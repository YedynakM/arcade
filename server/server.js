'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

const app = express();

app.use(cors());
app.use(express.json());

// Підключення маршрутів API: відсутній файл пропускається з логом
const routes = [
  ['/api', 'auth'],
  ['/api/me', 'me'],
  ['/api/games', 'games'],
  ['/api/scores', 'scores'],
  ['/api/leaderboard', 'leaderboard'],
  ['/api/achievements', 'achievements'],
  ['/api/feedback', 'feedback'],
  ['/api/summary', 'summary'],
  ['/api/admin', 'admin']
];

for (const [prefix, name] of routes) {
  const file = path.join(__dirname, 'routes', name + '.js');
  try {
    app.use(prefix, require(file));
    console.log(`Маршрут підключено: ${prefix} (${name}.js)`);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes(file)) {
      console.log(`Маршрут пропущено (файл відсутній): routes/${name}.js`);
    } else {
      throw err;
    }
  }
}

// Невідомі маршрути API повертають JSON 404
app.use('/api', errorHandler.notFoundHandler);

// Статика клієнта та головна сторінка
app.use(express.static(CLIENT_DIR));
app.get('/', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Аркада запущена: http://localhost:${PORT}`);
});