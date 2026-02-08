#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define source and target directories.
# INITIAL_DATA is the source directory containing initial data.
INITIAL_DATA="/var/initialdata/common"
# TARGET is the destination directory, typically mounted as a volume,
# where data will be copied. This variable is expected to be set
# as an environment variable in the Docker container, e.g., DATA_DIR_PATH.
TARGET="${DATA_DIR_PATH}/common"

echo "Starting entrypoint script."
echo "--------------------------------------------------"

# Check if the TARGET directory is set.
if [ -z "${TARGET}" ]; then
  echo "Error: TARGET directory (DATA_DIR_PATH) is not set."
  echo "Please ensure the DATA_DIR_PATH environment variable is defined."
  exit 1
fi

echo "Source directory for initial data: ${INITIAL_DATA}"
echo "Target directory for data: ${TARGET}"

# Check if the source directory exists.
if [ ! -d "${INITIAL_DATA}" ]; then
  echo "Warning: Initial data source directory '${INITIAL_DATA}' does not exist."
  echo "Skipping initial data copy operation."
else
  echo "Initial data source directory '${INITIAL_DATA}' found."
  echo "Checking if target directory '${TARGET}' exists and creating if necessary."

  # Create the target directory if it does not exist.
  mkdir -p "${TARGET}"
  if [ $? -eq 0 ]; then
    echo "Target directory '${TARGET}' ensured to exist."
  else
    echo "Error: Failed to create or ensure existence of target directory '${TARGET}'."
    exit 1
  fi

  echo "Initiating sync of initial data from '${INITIAL_DATA}' to '${TARGET}'."
  echo "This operation will sync directories and their contents recursively."
  echo "Files will be updated only if the source is newer (preserves manual changes)."

  # Sync contents from INITIAL_DATA to TARGET using rsync.
  # -a, --archive: recursive, preserve permissions, timestamps, symlinks, etc.
  # -v, --verbose: explain what is being done.
  # -u, --update: skip files that are newer in the destination.
  # Using -u for update-only behavior (copies new files, updates if source is newer).
  rsync -avu "${INITIAL_DATA}/" "${TARGET}/"

  if [ $? -eq 0 ]; then
    echo "Initial data sync operation completed successfully."
  else
    echo "Warning: Initial data sync operation encountered issues. Check logs above for details."
  fi
fi

echo "--------------------------------------------------"
echo "Passing control to the application backend: /app/backend"

# Execute the main application backend.
# The 'exec' command replaces the current shell process with the specified command,
# ensuring that signals (like SIGTERM) are correctly passed to the application.
exec /app/backend
