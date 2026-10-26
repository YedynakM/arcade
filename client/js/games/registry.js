// Каталог ігор і динамічне завантаження файлів ігор
export const GAMES = [
  { id: 'tictactoe', title: 'Хрестики-нулики', icon: '❌', description: 'Класична гра на полі 3×3 проти комп\'ютера.' },
  { id: 'maze', title: 'Лабіринт', icon: '🧩', description: 'Знайдіть вихід із лабіринту якнайшвидше.' },
  { id: 'puzzle', title: 'Пазл', icon: '🖼️', description: 'Складіть картинку з перемішаних частин.' },
  { id: 'memory', title: 'Пам\'ять', icon: '🃏', description: 'Знайдіть усі пари однакових карток.' },
  { id: 'snake', title: 'Змійка', icon: '🐍', description: 'Збирайте їжу та не врізайтеся в себе.' },
  { id: 'game2048', title: '2048', icon: '🔢', description: 'Об\'єднуйте плитки та досягніть 2048.' },
  { id: 'guessnumber', title: 'Вгадай число', icon: '🎯', description: 'Вгадайте загадане число за мінімум спроб.' }
];

// Назви файлів ігор збігаються з id
const FILES = {
  tictactoe: 'tictactoe',
  maze: 'maze',
  puzzle: 'puzzle',
  memory: 'memory',
  snake: 'snake',
  game2048: 'game2048',
  guessnumber: 'guessnumber'
};

// Кеш результатів перевірки доступності: id -> boolean
const availability = new Map();
// Кеш модулів: id -> об'єкт гри
const loaded = new Map();

export function getGameMeta(id) {
  return GAMES.find((g) => g.id === id) || null;
}

// Завантажує гру; якщо файлу немає або імпорт падає, повертає null
export async function loadGame(id) {
  const file = FILES[id];
  if (!file) return null;
  if (loaded.has(id)) return loaded.get(id);

  try {
    const module = await import(`./${file}.js`);
    const game = module && module.default;
    if (!game || typeof game.mount !== 'function') {
      availability.set(id, false);
      return null;
    }
    loaded.set(id, game);
    availability.set(id, true);
    return game;
  } catch (err) {
    availability.set(id, false);
    return null;
  }
}

// Чи існує файл гри (з кешем)
export async function isAvailable(id) {
  if (availability.has(id)) return availability.get(id);
  const game = await loadGame(id);
  return game !== null;
}