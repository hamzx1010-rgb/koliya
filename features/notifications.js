// notifications.js
// Drop into public/features/notifications.js
// Requires: global `supabase` client and a DOM element with ids: #notif-panel, #bell-dot, #panel-notif-dot

export async function initNotifications() {
  // DOM helpers
  const bellDot = document.getElementById('bell-dot');
  const panelDot = document.getElementById('panel-notif-dot');
  const panel = document.getElementById('notif-panel');

  async function fetchNotifications() {
    const uid = supabase.auth.getUser()?.data?.user?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) { console.error('fetchNotifications', error); return []; }
    return data;
  }

  async function refreshNotificationCounts() {
    const uid = supabase.auth.getUser()?.data?.user?.id;
    if (!uid) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: false })
      .eq('user_id', uid)
      .is('is_read', false);

    if (error) { console.error('refreshNotificationCounts', error); return; }
    const unread = count || 0;
    if (bellDot) bellDot.style.display = unread > 0 ? 'inline-block' : 'none';
    if (panelDot) panelDot.style.display = unread > 0 ? 'inline-block' : 'none';
  }

  // Render list into panel
  async function renderPanel() {
    if (!panel) return;
    panel.innerHTML = '<div class="notif-loading">Loading…</div>';
    const items = await fetchNotifications();
    panel.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'notif-list';
    items.forEach(n => {
      const row = document.createElement('div');
      row.className = 'notif-row' + (n.is_read ? '' : ' unread');
      row.dataset.notifId = n.id;
      row.innerHTML = `
        <div class="notif-meta"><strong>${n.type}</strong> · <span class="time">${new Date(n.created_at).toLocaleString()}</span></div>
        <div class="notif-text">${(n.payload && n.payload.title) || n.type}</div>
      `;
      row.addEventListener('click', () => handleNotificationClick(n.id, n));
      list.appendChild(row);
    });
    panel.appendChild(list);
    // update counts
    await refreshNotificationCounts();
  }

  // Mark single notification read
  async function markNotificationRead(notificationId) {
    // optimistic UI
    const el = document.querySelector(`[data-notif-id="${notificationId}"]`);
    if (el) el.classList.remove('unread');

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('markNotificationRead', error);
      // reconcile by re-fetching panel
      await renderPanel();
      return;
    }
    await refreshNotificationCounts();
  }

  // Batch mark visible notifications read (call when panel opens)
  async function markVisibleNotificationsRead() {
    const visible = Array.from(document.querySelectorAll('#notif-panel .notif-row.unread')).map(el => el.dataset.notifId);
    if (!visible.length) return;
    // optimistic hide
    visible.forEach(id => {
      const el = document.querySelector(`[data-notif-id="${id}"]`);
      if (el) el.classList.remove('unread');
    });

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', visible);

    if (error) {
      console.error('markVisibleNotificationsRead', error);
      await renderPanel();
      return;
    }
    await refreshNotificationCounts();
  }

  // Click handler for a notification
  async function handleNotificationClick(id, rowData) {
    // mark read and then navigate or open related content
    await markNotificationRead(id);
    // Example: if payload contains a url, open it
    try {
      const payload = rowData.payload || {};
      if (payload.url) window.open(payload.url, '_blank');
    } catch (e) { /* ignore */ }
  }

  // Panel open/close wiring (assumes you toggle #notif-panel visibility)
  // When panel becomes visible, mark visible notifications read after a short debounce
  let panelOpen = false;
  const observer = new MutationObserver(() => {
    const visible = panel && panel.offsetParent !== null;
    if (visible && !panelOpen) {
      panelOpen = true;
      setTimeout(markVisibleNotificationsRead, 300); // small debounce
    } else if (!visible) {
      panelOpen = false;
    }
  });
  if (panel) observer.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });

  // Public API
  await renderPanel();
  await refreshNotificationCounts();

  // Expose helpers for other modules
  return { renderPanel, refreshNotificationCounts, markNotificationRead, markVisibleNotificationsRead };
}
