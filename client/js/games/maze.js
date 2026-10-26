// client/js/games/maze.js
// Гра «Лабіринт»: ідеальний лабіринт (ітеративний recursive backtracker), малювання на <canvas>.

const SIZES = { easy: 10, medium: 16, hard: 24 };
const BASE_SCORE = { easy: 100, medium: 200, hard: 400 };

const MAX_CANVAS_PX = 600;
const PAD = 4;        // відступ полотна, щоб крайні стінки не обрізались
const MOVE_MS = 90;   // тривалість анімації руху (до 100 мс)

// Біти стінок клітинки
const N = 1, E = 2, S = 4, W = 8;

const DIRS = {
  up:    { dr: -1, dc: 0, bit: N },
  right: { dr: 0,  dc: 1, bit: E },
  down:  { dr: 1,  dc: 0, bit: S },
  left:  { dr: 0,  dc: -1, bit: W },
};

// e.code не залежить від розкладки, тому WASD працює і з українською
const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

/* ---------- Чиста логіка ---------- */

// Ідеальний лабіринт: кожна клітинка починає з усіма 4 стінками (15),
// стіни між сусідніми клітинками прибираються під час обходу зі стеком.
function generateMaze(n) {
  const cells = new Uint8Array(n * n).fill(N | E | S | W);
  const visited = new Uint8Array(n * n);
  const stack = [0];
  visited[0] = 1;

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const r = Math.floor(cur / n);
    const c = cur % n;

    // [індекс сусіда, стіна, яку прибрати в поточній, стіна, яку прибрати в сусіда]
    const options = [];
    if (r > 0     && !visited[cur - n]) options.push([cur - n, N, S]);
    if (c < n - 1 && !visited[cur + 1]) options.push([cur + 1, E, W]);
    if (r < n - 1 && !visited[cur + n]) options.push([cur + n, S, N]);
    if (c > 0     && !visited[cur - 1]) options.push([cur - 1, W, E]);

    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [next, curBit, nextBit] = options[Math.floor(Math.random() * options.length)];
    cells[cur] &= ~curBit;
    cells[next] &= ~nextBit;
    visited[next] = 1;
    stack.push(next);
  }
  return cells;
}

function calcScore(difficulty, seconds) {
  const base = BASE_SCORE[difficulty];
  return Math.round(Math.max(base * 0.1, base - 2 * seconds));
}

/* ---------- Стилі ---------- */

const CSS = `
.maze { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: ${MAX_CANVAS_PX}px; margin: 0 auto; text-align: center; color: #1f2937; }
.maze-hud { display: flex; justify-content: center; gap: 20px; font-weight: 600; margin-bottom: 8px; font-variant-numeric: tabular-nums; }
.maze-stage { position: relative; margin: 0 auto; }
.maze-canvas { display: block; border-radius: 6px; box-shadow: 0 0 0 1px #d1d5db; }
.maze-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; background: rgba(255, 255, 255, .88); border-radius: 6px; animation: maze-fade .25s ease both;
}
.maze-overlay[hidden] { display: none; }
.maze-overlay-title { font-size: 1.8rem; font-weight: 700; color: #15803d; }
.maze-overlay-info { font-size: 1.1rem; }
@keyframes maze-fade { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
.maze-pad { display: grid; grid-template-columns: repeat(3, 56px); gap: 6px; justify-content: center; margin-top: 12px; }
.maze-key {
  height: 56px; font-size: 1.4rem; border: 1px solid #d1d5db; border-radius: 10px; background: #f3f4f6; color: #1f2937;
  cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none;
  transition: background-color .15s ease, transform .1s ease;
}
.maze-key:active { background: #e5e7eb; transform: scale(.95); }
.maze-key.up { grid-column: 2; grid-row: 1; }
.maze-key.left { grid-column: 1; grid-row: 2; }
.maze-key.down { grid-column: 2; grid-row: 2; }
.maze-key.right { grid-column: 3; grid-row: 2; }
.maze-new {
  margin-top: 14px; padding: 10px 18px; font-size: 1rem; border: 0; border-radius: 8px;
  background: #2563eb; color: #fff; cursor: pointer; transition: background-color .2s ease;
}
.maze-new:hover { background: #1d4ed8; }
`;

/* ---------- Модуль гри ---------- */

