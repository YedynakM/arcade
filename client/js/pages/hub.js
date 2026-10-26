import { get, abortAll } from '../api.js';
import { getUser } from '../auth.js';
import { GAMES, isAvailable } from '../games/registry.js';
import { createSkeleton } from '../ui/skeleton.js';
import { showToast } from '../ui/toast.js';

const DIFFICULTIES = [
  { value: 'all', label: 'Усі' },
  { value: 'easy', label: 'Легка' },
  { value: 'medium', label: 'Середня' },
  { value: 'hard', label: 'Складна' }
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function render(container, ctx) {
  let alive = true;
  let debounceTimer = 0;
  let query = '';
  let difficulty = 'all';
  let state = null;

  const grid = el('div', 'card-grid stagger');

  // Створює картку однієї гри
  function buildCard(game, index) {
    const meta = state.serverGames[game.id] || { enabled: true, multiplier: 1 };
    const available = state.available[game.id];
    const disabled = !available || !meta.enabled;
    const isDaily = state.dailyId === game.id;

    const card = el(disabled ? 'div' : 'a', disabled ? 'card' : 'card card-hover');
    card.style.setProperty('--i', String(index));
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '0.5rem';
    if (disabled) card.style.opacity = '0.65';
    else if (state.user) card.href = `#/game/${game.id}`;
    else card.href = '#/login';

    const icon = el('div', '', game.icon);
    icon.style.fontSize = '2.5rem';
    const title = el('h3', '', game.title);
    title.style.margin = '0';
    const desc = el('p', 'field-hint', game.description);
    desc.style.margin = '0';

    const badges = el('div');
    badges.style.display = 'flex';
    badges.style.flexWrap = 'wrap';
    badges.style.gap = '0.4rem';
    if (!available) badges.append(el('span', 'badge', 'Скоро'));
    else if (!meta.enabled) badges.append(el('span', 'badge badge-danger', 'Вимкнено'));
    if (isDaily && !disabled) badges.append(el('span', 'badge badge-accent', 'Гра дня ×2'));
    if (meta.multiplier !== 1 && !disabled) badges.append(el('span', 'badge badge-primary', `Очки ×${meta.multiplier}`));

    card.append(icon, title, desc, badges);
    return card;
  }

  // Перемальовує каталог за пошуком і фільтром
  function renderGrid() {
    grid.innerHTML = '';
    const q = query.trim().toLowerCase();
    // Складність обирається в самій грі: фільтр не приховує ігор, що доступні на будь-якому рівні
    const list = GAMES.filter((g) => !q || g.title.toLowerCase().includes(q));
    if (!list.length) {
      grid.append(el('p', 'placeholder', 'Нічого не знайдено'));
      return;
    }
    list.forEach((g, i) => grid.append(buildCard(g, i)));
  }

  async function load() {
    container.innerHTML = '';
    container.append(el('h1', '', 'Ігри'), createSkeleton('card', 6));

    const user = getUser();
    try {
      const [data, availList] = await Promise.all([
        user ? get('/games') : Promise.resolve(null),
        Promise.all(GAMES.map((g) => isAvailable(g.id)))
      ]);
      if (!alive) return;

      const serverGames = {};
      if (data) for (const g of data.games) serverGames[g.id] = g;
      const available = {};
      GAMES.forEach((g, i) => { available[g.id] = availList[i]; });
      state = {
        user,
        serverGames,
        available,
        dailyId: data && data.dailyGame ? data.dailyGame.gameId : ''
      };

      container.innerHTML = '';
      container.append(el('h1', '', 'Ігри'));
      if (!user) {
        const hint = el('p', 'card');
        hint.append('Увійдіть, щоб грати. ');
        const link = el('a', '', 'Увійти');
        link.href = '#/login';
        hint.append(link);
        container.append(hint);
      }

      const toolbar = el('div');
      toolbar.style.display = 'flex';
      toolbar.style.flexWrap = 'wrap';
      toolbar.style.gap = '0.75rem';
      toolbar.style.margin = '1rem 0';

      const search = el('input');
      search.type = 'search';
      search.placeholder = 'Пошук за назвою';
      search.setAttribute('aria-label', 'Пошук за назвою');
      search.className = 'field';
      search.style.padding = '0.6rem 0.75rem';
      search.style.flex = '1 1 200px';
      search.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          query = search.value;
          renderGrid();
        }, 300);
      });

      const tabs = el('div', 'tabs');
      tabs.style.margin = '0';
      tabs.setAttribute('role', 'group');
      tabs.setAttribute('aria-label', 'Складність');
      for (const d of DIFFICULTIES) {
        const tab = el('button', d.value === difficulty ? 'tab active' : 'tab', d.label);
        tab.type = 'button';
        tab.addEventListener('click', () => {
          difficulty = d.value;
          tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(renderGrid, 300);
        });
        tabs.append(tab);
      }

      toolbar.append(search, tabs);
      container.append(toolbar, grid);
      renderGrid();
    } catch (err) {
      if (!alive || err.aborted) return;
      container.innerHTML = '';
      container.append(el('h1', '', 'Ігри'));
      const box = el('div', 'card placeholder');
      box.append(el('p', '', err.message || 'Не вдалося завантажити каталог'));
      const retry = el('button', 'btn btn-primary', 'Спробувати ще');
      retry.type = 'button';
      retry.addEventListener('click', load);
      box.append(retry);
      container.append(box);
      showToast(err.message || 'Не вдалося завантажити каталог', 'error');
    }
  }

  await load();

  return function cleanup() {
    alive = false;
    clearTimeout(debounceTimer);
    abortAll();
  };
}