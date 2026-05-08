// HOA Publisher Add-on
// Adds "HOA Tools → Publish final PDF to Homeowner Docs" to every Google Doc.
//
// DEPLOYMENT (one-time setup):
//   1. cd HOAPublisher && clasp create --title "HOA Publisher" --type standalone
//   2. clasp push
//   3. In Apps Script editor: Deploy → New deployment → Type: Add-on
//   4. Copy the deployment ID.
//   5. Admin Console → Apps → Google Workspace Marketplace apps →
//      Install app → paste deployment URL → install domain-wide.
//   After install, "HOA Tools" appears in the menu bar of every Google Doc.

var HOMEOWNER_DRIVE_ID = '0ALIbXXUEyG4GUk9PVA';
var BOARD_DRIVE_ID     = '0AExYZWmfRm9JUk9PVA';

// Maps keywords found in Board Docs folder path → Homeowner Docs folder name.
// Order matters: first match wins.
var FOLDER_MAP = [
  { pattern: 'ARC',                 destination: 'Governing Documents' },
  { pattern: 'Governing Documents', destination: 'Governing Documents' },
  { pattern: 'Policies',            destination: 'Policies' },
  { pattern: 'Budget',              destination: 'Budgets' },
  { pattern: 'Financials',          destination: 'Financials' },
  { pattern: 'Monthly Updates',     destination: 'Newsletters' },
  { pattern: 'Communications',      destination: 'Newsletters' },
  { pattern: 'Reserve Studies',     destination: 'Reserve Studies' },
  { pattern: 'Maps',                destination: 'Maps' },
  { pattern: 'Forms',               destination: 'Forms' },
  { pattern: 'Meetings',            destination: 'Meetings' },
];

// ── Add-on entry point ──────────────────────────────────────────────────────

function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('Publish final PDF to Homeowner Docs…', 'showPublishDialog')
    .addToUi();
}

// ── Dialog launcher ─────────────────────────────────────────────────────────

function showPublishDialog() {
  var doc  = DocumentApp.getActiveDocument();
  var file = DriveApp.getFileById(doc.getId());

  if (file.getMimeType() !== 'application/vnd.google-apps.document') {
    DocumentApp.getUi().alert(
      'HOA Tools — Cannot Publish',
      'This document is in Word (.docx) format and cannot be exported as PDF directly.\n\n' +
      'Option 1 — Convert first:\n' +
      '   File → Save as Google Docs, then run Publish again.\n\n' +
      'Option 2 — Manual method:\n' +
      '   File → Download → PDF Document (.pdf)\n' +
      '   Then upload via the → shortcut in Board Documents.',
      DocumentApp.getUi().ButtonSet.OK
    );
    return;
  }

  var suggested = suggestDestination(file);
  var folders   = getHomeownerFolders();

  var tpl = HtmlService.createTemplateFromFile('PublishDialog');
  tpl.docName     = doc.getName();
  tpl.suggested   = suggested ? suggested.name : '';
  tpl.suggestedId = suggested ? suggested.id   : '';
  tpl.folders     = folders;

  DocumentApp.getUi().showModalDialog(
    tpl.evaluate().setWidth(460).setHeight(295),
    'Publish to Homeowner Docs'
  );
}

// ── Called from dialog via google.script.run ────────────────────────────────

function doPublish(targetFolderId, pdfName) {
  var doc    = DocumentApp.getActiveDocument();
  var file   = DriveApp.getFileById(doc.getId());
  var blob   = file.getAs('application/pdf');
  var name   = pdfName.match(/\.pdf$/i) ? pdfName : pdfName + '.pdf';
  blob.setName(name);
  var created = DriveApp.getFolderById(targetFolderId).createFile(blob);
  return created.getName();
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function suggestDestination(file) {
  // Walk up parent folders to build a path string, stop at Board Docs root.
  var path = [];
  try {
    var current = file;
    for (var depth = 0; depth < 10; depth++) {
      var parents = current.getParents();
      if (!parents.hasNext()) break;
      var parent = parents.next();
      if (parent.getId() === BOARD_DRIVE_ID) break;
      path.unshift(parent.getName());
      current = parent;
    }
  } catch (e) {
    return null;
  }
  var pathStr = path.join('/');
  for (var i = 0; i < FOLDER_MAP.length; i++) {
    if (pathStr.indexOf(FOLDER_MAP[i].pattern) !== -1) {
      return findHomeownerFolder(FOLDER_MAP[i].destination);
    }
  }
  return null;
}

function getHomeownerFolders() {
  var root    = DriveApp.getFolderById(HOMEOWNER_DRIVE_ID);
  var iter    = root.getFolders();
  var folders = [];
  while (iter.hasNext()) {
    var f = iter.next();
    folders.push({ id: f.getId(), name: f.getName() });
  }
  folders.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return folders;
}

function findHomeownerFolder(name) {
  var root = DriveApp.getFolderById(HOMEOWNER_DRIVE_ID);
  var iter = root.getFoldersByName(name);
  return iter.hasNext() ? { id: iter.next().getId(), name: name } : null;
}
