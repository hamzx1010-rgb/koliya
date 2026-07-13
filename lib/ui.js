// lib/ui.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.mjs';

const SUPABASE_URL = window.__ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.__ENV?.SUPABASE_ANON_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const feedEl = document.getElementById('feed');
export const messagesMap = new Map();

export function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString(); } catch { return ''; }
}

export function updateDomFromMsg(el, msg) {
  el.querySelector('.author').textContent = msg.author || 'Anon';
  el.querySelector('.time').textContent = fmtTime(msg.created_at || msg.updated_at || new Date().toISOString());
  el.querySelector('.text').textContent = msg.text || '';
  const editedFlag = el.querySelector('.edited');
  editedFlag.style.display = msg.edited_at ? 'inline' : 'none';
}

export function renderMessage(msg) {
  const id = msg.id;
  let el = feedEl.querySelector(`[data-id="${id}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'message';
    el.dataset.id = id;
    el.innerHTML = `
      <div class="meta"><strong class="author"></strong> · <span class="time"></span><span class="edited" style="display:none">edited</span></div>
      <div class="text"></div>
      <div class="controls"><button class="edit-btn">Edit</button></div>
    `;
    feedEl.prepend(el);
  }
  updateDomFromMsg(el, msg);
}

export function upsertMessage(msg) {
  messagesMap.set(msg.id, msg);
  renderMessage(msg);
}

export function removeMessage(id) {
  messagesMap.delete(id);
  const node = feedEl.querySelector(`[data-id="${id}"]`);
  if (node) node.remove();
}
