use async_trait::async_trait;
use serde::Serialize;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tokio::fs;
use tokio::process::Command;

use crate::{
    exlogging::{log_event, LogLevel},
    utils::{safe_write, safety_check, DataStorageCache, SafeFsError},
};

#[derive(Error, Debug)]
pub enum TransactionalFsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Safety error: {0}")]
    SafetyError(#[from] SafeFsError),
    #[error("Git command error: {0}")]
    GitCommand(String),
    #[error("Commit not found: {0}")]
    CommitNotFound(String),
    #[error("Failed to parse git log output: {0}")]
    GitLogParseError(String),
    #[error("File not found: {0}")]
    FileNotFound(PathBuf),
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize)]
pub enum FsEntry {
    File {
        name: String,
    },
    Directory {
        name: String,
        children: Vec<FsEntry>,
    },
}

#[derive(Debug, PartialEq, Eq, Clone, Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub author: String,
    pub message: String,
    pub files: Vec<String>,
}

#[async_trait]
pub trait TransactionalFs {
    /// Writes a new file or updates an existing one, and commits the change.
    ///
    /// # Arguments
    /// * `new_file_content` - The content of the file.
    /// * `new_file_path_relative_to_root` - The path of the file relative to the `root_path`.
    /// * `git_message` - The Git commit message.
    async fn write_file(
        &self,
        new_file_content: Vec<u8>,
        new_file_path_relative_to_root: &PathBuf,
        git_message: &str,
    ) -> Result<(), TransactionalFsError>;

    /// Deletes a file and commits the deletion.
    ///
    /// # Arguments
    /// * `file_path_relative_to_root` - The path of the file relative to the `root_path`.
    /// * `git_message` - The Git commit message for the deletion.
    async fn delete_file(
        &self,
        file_path_relative_to_root: &PathBuf,
        git_message: &str,
    ) -> Result<(), TransactionalFsError>;

    /// Reverts the most recent Git commit.
    async fn revert_last_commit(&self) -> Result<(), TransactionalFsError>;

    /// Reverts a specific Git commit.
    ///
    /// # Arguments
    /// * `commit_hash` - The hash of the commit to revert.
    async fn revert_commit(&self, commit_hash: &str) -> Result<(), TransactionalFsError>;

    /// Lists all Git commits and their changed files.
    ///
    /// # Returns
    /// A vector of `CommitInfo` if Git is initialized, otherwise an empty vector.
    async fn list_commits(&self) -> Result<Vec<CommitInfo>, TransactionalFsError>;

    async fn list_files(&self) -> Result<FsEntry, TransactionalFsError>;
}

pub struct GitTransactionalFs<'a> {
    root_path: PathBuf,
    author_email: String,
    cache: &'a DataStorageCache,
}

pub async fn list_files_raw(path: &PathBuf) -> Result<FsEntry, TransactionalFsError> {
    let root_name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "/".to_string()); // Fallback for root if no name

    let children = GitTransactionalFs::walk_dir_recursive(&path).await?;

    Ok(FsEntry::Directory {
        name: root_name,
        children,
    })
}

#[async_trait]
impl<'a> TransactionalFs for GitTransactionalFs<'a> {
    // New implementation for list_files
    async fn list_files(&self) -> Result<FsEntry, TransactionalFsError> {
        let root_name = self
            .root_path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "/".to_string()); // Fallback for root if no name

        let children = Self::walk_dir_recursive(&self.root_path).await?;

