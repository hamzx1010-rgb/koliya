// features/dm.js
import { supabase, upsertMessage } from '../lib/ui.js';

// Minimal DM UI: open via ?feature=dm or hidden route
// This module creates a simple thread list and thread view.
// It uses the same upsert pattern and polling per open thread.

let currentThread = null;
const dmContainer = document.createElement('div');
dmContainer.id = 'dm-container';
dmContainer.style.display = 'none'; // hidden by default
document.body.appendChild(dmContainer);

function showDMUI() {
  dmContainer.style.display = 'block';
  dmContainer.innerHTML = `
    <div style="padding:8px;background:#fff;border-radius:8px;margin:12px;">
      <h3>Direct Messages</h3>
      <div id="dm-threads"></div>
      <div id="dm-thread-view" style="margin-top:8px;"></div>
    </div>
  `;
  loadThreads();
}

async function loadThreads() {
  const { data, error } = await supabase.from('dm_threads').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) { console.error('load threads', error); return; }
  const list = document.getElementById('dm-threads');
  list.innerHTML = '';
  data.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t.title || 'Thread';
    btn.dataset.threadId = t.id;
    btn.addEventListener('click', () => openThread(t.id));
    list.appendChild(btn);
  });
}

async function openThread(threadId) {
  currentThread = threadId;
  const view = document.getElementById('dm-thread-view');
  view.innerHTML = `<div id="dm-feed"></div><input id="dm-input" placeholder="Message..." /><button id="dm-send">Send</button>`;
  await pollThread(threadId);
  setInterval(() => pollThread(threadId), 2000);
}

async function pollThread(threadId) {
  const { data, error } = await supabase.from('dm_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(50);
  if (error) { console.error('dm poll', error); return; }
  data.forEach(m => {
    // map DM message into the same upsert pipeline but with thread prefix id
    upsertMessage({ ...m, id: `dm-${m.id}`, text: m.text, author: m.sender_id, created_at: m.created_at, edited_at: m.edited_at });
  });
}

// send DM
document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'dm-send') {
    const input = document.getElementById('dm-input');
    const text = input.value.trim();
    if (!text || !currentThread) return;
    input.value = '';
    const tempId = 'temp-dm-' + Math.random().toString(36).slice(2,9);
    const now = new Date().toISOString();
    upsertMessage({ id: tempId, author: 'You', text, created_at: now });
    const { data, error } = await supabase.from('dm_messages').insert({ thread_id: currentThread, text }).select().single();
    if (error) { console.error('dm send', error); removeMessage(tempId); alert('Could not send DM'); return; }
    // replace optimistic
    // note: we prefix dm id to avoid collision with feed ids
    removeMessage(tempId);
    upsertMessage({ ...data, id: `dm-${data.id}`, author: data.sender_id, text: data.text, created_at: data.created_at });
  }
});

// show DM UI if feature flag present
if (location.search.includes('feature=dm')) showDMUI();
