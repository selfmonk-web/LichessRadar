// LichessRadar — background.js

var ALARM_PREFIX = 'lrt_';

// ── Listen for alarms ────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name.indexOf(ALARM_PREFIX) !== 0) return;

  var withoutPrefix = alarm.name.slice(ALARM_PREFIX.length);
  var lastUnderscore = withoutPrefix.lastIndexOf('_');
  var id = withoutPrefix.slice(0, lastUnderscore);
  var label = withoutPrefix.slice(lastUnderscore + 1);

  chrome.storage.local.get('tournaments', function(result) {
    var tournaments = result.tournaments || [];
    var t = tournaments.find(function(x) { return x.id === id; });
    if (!t) return;

    var labelMap = {
      'start': '🏁 Starting now!',
      '30min': '⏰ Starting in 30 minutes',
      '1h':    '⏰ Starting in 1 hour',
      '6h':    '⏰ Starting in 6 hours',
      '12h':   '⏰ Starting in 12 hours',
      '24h':   '⏰ Starting in 24 hours'
    };

    var notifTitle = labelMap[label] || '⏰ Tournament reminder';
    var message = t.title + (t.note ? ' — ' + t.note : '');

    chrome.notifications.create('notif_' + id + '_' + label, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: notifTitle,
      message: message,
      priority: 2,
      requireInteraction: true,
      buttons: [{ title: 'Open tournament' }]
    });
  });
});

// ── Notification click → open tournament ─────────────────────────────────────
function openTournamentFromNotif(notifId) {
  var withoutPrefix = notifId.replace('notif_', '');
  var lastUnderscore = withoutPrefix.lastIndexOf('_');
  var id = withoutPrefix.slice(0, lastUnderscore);
  chrome.storage.local.get('tournaments', function(r) {
    var t = (r.tournaments || []).find(function(x) { return x.id === id; });
    if (t) chrome.tabs.create({ url: t.url });
    chrome.notifications.clear(notifId);
  });
}

chrome.notifications.onClicked.addListener(openTournamentFromNotif);
chrome.notifications.onButtonClicked.addListener(openTournamentFromNotif);

// ── Schedule alarms — multi-alert ────────────────────────────────────────────
function scheduleAlarms(tournament, settings) {
  var now   = Date.now();
  var start = new Date(tournament.startsAt).getTime();
  var id    = tournament.id;

  if (start <= now) return; // already started, no point

  // Always: at start
  chrome.alarms.create(ALARM_PREFIX + id + '_start', { when: start });

  // Multi-alert: schedule every enabled advance warning
  var alerts = settings.multiAlerts || ['30min'];
  var offsetMap = {
    '30min': 30  * 60 * 1000,
    '1h':    60  * 60 * 1000,
    '6h':    6   * 60 * 60 * 1000,
    '12h':   12  * 60 * 60 * 1000,
    '24h':   24  * 60 * 60 * 1000
  };

  alerts.forEach(function(label) {
    var offset = offsetMap[label];
    if (!offset) return;
    var when = start - offset;
    if (when > now) {
      chrome.alarms.create(ALARM_PREFIX + id + '_' + label, { when: when });
    }
  });
}

// ── Cancel all alarms for a tournament ───────────────────────────────────────
function cancelAlarms(id) {
  ['start', '30min', '1h', '6h', '12h', '24h'].forEach(function(label) {
    chrome.alarms.clear(ALARM_PREFIX + id + '_' + label);
  });
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function updateBadge(tournaments) {
  var now = Date.now();
  var favCount = (tournaments || []).filter(function(t) {
    return t.favorite && new Date(t.startsAt).getTime() > now;
  }).length;
  var upCount = (tournaments || []).filter(function(t) {
    return new Date(t.startsAt).getTime() > now;
  }).length;
  // Show favorites count if any, else total upcoming
  var count = favCount > 0 ? favCount : upCount;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: favCount > 0 ? '#cc8800' : '#4a4a8a' });
}

// ── Standby recovery — check for missed notifications on startup ─────────────
function checkMissedNotifications() {
  chrome.storage.local.get(['tournaments', 'lrSettings'], function(r) {
    var tournaments = r.tournaments || [];
    var settings = r.lrSettings || {};
    var now = Date.now();
    var window30 = 30 * 60 * 1000; // 30 min window

    tournaments.forEach(function(t) {
      var start = new Date(t.startsAt).getTime();
      // If tournament started within last 30 min and not yet notified
      if (start < now && start > now - window30 && !t.notified) {
        chrome.notifications.create('notif_' + t.id + '_missed', {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '🏁 Tournament started while you were away',
          message: t.title + ' — started ' + Math.round((now - start) / 60000) + ' min ago',
          priority: 2,
          requireInteraction: true,
          buttons: [{ title: 'Open tournament' }]
        });
        // Mark notified
        t.notified = true;
      }
    });
    chrome.storage.local.set({ tournaments: tournaments });
    updateBadge(tournaments);
  });
}

// ── Messages ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'SCHEDULE_ALARMS') {
    chrome.storage.local.get('lrSettings', function(r) {
      scheduleAlarms(msg.tournament, r.lrSettings || {});
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'CANCEL_ALARMS') {
    cancelAlarms(msg.id);
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'UPDATE_BADGE') {
    chrome.storage.local.get('tournaments', function(r) {
      updateBadge(r.tournaments || []);
      sendResponse({ ok: true });
    });
    return true;
  }
});

// ── On install / startup ──────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get('tournaments', function(r) {
    if (!r.tournaments) chrome.storage.local.set({ tournaments: [] });
  });
});

chrome.runtime.onStartup.addListener(function() {
  checkMissedNotifications();
});