        Ok(FsEntry::Directory {
            name: root_name,
            children,
        })
    }

    async fn write_file(
        &self,
        new_file_content: Vec<u8>,
        new_file_path_relative_to_root: &PathBuf,
        git_message: &str,
    ) -> Result<(), TransactionalFsError> {
        log_event(
            LogLevel::Info,
            format!("Update file {:?}", new_file_path_relative_to_root),
            Some(self.author_email.as_str()),
        );
        
        // The safe_write from utils now handles safety checks, directory creation, writing, and cache invalidation.
        safe_write(
            &self.root_path,
            new_file_path_relative_to_root,
            new_file_content,
            self.cache,
        )
        .await?;

        // Perform Git operations
        self.perform_git_commit(git_message).await?;

        Ok(())
    }

    async fn delete_file(
        &self,
        file_path_relative_to_root: &PathBuf,
        git_message: &str,
    ) -> Result<(), TransactionalFsError> {
        // log_event(
        //     LogLevel::Info,
        //     format!("Delete file {:?}", Path::from(file_path_relative_to_root.as_ref()).to_str()),
        //     Some(self.author_email.as_str()),
        // );
        let full_path = safety_check(&self.root_path, file_path_relative_to_root)?;

        if !full_path.exists() {
            return Err(TransactionalFsError::FileNotFound(full_path.clone()));
        }

        // Invalidate the cache before deleting the file.
        self.cache.invalidate(&full_path).await;
        fs::remove_file(&full_path).await?;

        // Perform Git operations
        self.perform_git_commit(git_message).await?;

        Ok(())
    }

    async fn revert_last_commit(&self) -> Result<(), TransactionalFsError> {
        log_event(
            LogLevel::Info,
            format!("Revert last request at {:?}", &self.root_path),
            Some(self.author_email.as_str()),
        );
        // Check if .git directory exists
        if !self.root_path.join(".git").exists() {
            return Ok(()); // No Git repo, nothing to revert
        }

        // Revert the last commit using git reset --hard HEAD~1
        // This will discard local changes and move HEAD to the previous commit.
        // TODO: Invalidate cache for affected files
        Self::run_git_command(&self.root_path, &["reset", "--hard", "HEAD~1"]).await?;
        Ok(())
    }

    async fn revert_commit(&self, commit_hash: &str) -> Result<(), TransactionalFsError> {
        log_event(
            LogLevel::Info,
            format!("Revert {} request at {:?}", commit_hash, &self.root_path),
            Some(self.author_email.as_str()),
        );
        // Check if .git directory exists
        if !self.root_path.join(".git").exists() {
            return Ok(()); // No Git repo, nothing to revert
        }

        // Check if the commit exists
        let output =
            Self::run_git_command_with_output(&self.root_path, &["cat-file", "-t", commit_hash])
                .await?;
        if output.trim() != "commit" {
            return Err(TransactionalFsError::CommitNotFound(
                commit_hash.to_string(),
            ));
        }

        // Revert the specific commit using git revert
        // TODO: Invalidate cache for affected files
        Self::run_git_command(&self.root_path, &["revert", "--no-edit", commit_hash]).await?; // --no-edit to avoid interactive editor
        Ok(())
    }

    async fn list_commits(&self) -> Result<Vec<CommitInfo>, TransactionalFsError> {
        // Check if .git directory exists
        if !self.root_path.join(".git").exists() {
            return Ok(Vec::new()); // No Git repo, return empty list
        }

        // Get commit hashes, authors, and messages
        let output_option = Self::run_git_command_with_output_fallible(
            &self.root_path,
            &["log", "--pretty=format:%H%n%an%n%s", "--name-only"],
        )
        .await?;

        let output = match output_option {
            Some(s) => s,
            None => return Ok(Vec::new()), // No commits found, return empty list
        };

        let mut commits = Vec::new();
        let mut lines = output.lines().peekable();

        while let Some(hash) = lines.next() {
            let author = lines.next().ok_or_else(|| {
                TransactionalFsError::GitLogParseError("missing author".to_string())
            })?;
            let message = lines.next().ok_or_else(|| {
                TransactionalFsError::GitLogParseError("missing message".to_string())
            })?;

            // Skip empty line after message
            if lines.peek().map_or(false, |l| l.is_empty()) {
                lines.next();
            }

            let mut files = Vec::new();
            while let Some(file_line) = lines.peek() {
                if file_line.is_empty() {
                    lines.next(); // Consume empty line
                    break;
                }
                files.push(file_line.to_string());
                lines.next();
            }

            commits.push(CommitInfo {
                hash: hash.to_string(),
                author: author.to_string(),
                message: message.to_string(),
                files,
            });
        }
        Ok(commits)
    }
}

impl<'a> GitTransactionalFs<'a> {
    /// Creates a new `GitTransactionalFs` instance.
    ///
    /// # Arguments
    /// * `root_path` - The root directory of the Git repository.
    /// * `author_email` - The default email of the author for Git commits.
    /// * `cache` - A reference to the data storage cache.
    pub async fn new(
        root_path: PathBuf,
        author_email: String,
        cache: &'a DataStorageCache,
    ) -> Result<Self, TransactionalFsError> {
        // Initialize Git if not already initialized
        if !root_path.join(".git").exists() {
            Self::run_git_command(&root_path, &["init"]).await?;
        }

        Ok(Self {
            root_path,
            author_email,
            cache,
        })
    }

