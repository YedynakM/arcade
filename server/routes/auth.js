'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { readDb, updateDb } = require('../services/db');
const { isString } = require('../services/validate');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../services/config');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

// Створює помилку з HTTP-статусом
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Рівень за очками: Новачок (0+), Профі (500+), Легенда (2000+)
function levelFor(points) {
  if (points >= 2000) return 'Легенда';
  if (points >= 500) return 'Профі';
  return 'Новачок';
}

// Публічний об'єкт користувача без passwordHash
function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    avatar: u.avatar,
    role: u.role,
    points: u.points,
    level: levelFor(u.points),
    blocked: u.blocked
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Перевірка логіна й пароля за правилами; кидає 400
function validateCredentials(body) {
  const { username, password } = body || {};
  let r = isString(username, 3, 20);
  if (!r.ok || !USERNAME_RE.test(username)) {
    throw httpError(400, 'Логін: 3-20 символів (літери, цифри, _)');
  }
  r = isString(password, 6, 64);
  if (!r.ok) throw httpError(400, 'Пароль: 6-64 символи');
}

// Створює адміна при першому запуску, якщо його ще немає
async function ensureAdmin() {
  const hash = await bcrypt.hash('admin123', 10);
  await updateDb((db) => {
    if (db.users.some((u) => u.role === 'admin')) return;
    db.users.push({
      id: crypto.randomUUID(),
      username: 'admin',
      passwordHash: hash,
      nickname: 'admin',
      avatar: '🙂',
      role: 'admin',
      points: 0,
      level: 'Новачок',
      blocked: false
    });
    console.log('Створено адміністратора: admin / admin123');
  });
}

router.post('/register', async (req, res, next) => {
  try {
    validateCredentials(req.body);
    const username = req.body.username.trim();
    const hash = await bcrypt.hash(req.body.password, 10);

    const user = await updateDb((db) => {
      const lower = username.toLowerCase();
      if (db.users.some((u) => u.username.toLowerCase() === lower)) {
        throw httpError(409, 'Такий логін уже зайнятий');
      }
      const created = {
        id: crypto.randomUUID(),
        username,
        passwordHash: hash,
        nickname: username,
        avatar: '🙂',
        role: 'user',
        points: 0,
        level: 'Новачок',
        blocked: false
      };
      db.users.push(created);
      return created;
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!isString(username, 1, 20).ok || !isString(password, 1, 64).ok) {
      throw httpError(400, 'Введіть логін і пароль');
    }

    const db = await readDb();
    const lower = username.trim().toLowerCase();
    const user = db.users.find((u) => u.username.toLowerCase() === lower);
    const valid = user && (await bcrypt.compare(password, user.passwordHash));
    if (!valid) throw httpError(401, 'Невірний логін або пароль');
    if (user.blocked) throw httpError(403, 'Обліковий запис заблоковано');

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// Автостворення адміна при завантаженні модуля
ensureAdmin().catch((err) => console.error('Не вдалося створити адміна:', err));

module.exports = router;
module.exports.publicUser = publicUser;
module.exports.levelFor = levelFor;