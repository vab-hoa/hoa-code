/**
 * Web App Entry Point
 * Uses redirect-based OAuth to identify users while running with admin permissions.
 *
 * Deploy as:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * This approach uses server-side OAuth redirect flow (not client-side GIS)
 * to avoid the googleusercontent.com origin restriction.
 */

// OAuth Configuration
var OAUTH_CONFIG = {
  clientId: '527585908490-r4vvrctanip4lv39v7bgj9m28ksom342.apps.googleusercontent.com',
  clientSecret: '[REDACTED-EXPOSED-SECRET]',
  scopes: 'email profile'
};

// Always returns the URL of the current deployment — never gets out of sync.
function getRedirectUri() {
  return ScriptApp.getService().getUrl();
}

/**
 * Main entry point for the web app.
 */
function doGet(e) {
  var params = e.parameter || {};

  // Check if this is an OAuth callback
  if (params.code) {
    return handleOAuthCallback(params.code, params.state);
  }

  // Check if user has a valid session
  var userEmail = getUserFromSession();

  if (!userEmail) {
    // No session - show sign-in page with link
    var redirectUri = getRedirectUri();
    var state = Utilities.getUuid();
    CacheService.getUserCache().put('oauth_state_' + state, 'pending', 3600); // 1 hour

    var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
      'client_id=' + encodeURIComponent(OAUTH_CONFIG.clientId) +
      '&redirect_uri=' + encodeURIComponent(redirectUri) +
      '&response_type=code' +
      '&scope=' + encodeURIComponent(OAUTH_CONFIG.scopes) +
      '&state=' + encodeURIComponent(state) +
      '&access_type=online' +
      '&prompt=select_account';

    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head></head>' +
      '<body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">' +
      '<div style="max-width:400px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">' +
      '<h2 style="color:#1a3c5e;margin-bottom:20px;">Property Report Request</h2>' +
      '<p style="color:#666;margin-bottom:24px;">Sign in with your Google account to continue.</p>' +
      '<a href="' + authUrl + '" target="_blank" style="display:inline-block;background:#1a73e8;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600;">Sign in with Google</a>' +
      '<p style="margin-top:16px;font-size:12px;color:#888;">(Opens in new tab)</p>' +
      '</div></body></html>'
    ).setTitle('Sign In - Property Report');
  }

  // User is authenticated - show the app
  var role = getUserRole(userEmail);
  var authorized = (role !== 'none');

  var template = HtmlService.createTemplateFromFile('WebApp');
  template.userEmail = userEmail;
  template.userRole = role;
  template.authorized = authorized;

  return template.evaluate()
    .setTitle('Villas at the Boulders — Property Report')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Start the OAuth authorization flow by redirecting to Google.
 */
function startOAuthFlow() {
  var state = Utilities.getUuid();
  var redirectUri = getRedirectUri();

  // Store state for CSRF protection
  CacheService.getUserCache().put('oauth_state_' + state, 'pending', 3600); // 1 hour

  var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    'client_id=' + encodeURIComponent(OAUTH_CONFIG.clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(OAUTH_CONFIG.scopes) +
    '&state=' + encodeURIComponent(state) +
    '&access_type=online' +
    '&prompt=select_account';

  // Return a page that redirects to Google OAuth
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head>' +
    '<meta http-equiv="refresh" content="0;url=' + authUrl + '">' +
    '</head><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">' +
    '<p>Redirecting to Google Sign-In...</p>' +
    '<p><a href="' + authUrl + '">Click here if not redirected</a></p>' +
    '</body></html>'
  ).setTitle('Signing In...');
}

/**
 * Handle the OAuth callback from Google.
 */
function handleOAuthCallback(code, state) {
  try {
    // Verify state for CSRF protection
    var cache = CacheService.getUserCache();
    var storedState = cache.get('oauth_state_' + state);

    if (!storedState) {
      // State expired or missing - restart OAuth flow instead of showing error
      return startOAuthFlow();
    }
    cache.remove('oauth_state_' + state);

    // Exchange code for tokens
    var redirectUri = getRedirectUri();
    var tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        code: code,
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      },
      muteHttpExceptions: true
    });

    var responseCode = tokenResponse.getResponseCode();
    var responseText = tokenResponse.getContentText();

    if (responseCode !== 200) {
      return showDebugError('Token exchange failed', 'HTTP ' + responseCode + '\n\nResponse:\n' + responseText);
    }

    var tokenData = JSON.parse(responseText);

    if (tokenData.error) {
      return showDebugError('Token error', 'Error: ' + tokenData.error + '\nDescription: ' + tokenData.error_description);
    }

    // Get user info from the ID token
    var idToken = tokenData.id_token;
    if (!idToken) {
      return showDebugError('No ID token', 'Token response:\n' + JSON.stringify(tokenData, null, 2));
    }

    var userInfo = parseIdToken(idToken);

    if (!userInfo || !userInfo.email) {
      return showDebugError('No email in token', 'User info:\n' + JSON.stringify(userInfo, null, 2));
    }

    // Store user email in session
    setUserSession(userInfo.email);

    // Show success with manual link (avoid auto-redirect issues)
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head></head>' +
      '<body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">' +
      '<h2 style="color:#2e7d32;">Sign-in Successful!</h2>' +
      '<p>Signed in as: <strong>' + userInfo.email + '</strong></p>' +
      '<p style="margin-top:20px;"><a href="' + getRedirectUri() + '" style="background:#1a73e8;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Continue to App</a></p>' +
      '</body></html>'
    ).setTitle('Success');

  } catch (err) {
    return showDebugError('Exception', err.toString() + '\n\nStack:\n' + err.stack);
  }
}

