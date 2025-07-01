#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define source and target directories.
# INITIAL_DATA is the source directory containing initial data.
INITIAL_DATA="/var/initialdata"
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

  echo "Initiating copy of initial data from '${INITIAL_DATA}' to '${TARGET}'."
  echo "This operation will copy directories and their contents recursively."
  echo "Existing files and directories in '${TARGET}' will NOT be overwritten."

  # Copy contents from INITIAL_DATA to TARGET.
  # -a, --archive: copy recursively and preserve attributes (permissions, timestamps, etc.).
  # -n, --no-clobber: do not overwrite an existing file.
  # -v, --verbose: explain what is being done.
  cp -anv "${INITIAL_DATA}"/* "${TARGET}"/

  if [ $? -eq 0 ]; then
    echo "Initial data copy operation completed successfully."
  else
    echo "Warning: Initial data copy operation encountered issues. Check logs above for details."
  fi
fi

echo "--------------------------------------------------"
echo "Passing control to the application backend: /app/backend"

# Execute the main application backend.
# The 'exec' command replaces the current shell process with the specified command,
# ensuring that signals (like SIGTERM) are correctly passed to the application.
exec /app/backend