    // Helper function to run Git commands
    async fn run_git_command(cwd: &Path, args: &[&str]) -> Result<(), TransactionalFsError> {
        let output = Command::new("git")
            .current_dir(cwd)
            .args(args)
            .output()
            .await?;

        log_event(
            LogLevel::Trace,
            format!(
                "Git command with args {:?} returned stdout: {}, stderr: {}",
                args,
                String::from_utf8_lossy(&output.stderr),
                String::from_utf8_lossy(&output.stdout)
            ),
            None::<&str>,
        );

        if !output.status.success() {
            return Err(TransactionalFsError::GitCommand(format!(
                "Failed to execute git command: {:?} in {:?}. Stderr: {}, Stdout: {}",
                args,
                cwd,
                String::from_utf8_lossy(&output.stderr),
                String::from_utf8_lossy(&output.stdout)
            )));
        }
        Ok(())
    }

    #[async_recursion::async_recursion]
    async fn walk_dir_recursive(current_path: &Path) -> Result<Vec<FsEntry>, TransactionalFsError> {
        let mut children = Vec::new();
        let mut entries = fs::read_dir(current_path).await?;

        while let Some(entry) = entries.next_entry().await? {
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy().into_owned();

            // Skip the .git directory
            if name == ".git" {
                continue;
            }

            let file_type = entry.file_type().await?;

            if file_type.is_dir() {
                let dir_children = Self::walk_dir_recursive(&entry.path()).await?;
                children.push(FsEntry::Directory {
                    name,
                    children: dir_children,
                });
            } else if file_type.is_file() {
                children.push(FsEntry::File { name });
            }
            // Skip other types like symlinks for this example, or add specific handling
        }

        // Sort children alphabetically for consistent output
        children.sort_by(|a, b| {
            let name_a = match a {
                FsEntry::File { name, .. } | FsEntry::Directory { name, .. } => name,
            };
            let name_b = match b {
                FsEntry::File { name, .. } | FsEntry::Directory { name, .. } => name,
            };
            name_a.cmp(name_b)
        });

        Ok(children)
    }

    // Existing run_git_command_with_output, will now just call the fallible one
    async fn run_git_command_with_output(
        cwd: &Path,
        args: &[&str],
    ) -> Result<String, TransactionalFsError> {
        Self::run_git_command_with_output_fallible(cwd, args)
            .await?
            .ok_or_else(|| {
                TransactionalFsError::GitCommand(format!(
                    "Git command {:?} unexpectedly returned no output.",
                    args
                ))
            })
    }

    // Helper function to run Git commands and capture stdout
    // Modified to return an Option<String> for cases where the command might legitimately
    // exit with a non-zero status but we still want to process it (e.g., git log in empty repo)
    async fn run_git_command_with_output_fallible(
        cwd: &Path,
        args: &[&str],
    ) -> Result<Option<String>, TransactionalFsError> {
        let output = Command::new("git")
            .current_dir(cwd)
            .args(args)
            .output()
            .await?;

        if !output.status.success() {
            let stderr_str = String::from_utf8_lossy(&output.stderr);
            // Handle the specific "no commits" error for git log
            if args.contains(&"log")
                && stderr_str.contains("fatal: your current branch")
                && stderr_str.contains("does not have any commits yet")
            {
                return Ok(None); // Indicate no logs available
            }
            return Err(TransactionalFsError::GitCommand(format!(
                "Failed to execute git command: {:?} in {:?}. Stderr: {}",
                args, cwd, stderr_str
            )));
        }
        Ok(Some(
            String::from_utf8_lossy(&output.stdout).trim().to_string(),
        ))
    }

    // Encapsulates the common git commit logic
    async fn perform_git_commit(&self, git_message: &str) -> Result<(), TransactionalFsError> {
        // Set user email and name for the commit
        Self::run_git_command(
            &self.root_path,
            &["config", "user.email", &self.author_email],
        )
        .await?;
        Self::run_git_command(
            &self.root_path,
            &["config", "user.name", &self.author_email],
        )
        .await?; // Name is also email as per requirement

        // Add all changes to staging
        Self::run_git_command(&self.root_path, &["add", "."]).await?;

        // Commit the changes
        Self::run_git_command(&self.root_path, &["commit", "-m", git_message]).await?;
        Ok(())
    }
}
