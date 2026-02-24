/**
 * Property Report Configuration
 * Section-based report system - each section is a separate Google Doc in Drive
 */

const REPORT_CONFIG = {
  // Google Drive folder ID for storing generated section documents
  // Set this after running createReportsFolder() once
  reportsFolderId: '1PXMEJ4vTzvxzqeNHDqwVGJR53nU8O5nl',

  // Number of days before generated section docs are automatically deleted
  expiryDays: 10,

  // Active report sections - order determines email order
  // To add a new section: add entry here + create Section{Type}.gs with generateSection_{type}()
  sections: [
    {
      type: 'hoaAccount',
      label: 'HOA Account',
      active: true
    },
    {
      type: 'propertyActivity',
      label: 'Work Orders & Architectural Requests',
      active: true
    },
    {
      type: 'gutters',
      label: 'Fall 2025 Gutter Cleaning & Inspection',
      active: true
    },
    {
      type: 'woodTrim',
      label: 'January 2026 Wood Trim Rot Evaluation',
      active: true
    },
    // Future sections (set active: true when ready):
    // { type: 'concrete',    label: '2026 Concrete Evaluation',    active: false },
    // { type: 'windowWells', label: '2026 Window Well Evaluation', active: false },
  ]
};
