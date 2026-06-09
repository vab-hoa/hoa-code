/**
 * LinkMonitor — Nightly link checker for villasboulders.org
 *
 * Crawls the site, validates all links (Drive links via DriveApp, others via HTTP),
 * and emails admin@villasboulders.org when NEW broken links are found.
 *
 * State: known-broken URLs stored in Script Properties so they are suppressed
 * on future runs. When a previously broken link is fixed, it is automatically
 * removed from the suppression list.
 *
 * Setup (run once from the Apps Script editor):
 *   createTrigger()   — installs the nightly time trigger
 *
 * Utilities (run from editor as needed):
 *   showKnownBroken() — log the current suppression list
 *   clearKnownBroken() — reset suppression list (next run re-alerts everything broken)
 */

const BASE_URL    = 'https://www.villasboulders.org';
const ALERT_EMAIL = 'admin@villasboulders.org';

const SKIP_PREFIXES = ['mailto:', 'tel:', 'javascript:', 'data:'];
const DRIVE_FILE_RE = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_OPEN_RE = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
const FETCH_OPTS    = {
  muteHttpExceptions: true,
  followRedirects: true,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HOA-LinkChecker/1.0)' },
};


// ── Main entry point ────────────────────────────────────────────────────────

function checkLinks() {
  Logger.log('Link check started for ' + BASE_URL);

  const { linkMap, pagesCrawled } = crawlSite();
  Logger.log('Pages crawled: ' + pagesCrawled + ', unique links: ' + Object.keys(linkMap).length);

  const broken = [];
  for (const url in linkMap) {
    const status = checkUrl(url);
    if (isBroken(status)) {
      broken.push({ url: url, status: status, pages: linkMap[url] });
    }
  }
  Logger.log('Broken: ' + broken.length);

  const props      = PropertiesService.getScriptProperties();
  const knownSet   = new Set(JSON.parse(props.getProperty('knownBroken') || '[]'));
  const brokenUrls = new Set(broken.map(function(b) { return b.url; }));

  const newBroken  = broken.filter(function(b) { return !knownSet.has(b.url); });
  const nowFixed   = [...knownSet].filter(function(url) { return !brokenUrls.has(url); });

  // Update suppression list: add newly broken, remove fixed ones
  newBroken.forEach(function(b) { knownSet.add(b.url); });
  nowFixed.forEach(function(url) { knownSet.delete(url); });
  props.setProperty('knownBroken', JSON.stringify([...knownSet]));

  if (newBroken.length > 0) {
    Logger.log('Sending alert for ' + newBroken.length + ' new broken link(s)');
    sendAlert(newBroken, broken.length, pagesCrawled, Object.keys(linkMap).length);
  }

  if (nowFixed.length > 0) {
    Logger.log('Removed ' + nowFixed.length + ' fixed link(s) from suppression list');
  }

  Logger.log('Done. New broken: ' + newBroken.length +
             ', total broken: ' + broken.length +
             ', newly fixed: ' + nowFixed.length);
}


// ── Crawler ─────────────────────────────────────────────────────────────────

function crawlSite() {
  const visited  = new Set();
  const toVisit  = [BASE_URL];
  const linkMap  = {};  // url -> [page, page, ...]
  let pagesCrawled = 0;

  while (toVisit.length > 0) {
    const url  = toVisit.pop();
    const norm = normalizeUrl(url);
    if (!norm || visited.has(norm)) continue;
    visited.add(norm);

    let response;
    try {
      response = UrlFetchApp.fetch(url, FETCH_OPTS);
    } catch (e) {
      Logger.log('Fetch error on ' + url + ': ' + e);
      continue;
    }

    if (response.getResponseCode() >= 400) continue;

    const ct = response.getHeaders()['Content-Type'] || '';
    if (ct.indexOf('html') === -1) continue;

    pagesCrawled++;
    const links = extractLinks(response.getContentText(), url);

    links.forEach(function(link) {
      const n = normalizeUrl(link);
      if (!n) return;
      if (!linkMap[n]) linkMap[n] = [];
      if (linkMap[n].indexOf(url) === -1) linkMap[n].push(url);
      if (isInternal(link) && !visited.has(n)) toVisit.push(link);
    });
  }

  return { linkMap: linkMap, pagesCrawled: pagesCrawled };
}

