'use strict';

// Відповідь 404 для невідомих маршрутів API
function notFoundHandler(req, res, next) {
  const err = new Error('Маршрут не знайдено');
  err.status = 404;
  next(err);
}

// Єдина обробка помилок: завжди JSON {error: "українською"}
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = Number(err.status || err.statusCode) || 500;
  let message = err.message;

  // Некоректний JSON у тілі запиту
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Некоректний JSON у запиті';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Запит занадто великий';
  }

  if (status < 400 || status > 599) status = 500;

  // Внутрішні помилки не розкривають деталей клієнту
  if (status >= 500) {
    console.error('Помилка сервера:', err);
    message = 'Внутрішня помилка сервера';
  }

  res.status(status).json({ error: message || 'Невідома помилка' });
}

module.exports = errorHandler;
module.exports.notFoundHandler = notFoundHandler;