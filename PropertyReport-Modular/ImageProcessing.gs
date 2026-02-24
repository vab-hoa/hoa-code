/**
 * Image Processing Module
 *
 * Handles image URL conversion and format conversion for the Property Report system.
 *
 * Functions:
 * - convertDriveUrl(): Converts Google Drive viewing URLs to direct download URLs
 * - convertHeifToJpeg(): Converts HEIF/HEIC images to JPEG format for compatibility
 *
 * Note: HEIF (High Efficiency Image Format) is used by iOS devices but not
 * supported by Google Docs, so conversion to JPEG is necessary.
 */

/**
 * Convert Google Drive viewing URL to direct download URL
 * @param {string} url - The Google Drive URL
 * @return {string} - Direct download URL
 */
function convertDriveUrl(url) {
  if (!url || typeof url !== 'string') return url;

  // Pattern for drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    const fileId = fileMatch[1];
    const directUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    return directUrl;
  }

  // Pattern for drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    const fileId = openMatch[1];
    const directUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    return directUrl;
  }

  return url;
}

/**
 * Convert HEIF images to JPEG
 * @param {Blob} blob - The image blob to check and convert
 * @param {string} filename - Original filename for logging
 * @returns {Blob} - Either the original blob or converted JPEG
 */
function convertHeifToJpeg(blob, filename) {
  try {
    if (!blob) return null;

    var contentType = blob.getContentType();

    // Check if it's a HEIF image
    var isHeif = false;
    if (contentType && (
      contentType.includes('heif') ||
      contentType.includes('heic') ||
      contentType === 'image/heif' ||
      contentType === 'image/heic' ||
      contentType === 'image/heif-sequence' ||
      contentType === 'image/heic-sequence'
    )) {
      isHeif = true;
    }

    // Also check file extension
    if (!isHeif && filename) {
      var ext = filename.toLowerCase().split('.').pop();
      if (ext === 'heif' || ext === 'heic') {
        isHeif = true;
      }
    }

    if (!isHeif) {
      return blob;
    }

    console.log('Converting HEIF image: ' + filename);

    try {
      var convertedBlob = blob.getAs('image/jpeg');
      console.log('Successfully converted HEIF to JPEG');
      return convertedBlob;
    } catch (conversionError) {
      console.error('Failed to convert HEIF image: ' + conversionError.toString());
      return null;
    }

  } catch (error) {
    console.error('Error in HEIF conversion: ' + error.toString());
    return blob;
  }
}
