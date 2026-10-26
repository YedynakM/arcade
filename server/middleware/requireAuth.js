'use strict';

const jwt = require('jsonwebtoken');
const { readDb } = require('../services/db');
const { JWT_SECRET } = require('../services/config');

// Створює помилку з HTTP-статусом
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Перевірка JWT із заголовка Authorization: Bearer <token>
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw httpError(401, 'Потрібна авторизація');
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      throw httpError(401, 'Недійсний або прострочений токен');
    }

    const db = await readDb();
    const user = db.users.find((u) => u.id === payload.id);
    if (!user) {
      throw httpError(401, 'Користувача не знайдено');
    }
    if (user.blocked) {
      throw httpError(403, 'Обліковий запис заблоковано');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;