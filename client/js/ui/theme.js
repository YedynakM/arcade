const THEME_KEY = 'arcade_theme';

// Читає збережену тему; null, якщо вибору ще не було
function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (e) {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    // localStorage недоступний: тема діє лише до перезавантаження
  }
}

// Тема за системними налаштуваннями
function systemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || systemTheme();
}

// Початкова тема: збережений вибір або prefers-color-scheme
export function initTheme() {
  applyTheme(getStoredTheme() || systemTheme());
}

// Перемикає тему та зберігає вибір; повертає нову тему
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  storeTheme(next);
  return next;
}