import { get, post, abortAll } from '../api.js';
import { getUser, loadMe } from '../auth.js';
import { navigate } from '../router.js';
import { getGameMeta, loadGame } from '../games/registry.js';
import { animateNumber } from '../ui/counter.js';
import { showToast } from '../ui/toast.js';

const LEVELS = [
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
  const user = getUser();
  if (!user) {
    navigate('/login');
    return null;
  }

  let alive = true;
  let game = null;
  let mounted = false;

  function stopGame() {
    if (game && mounted) {
      try { game.unmount(); } catch (e) { /* гра не має ламати сторінку */ }
    }
    mounted = false;
  }

  // Повідомлення з кнопкою повернення до каталогу
  function showMessage(text) {
    container.innerHTML = '';
    const box = el('div', 'card placeholder');
    box.append(el('p', '', text));
    const back = el('a', 'btn btn-primary', 'До каталогу');
    back.href = '#/hub';
    box.append(back);
    container.append(box);
  }

  const id = ctx.params.id;
  const meta = getGameMeta(id);
  if (!meta) {
    showMessage('Невідома гра.');
    return () => {};
  }

  container.innerHTML = '';
  container.append(el('p', '', 'Завантаження...'));

  try {
    const [data, loaded] = await Promise.all([get('/games'), loadGame(id)]);
    if (!alive) return () => {};
    const serverGame = data.games.find((g) => g.id === id);
    if (!serverGame || !serverGame.enabled) {
      showMessage('Цю гру вимкнено адміністратором.');
      return () => {};
    }
    if (!loaded) {
      showMessage('Ця гра ще не створена. Скоро!');
      return () => {};
    }
    game = loaded;
  } catch (err) {
    if (!err.aborted) {
      showMessage(err.message || 'Не вдалося завантажити гру.');
      showToast(err.message || 'Не вдалося завантажити гру', 'error');
    }
    return () => { alive = false; };
  }

  // Екран вибору складності
  function showStart() {
    stopGame();
    container.innerHTML = '';
    container.append(el('h1', '', `${meta.icon} ${meta.title}`));

    const card = el('section', 'card');
    card.append(el('p', '', meta.description));
    card.append(el('h3', '', 'Складність'));

    let difficulty = 'easy';
    const tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'group');
    for (const l of LEVELS) {
      const tab = el('button', l.value === difficulty ? 'tab active' : 'tab', l.label);
      tab.type = 'button';
      tab.addEventListener('click', () => {
        difficulty = l.value;
        tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      });
      tabs.append(tab);
    }

    const start = el('button', 'btn btn-primary', 'Почати');
    start.type = 'button';
    start.addEventListener('click', () => startGame(difficulty));
    const back = el('a', 'btn btn-ghost', 'До каталогу');
    back.href = '#/hub';

    const actions = el('div');
    actions.style.display = 'flex';
    actions.style.gap = '0.6rem';
    actions.append(start, back);
    card.append(tabs, actions);
    container.append(card);
  }

  // Запуск партії: onFinish спрацьовує рівно один раз
  function startGame(difficulty) {
    container.innerHTML = '';
    container.append(el('h1', '', `${meta.icon} ${meta.title}`));
    const area = el('div');
    container.append(area);

    let finished = false;
    const onFinish = async (result) => {
      if (finished || !alive) return;
      finished = true;
      stopGame();
      await submitResult(difficulty, result);
    };

    try {
      game.mount(area, { difficulty, onFinish });
      mounted = true;
    } catch (err) {
      showToast('Не вдалося запустити гру', 'error');
      showStart();
    }
  }

  async function submitResult(difficulty, result) {
    container.innerHTML = '';
    container.append(el('p', '', 'Збереження результату...'));
    const r = result || {};
    try {
      const res = await post('/scores', {
        gameId: id,
        difficulty,
        score: Math.max(0, Math.round(Number(r.score) || 0)),
        won: !!r.won,
        durationSec: Math.max(0, Math.round(Number(r.durationSec) || 0)),
        details: r.details && typeof r.details === 'object' ? r.details : {}
      });
      if (!alive) return;
      await loadMe();
      if (!alive) return;
      showResult(difficulty, res);
    } catch (err) {
      if (!alive || err.aborted) return;
      showToast(err.message || 'Не вдалося зберегти результат', 'error');
      showStart();
    }
  }

  // Екран результату
  function showResult(difficulty, res) {
    container.innerHTML = '';
    container.append(el('h1', '', 'Результат'));

    const card = el('section', 'card stagger');
    card.style.textAlign = 'center';

    const awarded = el('div', '', '0');
    awarded.style.fontSize = '3rem';
    awarded.style.fontWeight = '800';
    animateNumber(awarded, res.awarded, 900);
    const total = el('div');
    total.append('Всього очок: ');
    const totalNum = el('strong', '', '0');
    total.append(totalNum);
    animateNumber(totalNum, res.total, 900);

    card.append(el('div', 'field-hint', 'Нараховано очок'), awarded, total);
    if (res.newRecord) card.append(el('p', 'badge badge-accent', 'Новий рекорд!'));

    if (res.achievements && res.achievements.length) {
      card.append(el('h3', '', 'Нові досягнення'));
      for (const a of res.achievements) {
        card.append(el('p', '', `${a.icon} ${a.title}`));
      }
    }

    const again = el('button', 'btn btn-primary', 'Ще раз');
    again.type = 'button';
    again.addEventListener('click', () => startGame(difficulty));
    const back = el('a', 'btn', 'До каталогу');
    back.href = '#/hub';
    const actions = el('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'center';
    actions.style.gap = '0.6rem';
    actions.style.marginTop = '1rem';
    actions.append(again, back);
    card.append(actions);
    container.append(card);
  }

  showStart();

  return function cleanup() {
    alive = false;
    stopGame();
    abortAll();
  };
}