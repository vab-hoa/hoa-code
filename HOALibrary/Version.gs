/**
 * HOALibrary Version Information
 *
 * This file tracks the current version of HOALibrary.
 * Update this file when deploying new versions.
 */

/**
 * Get the current version of HOALibrary
 * @return {string} Version number in semantic versioning format (MAJOR.MINOR.PATCH)
 */
function getVersion() {
  return '5.0.0';
}

/**
 * Get detailed version information
 * @return {object} Version details including major features
 */
function getVersionInfo() {
  return {
    version: '5.0.0',
    releaseDate: '2026-02-15',
    description: 'Added Keystone Pacific integration',
    features: [
      'Address standardization (HOA format)',
      'Spreadsheet data retrieval (gutters, wood trim)',
      'Homeowner lookup and validation',
      'Keystone integration (profiles, violations, work orders, arch reviews)'
    ],
    breaking: false,
    deprecated: []
  };
}

/**
 * Version history and changelog
 * Update this when making new releases
 */
var VERSION_HISTORY = [
  {
    version: '5.0.0',
    date: '2026-02-15',
    changes: [
      'Added KeystoneIntegration module with 4 new functions',
      'getKeystoneProfileData() - Account and contact information',
      'getKeystoneViolations() - Property violations',
      'getKeystoneWorkOrders() - Work order history',
      'getKeystoneArchReviews() - Architectural review requests'
    ],
    breaking: false
  },
  {
    version: '4.0.0',
    date: '2026-02-14',
    changes: [
      'Stable production release',
      'Address standardization',
      'Building vs unit address handling',
      'Spreadsheet utilities',
      'Homeowner lookup functions'
    ],
    breaking: false
  },
  {
    version: '3.0.0',
    date: '2026-02-12',
    changes: [
      'Added project registry system',
      'Gutter and wood trim project modules'
    ],
    breaking: false
  },
  {
    version: '2.0.0',
    date: '2026-02-10',
    changes: [
      'Refactored into multiple modules',
      'Improved address parsing'
    ],
    breaking: true
  },
  {
    version: '1.0.0',
    date: '2026-02-08',
    changes: [
      'Initial release',
      'Basic address standardization'
    ],
    breaking: false
  }
];

/**
 * Check if library version is compatible with required version
 * @param {string} requiredVersion - Minimum required version
 * @return {boolean} True if current version meets requirement
 */
function isCompatibleWith(requiredVersion) {
  var current = getVersion().split('.').map(Number);
  var required = requiredVersion.split('.').map(Number);

  // Major version must match
  if (current[0] !== required[0]) {
    return current[0] > required[0];
  }

  // Minor version must be >= required
  if (current[1] < required[1]) {
    return false;
  }

  // Patch version doesn't matter for compatibility
  return true;
}

/**
 * Log version information to console
 * Useful for debugging and verifying correct version is loaded
 */
function logVersionInfo() {
  var info = getVersionInfo();
  console.log('=== HOALibrary Version Information ===');
  console.log('Version: ' + info.version);
  console.log('Released: ' + info.releaseDate);
  console.log('Description: ' + info.description);
  console.log('Features:');
  info.features.forEach(function(feature) {
    console.log('  - ' + feature);
  });
  console.log('=====================================');
}
