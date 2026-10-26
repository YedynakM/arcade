import { get, abortAll } from '../api.js';
import { getUser } from '../auth.js';
import { createSkeleton } from '../ui/skeleton.js';
import { animateNumber } from '../ui/counter.js';
import { showToast } from '../ui/toast.js';

// Іконки та назви ігор (до появи games/registry.js)
const GAMES = {
  tictactoe: { icon: '❌', title: 'Хрестики-нулики' },
  maze: { icon: '🧩', title: 'Лабіринт' },
  puzzle: { icon: '🖼️', title: 'Пазл' },
  memory: { icon: '🃏', title: 'Пам\'ять' },
  snake: { icon: '🐍', title: 'Змійка' },
  game2048: { icon: '🔢', title: '2048' },
  guessnumber: { icon: '🎯', title: 'Вгадай число' }
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Блок «Гра дня ×2»
function buildDaily(dailyGame, user) {
  const card = el('section', 'card');
  card.append(el('h2', '', 'Гра дня ×2'));

  const game = dailyGame && GAMES[dailyGame.gameId];
  if (!game) {
    card.append(el('p', '', 'Гру дня ще не обрано.'));
    return card;
  }

  const row = el('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '1rem';
  row.style.flexWrap = 'wrap';

  const icon = el('span', '', game.icon);
  icon.style.fontSize = '2.5rem';
  const name = el('strong', '', game.title);
  name.style.fontSize = '1.2rem';

  const play = el('a', 'btn btn-primary', 'Грати');
  play.href = `#/game/${dailyGame.gameId}`;
  play.style.marginLeft = 'auto';

  row.append(icon, name, play);
  card.append(row);
  if (!user) {
    card.append(el('p', 'field-hint', 'Увійдіть, щоб грати й отримувати подвійні очки.'));
  }
  return card;
}

// Топ-3 гравці
function buildTop3(top3) {
  const card = el('section', 'card');
  card.append(el('h2', '', 'Топ-3 гравці'));

  if (!top3.length) {
    card.append(el('p', '', 'Поки немає гравців у рейтингу.'));
    return card;
  }

  const list = el('div', 'stagger');
  list.style.display = 'grid';
  list.style.gap = '0.6rem';
  const medals = ['🥇', '🥈', '🥉'];

  top3.forEach((p, i) => {
    const row = el('div', 'card card-hover');
    row.style.setProperty('--i', String(i));
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '0.75rem';

    const avatar = el('span', '', p.avatar);
    avatar.style.fontSize = '1.8rem';
    const info = el('div');
    info.append(el('strong', '', `${medals[i] || ''} ${p.nickname}`), el('div', 'field-hint', p.level));
    const points = el('span', 'badge badge-primary', `${p.points} очк.`);
    points.style.marginLeft = 'auto';

    row.append(avatar, info, points);
    list.append(row);
  });

  card.append(list);
  return card;
}

// Лічильник із підписом
function buildCounter(label, value, index) {
  const card = el('div', 'card');
  card.style.setProperty('--i', String(index));
  card.style.textAlign = 'center';
  const num = el('div', '', '0');
  num.style.fontSize = '2.2rem';
  num.style.fontWeight = '800';
  card.append(num, el('div', 'field-hint', label));
  animateNumber(num, value, 900);
  return card;
}

export async function render(container, ctx) {
  let alive = true;

  async function load() {
    container.innerHTML = '';
    container.append(el('h1', '', 'Аркада'));
    const skeleton = createSkeleton('card', 3);
    container.append(skeleton);

    const user = getUser();
    try {
      // Для гостя запит ігор пропускається
      const [summary] = await Promise.all([
        get('/summary'),
        user ? get('/games') : Promise.resolve(null)
      ]);
      if (!alive) return;

      container.innerHTML = '';
      container.append(el('h1', '', user ? `Привіт, ${user.nickname}!` : 'Аркада'));

      const counters = el('div', 'card-grid stagger');
      counters.append(
        buildCounter('Гравців', summary.totalPlayers, 0),
        buildCounter('Партій', summary.totalGames, 1)
      );

      const grid = el('div', 'stagger');
      grid.style.display = 'grid';
      grid.style.gap = '1rem';
      const daily = buildDaily(summary.dailyGame, user);
      daily.style.setProperty('--i', '0');
      const top = buildTop3(summary.top3 || []);
      top.style.setProperty('--i', '1');
      grid.append(daily, top);

      container.append(counters, grid);
    } catch (err) {
      if (!alive || err.aborted) return;
      container.innerHTML = '';
      container.append(el('h1', '', 'Аркада'));
      const box = el('div', 'card placeholder');
      box.append(el('p', '', err.message || 'Не вдалося завантажити дані'));
      const retry = el('button', 'btn btn-primary', 'Спробувати ще');
      retry.type = 'button';
      retry.addEventListener('click', load);
      box.append(retry);
      container.append(box);
      showToast(err.message || 'Не вдалося завантажити дані', 'error');
    }
  }

  await load();

  return function cleanup() {
    alive = false;
    abortAll();
  };
}