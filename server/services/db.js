'use strict';

const fs = require('fs').promises;
const path = require('path');

// Шлях до файлу бази даних
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const TMP_PATH = DB_PATH + '.tmp';

// Черга запису: усі зміни виконуються строго по одній
let queue = Promise.resolve();

// Порожня структура бази за контрактом
function createEmptyDb() {
  return {
    users: [],
    scores: [],
    feedback: [],
    unlocked: [],
    settings: {
      multipliers: {},
      enabledGames: [],
      dailyGame: { gameId: '', date: '' }
    }
  };
}

// Доповнює прочитані дані відсутніми полями
function normalizeDb(data) {
  const empty = createEmptyDb();
  const db = data && typeof data === 'object' ? data : {};
  for (const key of ['users', 'scores', 'feedback', 'unlocked']) {
    if (!Array.isArray(db[key])) db[key] = empty[key];
  }
  const settings = db.settings && typeof db.settings === 'object' ? db.settings : {};
  if (!settings.multipliers || typeof settings.multipliers !== 'object') {
    settings.multipliers = empty.settings.multipliers;
  }
  if (!Array.isArray(settings.enabledGames)) {
    settings.enabledGames = empty.settings.enabledGames;
  }
  if (!settings.dailyGame || typeof settings.dailyGame !== 'object') {
    settings.dailyGame = empty.settings.dailyGame;
  }
  db.settings = settings;
  return db;
}

// Читає базу з файлу; якщо файлу немає, повертає порожню структуру
async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    return normalizeDb(JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') return createEmptyDb();
    throw err;
  }
}

// Атомарний запис: спершу тимчасовий файл, потім rename
async function writeAtomic(db) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    await fs.writeFile(TMP_PATH, JSON.stringify(db, null, 2), 'utf8');
    await fs.rename(TMP_PATH, DB_PATH);
  } catch (err) {
    await fs.unlink(TMP_PATH).catch(() => {});
    throw err;
  }
}

// Виконує mutatorFn(db) у черзі та зберігає базу.
// Якщо mutatorFn кидає помилку, запис не відбувається.
// Повертає те, що повернула mutatorFn.
function updateDb(mutatorFn) {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await mutatorFn(db);
    await writeAtomic(db);
    return result;
  });
  // Помилка одного запиту не ламає чергу для наступних
  queue = run.catch(() => {});
  return run;
}

module.exports = { readDb, updateDb };