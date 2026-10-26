'use strict';

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { readDb } = require('../services/db');
const { ACHIEVEMENTS } = require('../services/achievements');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const unlockedIds = new Set(
      db.unlocked
        .filter((u) => u.userId === req.user.id)
        .map((u) => u.achievementId)
    );

    const items = ACHIEVEMENTS.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      icon: a.icon,
      unlocked: unlockedIds.has(a.id)
    }));

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;