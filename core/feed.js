// core/feed.js
import { supabase, upsertMessage, fmtTime, feedEl } from '../lib/ui.js';

let lastFetchedAt = null;
let pollingInterval = null;

export async function loadInitial() {
  const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) { console.error('initial load error', error); return; }
  data.forEach(m => upsertMessage(m));
  if (data.length) lastFetchedAt = data[0].created_at;
}

export async function pollNew() {
  if (!lastFetchedAt) return;
  const { data, error } = await supabase.from('messages').select('*').gt('created_at', lastFetchedAt).order('created_at', { ascending: false });
  if (error) { console.error('poll error', error); return; }
  if (data && data.length) {
    data.forEach(m => upsertMessage(m));
    lastFetchedAt = data[0].created_at || lastFetchedAt;
  }
}

export async function sendMessage(text) {
  const tempId = 'temp-' + Math.random().toString(36).slice(2,9);
  const now = new Date().toISOString();
  const optimistic = { id: tempId, author: 'You', text, created_at: now };
  upsertMessage(optimistic);

  const { data, error } = await supabase.from('messages').insert({ text, author: 'You' }).select().single();
  if (error) {
    console.error('send error', error);
    removeMessage(tempId);
    alert('Could not send message: ' + (error.message || error));
    return;
  }
  // replace optimistic
  removeMessage(tempId);
  upsertMessage(data);
  lastFetchedAt = lastFetchedAt ? lastFetchedAt : data.created_at;
}

// wire composer
document.addEventListener('click', (e) => {
  if (e.target.id === 'sendBtn') {
    const input = document.getElementById('newText');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendMessage(text);
  }
});

// init
(async function init() {
  await loadInitial();
  pollingInterval = setInterval(pollNew, 2000);
})();
