// client/js/games/tictactoe.js
// Гра «Хрестики-нулики». Гравець = X (ходить першим), бот = O.

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // рядки
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // стовпці
  [0, 4, 8], [2, 4, 6],            // діагоналі
];

const BASE_SCORE = { win: 100, draw: 40, loss: 0 };
const MULTIPLIER = { easy: 1, medium: 1.5, hard: 2 };

const PLAYER = 'X';
const BOT = 'O';

/* ---------- Чиста логіка ---------- */

function getWinner(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line };
    }
  }
  return null;
}

function emptyCells(board) {
  const res = [];
  board.forEach((v, i) => { if (!v) res.push(i); });
  return res;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Клітинка, яка завершує лінію для mark (дві його позначки + одна вільна)
function findLineCompletion(board, mark) {
  for (const line of LINES) {
    const marks = line.filter((i) => board[i] === mark).length;
    const free = line.filter((i) => !board[i]);
    if (marks === 2 && free.length === 1) return free[0];
  }
  return -1;
}

function randomMove(board) {
  return randomItem(emptyCells(board));
}

function smartMove(board) {
  const win = findLineCompletion(board, BOT);
  if (win !== -1) return win;
  const block = findLineCompletion(board, PLAYER);
  if (block !== -1) return block;
  return randomMove(board);
}

// Мінімакс: + для бота, − для гравця; глибина дає перевагу швидшій перемозі
function minimax(board, isBotTurn, depth) {
  const w = getWinner(board);
  if (w) return w.mark === BOT ? 10 - depth : depth - 10;
  const free = emptyCells(board);
  if (free.length === 0) return 0;

  let best = isBotTurn ? -Infinity : Infinity;
  for (const i of free) {
    board[i] = isBotTurn ? BOT : PLAYER;
    const score = minimax(board, !isBotTurn, depth + 1);
    board[i] = null;
    best = isBotTurn ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

function minimaxMove(board) {
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const i of emptyCells(board)) {
    board[i] = BOT;
    const score = minimax(board, false, 1);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [i];
    } else if (score === bestScore) {
      bestMoves.push(i);
    }
  }
  return randomItem(bestMoves); // серед рівноцінних — випадковий, щоб гра була різноманітнішою
}

function chooseBotMove(board, difficulty) {
  if (difficulty === 'hard') return minimaxMove(board);
  if (difficulty === 'medium') {
    return Math.random() < 0.5 ? smartMove(board) : randomMove(board);
  }
  return randomMove(board);
}

function calcScore(outcome, difficulty) {
  const mult = MULTIPLIER[difficulty] ?? 1;
  return Math.round(BASE_SCORE[outcome] * mult);
}

/* ---------- Стилі ---------- */

const CSS = `
.ttt { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 320px; margin: 0 auto; text-align: center; color: #1f2937; }
.ttt-streak { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
.ttt-status { min-height: 1.6em; margin-bottom: 12px; color: #4b5563; }
.ttt-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ttt-cell {
  aspect-ratio: 1 / 1; font-size: 2.6rem; font-weight: 700; line-height: 1;
  background: #f3f4f6; border: 2px solid #d1d5db; border-radius: 10px;
  cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center;
  transition: background-color .2s ease, border-color .2s ease, transform .15s ease, box-shadow .2s ease;
}
.ttt-cell:hover:not(:disabled) { background: #e5e7eb; transform: translateY(-1px); }
.ttt-cell:disabled { cursor: default; }
.ttt-mark { display: inline-block; animation: ttt-pop .28s cubic-bezier(.34, 1.56, .64, 1) both; }
.ttt-mark.x { color: #2563eb; }
.ttt-mark.o { color: #dc2626; }
@keyframes ttt-pop {
  from { transform: scale(0) rotate(-90deg); opacity: 0; }
  to   { transform: scale(1) rotate(0);      opacity: 1; }
}
.ttt-cell.win { background: #bbf7d0; border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22, 163, 74, .25); animation: ttt-win .7s ease-in-out 2; }
@keyframes ttt-win { 50% { transform: scale(1.08); } }
.ttt-again {
  margin-top: 14px; padding: 10px 18px; font-size: 1rem; border: 0; border-radius: 8px;
  background: #2563eb; color: #fff; cursor: pointer; transition: background-color .2s ease;
}
.ttt-again:hover { background: #1d4ed8; }
.ttt-again[hidden] { display: none; }
`;

/* ---------- Модуль гри ---------- */

function createTicTacToe() {
  // Контекст і складність визначаються в mount
  let ctx = {};
  let difficulty = 'easy';

  // Сесійний стан (живе, поки не викликано unmount)
  let streak = 0;

  // Стан партії
  let board = Array(9).fill(null);
  let moves = 0;
  let startTime = null;  // момент першого ходу гравця в поточній партії
  let locked = false;    // клітинки заблоковані (хід бота / кінець партії)
  let finished = false;
  let destroyed = false;

  // DOM та ресурси
  let root = null;
  let boardEl = null;
  let cells = [];
  let streakEl = null;
  let statusEl = null;
  let againBtn = null;
  let botTimer = null;

  function setStatus(text) { statusEl.textContent = text; }
  function setStreakText() { streakEl.textContent = `Серія перемог: ${streak}`; }

  function syncDisabled() {
    cells.forEach((cell, i) => {
      cell.disabled = locked || finished || board[i] !== null;
    });
  }

  function placeMark(index, mark) {
    board[index] = mark;
    const span = document.createElement('span');
    span.className = `ttt-mark ${mark === PLAYER ? 'x' : 'o'}`;
    span.textContent = mark;
    cells[index].appendChild(span);
  }

  function startRound() {
    clearTimeout(botTimer);
    botTimer = null;
    board = Array(9).fill(null);
    moves = 0;
    startTime = null;
    finished = false;
    locked = false;
    cells.forEach((cell) => {
      cell.textContent = '';
      cell.classList.remove('win');
    });
    againBtn.hidden = true;
    setStatus('Ваш хід (X)');
    syncDisabled();
  }

  function finishRound(winner) {
    finished = true;
    locked = true;

    let outcome;
    if (winner && winner.mark === PLAYER) outcome = 'win';
    else if (winner) outcome = 'loss';
    else outcome = 'draw';

    // Перемога збільшує серію; нічия чи поразка її скидає
    streak = outcome === 'win' ? streak + 1 : 0;

    // Ціле число секунд від першого ходу гравця до кінця партії
    const durationSec = startTime === null
      ? 0
      : Math.floor((performance.now() - startTime) / 1000);

    if (winner) winner.line.forEach((i) => cells[i].classList.add('win'));
    setStreakText();
    setStatus(
      outcome === 'win' ? 'Ви перемогли! 🎉'
        : outcome === 'loss' ? 'Бот переміг'
          : 'Нічия'
    );
    syncDisabled();
    againBtn.hidden = false;

    // Результат показано — тепер повідомляємо про завершення партії (рівно один раз)
    const result = {
      score: calcScore(outcome, difficulty),
      won: outcome === 'win',
      durationSec,
      details: { moves, streak },
    };
    if (typeof ctx.onFinish === 'function') ctx.onFinish(result);
  }

  function botMove() {
    botTimer = null;
    if (destroyed || finished) return;

    const index = chooseBotMove(board, difficulty);
    placeMark(index, BOT);

    const winner = getWinner(board);
    if (winner || emptyCells(board).length === 0) {
      finishRound(winner);
      return;
    }
    locked = false;
    setStatus('Ваш хід (X)');
    syncDisabled();
  }

  function onBoardClick(e) {
    const cell = e.target.closest('.ttt-cell');
    if (!cell || !boardEl.contains(cell)) return;
    const index = Number(cell.dataset.index);
    if (locked || finished || board[index] !== null) return;

    if (startTime === null) startTime = performance.now();

    placeMark(index, PLAYER);
    moves += 1;

    const winner = getWinner(board);
    if (winner || emptyCells(board).length === 0) {
      finishRound(winner);
      return;
    }

    locked = true;
    setStatus('Хід бота…');
    syncDisabled();
    const delay = 400 + Math.random() * 200; // 400–600 мс
    botTimer = setTimeout(botMove, delay);
  }

  function onAgainClick() {
    startRound();
  }

  function mount(container, context) {
    if (root) unmount();
    destroyed = false;

    ctx = context || {};
    difficulty = ['easy', 'medium', 'hard'].includes(ctx.difficulty) ? ctx.difficulty : 'easy';
    streak = 0;

    root = container;
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="ttt">
        <div class="ttt-streak"></div>
        <div class="ttt-status"></div>
        <div class="ttt-board">
          ${Array.from({ length: 9 }, (_, i) =>
            `<button type="button" class="ttt-cell" data-index="${i}" aria-label="Клітинка ${i + 1}"></button>`
          ).join('')}
        </div>
        <button type="button" class="ttt-again" hidden>Грати ще раз</button>
      </div>
    `;

    boardEl = root.querySelector('.ttt-board');
    cells = Array.from(root.querySelectorAll('.ttt-cell'));
    streakEl = root.querySelector('.ttt-streak');
    statusEl = root.querySelector('.ttt-status');
    againBtn = root.querySelector('.ttt-again');

    boardEl.addEventListener('click', onBoardClick);
    againBtn.addEventListener('click', onAgainClick);

    setStreakText();
    startRound();
  }

  function unmount() {
    destroyed = true;
    clearTimeout(botTimer);
    botTimer = null;

    if (boardEl) boardEl.removeEventListener('click', onBoardClick);
    if (againBtn) againBtn.removeEventListener('click', onAgainClick);
    if (root) root.innerHTML = '';

    root = boardEl = streakEl = statusEl = againBtn = null;
    cells = [];
    ctx = {};
  }

  return {
    id: 'tictactoe',
    title: 'Хрестики-нулики',
    description: 'Класична гра 3×3: ставте X і обіграйте бота на трьох рівнях складності.',
    icon: '❌',
    mount,
    unmount,
  };
}

const game = createTicTacToe();
export default game;