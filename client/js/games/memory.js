// Гра «Пам'ять»: знайди всі пари однакових карток
const SIZES = {
  easy: { cols: 4, rows: 3, base: 100 },
  medium: { cols: 4, rows: 4, base: 200 },
  hard: { cols: 6, rows: 4, base: 350 }
};

const THEMES = {
  animals: { label: 'Тварини', items: ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐰', '🐨', '🐯', '🐷', '🐮'] },
  fruits: { label: 'Фрукти', items: ['🍎', '🍌', '🍇', '🍓', '🍉', '🍒', '🍍', '🥝', '🍑', '🍋', '🥭', '🍐'] },
  space: { label: 'Космос', items: ['🚀', '🌍', '🌙', '⭐', '🪐', '☄️', '🛸', '👽', '🌞', '🌟', '🔭', '🌌'] },
  transport: { label: 'Транспорт', items: ['🚗', '🚌', '🚲', '✈️', '🚂', '🚢', '🚁', '🛵', '🚜', '🚒', '🚑', '🏍️'] }
};

const MISMATCH_MS = 800;

const CSS = `
.mem-bar{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between;margin-bottom:.75rem}
.mem-stats{display:flex;flex-wrap:wrap;gap:.5rem}
.mem-board{display:grid;gap:.5rem;margin:0 auto;width:100%}
.mem-board.mem-locked{pointer-events:none}
.mem-card{position:relative;aspect-ratio:1/1;padding:0;border:none;background:transparent;perspective:600px;cursor:pointer;min-width:0}
.mem-inner{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .3s ease}
.mem-card.open .mem-inner,.mem-card.matched .mem-inner{transform:rotateY(180deg)}
.mem-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:12px;border:2px solid var(--border);backface-visibility:hidden;-webkit-backface-visibility:hidden}
.mem-back{background:var(--primary);color:var(--text-on-primary);font-size:1.5rem;font-weight:800}
.mem-front{background:var(--surface-2);transform:rotateY(180deg);font-size:clamp(1.4rem,6vw,2.6rem)}
.mem-card.matched .mem-front{border-color:var(--success);box-shadow:var(--shadow)}
.mem-card.wrong .mem-front{border-color:var(--danger)}
.mem-card:focus-visible .mem-face{outline:3px solid var(--focus);outline-offset:2px}
.mem-result{margin-top:1rem;text-align:center;font-weight:700}
@media (prefers-reduced-motion:reduce){.mem-inner{transition:none}}
`;

let root = null;
let state = null;
let timerId = 0;
let hideTimer = 0;
let options = { difficulty: 'easy', onFinish: null };
let theme = 'animals';
let els = {};

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function node(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function clearTimers() {
  clearInterval(timerId);
  clearTimeout(hideTimer);
  timerId = 0;
  hideTimer = 0;
}

function elapsedSec(s) {
  return s.startAt ? Math.floor((Date.now() - s.startAt) / 1000) : 0;
}

function updateStats() {
  const s = state;
  els.attempts.textContent = `Спроби: ${s.attempts}`;
  els.mistakes.textContent = `Помилки: ${s.mistakes}`;
  els.time.textContent = `Час: ${elapsedSec(s)} с`;
}

function setLabel(c, i) {
  const shown = c.open || c.matched;
  c.el.setAttribute('aria-label', shown ? `Картка ${i + 1}: ${c.emoji}, відкрита` : `Картка ${i + 1}, закрита`);
}

function calcScore(s, durationSec) {
  const base = SIZES[options.difficulty].base;
  const raw = base - durationSec - 5 * s.mistakes;
  return Math.max(Math.round(base * 0.1), Math.round(raw));
}

function finish(s) {
  clearTimers();
  const durationSec = elapsedSec(s);
  const score = calcScore(s, durationSec);
  s.done = true;
  els.time.textContent = `Час: ${durationSec} с`;
  els.board.classList.add('mem-locked');
  els.result.textContent = `Усі пари знайдено! Спроби: ${s.attempts}. Помилки: ${s.mistakes}. Час: ${durationSec} с. Очки: ${score}`;
  els.result.hidden = false;
  if (!s.reported) {
    s.reported = true;
    if (typeof options.onFinish === 'function') {
      options.onFinish({
        score,
        won: true,
        durationSec,
        details: { pairs: s.pairs, attempts: s.attempts, mistakes: s.mistakes, theme }
      });
    }
  }
}

function onCard(i) {
  const s = state;
  if (!s || s.done || s.locked) return;
  const c = s.cards[i];
  if (c.open || c.matched) return;

  // Таймер стартує з першого кліку
  if (!s.startAt) {
    s.startAt = Date.now();
    timerId = setInterval(updateStats, 250);
  }

  c.open = true;
  c.el.classList.add('open');
  setLabel(c, i);

  if (s.first === null) {
    s.first = i;
    return;
  }

  const a = s.cards[s.first];
  const firstIndex = s.first;
  s.attempts += 1;
  if (a.emoji === c.emoji) {
    a.matched = c.matched = true;
    s.matched += 1;
    s.first = null;
    a.el.classList.add('matched');
    c.el.classList.add('matched');
    updateStats();
    if (s.matched === s.pairs) finish(s);
    return;
  }

  s.mistakes += 1;
  s.locked = true;
  a.el.classList.add('wrong');
  c.el.classList.add('wrong');
  updateStats();
  hideTimer = setTimeout(() => {
    if (state !== s) return;
    for (const [card, idx] of [[a, firstIndex], [c, i]]) {
      card.open = false;
      card.el.classList.remove('open', 'wrong');
      setLabel(card, idx);
    }
    s.first = null;
    s.locked = false;
  }, MISMATCH_MS);
}

// Нова партія: попередня вважається покинутою, onFinish не викликається
function newGame() {
  clearTimers();
  const size = SIZES[options.difficulty] || SIZES.easy;
  const pairs = (size.cols * size.rows) / 2;
  const chosen = shuffle(THEMES[theme].items).slice(0, pairs);
  const deck = shuffle([...chosen, ...chosen]);

  const s = { cards: [], first: null, locked: false, attempts: 0, mistakes: 0, startAt: 0, done: false, reported: false, matched: 0, pairs };
  state = s;

  els.board.innerHTML = '';
  els.board.classList.remove('mem-locked');
  els.board.style.gridTemplateColumns = `repeat(${size.cols}, minmax(0, 1fr))`;
  els.board.style.maxWidth = `${size.cols * 6.5}rem`;
  els.result.hidden = true;
  els.result.textContent = '';

  deck.forEach((emoji, i) => {
    const btn = node('button', 'mem-card');
    btn.type = 'button';
    const inner = node('span', 'mem-inner');
    inner.append(node('span', 'mem-face mem-back', '?'), node('span', 'mem-face mem-front', emoji));
    btn.append(inner);
    btn.addEventListener('click', () => onCard(i));
    const card = { emoji, el: btn, open: false, matched: false };
    s.cards.push(card);
    setLabel(card, i);
    els.board.append(btn);
  });
  updateStats();
}

function buildUi(container) {
  container.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = CSS;

  const bar = node('div', 'mem-bar');
  const tabs = node('div', 'tabs');
  tabs.style.margin = '0';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Тема');
  for (const [key, t] of Object.entries(THEMES)) {
    const tab = node('button', key === theme ? 'tab active' : 'tab', t.label);
    tab.type = 'button';
    tab.addEventListener('click', () => {
      theme = key;
      tabs.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === tab));
      newGame();
    });
    tabs.append(tab);
  }
  const restart = node('button', 'btn', 'Нова гра');
  restart.type = 'button';
  restart.addEventListener('click', newGame);
  bar.append(tabs, restart);

  const stats = node('div', 'mem-stats');
  els.attempts = node('span', 'badge');
  els.mistakes = node('span', 'badge');
  els.time = node('span', 'badge');
  stats.append(els.attempts, els.mistakes, els.time);
  stats.style.marginBottom = '.75rem';

  els.board = node('div', 'mem-board');
  els.result = node('div', 'mem-result card');
  els.result.setAttribute('role', 'status');
  els.result.hidden = true;

  container.append(style, bar, stats, els.board, els.result);
}

export default {
  id: 'memory',
  title: 'Пам\'ять',
  icon: '🃏',
  description: 'Знайди всі пари однакових карток',

  mount(container, ctx) {
    this.unmount();
    root = container;
    options = {
      difficulty: ctx && SIZES[ctx.difficulty] ? ctx.difficulty : 'easy',
      onFinish: ctx ? ctx.onFinish : null
    };
    theme = 'animals';
    els = {};
    buildUi(container);
    newGame();
  },

  unmount() {
    clearTimers();
    state = null;
    if (root) root.innerHTML = '';
    root = null;
    els = {};
  }
};