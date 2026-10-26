'use strict';

const express = require('express');
const crypto = require('crypto');
const requireAuth = require('../middleware/requireAuth');
const { updateDb } = require('../services/db');
const { validateResult, awardPoints, levelFor } = require('../services/scoring');
const { checkAchievements } = require('../services/achievements');
const { todayStr } = require('./games');

const router = express.Router();

// Створює помилку з HTTP-статусом
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    const result = await updateDb((db) => {
      const user = db.users.find((u) => u.id === req.user.id);
      if (!user) throw httpError(401, 'Користувача не знайдено');
      if (user.blocked) throw httpError(403, 'Обліковий запис заблоковано');

      const check = validateResult(body, db.settings);
      if (!check.ok) throw httpError(400, check.error);

      const awarded = awardPoints(body, db.settings, todayStr());

      // Попередній особистий рекорд у цій грі (за нарахованими очками)
      const previous = db.scores
        .filter((s) => s.userId === user.id && s.gameId === body.gameId)
        .reduce((max, s) => Math.max(max, s.awarded), 0);
      const newRecord = awarded > previous;

      user.points = (user.points || 0) + awarded;
      user.level = levelFor(user.points);

      db.scores.push({
        id: crypto.randomUUID(),
        userId: user.id,
        gameId: body.gameId,
        difficulty: body.difficulty,
        score: body.score,
        awarded,
        won: body.won,
        durationSec: body.durationSec,
        details: body.details,
        createdAt: new Date().toISOString()
      });

      // Досягнення перевіряються за всіма партіями користувача
      const userScores = db.scores.filter((s) => s.userId === user.id);
      const unlockedIds = db.unlocked
        .filter((u) => u.userId === user.id)
        .map((u) => u.achievementId);
      const fresh = checkAchievements(user, userScores, unlockedIds);
      for (const a of fresh) {
        db.unlocked.push({
          userId: user.id,
          achievementId: a.id,
          unlockedAt: new Date().toISOString()
        });
      }

      return { awarded, total: user.points, newRecord, achievements: fresh };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;