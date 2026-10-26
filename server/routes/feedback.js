'use strict';

const express = require('express');
const crypto = require('crypto');
const { updateDb } = require('../services/db');
const { isString } = require('../services/validate');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMIT = 3;
const WINDOW_MS = 60 * 1000;

// Мітки часу відправок з одного IP (у пам'яті)
const hits = new Map();

// Створює помилку з HTTP-статусом
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Повертає true, якщо ліміт вичерпано; інакше реєструє спробу
function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

// Періодичне очищення застарілих записів
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    const recent = times.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) hits.delete(ip);
    else hits.set(ip, recent);
  }
}, WINDOW_MS).unref();

router.post('/', async (req, res, next) => {
  try {
    const { name, email, message } = req.body || {};

    if (!isString(name, 2, 40).ok) {
      throw httpError(400, 'Ім\'я: 2-40 символів');
    }
    if (!isString(email, 3, 100).ok || !EMAIL_RE.test(email.trim())) {
      throw httpError(400, 'Вкажіть коректний email');
    }
    if (!isString(message, 10, 500).ok) {
      throw httpError(400, 'Повідомлення: 10-500 символів');
    }

    if (isRateLimited(req.ip)) {
      throw httpError(429, 'Забагато повідомлень. Спробуйте за хвилину');
    }

    await updateDb((db) => {
      db.feedback.push({
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        createdAt: new Date().toISOString()
      });
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;