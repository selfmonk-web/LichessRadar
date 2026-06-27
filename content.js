// LichessRadar — content.js
// Compatible with Chrome 112+, pure vanilla JS

(function () {
  'use strict';

  var path = window.location.pathname;
  var isArena = path.indexOf('/tournament/') === 0;
  var isSwiss = path.indexOf('/swiss/') === 0;
  if (!isArena && !isSwiss) return;

  var type = isArena ? 'tournament' : 'swiss';
  var pathParts = path.split('/');
  var id = pathParts[2] ? pathParts[2].split('#')[0] : '';
  if (!id || id === 'new') return;

  function init() {
    if (document.getElementById('lr-save-btn')) return;
    injectButton();
  }

  // ── Extract data from page ─────────────────────────────────────────────────
  function extractData() {
    var titleEl = document.querySelector('h1') ||
                  document.querySelector('.tour__main h2') ||
                  document.querySelector('[class*="tour"] h2');
    var title = titleEl ? titleEl.textContent.trim() : '';
    if (!title) {
      title = document.title.replace(/\s*[•·|-].*$/, '').trim() || 'Tournament';
    }

    var startsAt = null;
    var timeEls = document.querySelectorAll('time[datetime]');
    for (var i = 0; i < timeEls.length; i++) {
      var dt = timeEls[i].getAttribute('datetime');
      if (dt) {
        var d = new Date(dt);
        if (!isNaN(d.getTime())) { startsAt = d.toISOString(); break; }
      }
    }
    if (!startsAt) {
      var dataTimeEl = document.querySelector('[data-time]');
      if (dataTimeEl) {
        var raw = parseInt(dataTimeEl.getAttribute('data-time'));
        if (!isNaN(raw)) startsAt = new Date(raw * 1000).toISOString();
      }
    }
    if (!startsAt) startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    var cleanUrl = 'https://lichess.org/' + type + '/' + id;
    var alreadyStarted = new Date(startsAt).getTime() < Date.now();

    return {
      id: id,
      title: title,
      url: cleanUrl,
      type: type,
      startsAt: startsAt,
      alreadyStarted: alreadyStarted,
      hasPrize: false,
      favorite: false,
      note: '',
      savedAt: new Date().toISOString(),
      notified: false
    };
  }

  // ── Inject floating button ─────────────────────────────────────────────────
  function injectButton() {
    var btn = document.createElement('button');
    btn.id = 'lr-save-btn';
    btn.className = 'lr-btn lr-btn--idle';
    btn.setAttribute('aria-label', 'Save to LichessRadar');
    btn.innerHTML = '<span class="lr-icon">📡</span><span class="lr-label">Save to Radar</span>';

    chrome.storage.local.get('tournaments', function(r) {
      var existing = (r.tournaments || []).find(function(t) { return t.id === id; });
      if (existing) {
        if (existing.alreadyStarted) {
          setButtonStarted(btn);
        } else {
          setButtonSaved(btn);
        }
      }
    });

    btn.addEventListener('click', handleSave);
    document.body.appendChild(btn);
  }

  // ── Save handler ───────────────────────────────────────────────────────────
  function handleSave() {
    var btn = document.getElementById('lr-save-btn');
    if (!btn || btn.classList.contains('lr-btn--saved') || btn.classList.contains('lr-btn--started')) return;

    btn.classList.add('lr-btn--loading');
    btn.querySelector('.lr-label').textContent = 'Saving…';

    var data = extractData();

    chrome.storage.local.get('tournaments', function(r) {
      var tournaments = r.tournaments || [];
      if (tournaments.some(function(t) { return t.id === data.id; })) {
        setButtonSaved(btn);
        return;
      }
      tournaments.unshift(data);
      chrome.storage.local.set({ tournaments: tournaments }, function() {
        chrome.runtime.sendMessage({ type: 'SCHEDULE_ALARMS', tournament: data });
        chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
        if (data.alreadyStarted) {
          setButtonStarted(btn);
          showToast('⚠️ Saved — this tournament already started');
        } else {
          setButtonSaved(btn);
          showToast('✅ Saved to LichessRadar!');
        }
      });
    });
  }

  function setButtonSaved(btn) {
    btn.classList.remove('lr-btn--idle', 'lr-btn--loading', 'lr-btn--started');
    btn.classList.add('lr-btn--saved');
    btn.querySelector('.lr-icon').textContent = '✅';
    btn.querySelector('.lr-label').textContent = 'On Radar';
    btn.removeEventListener('click', handleSave);
  }

  function setButtonStarted(btn) {
    btn.classList.remove('lr-btn--idle', 'lr-btn--loading', 'lr-btn--saved');
    btn.classList.add('lr-btn--started');
    btn.querySelector('.lr-icon').textContent = '🔴';
    btn.querySelector('.lr-label').textContent = 'Already started';
    btn.removeEventListener('click', handleSave);
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(message) {
    var existing = document.getElementById('lr-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'lr-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('lr-toast--visible'); }, 10);
    setTimeout(function() {
      toast.classList.remove('lr-toast--visible');
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 400);
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 1500);

})();
