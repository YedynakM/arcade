// client/js/games/guessnumber.js
// Гра «Вгадай число»: обмежена кількість спроб, підказки, історія, індикатор спроб.

const CONFIG = {
  easy: { min: 1, max: 50, attempts: 8 },
  medium: { min: 1, max: 100, attempts: 7 },
  hard: { min: 1, max: 1000, attempts: 10 }
};
const BASE_SCORE = { easy: 100, medium: 200, hard: 400 };
const STYLE_ID = 'guessnumber-style';

const STYLES = `
.gn { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; max-width: 420px; margin: 0 auto; color: var(--color-text, #1f2430); }
.gn-row { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; width: 100%; }
.gn-info { gap: 6px 16px; font-weight: 600; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
.gn-dots { gap: 6px; }
.gn-dot {
  width: 14px; height: 14px; border-radius: 50%; box-sizing: border-box;
  background: var(--color-accent, #3b6ef5); border: 2px solid var(--color-accent, #3b6ef5);
  transition: background-color 0.25s, opacity 0.25s;
}
.gn-dot-used { background: transparent; opacity: 0.4; border-color: rgba(128, 128, 128, 0.7); }
.gn-input {
  flex: 1 1 140px; min-width: 0; max-width: 220px; padding: 10px 12px; font-size: 1.1rem; text-align: center;
  background: var(--color-surface, #ffffff); color: var(--color-text, #1f2430);
  border: 2px solid rgba(128, 128, 128, 0.45); border-radius: 8px;
}
.gn-input:focus { outline: none; border-color: var(--color-accent, #3b6ef5); }
.gn-input:disabled { opacity: 0.5; }
.gn-btn {
  padding: 10px 16px; font-size: 1rem; cursor: pointer; touch-action: manipulation; user-select: none;
  background: var(--color-surface, #ffffff); color: var(--color-text, #1f2430);
  border: 2px solid rgba(128, 128, 128, 0.45); border-radius: 8px;
  transition: background-color 0.2s, border-color 0.2s;
}
.gn-btn:hover:not(:disabled) { background: rgba(128, 128, 128, 0.15); }
.gn-btn:disabled { opacity: 0.45; cursor: default; }
.gn-btn-accent, .gn-btn-accent:hover:not(:disabled) {
  background: var(--color-accent, #3b6ef5); border-color: var(--color-accent, #3b6ef5); color: #ffffff;
}
.gn-shake { animation: gn-shake 0.4s ease-in-out; }
@keyframes gn-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}
.gn-message { min-height: 1.5em; text-align: center; font-weight: 600; }
.gn-message-error { color: #e5484d; }
.gn-history { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; width: 100%; max-height: 240px; overflow-y: auto; }
.gn-item {
  display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 12px;
  background: rgba(128, 128, 128, 0.15); border-radius: 8px; font-variant-numeric: tabular-nums;
}
.gn-item-win { background: rgba(47, 158, 68, 0.22); }
.gn-result {
  width: 100%; box-sizing: border-box; padding: 12px 16px; text-align: center; font-weight: 700;
  border: 2px solid transparent; border-radius: 8px;
}
.gn-result[hidden] { display: none; }
.gn-result-win { background: rgba(47, 158, 68, 0.18); border-color: #2f9e44; }
.gn-result-lose { background: rgba(229, 72, 77, 0.15); border-color: #e5484d; }
.gn-pulse { animation: gn-pulse 0.6s ease-in-out 2; }
@keyframes gn-pulse { 50% { transform: scale(1.06); } }
`;

/* ---------- Допоміжне ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function restartAnimation(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // перезапуск анімації
  node.classList.add(className);
}

/* ---------- Чиста логіка ---------- */

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Перемога: база × (максСпроб − використано + 1) / максСпроб; поразка 0
function calcScore(difficulty, attemptsUsed, maxAttempts, won) {
  if (!won) return 0;
  return Math.round(BASE_SCORE[difficulty] * (maxAttempts - attemptsUsed + 1) / maxAttempts);
}