function extractLinks(html, pageUrl) {
  const links = [];
  const re    = /(?:href|src)=["']([^"'#][^"']*)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    if (SKIP_PREFIXES.some(function(p) { return raw.indexOf(p) === 0; })) continue;
    const abs = makeAbsolute(raw, pageUrl);
    if (abs) links.push(abs);
  }
  return links;
}


// ── Link checker ─────────────────────────────────────────────────────────────

function checkUrl(url) {
  const driveId = extractDriveId(url);
  if (driveId) {
    try {
      const file = DriveApp.getFileById(driveId);
      return file.isTrashed() ? 'trashed' : 200;
    } catch (e) {
      return 404;
    }
  }

  try {
    let resp = UrlFetchApp.fetch(url, Object.assign({ method: 'head' }, FETCH_OPTS));
    // Some servers reject HEAD — retry with GET
    if (resp.getResponseCode() === 405) {
      resp = UrlFetchApp.fetch(url, FETCH_OPTS);
    }
    return resp.getResponseCode();
  } catch (e) {
    return String(e);
  }
}

function isBroken(status) {
  if (status === 'trashed') return true;
  if (typeof status === 'number') return status >= 400;
  return true;  // exception string
}

function extractDriveId(url) {
  let m = url.match(DRIVE_FILE_RE);
  if (m) return m[1];
  m = url.match(DRIVE_OPEN_RE);
  return m ? m[1] : null;
}


// ── URL utilities ─────────────────────────────────────────────────────────────

function isInternal(url) {
  return url.indexOf(BASE_URL) === 0 || url.charAt(0) === '/';
}

function normalizeUrl(url) {
  if (!url) return '';
  url = url.split('#')[0];
  if (url !== BASE_URL && url !== BASE_URL + '/' && url.slice(-1) === '/') {
    url = url.slice(0, -1);
  }
  return url;
}

function makeAbsolute(url, base) {
  if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return url;
  if (url.indexOf('//') === 0) return 'https:' + url;
  if (url.charAt(0) === '/') return BASE_URL + url;
  // Relative path — resolve against base directory
  const dir = base.replace(/\/[^\/]*$/, '/');
  return dir + url;
}


// ── Email ─────────────────────────────────────────────────────────────────────

function sendAlert(newBroken, totalBroken, pagesCrawled, linksChecked) {
  const subject = 'villasboulders.org: ' + newBroken.length + ' NEW broken link(s) found';

  const lines = [
    'Link monitor report for villasboulders.org',
    'Pages crawled: ' + pagesCrawled,
    'Total links checked: ' + linksChecked,
    'Total broken (including previously known): ' + totalBroken,
    '',
    newBroken.length + ' NEW broken link(s):',
    '',
  ];

  newBroken.forEach(function(b) {
    lines.push('  ' + b.url);
    lines.push('    Status: ' + b.status);
    b.pages.forEach(function(page) {
      lines.push('    Found on: ' + page);
    });
    lines.push('');
  });

  lines.push('Previously known broken links are suppressed. To reset the suppression');
  lines.push('list, run clearKnownBroken() in the Apps Script editor for this project.');

  GmailApp.sendEmail(ALERT_EMAIL, subject, lines.join('\n'));
}


// ── Setup and utilities ───────────────────────────────────────────────────────

function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'checkLinks') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkLinks')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
  Logger.log('Trigger created: checkLinks runs daily at ~3 AM Mountain time');
}

function showKnownBroken() {
  const known = JSON.parse(
    PropertiesService.getScriptProperties().getProperty('knownBroken') || '[]'
  );
  Logger.log('Known broken (' + known.length + '):\n' + known.join('\n'));
}

function clearKnownBroken() {
  PropertiesService.getScriptProperties().deleteProperty('knownBroken');
  Logger.log('Suppression list cleared. Next run will alert on all broken links.');
}
