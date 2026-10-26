'use strict';

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { readDb, updateDb } = require('../services/db');
const { isInt, isEnum } = require('../services/validate');
const { GAME_IDS, levelFor, isGameEnabled, multiplierFor } = require('../services/scoring');
const { ensureDailyGame, todayStr } = require('./games');

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

// Створює помилку з HTTP-статусом
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Публічний об'єкт користувача без passwordHash
function toUser(u) {
  return {
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    avatar: u.avatar,
    role: u.role,
    points: u.points || 0,
    level: levelFor(u.points || 0),
    blocked: !!u.blocked
  };
}

// Налаштування у форматі відповіді: повний список ігор з множниками
function toSettings(settings) {
  const multipliers = {};
  for (const id of GAME_IDS) multipliers[id] = multiplierFor(settings, id);
  return {
    multipliers,
    enabledGames: GAME_IDS.filter((id) => isGameEnabled(settings, id)),
    dailyGame: settings.dailyGame
  };
}

router.use(requireAuth, requireAdmin);

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await ensureDailyGame();
    res.json(toSettings(settings));
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const { multipliers, enabledGames, dailyGame } = req.body || {};

    if (!multipliers || typeof multipliers !== 'object' || Array.isArray(multipliers)) {
      throw httpError(400, 'Множники мають бути об\'єктом');
    }
    const cleanMultipliers = {};
    for (const id of GAME_IDS) {
      const value = multipliers[id] === undefined ? 1 : multipliers[id];
      // Множник: ціле число 0-10
      if (!isInt(value, 0, 10).ok) {
        throw httpError(400, `Множник для «${id}»: ціле число від 0 до 10`);
      }
      cleanMultipliers[id] = value;
    }

    if (!Array.isArray(enabledGames) || !enabledGames.every((id) => isEnum(id, GAME_IDS).ok)) {
      throw httpError(400, 'Список увімкнених ігор містить невідому гру');
    }
    if (enabledGames.length === 0) {
      throw httpError(400, 'Увімкніть принаймні одну гру');
    }
    const cleanEnabled = GAME_IDS.filter((id) => enabledGames.includes(id));

    if (dailyGame !== undefined) {
      const gid = dailyGame && dailyGame.gameId;
      if (gid !== '' && !isEnum(gid, GAME_IDS).ok) {
        throw httpError(400, 'Невідома гра дня');
      }
    }

    const saved = await updateDb((db) => {
      db.settings.multipliers = cleanMultipliers;
      db.settings.enabledGames = cleanEnabled;
      if (dailyGame !== undefined) {
        db.settings.dailyGame = { gameId: dailyGame.gameId, date: todayStr() };
      }
      // Вимкнена гра не може бути грою дня
      if (!cleanEnabled.includes(db.settings.dailyGame.gameId)) {
        db.settings.dailyGame = { gameId: cleanEnabled[0], date: todayStr() };
      }
      return db.settings;
    });

    res.json(toSettings(saved));
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const db = await readDb();
    res.json({ users: db.users.map(toUser) });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const { blocked, resetPoints } = req.body || {};
    if (blocked === undefined && resetPoints === undefined) {
      throw httpError(400, 'Вкажіть blocked або resetPoints');
    }
    if (blocked !== undefined && typeof blocked !== 'boolean') {
      throw httpError(400, 'Поле «blocked» має бути true або false');
    }
    if (resetPoints !== undefined && typeof resetPoints !== 'boolean') {
      throw httpError(400, 'Поле «resetPoints» має бути true або false');
    }

    const user = await updateDb((db) => {
      const found = db.users.find((u) => u.id === req.params.id);
      if (!found) throw httpError(404, 'Користувача не знайдено');
      if (blocked === true && found.role === 'admin') {
        throw httpError(400, 'Адміністратора не можна заблокувати');
      }
      if (blocked !== undefined) found.blocked = blocked;
      if (resetPoints === true) {
        found.points = 0;
        found.level = levelFor(0);
      }
      return found;
    });

    res.json({ user: toUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const db = await readDb();
    const since = Date.now() - DAY_MS;

    const gamesByGame = {};
    for (const id of GAME_IDS) gamesByGame[id] = 0;
    const active = new Set();
    let totalPoints = 0;

    for (const s of db.scores) {
      if (gamesByGame[s.gameId] !== undefined) gamesByGame[s.gameId] += 1;
      if (new Date(s.createdAt).getTime() >= since) active.add(s.userId);
    }
    for (const u of db.users) totalPoints += u.points || 0;

    res.json({
      gamesByGame,
      activePlayers24h: active.size,
      totalPoints,
      totalGames: db.scores.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/feedback', async (req, res, next) => {
  try {
    const db = await readDb();
    const items = db.feedback
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;