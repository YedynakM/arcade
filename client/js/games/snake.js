// client/js/games/snake.js
// Гра «Змійка»: поле 20×20 на <canvas>, стрілки/WASD, свайпи, кнопки, пауза.

const GRID = 20;
const MAX_BOARD_PX = 480;
const BASE_INTERVAL = { easy: 150, medium: 110, hard: 80 };
const INTERVAL_STEP = 8;
const MIN_INTERVAL = 50;
const FOOD_PER_LEVEL = 5;
const FOOD_POINTS = 10;
const MULTIPLIER = { easy: 1, medium: 1.5, hard: 2 };
const WALLS_KILL = { easy: false, medium: true, hard: true };
const WIN_FOOD = 10;
const SWIPE_PX = 24;
const MAX_QUEUE = 2;
const STYLE_ID = 'snake-style';
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const SWIPE_END_EVENTS = ['pointerup', 'pointercancel'];

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// e.code не залежить від розкладки, тому WASD працює і з українською
const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right'
};

const COLORS = {
  board: '#1b2433',
  alt: '#212c3f',
  body: '#40c057',
  head: '#ffd43b',
  eye: '#1b2433',
  food: '#ff6b6b'
};

const STYLES = `
.sn { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; color: var(--color-text, #1f2430); }
.sn-row { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
.sn-hud { gap: 6px 16px; font-weight: 600; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
.sn-btn {
  padding: 8px 14px; font-size: 0.95rem; cursor: pointer; touch-action: manipulation; user-select: none;
  background: var(--color-surface, #ffffff); color: var(--color-text, #1f2430);
  border: 2px solid rgba(128, 128, 128, 0.45); border-radius: 8px;
  transition: background-color 0.2s, border-color 0.2s;
}
.sn-btn:hover:not(:disabled) { background: rgba(128, 128, 128, 0.15); }
.sn-btn:disabled { opacity: 0.45; cursor: default; }
.sn-btn-accent, .sn-btn-accent:hover:not(:disabled) {
  background: var(--color-accent, #3b6ef5); border-color: var(--color-accent, #3b6ef5); color: #ffffff;
}
.sn-boardwrap { position: relative; width: min(100%, ${MAX_BOARD_PX}px); aspect-ratio: 1; touch-action: none; user-select: none; }
.sn-canvas { display: block; width: 100%; height: 100%; border-radius: 8px; }
.sn-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 16px; text-align: center; font-weight: 700; font-size: 1.15rem; color: #ffffff;
  background: rgba(15, 23, 42, 0.72); border-radius: 8px; pointer-events: none;
  animation: sn-fade 0.25s ease-out;
}
.sn-overlay-over { pointer-events: auto; }
.sn-overlay[hidden], .sn-overlay .sn-btn[hidden] { display: none; }
@keyframes sn-fade { from { opacity: 0; } to { opacity: 1; } }
.sn-pad { display: grid; grid-template-columns: repeat(3, 56px); gap: 6px; justify-content: center; }
.sn-key { height: 56px; padding: 0; font-size: 1.4rem; border-radius: 10px; }
.sn-key:active { transform: scale(0.95); }
.sn-key-up { grid-column: 2; grid-row: 1; }
.sn-key-left { grid-column: 1; grid-row: 2; }
.sn-key-down { grid-column: 2; grid-row: 2; }
.sn-key-right { grid-column: 3; grid-row: 2; }
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

// Довжина 3 по центру, голова — перший елемент, рух праворуч
function createBody() {
  const mid = Math.floor(GRID / 2);
  return [{ x: mid + 1, y: mid }, { x: mid, y: mid }, { x: mid - 1, y: mid }];
}

// Їжа з'являється лише у вільній клітинці; null, якщо поле заповнене
function spawnFood(snake) {
  const taken = new Set(snake.map((p) => p.y * GRID + p.x));
  const free = [];
  for (let i = 0; i < GRID * GRID; i += 1) {
    if (!taken.has(i)) free.push(i);
  }
  if (free.length === 0) return null;
  const index = randomItem(free);
  return { x: index % GRID, y: Math.floor(index / GRID) };
}

function levelOf(foodEaten) {
  return Math.floor(foodEaten / FOOD_PER_LEVEL) + 1;
}

function foodPoints(difficulty) {
  return Math.round(FOOD_POINTS * MULTIPLIER[difficulty]);
}

/* ---------- Модуль гри ---------- */

function createSnake() {
  let state = null;

  function buildDom(container) {
    const style = el('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;

    const root = el('div', 'sn');

    const hud = el('div', 'sn-row sn-hud');
    const scoreEl = el('span');
    const lengthEl = el('span');
    const recordEl = el('span');
    const levelEl = el('span');
    hud.append(scoreEl, lengthEl, recordEl, levelEl);

    const actions = el('div', 'sn-row');
    const startBtn = makeButton('sn-btn sn-btn-accent', 'Старт', 'action', 'start');
    const pauseBtn = makeButton('sn-btn', 'Пауза', 'action', 'pause');
    const restartBtn = makeButton('sn-btn', 'Грати ще раз', 'action', 'restart');
    actions.append(startBtn, pauseBtn, restartBtn);

    const wrap = el('div', 'sn-boardwrap');
    const canvas = el('canvas', 'sn-canvas');
    canvas.setAttribute('aria-label', 'Поле гри «Змійка»');
    const overlay = el('div', 'sn-overlay');
    overlay.setAttribute('aria-live', 'polite');
    const msgEl = el('div');
    const overBtn = makeButton('sn-btn sn-btn-accent', 'Грати ще раз', 'action', 'restart');
    overlay.append(msgEl, overBtn);
    wrap.append(canvas, overlay);

    const pad = el('div', 'sn-pad');
    [['up', '▲', 'Вгору'], ['left', '◀', 'Ліворуч'], ['down', '▼', 'Вниз'], ['right', '▶', 'Праворуч']]
      .forEach(([dir, symbol, label]) => {
        const key = makeButton(`sn-btn sn-key sn-key-${dir}`, symbol, 'dir', dir);
        key.setAttribute('aria-label', label);
        pad.appendChild(key);
      });

    root.append(hud, actions, wrap, pad);
    container.replaceChildren(style, root);

    return {
      root, scoreEl, lengthEl, recordEl, levelEl, startBtn, pauseBtn, restartBtn,
      wrap, canvas, g: canvas.getContext('2d'), overlay, msgEl, overBtn
    };
  }

  /* --- Час і інтервал --- */

  function intervalMs() {
    const reduction = INTERVAL_STEP * Math.floor(state.foodEaten / FOOD_PER_LEVEL);
    return Math.max(MIN_INTERVAL, BASE_INTERVAL[state.difficulty] - reduction);
  }

  // Активний час: пауза не входить
  function elapsedMs() {
    const live = state.status === 'running' && state.timerStarted
      ? performance.now() - state.segStart
      : 0;
    return state.activeMs + live;
  }

  function stopStepTimer() {
    if (state.timerId !== null) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }
  }

  /* --- Інтерфейс --- */

  function updateHud() {
    state.scoreEl.textContent = `Очки: ${state.score}`;
    state.lengthEl.textContent = `Довжина: ${state.snake.length}`;
    state.recordEl.textContent = `Рекорд: ${state.record}`;
    state.levelEl.textContent = `Рівень: ${levelOf(state.foodEaten)}`;
  }

  function updateButtons() {
    const { status } = state;
    state.startBtn.disabled = status !== 'idle';
    state.pauseBtn.disabled = status !== 'running' && status !== 'paused';
    state.pauseBtn.textContent = status === 'paused' ? 'Продовжити' : 'Пауза';
  }

  function showOverlay(text, isOver) {
    state.msgEl.textContent = text;
    state.overBtn.hidden = !isOver;
    state.overlay.classList.toggle('sn-overlay-over', isOver);
    state.overlay.hidden = false;
  }

  function hideOverlay() {
    state.overlay.hidden = true;
  }

  /* --- Малювання --- */

  function resizeCanvas() {
    if (!state) return;
    const size = Math.floor(state.wrap.clientWidth);
    if (!size) return;
    const dpr = window.devicePixelRatio || 1;
    state.cssSize = size;
    state.dpr = dpr;
    state.canvas.width = Math.round(size * dpr);
    state.canvas.height = Math.round(size * dpr);
    draw();
  }

  function drawSegment(g, p, cell, color) {
    const pad = cell * 0.08;
    g.fillStyle = color;
    g.fillRect(p.x * cell + pad, p.y * cell + pad, cell - 2 * pad, cell - 2 * pad);
  }

  function draw() {
    if (!state || !state.cssSize) return;
    const { g, cssSize: size, snake, food } = state;
    const cell = size / GRID;

    g.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    g.fillStyle = COLORS.board;
    g.fillRect(0, 0, size, size);
    g.fillStyle = COLORS.alt;
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        if ((x + y) % 2 === 1) g.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    if (food) {
      g.fillStyle = COLORS.food;
      g.beginPath();
      g.arc((food.x + 0.5) * cell, (food.y + 0.5) * cell, cell * 0.36, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = snake.length - 1; i >= 1; i -= 1) drawSegment(g, snake[i], cell, COLORS.body);

    // Голова іншого кольору й з очима
    const head = snake[0];
    drawSegment(g, head, cell, COLORS.head);
    const d = DIRS[state.dir];
    const cx = (head.x + 0.5) * cell;
    const cy = (head.y + 0.5) * cell;
    g.fillStyle = COLORS.eye;
    [-1, 1].forEach((side) => {
      g.beginPath();
      g.arc(
        cx + d.x * cell * 0.15 - d.y * side * cell * 0.2,
        cy + d.y * cell * 0.15 + d.x * side * cell * 0.2,
        cell * 0.08, 0, Math.PI * 2
      );
      g.fill();
    });
  }

  /* --- Ігровий цикл --- */

  function step() {
    state.timerId = null;
    if (state.status !== 'running') return;
    if (!state.timerStarted) {
      state.timerStarted = true;
      state.segStart = performance.now();
    }
    if (state.queue.length > 0) state.dir = state.queue.shift();

    const d = DIRS[state.dir];
    const head = state.snake[0];
    let nx = head.x + d.x;
    let ny = head.y + d.y;
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
      if (WALLS_KILL[state.difficulty]) {
        endGame();
        return;
      }
      nx = (nx + GRID) % GRID;
      ny = (ny + GRID) % GRID;
    }

    const eats = state.food !== null && nx === state.food.x && ny === state.food.y;
    // Якщо змійка не росте, хвіст звільняє клітинку
    const checkLen = eats ? state.snake.length : state.snake.length - 1;
    for (let i = 0; i < checkLen; i += 1) {
      if (state.snake[i].x === nx && state.snake[i].y === ny) {
        endGame();
        return;
      }
    }

    state.snake.unshift({ x: nx, y: ny });
    if (eats) {
      state.foodEaten += 1;
      state.score += foodPoints(state.difficulty);
      state.maxLevel = Math.max(state.maxLevel, levelOf(state.foodEaten));
      state.food = spawnFood(state.snake);
    } else {
      state.snake.pop();
    }
    updateHud();
    draw();

    if (eats && state.food === null) { // поле заповнене
      endGame();
      return;
    }
    state.timerId = setTimeout(step, intervalMs());
  }

  function endGame() {
    if (state.status === 'over') return;
    const durationSec = Math.floor(elapsedMs() / 1000);
    stopStepTimer();
    state.status = 'over';
    state.record = Math.max(state.record, state.score);

    const { foodEaten, score, snake, maxLevel } = state;
    updateHud();
    updateButtons();
    draw();
    showOverlay(`Гру завершено. Їжі: ${foodEaten}. Очки: ${score}`, true);

    // Екран результату показано — повідомляємо рівно один раз
    if (typeof state.ctx.onFinish === 'function') {
      state.ctx.onFinish({
        score,
        won: foodEaten >= WIN_FOOD,
        durationSec,
        details: { foodEaten, length: snake.length, maxSpeedLevel: maxLevel }
      });
    }
  }

  function resetGame() {
    stopStepTimer();
    state.snake = createBody();
    state.dir = 'right';
    state.queue = [];
    state.food = spawnFood(state.snake);
    state.score = 0;
    state.foodEaten = 0;
    state.maxLevel = 1;
    state.activeMs = 0;
    state.segStart = 0;
    state.timerStarted = false;
    state.status = 'idle';
    showOverlay('Натисніть «Старт» або клавішу керування', false);
    updateHud();
    updateButtons();
    draw();
  }

  function startGame() {
    if (state.status !== 'idle') return;
    state.status = 'running';
    hideOverlay();
    updateButtons();
    state.timerId = setTimeout(step, intervalMs());
  }

  function pauseGame() {
    if (state.status !== 'running') return;
    stopStepTimer();
    if (state.timerStarted) state.activeMs += performance.now() - state.segStart;
    state.status = 'paused';
    showOverlay('Пауза. Пробіл або P — продовжити', false);
    updateButtons();
  }

  function resumeGame() {
    if (state.status !== 'paused') return;
    state.status = 'running';
    if (state.timerStarted) state.segStart = performance.now();
    hideOverlay();
    updateButtons();
    state.timerId = setTimeout(step, intervalMs());
  }

  function togglePause() {
    if (state.status === 'running') pauseGame();
    else if (state.status === 'paused') resumeGame();
  }

  // Черга до 2 напрямків; розворот на 180° і повтор поточного напряму відкидаються
  function queueDirection(name) {
    const { status } = state;
    if (status === 'over' || status === 'paused') return;
    if (status === 'idle') {
      if (name === OPPOSITE[state.dir]) return;
      if (name !== state.dir) state.queue.push(name);
      startGame();
      return;
    }
    const last = state.queue.length > 0 ? state.queue[state.queue.length - 1] : state.dir;
    if (name === last || name === OPPOSITE[last]) return;
    if (state.queue.length >= MAX_QUEUE) return;
    state.queue.push(name);
  }

  /* --- Обробники --- */

  function handleClick(event) {
    if (!state) return;
    const button = event.target.closest('button');
    if (!button) return;
    const { dir, action } = button.dataset;
    if (dir) queueDirection(dir);
    else if (action === 'start') startGame();
    else if (action === 'pause') togglePause();
    else if (action === 'restart') resetGame(); // покинута партія: onFinish не викликається
    button.blur();
  }

  function handleKeydown(event) {
    if (!state) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const dir = KEY_DIRS[event.code];
    if (dir) {
      event.preventDefault(); // стрілки не прокручують сторінку
      queueDirection(dir);
      return;
    }
    if (event.code === 'Space' && tag === 'BUTTON') return; // кнопка спрацює сама
    if (event.code === 'Space' || event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) togglePause();
    }
  }

  function handleVisibility() {
    if (state && document.hidden) pauseGame();
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
    if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? 'right' : 'left');
    else queueDirection(dy > 0 ? 'down' : 'up');
    start.x = event.clientX;
    start.y = event.clientY;
  }

  function handlePointerEnd() {
    if (state) state.swipe = null;
  }

  /* --- Публічний інтерфейс --- */

  function mount(container, ctx) {
    if (state) unmount();
    const dom = buildDom(container);
    const context = ctx || {};
    state = {
      ...dom,
      container,
      ctx: context,
      difficulty: DIFFICULTIES.includes(context.difficulty) ? context.difficulty : 'easy',
      record: 0,
      snake: [],
      dir: 'right',
      queue: [],
      food: null,
      score: 0,
      foodEaten: 0,
      maxLevel: 1,
      status: 'idle',
      activeMs: 0,
      segStart: 0,
      timerStarted: false,
      timerId: null,
      swipe: null,
      cssSize: 0,
      dpr: 1,
      resizeObserver: null
    };

    state.root.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibility);
    state.wrap.addEventListener('pointerdown', handlePointerDown);
    state.wrap.addEventListener('pointermove', handlePointerMove);
    SWIPE_END_EVENTS.forEach((name) => state.wrap.addEventListener(name, handlePointerEnd));
    state.resizeObserver = new ResizeObserver(resizeCanvas);
    state.resizeObserver.observe(state.wrap);

    resetGame();
    resizeCanvas();
  }

  function unmount() {
    if (!state) return;
    stopStepTimer();
    state.resizeObserver.disconnect();
    state.root.removeEventListener('click', handleClick);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('visibilitychange', handleVisibility);
    state.wrap.removeEventListener('pointerdown', handlePointerDown);
    state.wrap.removeEventListener('pointermove', handlePointerMove);
    SWIPE_END_EVENTS.forEach((name) => state.wrap.removeEventListener(name, handlePointerEnd));
    state.container.replaceChildren();
    state = null;
  }

  return {
    id: 'snake',
    title: 'Змійка',
    description: 'Збирай їжу, росни та не врізайся',
    icon: '🐍',
    mount,
    unmount
  };
}

const game = createSnake();
export default game;