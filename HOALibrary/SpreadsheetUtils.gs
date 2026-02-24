/**
 * Spreadsheet Utility Functions
 * Building-aware data retrieval from spreadsheets
 */


/**
 * Get all data for a building from a spreadsheet
 * Handles unit requests by returning all building data
 * Now also extracts hyperlink URLs from cells
 * 
 * @param {string} sheetId - The Google Sheet ID
 * @param {string} address - The address to search for (any format)
 * @return {object} - {headers: [], rows: [][], sheetUrl: string}
 */
function getBuildingDataFromSheet(sheetId, address) {
  if (!sheetId || !address) {
    console.log('getBuildingDataFromSheet: Missing required parameters');
    return null;
  }
  
  const buildingAddress = getBuildingAddress(address);
  console.log('Looking for building data: ' + buildingAddress);
  
  try {
    const sheet = SpreadsheetApp.openById(sheetId);
    const dataRange = sheet.getActiveSheet().getDataRange();
    const values = dataRange.getValues();
    
    if (!values || values.length < 2) {
      console.log('Sheet has no data');
      return null;
    }
    
    const headers = values[0];
    
    // Find address column
    const addressCol = headers.findIndex(function(h) {
      const header = h.toString().toLowerCase();
      return header.includes('address') || header.includes('property') || header.includes('unit');
    });
    
    if (addressCol === -1) {
      console.log('No address column found');
      return null;
    }
    
    // Get rich text values for hyperlink extraction
    const richTextValues = dataRange.getRichTextValues();
    
    // Find all rows for this building
    const buildingRows = [];
    for (let i = 1; i < values.length; i++) {
      const rowAddress = values[i][addressCol];
      if (!rowAddress) continue;
      
      const rowBuilding = getBuildingAddress(rowAddress.toString());
      
      if (rowBuilding === buildingAddress) {
        // Process the row, extracting hyperlink URLs where present
        const processedRow = [];
        for (let j = 0; j < values[i].length; j++) {
          let cellValue = values[i][j];
          
          // Check if this cell has a hyperlink
          if (richTextValues && richTextValues[i] && richTextValues[i][j]) {
            const richText = richTextValues[i][j];
            const linkUrl = richText.getLinkUrl();
            if (linkUrl) {
              // Replace the display text with the actual URL
              cellValue = linkUrl;
            }
          }
          
          processedRow.push(cellValue);
        }
        buildingRows.push(processedRow);
      }
    }
    
    if (buildingRows.length === 0) {
      console.log('No data found for building: ' + buildingAddress);
      return null;
    }
    
    console.log('Found ' + buildingRows.length + ' rows for building: ' + buildingAddress);
    
    return {
      headers: headers,
      rows: buildingRows,
      sheetUrl: sheet.getUrl()
    };
    
  } catch (error) {
    console.error('Error in getBuildingDataFromSheet: ' + error.toString());
    return null;
  }
}


/**
 * Test the standardization function
 */