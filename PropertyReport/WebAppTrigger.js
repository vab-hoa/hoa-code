/**
 * Async Report Trigger
 * Queues report generation via a short-lived time-based trigger.
 * This lets the web app return immediately without waiting for
 * the full report pipeline (which can take 60+ seconds).
 */

/**
 * Store a report job in ScriptProperties.
 *
 * @param {string} jobId - Unique job key
 * @param {Object} jobData - Job parameters
 */
function storeReportJob(jobId, jobData) {
  PropertiesService.getScriptProperties().setProperty(jobId, JSON.stringify(jobData));
}

/**
 * Create a one-minute time-based trigger that calls processReportAsync.
 * Returns the trigger's unique ID so it can be self-deleted on completion.
 *
 * @param {string} jobId - Job key stored in ScriptProperties
 * @return {string} Trigger unique ID
 */
function createReportTrigger(jobId) {
  var trigger = ScriptApp.newTrigger('processReportAsync')
    .timeBased()
    .after(60 * 1000)
    .create();
  // Store the trigger ID in the job so processReportAsync can delete it
  var props = PropertiesService.getScriptProperties();
  var jobData = JSON.parse(props.getProperty(jobId) || '{}');
  jobData.triggerId = trigger.getUniqueId();
  jobData.jobId = jobId;
  props.setProperty(jobId, JSON.stringify(jobData));
  return trigger.getUniqueId();
}

/**
 * Triggered ~1 minute after a report request is queued.
 * Finds the oldest pending job, runs the full report pipeline, then cleans up.
 */
function processReportAsync(e) {
  console.log('=== processReportAsync fired ===');
  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();

  // Find a pending report job
  var jobId = null;
  var jobData = null;
  for (var key in allProps) {
    if (key.indexOf('reportJob_') === 0) {
      try {
        jobData = JSON.parse(allProps[key]);
        jobId = key;
        break;
      } catch (parseErr) {
        console.error('Could not parse job ' + key + ': ' + parseErr);
        props.deleteProperty(key);
      }
    }
  }

  if (!jobId || !jobData) {
    console.log('No pending report job found — nothing to do');
    _cleanupStaleTriggers();
    return;
  }

  console.log('Processing job ' + jobId + ' for ' + jobData.standardizedAddress);

  // Delete the job from properties immediately to prevent double-processing
  props.deleteProperty(jobId);

  // Delete the trigger
  if (jobData.triggerId) {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getUniqueId() === jobData.triggerId) {
        ScriptApp.deleteTrigger(t);
        console.log('Deleted trigger ' + jobData.triggerId);
      }
    });
  }

  try {
    var reportData = gatherReportData(
      jobData.requestedByEmail,
      jobData.standardizedAddress,
      jobData.displayAddress,
      jobData.targetAddress
    );

    var sections = generateAllSections(
      jobData.standardizedAddress,
      jobData.displayAddress,
      reportData
    );

    sendPropertyReportEmail(jobData.recipientEmail, jobData.displayAddress, sections);

    // Notify manager if a board member requested a report for another address
    if (jobData.boardRequestForOther) {
      var managerMsg =
        'Board member ' + jobData.requestedByEmail + ' requested a property report for:\n\n' +
        '  ' + jobData.displayAddress + '\n\n' +
        'Report sent to: ' + jobData.recipientEmail;
      MailApp.sendEmail(
        'admin@villasboulders.org',
        'Board Report Request: ' + jobData.displayAddress,
        managerMsg
      );
      console.log('Manager notified of board report request');
    }

    console.log('Report job ' + jobId + ' completed successfully');
  } catch (err) {
    console.error('Report job ' + jobId + ' failed: ' + err.toString());
    notifyAdmin('Report generation failed for ' + jobData.displayAddress + ':\n\n' + err.toString());
  }
}

/**
 * Remove any orphaned processReportAsync triggers (safety net).
 */
function _cleanupStaleTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processReportAsync') {
      ScriptApp.deleteTrigger(t);
      console.log('Removed stale trigger: ' + t.getUniqueId());
    }
  });
}
