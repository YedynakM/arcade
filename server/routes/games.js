'use strict';

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { readDb, updateDb } = require('../services/db');
const { GAME_IDS, isGameEnabled, multiplierFor } = require('../services/scoring');

const router = express.Router();

// Сьогоднішня дата у форматі YYYY-MM-DD (локальний час сервера)
function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Обирає випадкову увімкнену гру; якщо таких немає, повертає порожній рядок
function pickDailyGame(settings) {
  const enabled = GAME_IDS.filter((id) => isGameEnabled(settings, id));
  if (enabled.length === 0) return '';
  return enabled[Math.floor(Math.random() * enabled.length)];
}

// Повертає актуальні налаштування; за потреби оновлює гру дня однією транзакцією
async function ensureDailyGame() {
  const today = todayStr();
  const db = await readDb();
  if (db.settings.dailyGame.date === today) return db.settings;

  return updateDb((fresh) => {
    // Повторна перевірка всередині транзакції: інший запит міг уже оновити гру дня
    if (fresh.settings.dailyGame.date !== today) {
      fresh.settings.dailyGame = { gameId: pickDailyGame(fresh.settings), date: today };
    }
    return fresh.settings;
  });
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const settings = await ensureDailyGame();
    const games = GAME_IDS.map((id) => ({
      id,
      enabled: isGameEnabled(settings, id),
      multiplier: multiplierFor(settings, id)
    }));
    res.json({ games, dailyGame: settings.dailyGame });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.todayStr = todayStr;
module.exports.ensureDailyGame = ensureDailyGame;