/**
 * Show detailed error for debugging.
 */
function showDebugError(title, details) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head></head>' +
    '<body style="font-family:Arial,sans-serif;padding:40px;">' +
    '<h2 style="color:#c62828;">Error: ' + title + '</h2>' +
    '<pre style="background:#f5f5f5;padding:16px;border-radius:4px;overflow:auto;white-space:pre-wrap;">' + details + '</pre>' +
    '</body></html>'
  ).setTitle('Error');
}

/**
 * Parse a JWT ID token to extract user info.
 */
function parseIdToken(idToken) {
  try {
    var parts = idToken.split('.');
    if (parts.length !== 3) return null;

    var payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString();
    return JSON.parse(payload);
  } catch (e) {
    console.error('Error parsing ID token: ' + e.toString());
    return null;
  }
}

/**
 * Store user email in session (using UserCache with a session token).
 */
function setUserSession(email) {
  var sessionId = Utilities.getUuid();
  var cache = CacheService.getUserCache();

  // Store session for 6 hours
  cache.put('user_session', JSON.stringify({
    email: email,
    created: Date.now()
  }), 21600);
}

/**
 * Get user email from session.
 */
function getUserFromSession() {
  try {
    var cache = CacheService.getUserCache();
    var sessionData = cache.get('user_session');

    if (!sessionData) return null;

    var session = JSON.parse(sessionData);

    // Check if session is still valid (6 hour max)
    if (Date.now() - session.created > 21600000) {
      cache.remove('user_session');
      return null;
    }

    return session.email;
  } catch (e) {
    return null;
  }
}

/**
 * Show an error page.
 */
function showError(message) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head></head>' +
    '<body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">' +
    '<h2 style="color:#c62828;">Error</h2>' +
    '<p>' + message + '</p>' +
    '<p><a href="' + getRedirectUri() + '">Try again</a></p>' +
    '</body></html>'
  ).setTitle('Error');
}

/**
 * Process a report request submitted from the web app.
 */
function processReportRequest(params) {
  try {
    // Get user email from session
    var email = getUserFromSession();
    if (!email) {
      return { success: false, error: 'Session expired. Please refresh the page.' };
    }

    // Check authorization server-side
    var role = getUserRole(email);
    if (role === 'none') {
      return { success: false, error: 'You are not authorized to request reports.' };
    }

    var targetAddress;
    var recipientEmail = email;
    var boardRequestForOther = false;

    if (role === 'board' && params.targetAddress && params.targetAddress.trim() !== '') {
      targetAddress = params.targetAddress.trim();
      boardRequestForOther = true;
      if (params.sendTo && params.sendTo.trim() !== '') {
        recipientEmail = params.sendTo.trim();
      }
    } else {
      var homeowner = HOALibrary.getHomeownerFromEmail(email);
      if (!homeowner || !homeowner.address) {
        return {
          success: false,
          error: 'Could not find a property address linked to your account. ' +
                 'Please contact manager@villasboulders.org.'
        };
      }
      targetAddress = homeowner.address;
    }

    var standardizedAddress = HOALibrary.standardizeHOAAddress(targetAddress);
    if (!standardizedAddress) {
      return {
        success: false,
        error: 'Address "' + targetAddress + '" could not be recognized. ' +
               'Use the format: 13738 Rock Point Unit 101'
      };
    }

    var displayAddress = HOALibrary.getDisplayAddress
      ? HOALibrary.getDisplayAddress(standardizedAddress)
      : targetAddress;

    var jobId = 'reportJob_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    storeReportJob(jobId, {
      recipientEmail: recipientEmail,
      requestedByEmail: email,
      targetAddress: targetAddress,
      standardizedAddress: standardizedAddress,
      displayAddress: displayAddress,
      role: role,
      boardRequestForOther: boardRequestForOther,
      timestamp: new Date().toISOString()
    });
    createReportTrigger(jobId);

    var msg = 'Your report for ' + displayAddress + ' is being generated. ' +
              'It will be sent to ' + recipientEmail + ' within a few minutes.';
    return { success: true, message: msg };
  } catch (e) {
    console.error('Error in processReportRequest: ' + e.toString());
    return { success: false, error: 'An error occurred. Please try again or contact manager@villasboulders.org.' };
  }
}

/**
 * Clear the user's session (sign out).
 */
function signOut() {
  CacheService.getUserCache().remove('user_session');
  return { success: true };
}
