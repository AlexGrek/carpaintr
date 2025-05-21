use tokio::process::Command;
use tokio::fs;
use std::path::{Path, PathBuf};
use async_trait::async_trait;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TransactionalFsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
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
}

pub struct GitTransactionalFs {
    root_path: PathBuf,
    author_email: String,
}

#[async_trait]
impl TransactionalFs for GitTransactionalFs {
    async fn write_file(
        &self,
        new_file_content: Vec<u8>,
        new_file_path_relative_to_root: &Path,
        git_message: &str,
    ) -> Result<(), TransactionalFsError> {
        let full_path = self.root_path.join(new_file_path_relative_to_root);

        // Ensure parent directories exist
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::write(&full_path, new_file_content).await?;

        // Perform Git operations
        self.perform_git_commit(git_message).await?;

        Ok(())
    }

    async fn delete_file(
        &self,
        file_path_relative_to_root: &Path,
        git_message: &str,
    ) -> Result<(), TransactionalFsError> {
        let full_path = self.root_path.join(file_path_relative_to_root);

        if !full_path.exists() {
            return Err(TransactionalFsError::FileNotFound(full_path));
        }

        fs::remove_file(&full_path).await?;

        // Perform Git operations
        self.perform_git_commit(git_message).await?;

        Ok(())
    }

    async fn revert_last_commit(&self) -> Result<(), TransactionalFsError> {
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
        // Check if .git directory exists
        if !self.root_path.join(".git").exists() {
            return Ok(()); // No Git repo, nothing to revert
        }

        // Check if the commit exists
        let output = Self::run_git_command_with_output(&self.root_path, &["cat-file", "-t", commit_hash]).await?;
        if output.trim() != "commit" {
            return Err(TransactionalFsError::CommitNotFound(commit_hash.to_string()));
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
        let output = Self::run_git_command_with_output(
            &self.root_path,
            &["log", "--pretty=format:%H%n%an%n%s", "--name-only"]
        ).await?;

        let mut commits = Vec::new();
        let mut lines = output.lines().peekable();

        while let Some(hash) = lines.next() {
            let author = lines.next().ok_or_else(|| TransactionalFsError::GitLogParseError("missing author".to_string()))?;
            let message = lines.next().ok_or_else(|| TransactionalFsError::GitLogParseError("missing message".to_string()))?;

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
    pub async fn new(root_path: PathBuf, author_email: String) -> Result<Self, TransactionalFsError> {
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
    async fn run_git_command(
        cwd: &Path,
        args: &[&str],
    ) -> Result<(), TransactionalFsError> {
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

    // Helper function to run Git commands and capture stdout
    async fn run_git_command_with_output(
        cwd: &Path,
        args: &[&str],
    ) -> Result<String, TransactionalFsError> {
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
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    // Encapsulates the common git commit logic
    async fn perform_git_commit(&self, git_message: &str) -> Result<(), TransactionalFsError> {
        // Set user email and name for the commit
        Self::run_git_command(&self.root_path, &["config", "user.email", &self.author_email]).await?;
        Self::run_git_command(&self.root_path, &["config", "user.name", &self.author_email]).await?; // Name is also email as per requirement

        // Add all changes to staging
        Self::run_git_command(&self.root_path, &["add", "."]).await?;

        // Commit the changes
        Self::run_git_command(&self.root_path, &["commit", "-m", git_message]).await?;
        Ok(())
    }
}