'use strict';

const { GAME_IDS } = require('./scoring');

// 8 досягнень: id, title, description, icon
const ACHIEVEMENTS = [
  { id: 'firstGame', title: 'Перша гра', description: 'Зіграйте свою першу гру', icon: '🎮' },
  { id: 'points100', title: '100 очок', description: 'Назбирайте 100 очок', icon: '💯' },
  { id: 'points500', title: '500 очок', description: 'Назбирайте 500 очок', icon: '🏅' },
  { id: 'points2000', title: '2000 очок', description: 'Назбирайте 2000 очок', icon: '🏆' },
  { id: 'allGames', title: 'Всі ігри', description: 'Зіграйте в усі ігри', icon: '🌟' },
  { id: 'winStreak10', title: '10 перемог поспіль', description: 'Виграйте 10 ігор поспіль', icon: '🔥' },
  { id: 'hardWin', title: 'Майстер', description: 'Виграйте на складності «hard»', icon: '💪' },
  { id: 'games25', title: 'Завзятий гравець', description: 'Зіграйте 25 ігор', icon: '⏱️' }
];

// Найдовша серія перемог поспіль (userScores у хронологічному порядку)
function longestWinStreak(userScores) {
  let best = 0;
  let current = 0;
  for (const s of userScores) {
    current = s.won ? current + 1 : 0;
    if (current > best) best = current;
  }
  return best;
}

// Перевіряє умови; повертає масив НОВИХ досягнень, яких ще немає в unlockedIds
function checkAchievements(user, userScores, unlockedIds) {
  const scores = Array.isArray(userScores) ? userScores : [];
  const unlocked = new Set(unlockedIds || []);
  const points = user ? user.points || 0 : 0;
  const played = new Set(scores.map((s) => s.gameId));

  const conditions = {
    firstGame: scores.length >= 1,
    points100: points >= 100,
    points500: points >= 500,
    points2000: points >= 2000,
    allGames: GAME_IDS.every((id) => played.has(id)),
    winStreak10: longestWinStreak(scores) >= 10,
    hardWin: scores.some((s) => s.won && s.difficulty === 'hard'),
    games25: scores.length >= 25
  };

  return ACHIEVEMENTS.filter((a) => conditions[a.id] && !unlocked.has(a.id));
}

module.exports = { ACHIEVEMENTS, checkAchievements };