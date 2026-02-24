/**
 * Utilities Module
 *
 * Contains helper functions used throughout the Property Report system.
 *
 * Functions:
 * - findFolderOrShortcut(): Finds folders in Google Drive, handling both
 *   regular folders and shortcuts to folders. This is important because
 *   some shared folders may appear as shortcuts in the script's Drive view.
 */

/**
 * Get all image files from a folder
 * @param {Folder} folder - The Google Drive folder
 * @return {Array} - Array of {name: string, url: string} objects
 */


/**
 * Find a folder by name, handling both regular folders and shortcuts
 * @param {string} folderName - The folder name to search for
 * @param {Folder} parentFolder - Optional parent folder to search within
 * @return {Folder|null} - The folder or null if not found
 */
/**
 * Find a folder by name, handling both regular folders and shortcuts
 * @param {string} folderName - The folder name to search for
 * @param {Folder} parentFolder - Optional parent folder to search within
 * @return {Folder|null} - The folder or null if not found
 */
function findFolderOrShortcut(folderName, parentFolder) {
  try {
    // First try regular folder
    if (parentFolder) {
      const folders = parentFolder.getFoldersByName(folderName);
      if (folders.hasNext()) {
        console.log('Found folder: ' + folderName);
        return folders.next();
      }
    } else {
      const folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        console.log('Found folder: ' + folderName);
        return folders.next();
      }
    }

    // If not found, look for shortcuts by iterating through files
    console.log('Folder not found, checking for shortcuts named: ' + folderName);

    try {
      // Get all files in the parent folder (or root)
      const files = parentFolder ? parentFolder.getFiles() : DriveApp.getFiles();

      while (files.hasNext()) {
        const file = files.next();

        // Check if this is a shortcut with the right name
        if (file.getName() === folderName &&
            file.getMimeType() === 'application/vnd.google-apps.shortcut') {

          console.log('Found shortcut: ' + folderName);

          // For shortcuts to folders, we need to get the target
          try {
            // Get the shortcut's target ID
            const targetId = file.getTargetId();
            console.log('Shortcut target ID: ' + targetId);

            // Try to open as folder
            const targetFolder = DriveApp.getFolderById(targetId);
            console.log('Successfully opened target folder');
            return targetFolder;

          } catch (e) {
            console.log('Could not open shortcut target as folder: ' + e.toString());
          }
        }
      }

    } catch (iterError) {
      console.log('Error iterating files: ' + iterError.toString());
    }

    console.log('Neither folder nor shortcut found for: ' + folderName);
    return null;

  } catch (error) {
    console.error('Error in findFolderOrShortcut: ' + error.toString());
    return null;
  }
}
