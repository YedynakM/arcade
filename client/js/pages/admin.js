import { abortAll } from '../api.js';
import { isAdmin } from '../auth.js';
import { navigate } from '../router.js';
import { renderSettings, renderUsers, renderStats, renderFeedback } from './adminParts.js';

const TABS = [
  { id: 'settings', label: 'Налаштування', render: renderSettings },
  { id: 'users', label: 'Користувачі', render: renderUsers },
  { id: 'stats', label: 'Статистика', render: renderStats },
  { id: 'feedback', label: 'Повідомлення', render: renderFeedback }
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function render(container, ctx) {
  if (!isAdmin()) {
    navigate('/');
    return null;
  }

  let alive = true;
  // Функція очищення активної вкладки (polling, запити)
  let tabCleanup = null;
  let current = '';

  container.innerHTML = '';
  container.append(el('h1', '', 'Адмінка'));

  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div');
  container.append(tabs, body);

  function stopTab() {
    if (typeof tabCleanup === 'function') {
      try { tabCleanup(); } catch (e) { /* очищення не має ламати перемикання */ }
    }
    tabCleanup = null;
    abortAll();
  }

  async function openTab(id) {
    if (current === id) return;
    current = id;
    stopTab();
    tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
    body.innerHTML = '';
    const tab = TABS.find((t) => t.id === id);
    const result = await tab.render(body);
    // Якщо за час завантаження сторінку закрито або вкладку змінено, одразу очищаємо
    if (!alive || current !== id) {
      if (typeof result === 'function') result();
      return;
    }
    tabCleanup = typeof result === 'function' ? result : null;
  }

  for (const t of TABS) {
    const btn = el('button', 'tab', t.label);
    btn.type = 'button';
    btn.dataset.tab = t.id;
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => openTab(t.id));
    tabs.append(btn);
  }

  await openTab('settings');

  return function cleanup() {
    alive = false;
    stopTab();
  };
}