'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { updateDb } = require('./services/db');
const { GAME_IDS, DIFFICULTIES, levelFor, awardPoints } = require('./services/scoring');
const { checkAchievements } = require('./services/achievements');

const DEMO_PASSWORD = 'demo123';
const DAY_MS = 24 * 60 * 60 * 1000;

// Вигадані демо-гравці
const DEMO_USERS = [
  { username: 'demo_olena', nickname: 'Олена Зірка', avatar: '🦊' },
  { username: 'demo_taras', nickname: 'Тарас Блискавка', avatar: '🐺' },
  { username: 'demo_marichka', nickname: 'Марічка Лис', avatar: '🦉' },
  { username: 'demo_bohdan', nickname: 'Богдан Майстер', avatar: '🐲' },
  { username: 'demo_solomiya', nickname: 'Соломія Сонце', avatar: '🌻' },
  { username: 'demo_andriy', nickname: 'Андрій Ракета', avatar: '🚀' },
  { username: 'demo_ivanka', nickname: 'Іванка Хмаринка', avatar: '☁️' },
  { username: 'demo_yurko', nickname: 'Юрко Лицар', avatar: '🛡️' }
];

// Правдоподібні межі очок і тривалості для кожної гри
const PROFILES = {
  tictactoe: { min: 10, max: 100, durMin: 10, durMax: 90 },
  maze: { min: 50, max: 400, durMin: 30, durMax: 300 },
  puzzle: { min: 50, max: 500, durMin: 60, durMax: 600 },
  memory: { min: 50, max: 300, durMin: 20, durMax: 240 },
  snake: { min: 10, max: 500, durMin: 15, durMax: 400 },
  game2048: { min: 100, max: 3000, durMin: 60, durMax: 900 },
  guessnumber: { min: 10, max: 150, durMin: 5, durMax: 120 }
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Дата у форматі YYYY-MM-DD (локальний час, як у games.js)
function dateStr(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Генерує одну партію користувача у форматі записів routes/scores.js
function makeScore(user, settings, now) {
  const gameId = pick(GAME_IDS);
  const p = PROFILES[gameId];
  const won = Math.random() < 0.6;
  const span = p.max - p.min;
  // Перемога дає вищі очки, поразка нижчі
  const score = won
    ? randInt(p.min + Math.round(span * 0.5), p.max)
    : randInt(p.min, p.min + Math.round(span * 0.5));
  const createdAt = new Date(now - Math.random() * 7 * DAY_MS);

  const body = { gameId, score };
  const awarded = awardPoints(body, settings, dateStr(createdAt));

  return {
    id: crypto.randomUUID(),
    userId: user.id,
    gameId,
    difficulty: pick(DIFFICULTIES),
    score,
    awarded,
    won,
    durationSec: randInt(p.durMin, p.durMax),
    details: { demo: true },
    createdAt: createdAt.toISOString()
  };
}

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = Date.now();

  const summary = await updateDb((db) => {
    let createdUsers = 0;
    let createdScores = 0;

    for (const demo of DEMO_USERS) {
      const lower = demo.username.toLowerCase();
      // Повторний запуск: наявних гравців пропускаємо
      if (db.users.some((u) => u.username.toLowerCase() === lower)) continue;

      const user = {
        id: crypto.randomUUID(),
        username: demo.username,
        passwordHash: hash,
        nickname: demo.nickname,
        avatar: demo.avatar,
        role: 'user',
        points: 0,
        level: 'Новачок',
        blocked: false
      };

      const count = randInt(5, 15);
      const scores = [];
      for (let i = 0; i < count; i++) scores.push(makeScore(user, db.settings, now));
      scores.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      // Перерахунок очок і рівня за правилами scoring.js
      user.points = scores.reduce((sum, s) => sum + s.awarded, 0);
      user.level = levelFor(user.points);

      // Досягнення за правилами achievements.js
      const fresh = checkAchievements(user, scores, []);
      for (const a of fresh) {
        db.unlocked.push({
          userId: user.id,
          achievementId: a.id,
          unlockedAt: new Date().toISOString()
        });
      }

      db.users.push(user);
      db.scores.push(...scores);
      createdUsers += 1;
      createdScores += scores.length;
    }

    return { createdUsers, createdScores };
  });

  console.log(`Демо-дані: створено гравців: ${summary.createdUsers}, партій: ${summary.createdScores}`);
  if (summary.createdUsers === 0) {
    console.log('Усі демо-гравці вже існують, дублікатів не створено.');
  }
}

main().catch((err) => {
  console.error('Не вдалося наповнити базу:', err);
  process.exit(1);
});