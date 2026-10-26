'use strict';

const { isInt, isEnum } = require('./validate');

// Дозволені ігри та рівні складності за контрактом
const GAME_IDS = ['tictactoe', 'maze', 'puzzle', 'memory', 'snake', 'game2048', 'guessnumber'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Рівень за очками: Новачок (0+), Профі (500+), Легенда (2000+)
function levelFor(points) {
  if (points >= 2000) return 'Легенда';
  if (points >= 500) return 'Профі';
  return 'Новачок';
}

// Чи увімкнена гра: порожній список enabledGames означає, що увімкнені всі
function isGameEnabled(settings, gameId) {
  const enabled = settings && Array.isArray(settings.enabledGames) ? settings.enabledGames : [];
  return enabled.length === 0 || enabled.includes(gameId);
}

// Множник гри (за замовчуванням 1)
function multiplierFor(settings, gameId) {
  const m = settings && settings.multipliers ? settings.multipliers[gameId] : undefined;
  return typeof m === 'number' && Number.isFinite(m) && m >= 0 ? m : 1;
}

// Очки = сире значення × множник гри × (2 для гри дня у відповідну дату)
function awardPoints(rawResult, settings, dateStr) {
  const raw = Number(rawResult && rawResult.score) || 0;
  const daily = settings && settings.dailyGame ? settings.dailyGame : {};
  const isDaily = daily.gameId === rawResult.gameId && daily.date === dateStr;
  return Math.round(raw * multiplierFor(settings, rawResult.gameId) * (isDaily ? 2 : 1));
}

// Перевірка результату гри; повертає {ok, error}
function validateResult(body, settings) {
  const b = body && typeof body === 'object' ? body : {};

  let r = isEnum(b.gameId, GAME_IDS);
  if (!r.ok) return { ok: false, error: 'Невідома гра' };
  if (!isGameEnabled(settings, b.gameId)) {
    return { ok: false, error: 'Цю гру вимкнено' };
  }

  r = isEnum(b.difficulty, DIFFICULTIES);
  if (!r.ok) return { ok: false, error: 'Невірна складність' };

  r = isInt(b.score, 0, 100000);
  if (!r.ok) return { ok: false, error: 'Очки: ціле число від 0 до 100000' };

  r = isInt(b.durationSec, 0, 86400);
  if (!r.ok) return { ok: false, error: 'Тривалість: ціле число від 0 до 86400 с' };

  if (typeof b.won !== 'boolean') {
    return { ok: false, error: 'Поле «won» має бути true або false' };
  }

  if (!b.details || typeof b.details !== 'object' || Array.isArray(b.details)) {
    return { ok: false, error: 'Деталі мають бути об\'єктом' };
  }

  return { ok: true, error: null };
}

module.exports = {
  GAME_IDS,
  DIFFICULTIES,
  levelFor,
  isGameEnabled,
  multiplierFor,
  awardPoints,
  validateResult
};