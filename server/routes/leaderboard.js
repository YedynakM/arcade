'use strict';

const express = require('express');
const { readDb } = require('../services/db');
const { GAME_IDS, levelFor } = require('../services/scoring');

const router = express.Router();

const PAGE_SIZE = 10;

// Створює помилку з HTTP-статусом
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Публічні поля гравця для таблиці лідерів (без passwordHash)
function toItem(user, points) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    level: levelFor(points),
    points
  };
}

router.get('/', async (req, res, next) => {
  try {
    const gameId = req.query.gameId ? String(req.query.gameId) : '';
    if (gameId && !GAME_IDS.includes(gameId)) {
      throw httpError(400, 'Невідома гра');
    }

    let page = parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;

    const db = await readDb();
    let rows;

    if (gameId) {
      // Сума нарахованих очок у цій грі
      const sums = new Map();
      for (const s of db.scores) {
        if (s.gameId !== gameId) continue;
        sums.set(s.userId, (sums.get(s.userId) || 0) + (s.awarded || 0));
      }
      rows = db.users
        .filter((u) => sums.has(u.id) && !u.blocked)
        .map((u) => toItem(u, sums.get(u.id)));
      // Рівень у рядку показує рівень за загальними очками користувача
      for (const row of rows) {
        const user = db.users.find((u) => u.id === row.id);
        row.level = levelFor(user.points || 0);
      }
    } else {
      rows = db.users
        .filter((u) => !u.blocked)
        .map((u) => toItem(u, u.points || 0));
    }

    rows.sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));

    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const start = (page - 1) * PAGE_SIZE;
    const items = rows.slice(start, start + PAGE_SIZE).map((row, i) => ({
      rank: start + i + 1,
      ...row
    }));

    res.json({ items, page, pages });
  } catch (err) {
    next(err);
  }
});

module.exports = router;