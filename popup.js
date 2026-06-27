// LichessRadar — popup.js
// Pure vanilla JS, compatible with Chrome 112+

var allTournaments = [];
var currentFilter = 'all';
var currentSort   = 'date';
var settings      = { multiAlerts: ['30min'], autoRemove: true };
var noteEditingId = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  loadSettings(function() {
    loadAndRender();
    bindEvents();
    listenStorageChanges();
  });
});

// ── Live storage listener — keeps popup in sync ───────────────────────────────
function listenStorageChanges() {
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes.tournaments) {
      allTournaments = changes.tournaments.newValue || [];
      render();
      updateFooter();
    }
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────
function loadSettings(cb) {
  chrome.storage.local.get('lrSettings', function(r) {
    if (r.lrSettings) {
      settings.multiAlerts = r.lrSettings.multiAlerts || ['30min'];
      settings.autoRemove  = r.lrSettings.autoRemove !== false;
    }
    // Restore checkboxes
    document.querySelectorAll('input[name="alert"]').forEach(function(chk) {
      chk.checked = settings.multiAlerts.indexOf(chk.value) !== -1;
    });
    document.getElementById('autoRemove').checked = settings.autoRemove;
    if (cb) cb();
  });
}

function saveSettings() {
  var checked = [];
  document.querySelectorAll('input[name="alert"]:checked').forEach(function(chk) {
    checked.push(chk.value);
  });
  settings.multiAlerts = checked.length > 0 ? checked : ['30min'];
  settings.autoRemove  = document.getElementById('autoRemove').checked;
  chrome.storage.local.set({ lrSettings: settings });
}

// ── Load & render ─────────────────────────────────────────────────────────────
function loadAndRender() {
  chrome.storage.local.get('tournaments', function(r) {
    allTournaments = r.tournaments || [];

    if (settings.autoRemove) {
      var cutoff = Date.now() - 4 * 60 * 60 * 1000;
      allTournaments = allTournaments.filter(function(t) {
        return new Date(t.startsAt).getTime() > cutoff;
      });
      chrome.storage.local.set({ tournaments: allTournaments });
    }

    render();
    updateFooter();
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  var list  = document.getElementById('tournamentList');
  var empty = document.getElementById('emptyState');
  var filtered = applyFilter(allTournaments, currentFilter);
  var sorted   = applySort(filtered, currentSort);

  if (sorted.length === 0) {
    list.style.display  = 'none';
    empty.style.display = 'flex';
    return;
  }
  list.style.display  = 'flex';
  empty.style.display = 'none';
  list.innerHTML = sorted.map(buildCard).join('');

  list.querySelectorAll('.card__title').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      var url = el.getAttribute('data-url');
      if (url) chrome.tabs.create({ url: url });
    });
  });
  list.querySelectorAll('.card__action-btn.delete').forEach(function(btn) {
    btn.addEventListener('click', function() { deleteTournament(btn.dataset.id); });
  });
  list.querySelectorAll('.card__action-btn.note-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { openNoteEditor(btn.dataset.id); });
  });
  list.querySelectorAll('.card__action-btn.fav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { toggleFavorite(btn.dataset.id); });
  });
  list.querySelectorAll('.prize-checkbox').forEach(function(chk) {
    chk.addEventListener('change', function() { togglePrize(chk.dataset.id, chk.checked); });
  });
}

// ── Filter / Sort ─────────────────────────────────────────────────────────────
function applyFilter(arr, f) {
  if (f === 'prize')     return arr.filter(function(t) { return t.hasPrize; });
  if (f === 'favorites') return arr.filter(function(t) { return t.favorite; });
  return arr;
}

function applySort(arr, s) {
  var copy = arr.slice();
  if (s === 'date') {
    copy.sort(function(a,b) { return new Date(a.startsAt) - new Date(b.startsAt); });
  } else if (s === 'favorites') {
    copy.sort(function(a,b) {
      if (a.favorite === b.favorite) return new Date(a.startsAt) - new Date(b.startsAt);
      return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
    });
  } else if (s === 'prize') {
    copy.sort(function(a,b) {
      if (a.hasPrize === b.hasPrize) return new Date(a.startsAt) - new Date(b.startsAt);
      return (b.hasPrize ? 1 : 0) - (a.hasPrize ? 1 : 0);
    });
  } else if (s === 'saved') {
    copy.sort(function(a,b) { return new Date(b.savedAt) - new Date(a.savedAt); });
  }
  return copy;
}

