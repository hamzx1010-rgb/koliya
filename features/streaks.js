// streaks.js
// Drop into public/features/streaks.js
// Requires: global `supabase` client and a DOM element with id #streak-widget

export function initStreaks() {
  const widget = document.getElementById('streak-widget');
  if (!widget) return;

  // Insert flame SVG and UI
  widget.innerHTML = `
    <div id="streak-inner" style="display:flex;align-items:center;gap:10px;">
      <svg id="streak-flame" viewBox="0 0 24 24" width="40" height="40" style="transition: transform .35s ease, filter .35s ease;">
        <path d="M12 2C10 6 7 7 7 11c0 3 3 5 5 7 2-2 5-4 5-7 0-4-3-5-5-9z" fill="#ff6a00"/>
      </svg>
      <div>
        <div id="streak-count" style="font-weight:600">0 day streak</div>
        <div id="streak-progress" style="font-size:12px;color:#666">No activity yet</div>
      </div>
      <button id="streak-claim" style="margin-left:8px;padding:6px 8px;border-radius:6px;">Claim</button>
    </div>
  `;

  async function fetchStreak() {
    const uid = supabase.auth.getUser()?.data?.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', uid)
      .single();
    if (error && error.code !== 'PGRST116') { console.error('fetchStreak', error); return null; }
    return data;
  }

  function animateFlame() {
    const flame = document.getElementById('streak-flame');
    flame.style.transform = 'scale(1.25)';
    flame.style.filter = 'drop-shadow(0 6px 12px rgba(255,106,0,0.35))';
    setTimeout(() => {
      flame.style.transform = '';
      flame.style.filter = '';
    }, 900);
  }

  async function refreshStreakUI() {
    const s = await fetchStreak();
    const countEl = document.getElementById('streak-count');
    const progEl = document.getElementById('streak-progress');
    if (!s) {
      countEl.textContent = '0 day streak';
      progEl.textContent = 'No activity yet';
      return;
    }
    countEl.textContent = `${s.current_streak} day streak`;
    progEl.textContent = `Best: ${s.best_streak}`;
  }

  // Claim daily activity (calls RPC or updates streaks)
  async function claimDaily() {
    const uid = supabase.auth.getUser()?.data?.user?.id;
    if (!uid) return;
    // call RPC record_daily_activity (SQL provided)
    const { data, error } = await supabase.rpc('record_daily_activity', { p_user_id: uid });
    if (error) { console.error('claimDaily', error); return; }
    // animate and refresh
    animateFlame();
    await refreshStreakUI();
    // create a notification for streak increment (optional)
    await supabase.from('notifications').insert({
      user_id: uid,
      type: 'streak',
      payload: { title: `🔥 ${data.current_streak} day streak!` },
      is_read: false
    });
  }

  document.getElementById('streak-claim').addEventListener('click', claimDaily);

  // initial load
  refreshStreakUI();

  // expose refresh for other modules
  return { refreshStreakUI, claimDaily, animateFlame };
}