/* ---------- Модуль гри ---------- */

function createGuessNumber() {
  let state = null;

  function buildDom(container) {
    const style = el('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;

    const root = el('div', 'gn');

    const info = el('div', 'gn-row gn-info');
    const rangeEl = el('span');
    const leftEl = el('span');
    info.append(rangeEl, leftEl);

    const dotsEl = el('div', 'gn-row gn-dots');

    const inputRow = el('div', 'gn-row');
    const input = el('input', 'gn-input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.step = '1';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Ваше число');
    const submitBtn = el('button', 'gn-btn gn-btn-accent', 'Спробувати');
    submitBtn.type = 'button';
    submitBtn.dataset.action = 'submit';
    inputRow.append(input, submitBtn);

    const messageEl = el('div', 'gn-message');
    messageEl.setAttribute('aria-live', 'polite');

    const historyEl = el('ul', 'gn-history');
    historyEl.setAttribute('aria-label', 'Історія спроб');

    const resultEl = el('div', 'gn-result');
    resultEl.hidden = true;
    resultEl.setAttribute('aria-live', 'polite');

    const actions = el('div', 'gn-row');
    const newBtn = el('button', 'gn-btn', 'Нова гра');
    newBtn.type = 'button';
    newBtn.dataset.action = 'new';
    actions.appendChild(newBtn);

    root.append(info, dotsEl, inputRow, messageEl, historyEl, resultEl, actions);
    container.replaceChildren(style, root);

    return { root, rangeEl, leftEl, dotsEl, inputRow, input, submitBtn, messageEl, historyEl, resultEl };
  }

  /* --- Інтерфейс --- */

  function setMessage(text, isError) {
    state.messageEl.textContent = text;
    state.messageEl.classList.toggle('gn-message-error', Boolean(isError));
  }

  function updateInfo() {
    const { cfg, used, lo, hi } = state;
    state.rangeEl.textContent = `Діапазон: ${lo}–${hi}`;
    state.leftEl.textContent = `Спроб лишилось: ${cfg.attempts - used}`;
    state.dotsEl.querySelectorAll('.gn-dot').forEach((dot, i) => {
      dot.classList.toggle('gn-dot-used', i < used);
    });
  }

  function setLocked(locked) {
    state.input.disabled = locked;
    state.submitBtn.disabled = locked;
  }

  function addHistory(guess, kind) {
    const item = el('li', 'gn-item');
    const numEl = el('strong', undefined, String(guess));
    let label;
    if (kind === 'win') {
      label = '✅ вгадано';
      item.classList.add('gn-item-win');
    } else if (kind === 'higher') {
      label = '⬆️ більше';
    } else {
      label = '⬇️ менше';
    }
    item.append(numEl, el('span', undefined, label));
    state.historyEl.prepend(item); // найновіші зверху
  }

  /* --- Перебіг партії --- */

  function resetGame() {
    const { cfg } = state;
    state.target = randomInt(cfg.min, cfg.max);
    state.used = 0;
    state.lo = cfg.min;
    state.hi = cfg.max;
    state.guesses = new Set();
    state.startMs = null;
    state.finished = false;

    state.dotsEl.replaceChildren();
    for (let i = 0; i < cfg.attempts; i += 1) state.dotsEl.appendChild(el('span', 'gn-dot'));
    state.historyEl.replaceChildren();
    state.resultEl.hidden = true;
    state.resultEl.className = 'gn-result';
    state.input.value = '';
    state.input.min = String(cfg.min);
    state.input.max = String(cfg.max);
    setMessage(`Загадано число від ${cfg.min} до ${cfg.max}`, false);
    setLocked(false);
    updateInfo();
    state.input.focus();
  }

  // Повертає текст помилки або null; спроба при помилці не витрачається
  function validate(raw) {
    if (state.input.validity.badInput) return 'Введіть число цифрами';
    if (raw === '') return 'Введіть число';
    const value = Number(raw);
    if (!Number.isInteger(value)) return 'Введіть ціле число';
    if (value < state.cfg.min || value > state.cfg.max) {
      return `Число має бути від ${state.cfg.min} до ${state.cfg.max}`;
    }
    if (state.guesses.has(value)) return `Ви вже вводили число ${value}`;
    return null;
  }

  function finishGame(won) {
    state.finished = true;
    const durationSec = state.startMs === null
      ? 0
      : Math.max(0, Math.floor((performance.now() - state.startMs) / 1000));
    const { cfg, used, target, difficulty } = state;
    const score = calcScore(difficulty, used, cfg.attempts, won);

    setLocked(true);
    setMessage('', false);
    state.resultEl.textContent = won
      ? `Вгадано! Число: ${target}. Спроб: ${used}. Очки: ${score}`
      : `Спроби закінчились. Загадане число: ${target}`;
    state.resultEl.className = `gn-result ${won ? 'gn-result-win' : 'gn-result-lose'}`;
    state.resultEl.hidden = false;
    if (won) restartAnimation(state.resultEl, 'gn-pulse');

    // Екран результату показано — повідомляємо рівно один раз
    if (typeof state.ctx.onFinish === 'function') {
      state.ctx.onFinish({
        score,
        won,
        durationSec,
        details: {
          min: cfg.min,
          max: cfg.max,
          attemptsUsed: used,
          maxAttempts: cfg.attempts,
          target
        }
      });
    }
  }

  function submitGuess() {
    if (!state || state.finished) return;
    const raw = state.input.value.trim();
    const error = validate(raw);
    if (error) {
      setMessage(error, true);
      state.input.focus();
      return;
    }

    const guess = Number(raw);
    if (state.startMs === null) state.startMs = performance.now(); // перша зарахована спроба
    state.used += 1;
    state.guesses.add(guess);
    state.input.value = '';

    if (guess === state.target) {
      addHistory(guess, 'win');
      updateInfo();
      finishGame(true);
      return;
    }

    const higher = state.target > guess;
    if (higher) state.lo = Math.max(state.lo, guess + 1);
    else state.hi = Math.min(state.hi, guess - 1);
    addHistory(guess, higher ? 'higher' : 'lower');
    updateInfo();
    restartAnimation(state.inputRow, 'gn-shake');

    if (state.used >= state.cfg.attempts) {
      finishGame(false);
      return;
    }
    setMessage(higher ? 'Загадане число більше' : 'Загадане число менше', false);
    state.input.focus();
  }

  /* --- Обробники --- */

  function handleClick(event) {
    if (!state) return;
    const button = event.target.closest('button');
    if (!button) return;
    const { action } = button.dataset;
    if (action === 'submit') submitGuess();
    else if (action === 'new') resetGame(); // покинута партія: onFinish не викликається
  }

  function handleKeydown(event) {
    if (!state || event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    submitGuess();
  }

  /* --- Публічний інтерфейс --- */

  function mount(container, ctx) {
    if (state) unmount();
    const context = ctx || {};
    const difficulty = Object.hasOwn(CONFIG, context.difficulty) ? context.difficulty : 'easy';
    const dom = buildDom(container);
    state = {
      ...dom,
      container,
      ctx: context,
      difficulty,
      cfg: CONFIG[difficulty],
      target: 0,
      used: 0,
      lo: 0,
      hi: 0,
      guesses: new Set(),
      startMs: null,
      finished: false
    };

    state.root.addEventListener('click', handleClick);
    state.input.addEventListener('keydown', handleKeydown);
    resetGame();
  }

  function unmount() {
    if (!state) return;
    state.root.removeEventListener('click', handleClick);
    state.input.removeEventListener('keydown', handleKeydown);
    state.container.replaceChildren();
    state = null;
  }

  return {
    id: 'guessnumber',
    title: 'Вгадай число',
    description: 'Вгадай загадане число за обмежену кількість спроб',
    icon: '🎯',
    mount,
    unmount
  };
}

const game = createGuessNumber();
export default game;