// ── Build card HTML ───────────────────────────────────────────────────────────
function buildCard(t) {
  var now   = Date.now();
  var start = new Date(t.startsAt).getTime();
  var diff  = start - now;

  var statusBadge, cardClass = '';
  if (t.alreadyStarted && diff > -4 * 60 * 60 * 1000) {
    statusBadge = '<span class="badge badge--started">⚠️ Already started</span>';
  } else if (diff < 0 && diff > -4 * 60 * 60 * 1000) {
    statusBadge = '<span class="badge badge--live">🔴 Live</span>';
    cardClass = 'card--live';
  } else if (diff < 0) {
    statusBadge = '<span class="badge badge--done">✅ Ended</span>';
  } else if (diff < 30 * 60 * 1000) {
    statusBadge = '<span class="badge badge--soon">🟡 Starting soon</span>';
  } else {
    statusBadge = '<span class="badge badge--upcoming">🔵 Upcoming</span>';
  }

  var typeBadge = t.type === 'tournament'
    ? '<span class="badge badge--arena">Arena</span>'
    : '<span class="badge badge--swiss">Swiss</span>';

  var prizeChecked    = t.hasPrize ? 'checked' : '';
  var prizeActiveClass = t.hasPrize ? 'prize-check--active' : '';
  var prizeHtml = '<label class="prize-check ' + prizeActiveClass + '">'
    + '<input type="checkbox" class="prize-checkbox" data-id="' + esc(t.id) + '" ' + prizeChecked + '>'
    + '<span class="prize-check__label">💰 Prize</span>'
    + '</label>';

  var favActive = t.favorite ? 'active' : '';
  var favBtn = '<button class="card__action-btn fav-btn ' + favActive + '" data-id="' + esc(t.id) + '" title="Favorite">'
    + (t.favorite ? '⭐' : '☆') + '</button>';

  var noteHtml = t.note
    ? '<div class="card__note">' + esc(t.note) + '</div>'
    : '';

  if (t.favorite) cardClass += ' card--favorite';
  if (t.hasPrize && !t.favorite) cardClass += ' card--prize';

  return '<div class="card ' + cardClass.trim() + '">'
    + '<div class="card__top">'
    +   '<a class="card__title" href="#" data-url="' + esc(t.url) + '">' + esc(t.title) + '</a>'
    +   '<div class="card__actions">'
    +     favBtn
    +     '<button class="card__action-btn note-btn" data-id="' + esc(t.id) + '" title="Note">📝</button>'
    +     '<button class="card__action-btn delete" data-id="' + esc(t.id) + '" title="Remove">✕</button>'
    +   '</div>'
    + '</div>'
    + '<div class="card__meta">' + statusBadge + typeBadge + prizeHtml + '</div>'
    + '<div class="card__time">' + formatTime(t.startsAt) + '</div>'
    + noteHtml
    + '</div>';
}

// ── Actions ───────────────────────────────────────────────────────────────────
function toggleFavorite(id) {
  allTournaments = allTournaments.map(function(t) {
    if (t.id === id) return Object.assign({}, t, { favorite: !t.favorite });
    return t;
  });
  chrome.storage.local.set({ tournaments: allTournaments }, function() {
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
    render();
  });
}

function togglePrize(id, val) {
  allTournaments = allTournaments.map(function(t) {
    if (t.id === id) return Object.assign({}, t, { hasPrize: val });
    return t;
  });
  chrome.storage.local.set({ tournaments: allTournaments }, render);
}

function deleteTournament(id) {
  allTournaments = allTournaments.filter(function(t) { return t.id !== id; });
  chrome.storage.local.set({ tournaments: allTournaments }, function() {
    chrome.runtime.sendMessage({ type: 'CANCEL_ALARMS', id: id });
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
    render();
    updateFooter();
  });
}

// ── Note editor ───────────────────────────────────────────────────────────────
function openNoteEditor(id) {
  var t = allTournaments.find(function(x) { return x.id === id; });
  if (!t) return;
  noteEditingId = id;
  document.getElementById('noteTourName').textContent = t.title;
  document.getElementById('noteInput').value = t.note || '';
  document.getElementById('noteOverlay').style.display = 'flex';
  setTimeout(function() { document.getElementById('noteInput').focus(); }, 50);
}

function closeNoteEditor() {
  noteEditingId = null;
  document.getElementById('noteOverlay').style.display = 'none';
}

function saveNote() {
  if (!noteEditingId) return;
  var note = document.getElementById('noteInput').value.trim();
  allTournaments = allTournaments.map(function(t) {
    if (t.id === noteEditingId) return Object.assign({}, t, { note: note });
    return t;
  });
  chrome.storage.local.set({ tournaments: allTournaments }, function() {
    closeNoteEditor();
    render();
  });
}

