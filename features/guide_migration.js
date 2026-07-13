// guide_migration.js
// Shows the onboarding guide once per account (migrates anon dismissal to account on sign-in).
// Place after supabase client is loaded.

const GuideStorage = (function () {
  // safe storage wrapper: prefer localStorage, fallback to sessionStorage, then in-memory
  let store = null;
  try {
    if (window.localStorage) store = window.localStorage;
  } catch (e) { /* blocked */ }
  if (!store) {
    try { if (window.sessionStorage) store = window.sessionStorage; } catch (e) {}
  }
  if (!store) {
    const mem = {};
    store = {
      getItem(k) { return mem.hasOwnProperty(k) ? mem[k] : null; },
      setItem(k, v) { mem[k] = String(v); },
      removeItem(k) { delete mem[k]; }
    };
  }
  return store;
})();

function seenKeyFor(uid) {
  return `campus_feed_seen_guide_v1_${uid || 'anon'}`;
}

async function waitForAuthRestore(timeoutMs = 2000) {
  // Wait for Supabase to restore session (poll for up to timeoutMs)
  const s = window.supabase;
  if (!s || !s.auth) return null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const u = s.auth.getUser();
      if (u?.data?.user?.id) return u.data.user.id;
    } catch (e) { /* ignore */ }
    await new Promise(r => setTimeout(r, 100));
  }
  // final attempt
  try { const u = s.auth.getUser(); return u?.data?.user?.id || null; } catch { return null; }
}

async function maybeShowGuideModal() {
  const guideEl = document.getElementById('first-guide');
  const dismissBtn = document.getElementById('guide-dismiss');
  const neverBtn = document.getElementById('guide-never');
  if (!guideEl || !dismissBtn || !neverBtn) return;

  const uid = await waitForAuthRestore(2000);
  const key = seenKeyFor(uid);
  const seen = GuideStorage.getItem(key);
  if (seen === 'true') return; // already dismissed for this user

  // If user dismissed while anonymous earlier, migrate on sign-in
  // If user is signed in and anon flag exists, migrate it now
  const anonKey = seenKeyFor(null);
  const anonSeen = GuideStorage.getItem(anonKey);
  if (uid && anonSeen === 'true') {
    try { GuideStorage.setItem(key, 'true'); GuideStorage.removeItem(anonKey); } catch (e) {}
    return;
  }

  // Show guide
  guideEl.style.display = 'block';
  guideEl.setAttribute('aria-hidden', 'false');

  function hideAndRemember() {
    guideEl.style.display = 'none';
    guideEl.setAttribute('aria-hidden', 'true');
    try { GuideStorage.setItem(key, 'true'); } catch (e) {}
  }

  dismissBtn.addEventListener('click', () => hideAndRemember(), { once: true });
  neverBtn.addEventListener('click', () => hideAndRemember(), { once: true });
}

// If user dismisses while signed out, store anon flag; when they sign in, migrate it to their uid
(function initGuideMigration() {
  const s = window.supabase;
  if (!s || !s.auth) return;

  // On auth change: if signed in, migrate anon flag to user key
  s.auth.onAuthStateChange(async (event, session) => {
    const uid = session?.user?.id || null;
    if (uid) {
      const anonKey = seenKeyFor(null);
      try {
        const anonSeen = GuideStorage.getItem(anonKey);
        if (anonSeen === 'true') {
          const userKey = seenKeyFor(uid);
          GuideStorage.setItem(userKey, 'true');
          GuideStorage.removeItem(anonKey);
        }
      } catch (e) { /* ignore */ }
    }
    // attempt to show (or not) after auth change
    setTimeout(maybeShowGuideModal, 200);
  });

  // Try on load (auth may already be restored)
  setTimeout(maybeShowGuideModal, 400);
})();
