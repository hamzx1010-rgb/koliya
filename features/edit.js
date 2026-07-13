// features/edit.js
import { upsertMessage, messagesMap } from '../lib/ui.js';
import { supabase } from '../lib/ui.js';

function startEditFlow(item) {
  const id = item.dataset.id;
  const old = messagesMap.get(id);
  if (!old) return;
  const textEl = item.querySelector('.text');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = old.text;
  input.style.width = '100%';
  item.replaceChild(input, textEl);
  input.focus();

  const finish = async (commit) => {
    if (!commit) { item.replaceChild(textEl, input); return; }
    const newText = input.value.trim();
    if (newText === old.text) { item.replaceChild(textEl, input); return; }
    const optimistic = { ...old, text: newText, edited_at: new Date().toISOString() };
    upsertMessage(optimistic);
    try {
      const { data, error } = await supabase.from('messages').update({ text: newText, edited_at: optimistic.edited_at }).eq('id', id).select().single();
      if (error) throw error;
      upsertMessage(data);
    } catch (err) {
      upsertMessage(old);
      alert('Could not save edit: ' + (err.message || err));
    } finally {
      const restored = item.querySelector('.text') || document.createElement('div');
      restored.className = 'text';
      restored.textContent = messagesMap.get(id).text;
      item.replaceChild(restored, input);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  }, { once: true });

  input.addEventListener('blur', () => finish(true), { once: true });
}

// delegation
document.addEventListener('click', (e) => {
  if (e.target.matches('.edit-btn')) {
    const item = e.target.closest('.message');
    startEditFlow(item);
  }
});
