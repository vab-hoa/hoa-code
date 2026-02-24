/**
 * Wood Trim Assessment Project
 */

const WoodTrimProject = {
  id: 'woodtrim',
  name: 'Wood Trim Assessment',
  description: 'Wood trim condition assessment and repair recommendations',
  sortOrder: 2,
  
  /**
   * Check if this project is currently active
   */
  isActive: function() {
    return true;
  },
  
  /**
   * Get the spreadsheet ID for this project
   */
  getSpreadsheetId: function() {
    return '1K9OlpqGkrYzXGXjd2fssPmvPuCDE2YAqCNuXyu8JmoE';
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
      console.error('Error getting wood trim data: ' + error.toString());
      return {
        spreadsheetData: null,
        hasData: false,
        error: error.toString()
      };
    }
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
      body.appendParagraph('Data shown for entire building')
        .setFontSize(10)
        .setItalic(true);
      // Add implementation for wood trim data display
    } else {
      body.appendParagraph('No wood trim assessment records found.');
    }
  }
};