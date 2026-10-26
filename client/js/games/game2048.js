// client/js/games/game2048.js
// Гра «2048»: ковзання й злиття плиток, стрілки/WASD, свайпи, кнопки-стрілки.

const CONFIG = {
  easy: { size: 5, chanceTwo: 0.9 },
  medium: { size: 4, chanceTwo: 0.9 },
  hard: { size: 4, chanceTwo: 0.7 }
};
const TARGET = 2048;
const MOVE_MS = 120;
const SWIPE_PX = 24;
const MAX_BOARD_PX = 480;
const STYLE_ID = 'game2048-style';
const SWIPE_END_EVENTS = ['pointerup', 'pointercancel', 'pointerleave'];

// e.code не залежить від розкладки, тому WASD працює і з українською
const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right'
};

const STYLES = `
.g2 { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; color: var(--color-text, #1f2430); }
.g2-row { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
.g2-hud { gap: 6px 16px; font-weight: 600; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
.g2-btn {
  padding: 8px 14px; font-size: 0.95rem; cursor: pointer; touch-action: manipulation; user-select: none;
  background: var(--color-surface, #ffffff); color: var(--color-text, #1f2430);
  border: 2px solid rgba(128, 128, 128, 0.45); border-radius: 8px;
  transition: background-color 0.2s, border-color 0.2s;
}
.g2-btn:hover:not(:disabled) { background: rgba(128, 128, 128, 0.15); }
.g2-btn-accent, .g2-btn-accent:hover:not(:disabled) {
  background: var(--color-accent, #3b6ef5); border-color: var(--color-accent, #3b6ef5); color: #ffffff;
}
.g2-boardwrap { position: relative; width: min(100%, ${MAX_BOARD_PX}px); aspect-ratio: 1; touch-action: none; user-select: none; }
.g2-board {
  position: absolute; inset: 0; container-type: inline-size; display: grid;
  grid-template-columns: repeat(var(--n), 1fr); grid-template-rows: repeat(var(--n), 1fr);
  background: rgba(128, 128, 128, 0.3); border-radius: 8px;
}
.g2-cell { margin: 1.2cqw; background: rgba(128, 128, 128, 0.18); border-radius: 6px; }
.g2-tiles { position: absolute; inset: 0; isolation: isolate; }
.g2-tile {
  position: absolute; left: 0; top: 0; box-sizing: border-box; padding: 1.2cqw; pointer-events: none;
  width: calc(100% / var(--n)); height: calc(100% / var(--n));
  transition: transform ${MOVE_MS}ms ease-out;
}
.g2-tile-inner {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; font-weight: 700; line-height: 1; font-size: calc(42cqw / var(--n));
}
.g2-d3 { font-size: calc(34cqw / var(--n)); }
.g2-d4 { font-size: calc(27cqw / var(--n)); }
.g2-d5 { font-size: calc(22cqw / var(--n)); }
.g2-v2 { background: #eee4da; color: #1f2430; }
.g2-v4 { background: #ede0c8; color: #1f2430; }
.g2-v8 { background: #f2b179; color: #ffffff; }
.g2-v16 { background: #f59563; color: #ffffff; }
.g2-v32 { background: #f67c5f; color: #ffffff; }
.g2-v64 { background: #f65e3b; color: #ffffff; }
.g2-v128 { background: #edcf72; color: #1f2430; }
.g2-v256 { background: #edcc61; color: #1f2430; }
.g2-v512 { background: #edc850; color: #1f2430; }
.g2-v1024 { background: #edc53f; color: #1f2430; }
.g2-v2048 { background: #edc22e; color: #1f2430; box-shadow: 0 0 12px 2px rgba(237, 194, 46, 0.7); }
.g2-vbig { background: #3c3a32; color: #ffffff; }
.g2-new { animation: g2-appear 0.16s ease-out both; }
.g2-pop { animation: g2-pop 0.18s ease-out; }
@keyframes g2-appear { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes g2-pop { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
.g2-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 16px; text-align: center; font-weight: 700; font-size: 1.15rem; color: #ffffff;
  background: rgba(15, 23, 42, 0.78); border-radius: 8px; animation: g2-fade 0.25s ease-out;
}
.g2-overlay[hidden], .g2-overlay .g2-btn[hidden] { display: none; }
@keyframes g2-fade { from { opacity: 0; } to { opacity: 1; } }
.g2-pad { display: grid; grid-template-columns: repeat(3, 56px); gap: 6px; justify-content: center; }
.g2-key { height: 56px; padding: 0; font-size: 1.4rem; border-radius: 10px; }
.g2-key:active { transform: scale(0.95); }
.g2-key-up { grid-column: 2; grid-row: 1; }
.g2-key-left { grid-column: 1; grid-row: 2; }
.g2-key-down { grid-column: 2; grid-row: 2; }
.g2-key-right { grid-column: 3; grid-row: 2; }
`;

