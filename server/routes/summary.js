'use strict';

const express = require('express');
const { readDb } = require('../services/db');
const { levelFor } = require('../services/scoring');
const { ensureDailyGame } = require('./games');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    // Гра дня оновлюється за потреби, потім читаємо актуальну базу
    const settings = await ensureDailyGame();
    const db = await readDb();

    const players = db.users.filter((u) => u.role !== 'admin' && !u.blocked);

    const top3 = players
      .slice()
      .sort((a, b) => (b.points || 0) - (a.points || 0) || a.username.localeCompare(b.username))
      .slice(0, 3)
      .map((u, i) => ({
        rank: i + 1,
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        level: levelFor(u.points || 0),
        points: u.points || 0
      }));

    res.json({
      top3,
      totalPlayers: players.length,
      totalGames: db.scores.length,
      dailyGame: settings.dailyGame
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;