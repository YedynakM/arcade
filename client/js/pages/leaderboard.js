import { get, abortAll } from '../api.js';
import { getUser } from '../auth.js';
import { GAMES } from '../games/registry.js';
import { createSkeleton } from '../ui/skeleton.js';
import { showToast } from '../ui/toast.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function render(container, ctx) {
  let alive = true;
  let gameId = '';
  let page = 1;
  // Лічильник запитів: відповідь застарілого запиту ігнорується
  let requestId = 0;

  const me = getUser();

  container.innerHTML = '';
  container.append(el('h1', '', 'Рейтинг'));

  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div');
  container.append(tabs, body);

  const tabItems = [{ id: '', label: 'Загальний' }, ...GAMES.map((g) => ({ id: g.id, label: `${g.icon} ${g.title}` }))];
  for (const t of tabItems) {
    const btn = el('button', t.id === gameId ? 'tab active' : 'tab', t.label);
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => {
      if (gameId === t.id) return;
      gameId = t.id;
      page = 1;
      tabs.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === btn));
      load();
    });
    tabs.append(btn);
  }

  function buildTable(data) {
    const wrap = el('div', 'table-wrap stagger');
    const table = el('table');
    const head = el('thead');
    const hr = el('tr');
    for (const h of ['Місце', 'Аватар', 'Нік', 'Рівень', 'Очки']) hr.append(el('th', '', h));
    head.append(hr);
    const tbody = el('tbody');

    for (const item of data.items) {
      const tr = el('tr');
      if (me && item.id === me.id) {
        tr.style.fontWeight = '700';
        tr.style.background = 'var(--surface-2)';
        tr.setAttribute('aria-current', 'true');
      }
      tr.append(
        el('td', '', String(item.rank)),
        el('td', '', item.avatar),
        el('td', '', item.nickname),
        el('td', '', item.level),
        el('td', '', String(item.points))
      );
      tbody.append(tr);
    }
    table.append(head, tbody);
    wrap.append(table);
    return wrap;
  }

  function buildPager(data) {
    const pager = el('div');
    pager.style.display = 'flex';
    pager.style.alignItems = 'center';
    pager.style.justifyContent = 'center';
    pager.style.gap = '0.75rem';
    pager.style.marginTop = '1rem';

    const prev = el('button', 'btn', 'Попередня');
    prev.type = 'button';
    prev.disabled = data.page <= 1;
    prev.addEventListener('click', () => { page = data.page - 1; load(); });

    const label = el('span', '', `Сторінка ${data.page} з ${data.pages}`);

    const next = el('button', 'btn', 'Наступна');
    next.type = 'button';
    next.disabled = data.page >= data.pages;
    next.addEventListener('click', () => { page = data.page + 1; load(); });

    pager.append(prev, label, next);
    return pager;
  }

  async function load() {
    const id = ++requestId;
    // Перемикання вкладки чи сторінки скасовує попередній запит
    abortAll();
    body.innerHTML = '';
    body.append(createSkeleton('row', 6));

    const query = `/leaderboard?gameId=${encodeURIComponent(gameId)}&page=${page}`;
    try {
      const data = await get(query);
      if (!alive || id !== requestId) return;
      page = data.page;
      body.innerHTML = '';
      if (!data.items.length) {
        body.append(el('p', 'card placeholder', 'Поки що немає результатів.'));
        return;
      }
      body.append(buildTable(data), buildPager(data));
    } catch (err) {
      if (!alive || id !== requestId || err.aborted) return;
      body.innerHTML = '';
      const box = el('div', 'card placeholder');
      box.append(el('p', '', err.message || 'Не вдалося завантажити рейтинг'));
      const retry = el('button', 'btn btn-primary', 'Спробувати ще');
      retry.type = 'button';
      retry.addEventListener('click', load);
      box.append(retry);
      body.append(box);
      showToast(err.message || 'Не вдалося завантажити рейтинг', 'error');
    }
  }

  await load();

  return function cleanup() {
    alive = false;
    abortAll();
  };
}