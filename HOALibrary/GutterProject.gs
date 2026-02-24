/**
 * Gutter Maintenance Project
 */

const GutterProject = {
  id: 'gutters',
  name: 'Gutter Maintenance',
  description: 'Gutter cleaning and maintenance records',
  sortOrder: 1,
  
  /**
   * Check if this project is currently active
   */
  isActive: function() {
    // Could check date ranges, config, etc.
    return true;
  },
  
  /**
   * Get the spreadsheet ID for this project
   */
  getSpreadsheetId: function() {
    return '10UiY9SiZLIAhyV85vBGQuHqeDxwNSu6NQEzlXfwoz_A';
  },
  
  /**
   * Get report data for a specific address
   * @param {string} standardizedAddress - The standardized address
   * @return {Object} Project data for the report
   */
  getReportData: function(standardizedAddress) {
    try {
      const data = getBuildingDataFromSheet(this.getSpreadsheetId(), standardizedAddress);
      return {
        spreadsheetData: data,
        hasData: data && data.rows && data.rows.length > 0
      };
    } catch (error) {
      console.error('Error getting gutter data: ' + error.toString());
      return {
        spreadsheetData: null,
        hasData: false,
        error: error.toString()
      };
    }
  },
  
  /**
   * Get folder images for this project
   * @param {string} standardizedAddress - The standardized address
   * @return {Object} Folder images data
   */
  getFolderImages: function(standardizedAddress) {
    // This functionality could be moved here from the main script
    return null; // Placeholder for now
  },
  
  /**
   * Format data for PDF inclusion
   * @param {Object} data - The project data
   * @param {DocumentApp.Body} body - The document body
   */
  appendToDocument: function(data, body) {
    body.appendParagraph(this.name)
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
    
    if (data.hasData) {
      // Add implementation for adding data to document
      body.appendParagraph('Gutter maintenance data available');
    } else {
      body.appendParagraph('No gutter maintenance records found.');
    }
  }
};