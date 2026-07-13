// notifications_fix.js
// Marks DM/thread notifications read when opening a DM and ensures badges refresh reliably.
// Place after supabase client is loaded.

(async function () {
  const s = window.supabase;
  if (!s) return;

  // helper: get current user id (wait for restore)
  async function getUid() {
    // small wait for auth restore
    for (let i = 0; i < 15; i++) {
      const u = s.auth.getUser();
      if (u?.data?.user?.id) return u.data.user.id;
      await new Promise(r => setTimeout(r, 100));
    }
    const u = s.auth.getUser();
    return u?.data?.user?.id || null;
  }

  function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // refresh unread count UI
  async function refreshCounts() {
    const uid = await getUid();
    const bellDot = document.getElementById('bell-dot');
    const panelDot = document.getElementById('panel-notif-dot');
    if (!uid) { if (bellDot) bellDot.classList.add('hidden'); if (panelDot) panelDot.classList.add('hidden'); return; }
    const { count, error } = await s.from('notifications').select('id', { count: 'exact', head: false }).eq('user_id', uid).is('is_read', false);
    if (error) { console.error('refreshCounts', error); return; }
    const unread = count || 0;
    if (bellDot) bellDot.classList.toggle('hidden', unread === 0);
    if (panelDot) panelDot.classList.toggle('hidden', unread === 0);
  }

  // fetch notifications (unread + read)
  async function fetchNotifications() {
    const uid = await getUid();
    if (!uid) return [];
    const { data, error } = await s.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(200);
    if (error) { console.error('fetchNotifications', error); return []; }
    return data || [];
  }

  // render panel (simple)
  async function renderPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    panel.innerHTML = '<div style="padding:8px">Loading…</div>';
    const items = await fetchNotifications();
    panel.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'notif-list';
    items.forEach(n => {
      const row = document.createElement('div');
      row.className = 'notif-row' + (n.is_read ? '' : ' unread');
      row.dataset.notifId = n.id;
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>${escapeHtml(n.type)}</strong><div style="font-size:12px;color:var(--muted)">${new Date(n.created_at).toLocaleString()}</div></div>
          <div style="font-size:12px;color:var(--muted)">›</div>
        </div>
        <div style="margin-top:6px">${escapeHtml((n.payload && n.payload.title) || n.type)}</div>
      `;
      row.addEventListener('click', () => handleClick(n));
      list.appendChild(row);
    });
    panel.appendChild(list);
    await refreshCounts();
  }

  // mark a single notification read (safe: checks user_id)
  async function markNotificationRead(id) {
    const uid = await getUid();
    if (!uid) return;
    try {
      await s.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid);
    } catch (e) { console.error('markNotificationRead', e); }
    await refreshCounts();
  }

  // mark multiple notifications by id list
  async function markNotificationsByIds(ids = []) {
    if (!ids || !ids.length) return;
    const uid = await getUid();
    if (!uid) return;
    try {
      await s.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids).eq('user_id', uid);
    } catch (e) { console.error('markNotificationsByIds', e); }
    await refreshCounts();
  }

  // When opening a DM thread, find unread notifications that reference that thread and mark them read.
  // This function is robust: it fetches unread notifications and inspects payload fields for common keys.
  async function markThreadNotificationsRead(threadId) {
    if (!threadId) return;
    const uid = await getUid();
    if (!uid) return;
    // fetch unread notifications for user
    const { data, error } = await s.from('notifications').select('*').eq('user_id', uid).is('is_read', false).limit(500);
    if (error) { console.error('markThreadNotificationsRead: fetch', error); return; }
    const toMark = [];
    (data || []).forEach(n => {
      const p = n.payload || {};
      // check common payload shapes
      if (p.thread_id === threadId || p.threadId === threadId || p.thread === threadId) toMark.push(n.id);
      // sometimes payload may be stringified JSON inside a field
      try {
        if (!toMark.length && typeof p === 'string') {
          const parsed = JSON.parse(p);
          if (parsed && (parsed.thread_id === threadId || parsed.threadId === threadId || parsed.thread === threadId)) toMark.push(n.id);
        }
      } catch (e) { /* ignore parse errors */ }
    });
    if (toMark.length) await markNotificationsByIds(toMark);
  }

  // click handler for notification row
  async function handleClick(n) {
    await markNotificationRead(n.id);
    // if payload points to a DM thread, open it and mark thread notifications read
    const p = n.payload || {};
    const threadId = p.thread_id || p.threadId || p.thread || null;
    if (threadId) {
      // open DM thread UI (if you have one) — we call global openDMThread if present
      if (typeof window.openDMThread === 'function') window.openDMThread(threadId);
      await markThreadNotificationsRead(threadId);
    } else if (p.url) {
      window.open(p.url, '_blank');
    }
    // refresh panel UI
    await renderPanel();
  }

  // mark visible notifications read when panel opens
  async function markVisibleReadFromPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const visible = Array.from(panel.querySelectorAll('.notif-row.unread')).map(el => el.dataset.notifId);
    if (!visible.length) return;
    await markNotificationsByIds(visible);
    await renderPanel();
  }

  // wire panel toggle buttons (if present)
  const bellBtn = document.getElementById('bell-btn');
  const panelBtn = document.getElementById('panel-btn');
  const panelEl = document.getElementById('notif-panel');

  function togglePanel() {
    if (!panelEl) return;
    const visible = panelEl.style.display !== 'block';
    panelEl.style.display = visible ? 'block' : 'none';
    panelEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) {
      setTimeout(markVisibleReadFromPanel, 300);
      renderPanel();
    }
  }

  if (bellBtn) bellBtn.addEventListener('click', togglePanel);
  if (panelBtn) panelBtn.addEventListener('click', togglePanel);

  // ensure counts refresh after auth restore
  s.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      await refreshCounts();
      await renderPanel();
    } else {
      const bellDot = document.getElementById('bell-dot');
      const panelDot = document.getElementById('panel-notif-dot');
      if (bellDot) bellDot.classList.add('hidden');
      if (panelDot) panelDot.classList.add('hidden');
    }
  });

  // initial attempt after load
  setTimeout(() => { refreshCounts(); renderPanel(); }, 600);
  // poll counts periodically
  setInterval(refreshCounts, 6000);

  // expose for debugging
  window.NOTIFS = window.NOTIFS || {};
  Object.assign(window.NOTIFS, { refreshCounts, renderPanel, markThreadNotificationsRead });
})();
