// Per-section/per-question comments, floating over a static recap page.
// Adapted from lvt-impact-report's deck-viewer comments.js: that version
// tracked the active slide via an iframe's #label pill. This page has no
// deck viewer, so the "current item" is instead whichever element carrying
// a data-cmt attribute is scrolled into view (same y+130 offset the page's
// own floating section-nav already uses). Everything else — panel, form,
// realtime — is unchanged.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Primary path: /api/config?deck=<id> (Vercel serverless function reading
// the env vars the Supabase integration injected — see api/config.js).
// Falls back to supabase-config.js so the widget still works when previewed
// with a plain static server (python3 -m http.server) that has no /api route.
function loadConfig() {
  var deck = window.COMMENTS_DECK_ID || 'page';
  return fetch('/api/config?deck=' + encodeURIComponent(deck), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('no /api/config'); return r.json(); })
    .catch(function () {
      var fallback = window.SUPABASE_COMMENTS_CONFIG || {};
      return Object.assign({}, fallback, { deckId: deck });
    });
}

(async function () {
  var cfg = await loadConfig();
  var deckId = cfg.deckId || 'page';
  var configured = !!(cfg.url && cfg.anonKey && cfg.url.indexOf('YOUR-PROJECT-REF') === -1);
  var supabase = configured ? createClient(cfg.url, cfg.anonKey) : null;

  var items = [].slice.call(document.querySelectorAll('[data-cmt]'));
  var slide = 1;
  var panelOpen = false;
  var seenIds = {};
  var channel = null;

  // ── styles ──────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent =
    '.dc-btn{position:fixed;top:14px;right:16px;background:#262533;color:#fff;border:none;' +
    'border-radius:20px;padding:9px 16px;font-size:12.5px;font-weight:600;cursor:pointer;' +
    'font-family:inherit;display:flex;align-items:center;gap:7px;z-index:120;' +
    'box-shadow:0 10px 26px -10px rgba(38,37,51,.5);}' +
    '.dc-btn:hover{background:#37364a;}' +
    '.dc-badge{background:#f86b3c;color:#fff;border-radius:10px;min-width:16px;height:16px;' +
    'padding:0 4px;font-size:10px;font-weight:700;display:flex;align-items:center;' +
    'justify-content:center;line-height:1;}' +
    '.dc-overlay{position:fixed;inset:0;background:rgba(38,37,51,0.34);z-index:150;' +
    'opacity:0;pointer-events:none;transition:opacity .18s ease;}' +
    '.dc-overlay.on{opacity:1;pointer-events:auto;}' +
    '.dc-panel{position:fixed;top:0;right:0;bottom:0;width:min(360px,92vw);' +
    'background:rgba(15,17,23,0.97);border-left:1px solid rgba(255,255,255,0.14);' +
    'color:rgba(255,255,255,0.94);font-family:"DM Sans",system-ui,sans-serif;' +
    'z-index:151;display:flex;flex-direction:column;transform:translateX(100%);' +
    'transition:transform .22s ease;}' +
    '.dc-panel.on{transform:translateX(0);}' +
    '.dc-head{display:flex;align-items:center;justify-content:space-between;' +
    'padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.1);}' +
    '.dc-title{font-size:13px;font-weight:700;letter-spacing:0.02em;}' +
    '.dc-close{background:none;border:0;color:rgba(255,255,255,0.7);font-size:20px;' +
    'line-height:1;cursor:pointer;padding:2px 6px;}' +
    '.dc-close:hover{color:#fff;}' +
    '.dc-list{flex:1;overflow-y:auto;padding:12px 16px;display:flex;' +
    'flex-direction:column;gap:12px;}' +
    '.dc-empty{color:rgba(255,255,255,0.45);font-size:12.5px;padding:8px 0;}' +
    '.dc-item{font-size:12.5px;line-height:1.45;}' +
    '.dc-row{display:flex;align-items:baseline;gap:6px;}' +
    '.dc-author{font-weight:700;}' +
    '.dc-time{color:rgba(255,255,255,0.4);font-size:10.5px;flex:1;}' +
    '.dc-body{margin-top:2px;white-space:pre-wrap;word-break:break-word;color:rgba(255,255,255,0.88);}' +
    '.dc-form{border-top:1px solid rgba(255,255,255,0.1);padding:12px 16px 16px;}' +
    '.dc-input,.dc-textarea{width:100%;background:rgba(255,255,255,0.07);' +
    'border:1px solid rgba(255,255,255,0.16);border-radius:8px;color:#fff;' +
    'font-family:inherit;font-size:12.5px;padding:8px 10px;box-sizing:border-box;}' +
    '.dc-input{margin-bottom:8px;}' +
    '.dc-textarea{resize:vertical;min-height:60px;margin-bottom:8px;}' +
    '.dc-input::placeholder,.dc-textarea::placeholder{color:rgba(255,255,255,0.35);}' +
    '.dc-submit{width:100%;background:#f86b3c;border:0;border-radius:8px;color:#fff;' +
    'font-weight:700;font-size:12.5px;padding:9px;cursor:pointer;font-family:inherit;}' +
    '.dc-submit:hover{background:#e85a2c;}' +
    '.dc-submit:disabled{opacity:0.5;cursor:default;}' +
    '.dc-note{font-size:10.5px;color:rgba(255,255,255,0.4);padding:8px 16px 0;}' +
    '.dc-whoas{font-size:11px;color:rgba(255,255,255,0.55);margin-bottom:8px;}' +
    '.dc-change{background:none;border:0;color:#f86b3c;font-size:11px;font-weight:600;' +
    'cursor:pointer;font-family:inherit;padding:0;text-decoration:underline;}' +
    '.dc-del{background:none;border:0;color:rgba(255,255,255,0.4);font-size:10.5px;' +
    'font-weight:600;cursor:pointer;font-family:inherit;padding:0;white-space:nowrap;}' +
    '.dc-del:hover{color:#f86b3c;}' +
    '.dc-del.confirm{color:#f86b3c;}' +
    '@media print{.dc-btn,.dc-overlay,.dc-panel{display:none!important}}';
  document.head.appendChild(style);

  // ── markup ──────────────────────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.className = 'dc-btn';
  btn.innerHTML = '&#128172; Comments<span class="dc-badge" id="dc-badge" style="display:none"></span>';
  btn.setAttribute('aria-label', 'Comments');
  btn.title = 'Comments (C)';
  document.body.appendChild(btn);

  var overlay = document.createElement('div');
  overlay.className = 'dc-overlay';
  document.body.appendChild(overlay);

  var panel = document.createElement('div');
  panel.className = 'dc-panel';
  panel.innerHTML =
    '<div class="dc-head"><div class="dc-title" id="dc-title">Comments</div>' +
    '<button class="dc-close" aria-label="Close comments">&times;</button></div>' +
    '<div class="dc-list" id="dc-list"></div>' +
    (configured
      ? '<div class="dc-form">' +
        '<div class="dc-whoas" id="dc-whoas" style="display:none">Commenting as ' +
        '<b id="dc-whoas-name"></b> &middot; <button class="dc-change" id="dc-change" type="button">not you?</button></div>' +
        '<input class="dc-input" id="dc-name" placeholder="Your name" maxlength="60">' +
        '<textarea class="dc-textarea" id="dc-body" placeholder="Add a comment here&hellip;" maxlength="2000"></textarea>' +
        '<button class="dc-submit" id="dc-submit">Post comment</button></div>'
      : '<div class="dc-note">Comments aren\'t wired up yet on this deployment.</div>');
  document.body.appendChild(panel);

  var listEl = document.getElementById('dc-list');
  var titleEl = document.getElementById('dc-title');
  var badgeEl = document.getElementById('dc-badge');
  var nameEl = document.getElementById('dc-name');
  var bodyEl = document.getElementById('dc-body');
  var submitEl = document.getElementById('dc-submit');
  var whoasEl = document.getElementById('dc-whoas');
  var whoasNameEl = document.getElementById('dc-whoas-name');
  var changeEl = document.getElementById('dc-change');

  // In-memory only — asked once per page load, forgotten on refresh, never
  // written to localStorage. A shared link shouldn't remember a name past
  // the tab that used it.
  var sessionAuthor = '';
  function syncNameUI() {
    if (!nameEl) return;
    if (sessionAuthor) {
      whoasEl.style.display = 'block';
      whoasNameEl.textContent = sessionAuthor;
      nameEl.style.display = 'none';
      nameEl.value = sessionAuthor;
    } else {
      whoasEl.style.display = 'none';
      nameEl.style.display = '';
    }
  }
  if (changeEl) {
    changeEl.onclick = function () { sessionAuthor = ''; syncNameUI(); nameEl.focus(); };
  }
  syncNameUI();

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function relTime(iso) {
    var d = (Date.parse(iso) - Date.now()) / 1000;
    var units = [['day', 86400], ['hour', 3600], ['minute', 60]];
    for (var k = 0; k < units.length; k++) {
      var secs = units[k][1];
      if (Math.abs(d) >= secs || units[k][0] === 'minute') {
        var n = Math.round(d / secs);
        return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(n, units[k][0]);
      }
    }
    return 'just now';
  }

  function renderList(rows) {
    if (!rows.length) {
      listEl.innerHTML = '<div class="dc-empty">No comments here yet.</div>';
      return;
    }
    listEl.innerHTML = rows.map(function (r) {
      return '<div class="dc-item"><div class="dc-row">' +
        '<span class="dc-author">' + escapeHtml(r.author) + '</span>' +
        '<span class="dc-time">' + relTime(r.created_at) + '</span>' +
        '<button class="dc-del" data-id="' + r.id + '" aria-label="Delete comment">Delete</button>' +
        '</div><div class="dc-body">' + escapeHtml(r.body) + '</div></div>';
    }).join('');
  }

  // Open link, no login — same trust model as read/insert: anyone can
  // remove any comment (e.g. clear a stray/test one), not just their own.
  function deleteComment(id) {
    if (!configured) return;
    supabase.from('comments').delete().eq('id', id).then(function () {
      currentRows = currentRows.filter(function (r) { return r.id !== id; });
      renderList(currentRows);
      updateBadge(currentRows.length);
    });
  }
  // Two clicks instead of a native confirm() dialog.
  listEl.addEventListener('click', function (e) {
    var btnEl = e.target.closest && e.target.closest('.dc-del');
    if (!btnEl) return;
    if (btnEl.classList.contains('confirm')) {
      clearTimeout(btnEl._t);
      deleteComment(btnEl.dataset.id);
      return;
    }
    btnEl.classList.add('confirm');
    btnEl.textContent = 'Confirm?';
    btnEl._t = setTimeout(function () {
      btnEl.classList.remove('confirm');
      btnEl.textContent = 'Delete';
    }, 3000);
  });

  function updateBadge(count) {
    if (count > 0) {
      badgeEl.textContent = count > 99 ? '99+' : String(count);
      badgeEl.style.display = 'flex';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  var currentRows = [];

  function currentLabel() {
    var el = items[slide - 1];
    return (el && el.getAttribute('data-cmt')) || 'This page';
  }

  function loadSlide() {
    titleEl.textContent = 'Comments · ' + currentLabel();
    if (!configured) { updateBadge(0); return; }
    listEl.innerHTML = '<div class="dc-empty">Loading&hellip;</div>';
    supabase.from('comments').select('*')
      .eq('deck_id', deckId).eq('slide', slide)
      .order('created_at', { ascending: true })
      .then(function (res) {
        currentRows = (res && res.data) || [];
        currentRows.forEach(function (r) { seenIds[r.id] = true; });
        renderList(currentRows);
        updateBadge(currentRows.length);
      });
  }

  function openPanel() {
    panelOpen = true;
    overlay.classList.add('on');
    panel.classList.add('on');
    loadSlide();
    setTimeout(function () { var el = sessionAuthor ? bodyEl : nameEl; if (el) el.focus(); }, 50);
  }
  function closePanel() {
    panelOpen = false;
    overlay.classList.remove('on');
    panel.classList.remove('on');
  }
  function togglePanel() { panelOpen ? closePanel() : openPanel(); }

  btn.onclick = togglePanel;
  overlay.onclick = closePanel;
  panel.querySelector('.dc-close').onclick = closePanel;

  // Keys typed inside the panel must stay local, not fall through to any
  // page-level shortcut handler.
  panel.addEventListener('keydown', function (e) {
    e.stopPropagation();
  });
  document.addEventListener('keydown', function (e) {
    if (panelOpen) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); togglePanel(); }
  });

  if (submitEl) {
    submitEl.onclick = function () {
      var author = (nameEl.value || '').trim();
      var body = (bodyEl.value || '').trim();
      if (!author || !body) return;
      sessionAuthor = author;
      syncNameUI();
      submitEl.disabled = true;
      supabase.from('comments').insert({ deck_id: deckId, slide: slide, author: author, body: body })
        .select().single()
        .then(function (res) {
          submitEl.disabled = false;
          if (res && res.data) {
            seenIds[res.data.id] = true;
            currentRows.push(res.data);
            renderList(currentRows);
            updateBadge(currentRows.length);
          }
          bodyEl.value = '';
        }, function () { submitEl.disabled = false; });
    };
  }

  // ── live updates for anyone with the panel open ────────────────────────
  if (configured) {
    channel = supabase.channel('comments-' + deckId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: 'deck_id=eq.' + deckId },
        function (payload) {
          var row = payload.new;
          if (seenIds[row.id]) return;
          seenIds[row.id] = true;
          if (row.slide === slide) {
            currentRows.push(row);
            renderList(currentRows);
            updateBadge(currentRows.length);
          }
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: 'deck_id=eq.' + deckId },
        function (payload) {
          var id = payload.old && payload.old.id;
          if (!id) return;
          currentRows = currentRows.filter(function (r) { return r.id !== id; });
          if (panelOpen) renderList(currentRows);
          updateBadge(currentRows.length);
        })
      .subscribe();
  }

  // ── track the current item via scroll position ─────────────────────────
  // Same y+130 offset the page's own floating section-nav (nav-fab) already
  // uses, so "current" agrees with whatever the nav shows as active.
  function currentIndex() {
    if (!items.length) return 1;
    var y = window.scrollY + 130, cur = items[0];
    items.forEach(function (el) { if (el.getBoundingClientRect().top + window.scrollY <= y) cur = el; });
    return items.indexOf(cur) + 1;
  }

  function loadCountOnly() {
    if (!configured) return;
    supabase.from('comments').select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId).eq('slide', slide)
      .then(function (res) { updateBadge((res && res.count) || 0); });
  }

  slide = currentIndex();
  loadCountOnly();
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var n = currentIndex();
      if (n !== slide) { slide = n; if (panelOpen) loadSlide(); else loadCountOnly(); }
    });
  }, { passive: true });
})();
