const SIZES = [3, 4, 5, 6, 7];
const DEFAULT_SIZE = { easy: 3, medium: 4, hard: 5 };
const BASE_SCORE = { 3: 100, 4: 200, 5: 350, 6: 500, 7: 700 };
const NUMBERS_FACTOR = 0.8;
const PEEK_PENALTY = 15;
const IMAGE_RES = 600;
const THUMB_RES = 112;
const STYLE_ID = 'puzzle-style';
const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const PEEK_END_EVENTS = ['pointerup', 'pointerleave', 'pointercancel'];

const STYLES = `
.pz { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; color: var(--color-text, #1f2430); }
.pz-row { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
.pz-stats { gap: 24px; font-weight: 600; }
.pz-btn {
  padding: 8px 14px; font-size: 0.95rem; cursor: pointer; touch-action: manipulation; user-select: none;
  background: var(--color-surface, #ffffff); color: var(--color-text, #1f2430);
  border: 2px solid rgba(128, 128, 128, 0.45); border-radius: 8px;
  transition: background-color 0.2s, border-color 0.2s;
}
.pz-btn:hover:not(:disabled) { background: rgba(128, 128, 128, 0.15); }
.pz-btn:disabled { opacity: 0.45; cursor: default; }
.pz-btn-active, .pz-btn-active:hover:not(:disabled) {
  background: var(--color-accent, #3b6ef5); border-color: var(--color-accent, #3b6ef5); color: #ffffff;
}
.pz-thumb { padding: 0; line-height: 0; cursor: pointer; background: none; border: 3px solid transparent; border-radius: 9px; }
.pz-thumb canvas { display: block; width: 56px; height: 56px; border-radius: 6px; }
.pz-thumb-active { border-color: var(--color-accent, #3b6ef5); }
.pz-message { min-height: 1.4em; text-align: center; color: #e5484d; }
.pz-boardwrap { position: relative; width: min(100%, 520px); aspect-ratio: 1; }
.pz-board {
  position: absolute; inset: 0; overflow: hidden; container-type: inline-size;
  background: rgba(128, 128, 128, 0.18); border-radius: 8px;
}
.pz-tile {
  position: absolute; left: 0; top: 0; box-sizing: border-box;
  width: calc(100% / var(--n)); height: calc(100% / var(--n));
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; user-select: none;
  transition: transform 0.15s ease, opacity 0.4s ease;
}
.pz-board-image .pz-tile {
  background-image: var(--pz-img);
  background-size: calc(var(--n) * 100%) calc(var(--n) * 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4), inset 0 0 0 2px rgba(0, 0, 0, 0.2);
}
.pz-board-numbers .pz-tile {
  color: #ffffff; font-weight: 700; font-size: calc(40cqw / var(--n));
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35);
}
.pz-tile-empty { opacity: 0; pointer-events: none; }
.pz-solved .pz-tile { box-shadow: none; cursor: default; }
.pz-peek {
  position: absolute; inset: 0; display: none; border-radius: 8px;
  background-image: var(--pz-img); background-size: cover; pointer-events: none;
}
.pz-peek-on { display: block; }
.pz-result {
  padding: 10px 16px; text-align: center; font-weight: 600;
  background: rgba(47, 158, 68, 0.18); border: 2px solid #2f9e44; border-radius: 8px;
  animation: pz-pop 0.3s ease-out;
}
.pz-result[hidden] { display: none; }
@keyframes pz-pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function drawHill(c, s, baseY, amp, freq, phase, color) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, s);
  for (let x = 0; x <= s; x += 10) {
    c.lineTo(x, s * baseY + Math.sin((x / s) * freq + phase) * s * amp);
  }
  c.lineTo(s, s);
  c.closePath();
  c.fill();
}

function drawSunset(c, s) {
  const sky = c.createLinearGradient(0, 0, 0, s);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.45, '#d4418e');
  sky.addColorStop(0.75, '#ff9a44');
  sky.addColorStop(1, '#ffd36e');
  c.fillStyle = sky;
  c.fillRect(0, 0, s, s);
  c.fillStyle = '#fff3b0';
  c.beginPath();
  c.arc(s * 0.68, s * 0.6, s * 0.13, 0, Math.PI * 2);
  c.fill();
  drawHill(c, s, 0.78, 0.04, 7, 0.5, '#5a2a6b');
  drawHill(c, s, 0.88, 0.05, 5, 2, '#2c1442');
}

function drawWaves(c, s) {
  const bg = c.createLinearGradient(0, 0, 0, s);
  bg.addColorStop(0, '#0b2447');
  bg.addColorStop(1, '#19a7ce');
  c.fillStyle = bg;
  c.fillRect(0, 0, s, s);
  c.fillStyle = '#f4f1de';
  c.beginPath();
  c.arc(s * 0.25, s * 0.2, s * 0.09, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 6; i += 1) {
    drawHill(c, s, 0.35 + i * 0.11, 0.035, 6 + i, i * 1.3, `hsl(${200 + i * 6}, 70%, ${62 - i * 8}%)`);
  }
}

function drawMosaic(c, s) {
  const rand = seededRandom(7);
  const cells = 12;
  const size = s / cells;
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const hue = (x * 22 + y * 14 + rand() * 50) % 360;
      c.fillStyle = `hsl(${hue}, 70%, ${38 + rand() * 30}%)`;
      c.fillRect(x * size, y * size, size, size);
    }
  }
}

function drawStripes(c, s) {
  const colors = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#073b4c', '#8338ec'];
  c.save();
  c.translate(s / 2, s / 2);
  c.rotate(-Math.PI / 6);
  for (let i = -16; i < 16; i += 1) {
    c.fillStyle = colors[((i % colors.length) + colors.length) % colors.length];
    c.fillRect(i * 50, -s, 50, s * 2);
  }
  c.restore();
  const glow = c.createRadialGradient(s * 0.3, s * 0.3, 10, s * 0.3, s * 0.3, s * 0.6);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, s, s);
}

function drawMountains(c, s) {
  const sky = c.createLinearGradient(0, 0, 0, s);
  sky.addColorStop(0, '#89c2d9');
  sky.addColorStop(1, '#e0fbfc');
  c.fillStyle = sky;
  c.fillRect(0, 0, s, s);
  c.fillStyle = '#ffe066';
  c.beginPath();
  c.arc(s * 0.22, s * 0.2, s * 0.08, 0, Math.PI * 2);
  c.fill();
  const rand = seededRandom(21);
  const layers = [['#8fb3d1', 0.55], ['#4f7ca3', 0.68], ['#2a4d6e', 0.82]];
  const steps = 6;
  layers.forEach(([color, baseY]) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, s);
    for (let i = 0; i <= steps; i += 1) {
      const x = (i / steps) * s;
      const y = i % 2 === 0 ? baseY * s - rand() * s * 0.18 : baseY * s + s * 0.08;
      c.lineTo(x, y);
    }
    c.lineTo(s, s);
    c.closePath();
    c.fill();
  });
}

function drawCircles(c, s) {
  const bg = c.createLinearGradient(0, 0, s, s);
  bg.addColorStop(0, '#1d2671');
  bg.addColorStop(1, '#c33764');
  c.fillStyle = bg;
  c.fillRect(0, 0, s, s);
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f8f9fa'];
  for (let i = 0; i < 10; i += 1) {
    c.fillStyle = colors[i % colors.length];
    c.beginPath();
    c.arc(s * 0.35, s * 0.4, s * (0.5 - i * 0.045), 0, Math.PI * 2);
    c.fill();
  }
  const rand = seededRandom(5);
  for (let i = 0; i < 14; i += 1) {
    c.fillStyle = `hsla(${rand() * 360}, 80%, 65%, 0.7)`;
    c.beginPath();
    c.arc(rand() * s, rand() * s, 12 + rand() * 28, 0, Math.PI * 2);
    c.fill();
  }
}

const IMAGES = [
  { id: 'sunset', name: 'Захід сонця', draw: drawSunset },
  { id: 'waves', name: 'Хвилі', draw: drawWaves },
  { id: 'mosaic', name: 'Мозаїка', draw: drawMosaic },
  { id: 'stripes', name: 'Смуги', draw: drawStripes },
  { id: 'mountains', name: 'Гори', draw: drawMountains },
  { id: 'circles', name: 'Кола', draw: drawCircles }
];

function makeImageCanvas(def) {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_RES;
  canvas.height = IMAGE_RES;
  def.draw(canvas.getContext('2d'), IMAGE_RES);
  return canvas;
}

function cropToSquare(img) {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_RES;
  canvas.height = IMAGE_RES;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const side = Math.min(w, h);
  canvas.getContext('2d').drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, IMAGE_RES, IMAGE_RES);
  return canvas;
}

function createThumbButton(id, name) {
  const button = el('button', 'pz-thumb');
  button.type = 'button';
  button.dataset.image = id;
  button.title = name;
  button.setAttribute('aria-label', name);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_RES;
  canvas.height = THUMB_RES;
  button.appendChild(canvas);
  return button;
}

function drawThumb(button, source) {
  button.firstChild.getContext('2d').drawImage(source, 0, 0, THUMB_RES, THUMB_RES);
}

function neighborsOf(pos, n) {
  const row = Math.floor(pos / n);
  const col = pos % n;
  const result = [];
  if (row > 0) result.push(pos - n);
  if (row < n - 1) result.push(pos + n);
  if (col > 0) result.push(pos - 1);
  if (col < n - 1) result.push(pos + 1);
  return result;
}

function isSolved(board) {
  return board.every((id, pos) => id === pos);
}

// Перемішування серією допустимих ходів від складеного стану гарантує розв'язність
function shuffledBoard(n) {
  const total = n * n;
  const board = Array.from({ length: total }, (_, i) => i);
  let empty = total - 1;
  let prev = -1;
  do {
    for (let i = 0; i < 40 * n; i += 1) {
      const next = randomItem(neighborsOf(empty, n).filter((p) => p !== prev));
      board[empty] = board[next];
      board[next] = total - 1;
      prev = empty;
      empty = next;
    }
  } while (isSolved(board));
  return board;
}

function calcScore(size, moves, durationSec, peeks, mode) {
  const base = BASE_SCORE[size];
  const extraMoves = Math.max(0, moves - size * size * 2);
  let score = base - durationSec - extraMoves - peeks * PEEK_PENALTY;
  if (mode === 'numbers') score *= NUMBERS_FACTOR;
  return Math.max(Math.round(score), Math.round(base * 0.1));
}

function createPuzzle() {
  let state = null;

  function buildDom(container) {
    const style = el('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;

    const root = el('div', 'pz');
    const statsEl = el('div', 'pz-row pz-stats');
    const movesEl = el('span');
    const timeEl = el('span');
    statsEl.append(movesEl, timeEl);

    const sizeRow = el('div', 'pz-row');
    sizeRow.setAttribute('role', 'group');
    sizeRow.setAttribute('aria-label', 'Розмір поля');
    SIZES.forEach((n) => {
      const button = el('button', 'pz-btn', `${n}×${n}`);
      button.type = 'button';
      button.dataset.size = String(n);
      sizeRow.appendChild(button);
    });

    const modeRow = el('div', 'pz-row');
    modeRow.setAttribute('role', 'group');
    modeRow.setAttribute('aria-label', 'Режим плиток');
    [['image', 'Картинка'], ['numbers', 'Цифри']].forEach(([mode, label]) => {
      const button = el('button', 'pz-btn', label);
      button.type = 'button';
      button.dataset.mode = mode;
      modeRow.appendChild(button);
    });

    const thumbsRow = el('div', 'pz-row');
    const thumbs = {};
    IMAGES.forEach((def) => {
      thumbs[def.id] = createThumbButton(def.id, def.name);
      thumbsRow.appendChild(thumbs[def.id]);
    });
    const uploadBtn = el('button', 'pz-btn', 'Завантажити своє фото');
    uploadBtn.type = 'button';
    uploadBtn.dataset.action = 'upload';
    thumbsRow.appendChild(uploadBtn);

    const fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;

    const messageEl = el('div', 'pz-message');
    messageEl.setAttribute('aria-live', 'polite');

    const wrap = el('div', 'pz-boardwrap');
    const boardEl = el('div', 'pz-board');
    const peekEl = el('div', 'pz-peek');
    wrap.append(boardEl, peekEl);

    const resultEl = el('div', 'pz-result');
    resultEl.hidden = true;
    resultEl.setAttribute('aria-live', 'polite');

    const actionsRow = el('div', 'pz-row');
    const shuffleBtn = el('button', 'pz-btn', 'Перемішати знову');
    shuffleBtn.type = 'button';
    shuffleBtn.dataset.action = 'shuffle';
    const peekBtn = el('button', 'pz-btn', 'Підгляд (тримайте)');
    peekBtn.type = 'button';
    actionsRow.append(shuffleBtn, peekBtn);

    root.append(statsEl, sizeRow, modeRow, thumbsRow, fileInput, messageEl, wrap, resultEl, actionsRow);
    container.replaceChildren(style, root);

    return {
      root, movesEl, timeEl, sizeRow, modeRow, thumbsRow, thumbs, uploadBtn,
      fileInput, messageEl, wrap, boardEl, peekEl, resultEl, peekBtn
    };
  }

  function getCssUrl(imageId) {
    if (!state.cssUrls[imageId]) {
      state.cssUrls[imageId] = state.sources[imageId].toDataURL('image/jpeg', 0.92);
    }
    return state.cssUrls[imageId];
  }

  function setMessage(text) {
    state.messageEl.textContent = text;
  }

  function elapsedSec() {
    return state.started ? Math.floor((Date.now() - state.startTs) / 1000) : 0;
  }

  function updateStats() {
    state.movesEl.textContent = `Ходи: ${state.moves}`;
    state.timeEl.textContent = `Час: ${elapsedSec()} с`;
  }

  function stopTimer() {
    if (state.timerId !== null) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startTimer() {
    state.started = true;
    state.startTs = Date.now();
    state.timerId = setInterval(updateStats, 250);
  }

  function updateControls() {
    state.sizeRow.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('pz-btn-active', Number(b.dataset.size) === state.size);
    });
    state.modeRow.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('pz-btn-active', b.dataset.mode === state.mode);
    });
    state.thumbsRow.querySelectorAll('.pz-thumb').forEach((b) => {
      b.classList.toggle('pz-thumb-active', state.mode === 'image' && b.dataset.image === state.imageId);
    });
    state.peekBtn.disabled = state.mode !== 'image';
  }

  function positionTiles() {
    const n = state.size;
    state.board.forEach((id, pos) => {
      const x = (pos % n) * 100;
      const y = Math.floor(pos / n) * 100;
      state.tiles[id].style.transform = `translate(${x}%, ${y}%)`;
    });
  }

  function rebuildBoard() {
    const n = state.size;
    const total = n * n;
    state.boardEl.replaceChildren();
    state.boardEl.style.setProperty('--n', String(n));
    state.boardEl.className = `pz-board pz-board-${state.mode}`;
    if (state.mode === 'image') {
      state.wrap.style.setProperty('--pz-img', `url("${getCssUrl(state.imageId)}")`);
    }
    state.tiles = [];
    for (let id = 0; id < total; id += 1) {
      const row = Math.floor(id / n);
      const col = id % n;
      const tile = el('div', 'pz-tile');
      tile.dataset.id = String(id);
      tile.setAttribute('aria-label', `Плитка ${id + 1}`);
      if (state.mode === 'image') {
        tile.style.backgroundPosition = `${(col * 100) / (n - 1)}% ${(row * 100) / (n - 1)}%`;
      } else {
        tile.textContent = String(id + 1);
        tile.style.backgroundColor = `hsl(${Math.round(((row + col) / (2 * n - 2)) * 260)}, 60%, 48%)`;
      }
      if (id === total - 1) tile.classList.add('pz-tile-empty');
      state.boardEl.appendChild(tile);
      state.tiles.push(tile);
    }
    positionTiles();
  }

  function endPeek() {
    if (!state || !state.peekActive) return;
    state.peekActive = false;
    state.peekEl.classList.remove('pz-peek-on');
  }

  function startGame() {
    stopTimer();
    endPeek();
    state.board = shuffledBoard(state.size);
    state.moves = 0;
    state.peeks = 0;
    state.started = false;
    state.finished = false;
    state.startTs = 0;
    state.resultEl.hidden = true;
    setMessage('');
    rebuildBoard();
    updateControls();
    updateStats();
  }

  function moveToward(pos) {
    const n = state.size;
    const empty = state.board.indexOf(n * n - 1);
    if (pos === empty) return 0;
    const sameRow = Math.floor(pos / n) === Math.floor(empty / n);
    const sameCol = pos % n === empty % n;
    if (!sameRow && !sameCol) return 0;
    const step = sameRow ? (pos > empty ? 1 : -1) : (pos > empty ? n : -n);
    let current = empty;
    let count = 0;
    while (current !== pos) {
      const next = current + step;
      state.board[current] = state.board[next];
      state.board[next] = n * n - 1;
      current = next;
      count += 1;
    }
    return count;
  }

  function finishGame() {
    state.finished = true;
    stopTimer();
    const durationSec = elapsedSec();
    const { size, moves, mode, imageId, peeks } = state;
    const score = calcScore(size, moves, durationSec, peeks, mode);

    state.boardEl.classList.add('pz-solved');
    state.tiles[size * size - 1].classList.remove('pz-tile-empty');
    state.timeEl.textContent = `Час: ${durationSec} с`;
    state.resultEl.textContent = `Складено! Ходи: ${moves}. Час: ${durationSec} с. Очки: ${score}`;
    state.resultEl.hidden = false;

    state.ctx.onFinish({
      score,
      won: true,
      durationSec,
      details: { size, moves, mode, imageId, peeks }
    });
  }

  function applyMoves(count) {
    if (!count) return;
    if (!state.started) startTimer();
    state.moves += count;
    positionTiles();
    updateStats();
    if (isSolved(state.board)) finishGame();
  }

  function selectSize(n) {
    state.size = n;
    startGame();
  }

  function selectMode(mode) {
    state.mode = mode;
    startGame();
  }

  function selectImage(imageId) {
    state.imageId = imageId;
    state.mode = 'image';
    startGame();
  }

  function addCustomThumb(canvas) {
    let button = state.thumbsRow.querySelector('[data-image="custom"]');
    if (!button) {
      button = createThumbButton('custom', 'Своє фото');
      state.thumbsRow.insertBefore(button, state.uploadBtn);
    }
    drawThumb(button, canvas);
  }

  function releasePending() {
    if (state.pendingImg) {
      state.pendingImg.onload = null;
      state.pendingImg.onerror = null;
      state.pendingImg = null;
    }
    if (state.pendingUrl) {
      URL.revokeObjectURL(state.pendingUrl);
      state.pendingUrl = null;
    }
  }

  function handleFileChange() {
    const file = state.fileInput.files[0];
    state.fileInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Файл не є зображенням. Залишено попередню картинку.');
      return;
    }
    releasePending();
    const current = state;
    const img = new Image();
    state.pendingImg = img;
    state.pendingUrl = URL.createObjectURL(file);

    img.onload = () => {
      if (state !== current) return;
      if (!img.naturalWidth || !img.naturalHeight) {
        releasePending();
        setMessage('Не вдалося завантажити зображення. Залишено попередню картинку.');
        return;
      }
      const canvas = cropToSquare(img);
      releasePending();
      state.sources.custom = canvas;
      delete state.cssUrls.custom;
      addCustomThumb(canvas);
      selectImage('custom');
    };
    img.onerror = () => {
      if (state !== current) return;
      releasePending();
      setMessage('Не вдалося завантажити зображення. Залишено попередню картинку.');
    };
    img.src = state.pendingUrl;
  }

  function handleClick(event) {
    if (!state) return;
    const tile = event.target.closest('.pz-tile');
    if (tile) {
      if (state.finished || state.peekActive) return;
      applyMoves(moveToward(state.board.indexOf(Number(tile.dataset.id))));
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.size) selectSize(Number(button.dataset.size));
    else if (button.dataset.mode) selectMode(button.dataset.mode);
    else if (button.dataset.image) selectImage(button.dataset.image);
    else if (button.dataset.action === 'shuffle') startGame();
    else if (button.dataset.action === 'upload') state.fileInput.click();
  }

  function handleKeydown(event) {
    if (!state || state.finished || state.peekActive) return;
    if (!ARROW_KEYS.includes(event.key)) return;
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    event.preventDefault();
    const n = state.size;
    const empty = state.board.indexOf(n * n - 1);
    const row = Math.floor(empty / n);
    const col = empty % n;
    let target = -1;
    if (event.key === 'ArrowUp' && row > 0) target = empty - n;
    else if (event.key === 'ArrowDown' && row < n - 1) target = empty + n;
    else if (event.key === 'ArrowLeft' && col > 0) target = empty - 1;
    else if (event.key === 'ArrowRight' && col < n - 1) target = empty + 1;
    if (target >= 0) applyMoves(moveToward(target));
  }

  function handlePeekStart(event) {
    if (!state || state.finished || state.mode !== 'image') return;
    event.preventDefault();
    state.peekActive = true;
    state.peeks += 1;
    state.peekEl.classList.add('pz-peek-on');
  }

  function handleContextMenu(event) {
    event.preventDefault();
  }

  function mount(container, ctx) {
    if (state) unmount();
    const dom = buildDom(container);
    const difficulty = DEFAULT_SIZE[ctx.difficulty] ? ctx.difficulty : 'easy';
    state = {
      ...dom,
      container,
      ctx,
      size: DEFAULT_SIZE[difficulty],
      mode: 'image',
      imageId: IMAGES[0].id,
      sources: {},
      cssUrls: {},
      tiles: [],
      board: [],
      moves: 0,
      peeks: 0,
      started: false,
      finished: false,
      startTs: 0,
      timerId: null,
      peekActive: false,
      pendingUrl: null,
      pendingImg: null
    };
    IMAGES.forEach((def) => {
      state.sources[def.id] = makeImageCanvas(def);
      drawThumb(state.thumbs[def.id], state.sources[def.id]);
    });

    state.root.addEventListener('click', handleClick);
    state.fileInput.addEventListener('change', handleFileChange);
    document.addEventListener('keydown', handleKeydown);
    state.peekBtn.addEventListener('pointerdown', handlePeekStart);
    PEEK_END_EVENTS.forEach((name) => state.peekBtn.addEventListener(name, endPeek));
    state.peekBtn.addEventListener('contextmenu', handleContextMenu);
    startGame();
  }

  function unmount() {
    if (!state) return;
    stopTimer();
    releasePending();
    state.root.removeEventListener('click', handleClick);
    state.fileInput.removeEventListener('change', handleFileChange);
    document.removeEventListener('keydown', handleKeydown);
    state.peekBtn.removeEventListener('pointerdown', handlePeekStart);
    PEEK_END_EVENTS.forEach((name) => state.peekBtn.removeEventListener(name, endPeek));
    state.peekBtn.removeEventListener('contextmenu', handleContextMenu);
    state.container.replaceChildren();
    state = null;
  }

  return {
    id: 'puzzle',
    title: 'Пазл',
    description: 'Склади картинку з перемішаних плиток',
    icon: '🖼️',
    mount,
    unmount
  };
}

const puzzleGame = createPuzzle();

export default puzzleGame;