// ── Add via URL ───────────────────────────────────────────────────────────────
function addByUrl() {
  var raw = document.getElementById('addUrlInput').value.trim();
  var err = document.getElementById('addError');
  var btn = document.getElementById('addBtn');
  err.textContent = '';

  if (!raw) { err.textContent = 'Paste a Lichess tournament link first.'; return; }

  var arenaMatch = raw.match(/lichess\.org\/tournament\/([a-zA-Z0-9]+)/);
  var swissMatch = raw.match(/lichess\.org\/swiss\/([a-zA-Z0-9]+)/);

  if (!arenaMatch && !swissMatch) {
    err.textContent = 'Not a valid lichess.org/tournament/… or /swiss/… link.';
    return;
  }

  var type = arenaMatch ? 'tournament' : 'swiss';
  var id   = arenaMatch ? arenaMatch[1] : swissMatch[1];
  var url  = 'https://lichess.org/' + type + '/' + id;

  if (allTournaments.some(function(t) { return t.id === id; })) {
    err.textContent = 'Already saved!';
    return;
  }

  btn.textContent = '…';
  btn.disabled = true;

  var apiUrl = arenaMatch
    ? 'https://lichess.org/api/tournament/' + id
    : 'https://lichess.org/api/swiss/' + id;

  fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
    .then(function(res) {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.json();
    })
    .then(function(data) {
      var title = data.fullName || data.name || type + ' — ' + id;
      var startsAt;
      if (data.startsAt) {
        startsAt = new Date(data.startsAt).toISOString();
      } else if (data.schedule && data.schedule.at) {
        startsAt = new Date(data.schedule.at).toISOString();
      } else {
        startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
      var alreadyStarted = new Date(startsAt).getTime() < Date.now();
      saveTournament({ id:id, title:title, url:url, type:type, startsAt:startsAt, alreadyStarted:alreadyStarted });
    })
    .catch(function() {
      err.textContent = 'Could not fetch details — saved with placeholder.';
      saveTournament({ id:id, title:type + ' — ' + id, url:url, type:type,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), alreadyStarted: false });
    });

  function saveTournament(fields) {
    var t = Object.assign({ hasPrize:false, favorite:false, note:'', savedAt:new Date().toISOString(), notified:false }, fields);
    allTournaments.unshift(t);
    chrome.storage.local.set({ tournaments: allTournaments }, function() {
      chrome.runtime.sendMessage({ type: 'SCHEDULE_ALARMS', tournament: t });
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
      document.getElementById('addUrlInput').value = '';
      btn.textContent = 'Add';
      btn.disabled = false;
      render();
      updateFooter();
    });
  }
}

// ── Footer ────────────────────────────────────────────────────────────────────
function updateFooter() {
  var n = allTournaments.length;
  document.getElementById('footerCount').textContent = n === 1 ? '1 saved' : n + ' saved';
}

// ── Time formatting ───────────────────────────────────────────────────────────
function formatTime(iso) {
  var d    = new Date(iso);
  var now  = new Date();
  var diff = d - now;

  if (diff > 0 && diff < 60000) return 'Starting in less than a minute';
  if (diff > 0 && diff < 3600000) return 'In ' + Math.round(diff / 60000) + ' min';

  var dDay     = new Date(d.getFullYear(),   d.getMonth(),   d.getDate());
  var today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var dayDiff  = Math.round((dDay - today) / 86400000);
  var timeStr  = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (dayDiff === 0)  return 'Today at '     + timeStr;
  if (dayDiff === 1)  return 'Tomorrow at '  + timeStr;
  if (dayDiff === -1) return 'Yesterday at ' + timeStr;
  if (diff < 0 && diff > -14400000) return 'Live now';

  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    + ' at ' + timeStr;
}

// ── Escape HTML ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Bind events ───────────────────────────────────────────────────────────────
function bindEvents() {
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  document.getElementById('sortSelect').addEventListener('change', function(e) {
    currentSort = e.target.value;
    render();
  });

  document.getElementById('addBtn').addEventListener('click', addByUrl);
  document.getElementById('addUrlInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') addByUrl();
  });

  document.getElementById('noteSaveBtn').addEventListener('click', saveNote);
  document.getElementById('noteCancelBtn').addEventListener('click', closeNoteEditor);
  document.getElementById('noteOverlay').addEventListener('click', function(e) {
    if (e.target === document.getElementById('noteOverlay')) closeNoteEditor();
  });

  document.getElementById('settingsBtn').addEventListener('click', function() {
    document.getElementById('settingsPanel').style.display = 'flex';
    document.getElementById('tournamentList').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('addPanel').style.display = 'none';
    document.querySelector('.filters').style.display = 'none';
    document.querySelector('.sort-bar').style.display = 'none';
    document.getElementById('mainFooter').style.display = 'none';
    document.getElementById('linksBar').style.display = 'none';
  });

  document.getElementById('backBtn').addEventListener('click', function() {
    saveSettings();
    document.getElementById('settingsPanel').style.display = 'none';
    document.getElementById('addPanel').style.display = 'block';
    document.querySelector('.filters').style.display = 'flex';
    document.querySelector('.sort-bar').style.display = 'flex';
    document.getElementById('mainFooter').style.display = 'flex';
    document.getElementById('linksBar').style.display = 'flex';
    render();
    updateFooter();
  });

  document.querySelectorAll('input[name="alert"]').forEach(function(chk) {
    chk.addEventListener('change', saveSettings);
  });
  document.getElementById('autoRemove').addEventListener('change', saveSettings);

  document.getElementById('clearAllBtn').addEventListener('click', function() {
    if (confirm('Remove all saved tournaments?')) {
      allTournaments.forEach(function(t) {
        chrome.runtime.sendMessage({ type: 'CANCEL_ALARMS', id: t.id });
      });
      allTournaments = [];
      chrome.storage.local.set({ tournaments: [] }, function() {
        chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
        render();
        updateFooter();
      });
    }
  });
}