function createMaze() {
  // Контекст, складність і розмір поля визначаються в mount
  let ctx = {};
  let difficulty = 'easy';
  let n = SIZES.easy;

  // Стан лабіринту / партії
  let cells = null;
  let pos = { r: 0, c: 0 };      // логічна позиція
  let vis = { r: 0, c: 0 };      // візуальна позиція (в одиницях клітинок, для анімації)
  let moves = 0;
  let startTime = null;          // старт таймера = перший хід
  let endTime = null;
  let locked = false;
  let completed = false;         // onFinish для цієї партії вже викликано
  let destroyed = false;

  // Анімація й таймери
  let anim = null;
  let rafId = null;
  let hudTimer = null;
  let finishTimer = null;

  // Розміри полотна
  let cellPx = 0;
  let cssSize = 0;
  let dpr = 1;

  // DOM
  let root = null;
  let wrap = null;
  let stage = null;
  let canvas = null;
  let g = null;
  let overlay = null;
  let overlayInfo = null;
  let timeEl = null;
  let scoreEl = null;
  let padEl = null;
  let newBtn = null;

  /* --- Допоміжне --- */

  function currentSec() {
    if (startTime === null) return 0;
    const end = endTime ?? performance.now();
    return Math.floor((end - startTime) / 1000);
  }

  function updateHud() {
    const sec = currentSec();
    timeEl.textContent = `Час: ${sec} с`;
    scoreEl.textContent = `Очки: ${calcScore(difficulty, sec)}`;
  }

  function fitCanvas() {
    const avail = Math.min(MAX_CANVAS_PX, wrap.clientWidth || MAX_CANVAS_PX);
    cellPx = Math.max(4, Math.floor((avail - 2 * PAD) / n));
    cssSize = cellPx * n + 2 * PAD;
    dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    stage.style.width = `${cssSize}px`;
  }

  /* --- Малювання --- */

  function draw() {
    if (!g || !cells) return;
    const s = cellPx;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssSize, cssSize);
    g.fillStyle = '#f9fafb';
    g.fillRect(0, 0, cssSize, cssSize);

    // Старт і вихід
    g.fillStyle = '#dbeafe';
    g.fillRect(PAD, PAD, s, s);
    g.fillStyle = '#bbf7d0';
    g.fillRect(PAD + (n - 1) * s, PAD + (n - 1) * s, s, s);

    g.font = `${Math.floor(s * 0.6)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#000';
    g.fillText('🏁', PAD + (n - 0.5) * s, PAD + (n - 0.5) * s + 1);

    // Стіни — один шлях, один stroke
    g.strokeStyle = '#111827';
    g.lineWidth = Math.max(2, Math.min(5, Math.round(s * 0.09)));
    g.lineCap = 'square';
    g.beginPath();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = cells[r * n + c];
        const x = PAD + c * s;
        const y = PAD + r * s;
        if (v & N) { g.moveTo(x, y);     g.lineTo(x + s, y); }
        if (v & W) { g.moveTo(x, y);     g.lineTo(x, y + s); }
        if (v & S) { g.moveTo(x, y + s); g.lineTo(x + s, y + s); }
        if (v & E) { g.moveTo(x + s, y); g.lineTo(x + s, y + s); }
      }
    }
    g.stroke();

    // Гравець
    const px = PAD + (vis.c + 0.5) * s;
    const py = PAD + (vis.r + 0.5) * s;
    g.beginPath();
    g.arc(px, py, s * 0.3, 0, Math.PI * 2);
    g.fillStyle = '#2563eb';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#1e3a8a';
    g.stroke();
  }

  /* --- Анімація руху --- */

  function tick(ts) {
    rafId = null;
    if (destroyed || !anim) return;
    const p = Math.min(1, Math.max(0, (ts - anim.t0) / MOVE_MS));
    vis.r = anim.fr + (anim.tr - anim.fr) * p;
    vis.c = anim.fc + (anim.tc - anim.fc) * p;
    draw();
    if (p < 1) rafId = requestAnimationFrame(tick);
    else anim = null;
  }

  function startAnim() {
    // Нова анімація стартує з поточної візуальної позиції — тому утримання клавіші виглядає плавно
    anim = { fr: vis.r, fc: vis.c, tr: pos.r, tc: pos.c, t0: performance.now() };
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  /* --- Ігрова логіка --- */

  function newMaze() {
    clearTimeout(finishTimer);
    finishTimer = null;
    clearInterval(hudTimer);
    hudTimer = null;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    anim = null;

    cells = generateMaze(n);
    pos = { r: 0, c: 0 };
    vis = { r: 0, c: 0 };
    moves = 0;
    startTime = null;
    endTime = null;
    locked = false;
    completed = false;
    overlay.hidden = true;

    fitCanvas();
    updateHud();
    draw();
  }

  function showResult() {
    finishTimer = null;
    if (destroyed || completed) return;
    completed = true;

    // Фіксуємо кінцеву позицію без очікування rAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    anim = null;
    vis = { r: pos.r, c: pos.c };
    draw();

    const durationSec = currentSec();
    const score = calcScore(difficulty, durationSec);

    overlayInfo.textContent = `Час: ${durationSec} с. Очки: ${score}`;
    overlay.hidden = false;

    // Результат показано — повідомляємо рівно один раз
    if (typeof ctx.onFinish === 'function') {
      ctx.onFinish({
        score,
        won: true,
        durationSec,
        details: { size: n, moves },
      });
    }
  }

  function move(dirName) {
    if (destroyed || locked || !cells) return;
    const d = DIRS[dirName];
    if (!d) return;
    if (cells[pos.r * n + pos.c] & d.bit) return; // стіна

    pos = { r: pos.r + d.dr, c: pos.c + d.dc };
    moves += 1;

    if (startTime === null) {
      startTime = performance.now();
      hudTimer = setInterval(updateHud, 200);
    }
    startAnim();

    if (pos.r === n - 1 && pos.c === n - 1) {
      locked = true;
      endTime = performance.now();
      clearInterval(hudTimer);
      hudTimer = null;
      updateHud();
      // Даємо дограти анімації останнього кроку, потім показуємо екран перемоги
      finishTimer = setTimeout(showResult, MOVE_MS + 20);
    }
  }

  /* --- Обробники --- */

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEY_DIRS[e.code];
    if (!dir) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    e.preventDefault(); // стрілки не мають прокручувати сторінку
    move(dir);
  }

  function onPadClick(e) {
    const btn = e.target.closest('[data-dir]');
    if (btn && padEl.contains(btn)) move(btn.dataset.dir);
  }

  function onNewClick() {
    newMaze(); // поточна партія вважається покинутою, onFinish не викликається
  }

  function onResize() {
    if (!root) return;
    fitCanvas();
    draw();
  }

  /* --- Публічний інтерфейс --- */

  function mount(container, context) {
    if (root) unmount();
    destroyed = false;

    ctx = context || {};
    difficulty = Object.hasOwn(SIZES, ctx.difficulty) ? ctx.difficulty : 'easy';
    n = SIZES[difficulty];

    root = container;
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="maze">
        <div class="maze-hud">
          <span class="maze-time"></span>
          <span class="maze-score"></span>
        </div>
        <div class="maze-stage">
          <canvas class="maze-canvas"></canvas>
          <div class="maze-overlay" hidden>
            <div class="maze-overlay-title">Ви вийшли!</div>
            <div class="maze-overlay-info"></div>
          </div>
        </div>
        <div class="maze-pad">
          <button type="button" class="maze-key up" data-dir="up" aria-label="Вгору">▲</button>
          <button type="button" class="maze-key left" data-dir="left" aria-label="Ліворуч">◀</button>
          <button type="button" class="maze-key down" data-dir="down" aria-label="Вниз">▼</button>
          <button type="button" class="maze-key right" data-dir="right" aria-label="Праворуч">▶</button>
        </div>
        <button type="button" class="maze-new">Новий лабіринт</button>
      </div>
    `;

    wrap = root.querySelector('.maze');
    stage = root.querySelector('.maze-stage');
    canvas = root.querySelector('.maze-canvas');
    g = canvas.getContext('2d');
    overlay = root.querySelector('.maze-overlay');
    overlayInfo = root.querySelector('.maze-overlay-info');
    timeEl = root.querySelector('.maze-time');
    scoreEl = root.querySelector('.maze-score');
    padEl = root.querySelector('.maze-pad');
    newBtn = root.querySelector('.maze-new');

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    padEl.addEventListener('click', onPadClick);
    newBtn.addEventListener('click', onNewClick);

    newMaze();
  }

  function unmount() {
    destroyed = true;
    clearTimeout(finishTimer);
    finishTimer = null;
    clearInterval(hudTimer);
    hudTimer = null;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    anim = null;

    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
    if (padEl) padEl.removeEventListener('click', onPadClick);
    if (newBtn) newBtn.removeEventListener('click', onNewClick);
    if (root) root.innerHTML = '';

    root = wrap = stage = canvas = g = overlay = overlayInfo = null;
    timeEl = scoreEl = padEl = newBtn = null;
    cells = null;
    ctx = {};
  }

  return {
    id: 'maze',
    title: 'Лабіринт',
    description: 'Знайдіть вихід із випадково згенерованого лабіринту якомога швидше.',
    icon: '🧩',
    mount,
    unmount,
  };
}

const game = createMaze();
export default game;