/* ---------- Допоміжне ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeButton(className, text, dataName, dataValue) {
  const button = el('button', className, text);
  button.type = 'button';
  button.dataset[dataName] = dataValue;
  return button;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/* ---------- Чиста логіка ---------- */

// Клітинка k-та від краю, до якого рухаються плитки, у рядку/стовпці line
function cellAt(dir, line, k, n) {
  if (dir === 'left') return [line, k];
  if (dir === 'right') return [line, n - 1 - k];
  if (dir === 'up') return [k, line];
  return [n - 1 - k, line];
}

/* ---------- Модуль гри ---------- */

function createGame2048() {
  let state = null;

  function buildDom(container, n) {
    const style = el('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;

    const root = el('div', 'g2');

    const hud = el('div', 'g2-row g2-hud');
    const scoreEl = el('span');
    const bestEl = el('span');
    const recordEl = el('span');
    hud.append(scoreEl, bestEl, recordEl);

    const actions = el('div', 'g2-row');
    actions.appendChild(makeButton('g2-btn g2-btn-accent', 'Нова гра', 'action', 'restart'));

    const wrap = el('div', 'g2-boardwrap');
    wrap.style.setProperty('--n', String(n));
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Поле гри 2048');
    const board = el('div', 'g2-board');
    for (let i = 0; i < n * n; i += 1) board.appendChild(el('div', 'g2-cell'));
    const layer = el('div', 'g2-tiles');
    board.appendChild(layer);

    const overlay = el('div', 'g2-overlay');
    overlay.hidden = true;
    overlay.setAttribute('aria-live', 'polite');
    const msgEl = el('div');
    const overActions = el('div', 'g2-row');
    const continueBtn = makeButton('g2-btn', 'Продовжувати', 'action', 'continue');
    const finishBtn = makeButton('g2-btn g2-btn-accent', 'Завершити', 'action', 'finish');
    const againBtn = makeButton('g2-btn g2-btn-accent', 'Грати ще раз', 'action', 'restart');
    overActions.append(continueBtn, finishBtn, againBtn);
    overlay.append(msgEl, overActions);
    wrap.append(board, overlay);

    const pad = el('div', 'g2-pad');
    [['up', '▲', 'Вгору'], ['left', '◀', 'Ліворуч'], ['down', '▼', 'Вниз'], ['right', '▶', 'Праворуч']]
      .forEach(([dir, symbol, label]) => {
        const key = makeButton(`g2-btn g2-key g2-key-${dir}`, symbol, 'dir', dir);
        key.setAttribute('aria-label', label);
        pad.appendChild(key);
      });

    root.append(hud, actions, wrap, pad);
    container.replaceChildren(style, root);

    return {
      root, scoreEl, bestEl, recordEl, wrap, layer, overlay, msgEl,
      continueBtn, finishBtn, againBtn
    };
  }

  /* --- Інтерфейс --- */

  function updateHud() {
    state.record = Math.max(state.record, state.score);
    state.scoreEl.textContent = `Рахунок: ${state.score}`;
    state.bestEl.textContent = `Найкраща плитка: ${state.bestTile}`;
    state.recordEl.textContent = `Рекорд: ${state.record}`;
  }

  function showOverlay(text, mode) {
    state.msgEl.textContent = text;
    state.continueBtn.hidden = mode !== 'prompt';
    state.finishBtn.hidden = mode !== 'prompt';
    state.againBtn.hidden = mode !== 'over';
    state.overlay.hidden = false;
  }

  /* --- Плитки --- */

  function paint(tile) {
    const v = tile.value;
    const classes = ['g2-tile-inner', v <= TARGET ? `g2-v${v}` : 'g2-vbig'];
    const len = String(v).length;
    if (len >= 3) classes.push(`g2-d${Math.min(len, 5)}`);
    tile.inner.className = classes.join(' ');
    tile.inner.textContent = String(v);
  }

  function place(tile) {
    tile.node.style.transform = `translate(${tile.col * 100}%, ${tile.row * 100}%)`;
  }

  function playAnim(tile, className, delay) {
    tile.inner.classList.remove('g2-new', 'g2-pop');
    void tile.inner.offsetWidth; // перезапуск анімації
    tile.inner.style.animationDelay = `${delay}ms`;
    tile.inner.classList.add(className);
  }

  function addTile(row, col, value, delay) {
    const node = el('div', 'g2-tile');
    const inner = el('div');
    node.appendChild(inner);
    const tile = { value, row, col, node, inner };
    paint(tile);
    place(tile);
    state.layer.appendChild(node);
    state.grid[row * state.n + col] = tile;
    state.bestTile = Math.max(state.bestTile, value);
    playAnim(tile, 'g2-new', delay);
  }

  function spawnTile(delay) {
    const free = [];
    state.grid.forEach((tile, i) => { if (!tile) free.push(i); });
    if (free.length === 0) return;
    const index = randomItem(free);
    const value = Math.random() < state.chanceTwo ? 2 : 4;
    addTile(Math.floor(index / state.n), index % state.n, value, delay);
  }

  function scheduleRemove(tile) {
    tile.node.style.zIndex = '-1'; // поглинена плитка ховається під тією, що залишається
    const timer = setTimeout(() => {
      tile.node.remove();
      state.timers.delete(timer);
    }, MOVE_MS + 30);
    state.timers.add(timer);
  }

  function canMove() {
    const { grid, n } = state;
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const tile = grid[r * n + c];
        if (!tile) return true;
        const right = c < n - 1 ? grid[r * n + c + 1] : null;
        const down = r < n - 1 ? grid[(r + 1) * n + c] : null;
        if ((right && right.value === tile.value) || (down && down.value === tile.value)) return true;
      }
    }
    return false;
  }

  /* --- Хід і кінець партії --- */

  function move(dirName) {
    if (!state || state.status !== 'playing') return;
    const { n } = state;
    const newGrid = Array(n * n).fill(null);
    const entries = [];
    let changed = false;

    for (let line = 0; line < n; line += 1) {
      const queue = [];
      for (let k = 0; k < n; k += 1) {
        const [r, c] = cellAt(dirName, line, k, n);
        const tile = state.grid[r * n + c];
        if (tile) queue.push(tile);
      }
      const out = [];
      queue.forEach((tile) => {
        const last = out[out.length - 1];
        if (last && !last.merged && last.tile.value === tile.value) {
          last.merged = true; // кожна плитка зливається максимум раз за хід
          last.absorbed = tile;
        } else {
          out.push({ tile, merged: false, absorbed: null, row: 0, col: 0 });
        }
      });
      out.forEach((entry, k) => {
        const [r, c] = cellAt(dirName, line, k, n);
        entry.row = r;
        entry.col = c;
        newGrid[r * n + c] = entry.tile;
        entries.push(entry);
        if (entry.tile.row !== r || entry.tile.col !== c || entry.merged) changed = true;
      });
    }
    if (!changed) return; // порожній хід не додає плитку

    state.grid = newGrid;
    if (state.startMs === null) state.startMs = performance.now();
    state.moves += 1;

    entries.forEach((entry) => {
      const { tile, absorbed } = entry;
      tile.row = entry.row;
      tile.col = entry.col;
      place(tile);
      if (absorbed) {
        absorbed.row = entry.row;
        absorbed.col = entry.col;
        place(absorbed);
        scheduleRemove(absorbed);
        tile.value *= 2;
        state.score += tile.value;
        state.bestTile = Math.max(state.bestTile, tile.value);
        paint(tile);
        playAnim(tile, 'g2-pop', MOVE_MS);
      }
    });

    spawnTile(MOVE_MS);
    updateHud();

    if (!state.winShown && state.bestTile >= TARGET) {
      state.winShown = true; // накладка з'являється лише раз за партію
      state.reachedMs = performance.now();
      state.status = 'prompt';
      showOverlay('Ви досягли 2048!', 'prompt');
      return;
    }
    if (!canMove()) endGame(false);
  }

  function endGame(byChoice) {
    if (state.status === 'over') return;
    const endMs = byChoice ? state.reachedMs : performance.now();
    const durationSec = state.startMs === null
      ? 0
      : Math.max(0, Math.floor((endMs - state.startMs - state.idleMs) / 1000));
    state.status = 'over';
    updateHud();
    showOverlay(
      byChoice ? `Гру завершено. Рахунок: ${state.score}` : `Ходів більше немає. Рахунок: ${state.score}`,
      'over'
    );

    // Екран результату показано — повідомляємо рівно один раз
    if (typeof state.ctx.onFinish === 'function') {
      state.ctx.onFinish({
        score: state.score,
        won: state.bestTile >= TARGET,
        durationSec,
        details: { gridSize: state.n, bestTile: state.bestTile, moves: state.moves }
      });
    }
  }

  function continueGame() {
    if (state.status !== 'prompt') return;
    state.idleMs += performance.now() - state.reachedMs; // час накладки не рахується
    state.status = 'playing';
    state.overlay.hidden = true;
    if (!canMove()) endGame(false);
  }

  function resetGame() {
    state.timers.forEach((timer) => clearTimeout(timer));
    state.timers.clear();
    state.layer.replaceChildren();
    state.grid = Array(state.n * state.n).fill(null);
    state.score = 0;
    state.bestTile = 0;
    state.moves = 0;
    state.startMs = null;
    state.idleMs = 0;
    state.reachedMs = 0;
    state.winShown = false;
    state.status = 'playing';
    state.swipe = null;
    state.overlay.hidden = true;
    spawnTile(0);
    spawnTile(0);
    updateHud();
  }

  /* --- Обробники --- */

  function handleClick(event) {
    if (!state) return;
    const button = event.target.closest('button');
    if (!button) return;
    const { dir, action } = button.dataset;
    if (dir) move(dir);
    else if (action === 'restart') resetGame(); // покинута партія: onFinish не викликається
    else if (action === 'continue') continueGame();
    else if (action === 'finish') endGame(true);
    button.blur();
  }

  function handleKeydown(event) {
    if (!state) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const dir = KEY_DIRS[event.code];
    if (!dir) return;
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    event.preventDefault(); // клавіші не прокручують сторінку
    move(dir);
  }

  function handlePointerDown(event) {
    state.swipe = { x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event) {
    const start = state.swipe;
    if (!start) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      state.swipe = null;
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    state.swipe = null; // один свайп = один хід
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  }

  function handlePointerEnd() {
    if (state) state.swipe = null;
  }

  /* --- Публічний інтерфейс --- */

  function mount(container, ctx) {
    if (state) unmount();
    const context = ctx || {};
    const difficulty = Object.hasOwn(CONFIG, context.difficulty) ? context.difficulty : 'easy';
    const { size, chanceTwo } = CONFIG[difficulty];
    const dom = buildDom(container, size);
    state = {
      ...dom,
      container,
      ctx: context,
      n: size,
      chanceTwo,
      grid: [],
      score: 0,
      bestTile: 0,
      record: 0,
      moves: 0,
      startMs: null,
      idleMs: 0,
      reachedMs: 0,
      winShown: false,
      status: 'playing',
      swipe: null,
      timers: new Set()
    };

    state.root.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    state.wrap.addEventListener('pointerdown', handlePointerDown);
    state.wrap.addEventListener('pointermove', handlePointerMove);
    SWIPE_END_EVENTS.forEach((name) => state.wrap.addEventListener(name, handlePointerEnd));

    resetGame();
  }

  function unmount() {
    if (!state) return;
    state.timers.forEach((timer) => clearTimeout(timer));
    state.timers.clear();
    state.root.removeEventListener('click', handleClick);
    document.removeEventListener('keydown', handleKeydown);
    state.wrap.removeEventListener('pointerdown', handlePointerDown);
    state.wrap.removeEventListener('pointermove', handlePointerMove);
    SWIPE_END_EVENTS.forEach((name) => state.wrap.removeEventListener(name, handlePointerEnd));
    state.container.replaceChildren();
    state = null;
  }

  return {
    id: 'game2048',
    title: '2048',
    description: 'Об\'єднуй плитки та доберися до 2048',
    icon: '🔢',
    mount,
    unmount
  };
}

const game = createGame2048();
export default game;