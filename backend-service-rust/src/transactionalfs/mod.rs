use async_trait::async_trait;
use serde::Serialize;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tokio::fs;
use tokio::process::Command;

use crate::{
    exlogging::{self, log_event, LogLevel},
    utils::{safe_write, safety_check, SafeFsError},
};

#[derive(Error, Debug)]
pub enum TransactionalFsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Safety error: {0}")]
    SafetyError(#[from] SafeFsError),
    #[error("Git command error: {0}")]
    GitCommand(String),
    #[error("Path error: {0}")]
    Path(String),
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
        new_file_path_relative_to_root: &Path,
        git_message: &str,
    ) -> Result<(), TransactionalFsError>;

    /// Deletes a file and commits the deletion.
    ///
    /// # Arguments
    /// * `file_path_relative_to_root` - The path of the file relative to the `root_path`.
    /// * `git_message` - The Git commit message for the deletion.
    async fn delete_file(
        &self,
        file_path_relative_to_root: &Path,
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

pub struct GitTransactionalFs {
    root_path: PathBuf,
    author_email: String,
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
impl TransactionalFs for GitTransactionalFs {
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
        new_file_path_relative_to_root: &Path,
        git_message: &str,
    ) -> Result<(), TransactionalFsError> {
        log_event(
            LogLevel::Info,
            format!("Update file {:?}", new_file_path_relative_to_root),
            Some(self.author_email.as_str()),
        );
        let full_path = self.root_path.join(new_file_path_relative_to_root);

        // Ensure parent directories exist
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        safe_write(&self.root_path, &full_path, new_file_content).await?;

        // Perform Git operations
        self.perform_git_commit(git_message).await?;

        Ok(())
    }

    async fn delete_file(
        &self,
        file_path_relative_to_root: &Path,
        git_message: &str,
    ) -> Result<(), TransactionalFsError> {
        log_event(
            LogLevel::Info,
            format!("Delete file {:?}", file_path_relative_to_root),
            Some(self.author_email.as_str()),
        );
        let full_path = self.root_path.join(file_path_relative_to_root);

        if !full_path.exists() {
            return Err(TransactionalFsError::FileNotFound(full_path));
        }

        safety_check(&self.root_path, &full_path)?;
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

impl GitTransactionalFs {
    /// Creates a new `GitTransactionalFs` instance.
    ///
    /// # Arguments
    /// * `root_path` - The root directory of the Git repository.
    /// * `author_email` - The default email of the author for Git commits.
    pub async fn new(
        root_path: PathBuf,
        author_email: String,
    ) -> Result<Self, TransactionalFsError> {
        // Initialize Git if not already initialized
        if !root_path.join(".git").exists() {
            Self::run_git_command(&root_path, &["init"]).await?;
        }

        Ok(Self {
            root_path,
            author_email,
        })
    }

    // Helper function to run Git commands
    async fn run_git_command(cwd: &Path, args: &[&str]) -> Result<(), TransactionalFsError> {
        let output = Command::new("git")
            .current_dir(cwd)
            .args(args)
            .output()
            .await?;

        if !output.status.success() {
            return Err(TransactionalFsError::GitCommand(format!(
                "Failed to execute git command: {:?} in {:?}. Stderr: {}",
                args,
                cwd,
                String::from_utf8_lossy(&output.stderr)
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

// tests

#[cfg(test)]
mod tests {
    use super::*; // Import items from the parent module
    use tempfile::TempDir; // For creating temporary directories

    // Helper function to set up a clean test environment
    async fn setup_test_env() -> Result<(TempDir, GitTransactionalFs), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let root_path = temp_dir.path().to_path_buf();
        let author_email = "test@example.com".to_string();

        let fs_manager = GitTransactionalFs::new(root_path, author_email).await?;
        Ok((temp_dir, fs_manager))
    }

    #[tokio::test]
    async fn test_initial_write_and_list() -> Result<(), Box<dyn std::error::Error>> {
        let (_temp_dir, fs_manager) = setup_test_env().await?;

        let file_path = PathBuf::from("test_file.txt");
        let file_content = b"Hello, world!";
        let commit_message = "Initial commit: Add test_file.txt";

        fs_manager
            .write_file(file_content.to_vec(), &file_path, commit_message)
            .await?;

        let commits = fs_manager.list_commits().await?;
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].message, commit_message);
        assert_eq!(commits[0].author, "test@example.com");
        assert!(commits[0].hash.len() > 0); // Check if hash is not empty
        assert_eq!(commits[0].files, vec!["test_file.txt"]);

        // Verify file content on disk
        let actual_content = fs::read(fs_manager.root_path.join(&file_path)).await?;
        assert_eq!(actual_content, file_content);

        Ok(())
    }

    #[tokio::test]
    async fn test_update_file_and_list() -> Result<(), Box<dyn std::error::Error>> {
        let (_temp_dir, fs_manager) = setup_test_env().await?;

        let file_path = PathBuf::from("update_me.txt");
        let initial_content = b"Initial content";
        let updated_content = b"Updated content";

        fs_manager
            .write_file(initial_content.to_vec(), &file_path, "Initial write")
            .await?;
        fs_manager
            .write_file(updated_content.to_vec(), &file_path, "Update file")
            .await?;

        let commits = fs_manager.list_commits().await?;
        assert_eq!(commits.len(), 2);

        // Check the latest commit
        assert_eq!(commits[0].message, "Update file");
        assert_eq!(commits[0].files, vec!["update_me.txt"]);

        // Check the initial commit
        assert_eq!(commits[1].message, "Initial write");
        assert_eq!(commits[1].files, vec!["update_me.txt"]);

        // Verify file content on disk
        let actual_content = fs::read(fs_manager.root_path.join(&file_path)).await?;
        assert_eq!(actual_content, updated_content);

        Ok(())
    }

    #[tokio::test]
    async fn test_delete_file_and_list() -> Result<(), Box<dyn std::error::Error>> {
        let (_temp_dir, fs_manager) = setup_test_env().await?;

        let file_path = PathBuf::from("delete_me.txt");
        let file_content = b"Content to be deleted";

        fs_manager
            .write_file(file_content.to_vec(), &file_path, "Add file for deletion")
            .await?;
        assert!(fs_manager.root_path.join(&file_path).exists());

        fs_manager
            .delete_file(&file_path, "Delete the file")
            .await?;
        assert!(!fs_manager.root_path.join(&file_path).exists()); // File should no longer exist

        let commits = fs_manager.list_commits().await?;
        assert_eq!(commits.len(), 2);

        // The latest commit should be the deletion
        assert_eq!(commits[0].message, "Delete the file");
        // Git log --name-only for deletions shows the file name
        assert_eq!(commits[0].files, vec!["delete_me.txt"]);

        Ok(())
    }

    #[tokio::test]
    async fn test_delete_non_existent_file() -> Result<(), Box<dyn std::error::Error>> {
        let (_temp_dir, fs_manager) = setup_test_env().await?;

        let file_path = PathBuf::from("non_existent.txt");
        let result = fs_manager
            .delete_file(&file_path, "Try to delete non-existent")
            .await;

        match result {
            Err(TransactionalFsError::FileNotFound(_)) => assert!(true), // Expected error
            _ => panic!("Expected FileNotFound error, but got {:?}", result),
        }

        let commits = fs_manager.list_commits().await?;
        assert_eq!(commits.len(), 0); // No commit should have been made

        Ok(())
    }

    #[tokio::test]
    async fn test_revert_last_commit() -> Result<(), Box<dyn std::error::Error>> {
        let (_temp_dir, fs_manager) = setup_test_env().await?;

        let file_path = PathBuf::from("revert_test.txt");
        let initial_content = b"First version";
        let updated_content = b"Second version";

        fs_manager
            .write_file(initial_content.to_vec(), &file_path, "Initial commit")
            .await?;
        fs_manager
            .write_file(updated_content.to_vec(), &file_path, "Update commit")
            .await?;

        let commits_before_revert = fs_manager.list_commits().await?;
        assert_eq!(commits_before_revert.len(), 2);
        assert_eq!(
            fs::read(fs_manager.root_path.join(&file_path)).await?,
            updated_content
        );

        fs_manager.revert_last_commit().await?; // Revert the "Update commit"

        let commits_after_revert = fs_manager.list_commits().await?;
        assert_eq!(commits_after_revert.len(), 1); // Only "Initial commit" should remain
        assert_eq!(commits_after_revert[0].message, "Initial commit");

        // Verify file content is back to initial
        let actual_content = fs::read(fs_manager.root_path.join(&file_path)).await?;
        assert_eq!(actual_content, initial_content);

        Ok(())
    }

    #[tokio::test]
    async fn test_revert_specific_commit() -> Result<(), Box<dyn std::error::Error>> {
        let (_temp_dir, fs_manager) = setup_test_env().await?;

        let file1_path = PathBuf::from("file1.txt");
        let file2_path = PathBuf::from("file2.txt");

        fs_manager
            .write_file(b"content1".to_vec(), &file1_path, "Commit A: Add file1")
            .await?;
        fs_manager
            .write_file(b"content2".to_vec(), &file2_path, "Commit B: Add file2")
            .await?;
        fs_manager
            .write_file(
                b"content1_v2".to_vec(),
                &file1_path,
                "Commit C: Update file1",
            )
            .await?;

        let commits = fs_manager.list_commits().await?;
        assert_eq!(commits.len(), 3);

        // Find Commit B's hash (which added file2.txt)
        let commit_b_hash = commits
            .iter()
            .find(|c| c.message == "Commit B: Add file2")
            .map(|c| c.hash.clone())
            .expect("Commit B not found");

        // Revert Commit B
        fs_manager.revert_commit(&commit_b_hash).await?;

        // After reverting Commit B, file2.txt should be gone, but Commit C should still exist
        assert!(!fs_manager.root_path.join(&file2_path).exists());
        assert!(fs_manager.root_path.join(&file1_path).exists());
        assert_eq!(
            fs::read(fs_manager.root_path.join(&file1_path)).await?,
            b"content1_v2"
        );

        let commits_after_revert = fs_manager.list_commits().await?;
        assert_eq!(commits_after_revert.len(), 4); // Original 3 + 1 revert commit
        assert_eq!(
            commits_after_revert[0].message,
            format!("Revert \"Commit B: Add file2\"")
        );
        assert_eq!(commits_after_revert[0].files, vec!["file2.txt"]); // Revert commit undoes file2.txt addition

        Ok(())
    }

    #[tokio::test]
    async fn test_list_commits_empty_repo() -> Result<(), Box<dyn std::error::Error>> {
        let (_temp_dir, fs_manager) = setup_test_env().await?;

        let commits = fs_manager.list_commits().await?;
        assert_eq!(commits.len(), 0); // No commits yet

        Ok(())
    }

    #[tokio::test]
    async fn test_nested_directory_write() -> Result<(), Box<dyn std::error::Error>> {
        let (_temp_dir, fs_manager) = setup_test_env().await?;

        let file_path = PathBuf::from("dir1/dir2/nested_file.txt");
        let file_content = b"Nested content";
        let commit_message = "Add nested file";

        fs_manager
            .write_file(file_content.to_vec(), &file_path, commit_message)
            .await?;

        let commits = fs_manager.list_commits().await?;
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].message, commit_message);
        assert_eq!(commits[0].files, vec!["dir1/dir2/nested_file.txt"]);

        // Verify file content on disk
        let actual_content = fs::read(fs_manager.root_path.join(&file_path)).await?;
        assert_eq!(actual_content, file_content);

        Ok(())
    }
}
