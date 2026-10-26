'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const requireAuth = require('../middleware/requireAuth');
const { updateDb } = require('../services/db');
const { isString } = require('../services/validate');
const { publicUser } = require('./auth');

const router = express.Router();

// Один емодзі: один графемний кластер, що містить піктограму
function isSingleEmoji(value) {
  if (typeof value !== 'string') return false;
  const str = value.trim();
  if (!str || !/\p{Extended_Pictographic}/u.test(str)) return false;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)];
    return parts.length === 1;
  }
  return [...str].length <= 8;
}

// Створює помилку з HTTP-статусом
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/', async (req, res, next) => {
  try {
    const { nickname, avatar } = req.body || {};
    const hasNick = nickname !== undefined;
    const hasAvatar = avatar !== undefined;

    if (!hasNick && !hasAvatar) {
      throw httpError(400, 'Вкажіть нік або аватар');
    }
    if (hasNick && !isString(nickname, 2, 20).ok) {
      throw httpError(400, 'Нік: 2-20 символів');
    }
    if (hasAvatar && !isSingleEmoji(avatar)) {
      throw httpError(400, 'Аватар має бути одним емодзі');
    }

    const user = await updateDb((db) => {
      const found = db.users.find((u) => u.id === req.user.id);
      if (!found) throw httpError(401, 'Користувача не знайдено');
      if (hasNick) found.nickname = nickname.trim();
      if (hasAvatar) found.avatar = avatar.trim();
      return found;
    });

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.put('/password', async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!isString(oldPassword, 1, 64).ok) {
      throw httpError(400, 'Введіть старий пароль');
    }
    if (!isString(newPassword, 6, 64).ok) {
      throw httpError(400, 'Новий пароль: 6-64 символи');
    }

    const matches = await bcrypt.compare(oldPassword, req.user.passwordHash);
    if (!matches) throw httpError(400, 'Старий пароль невірний');

    const newHash = await bcrypt.hash(newPassword, 10);
    await updateDb((db) => {
      const found = db.users.find((u) => u.id === req.user.id);
      if (!found) throw httpError(401, 'Користувача не знайдено');
      found.passwordHash = newHash;
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;