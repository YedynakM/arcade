import { abortAll } from './api.js';
import { getUser, isAdmin } from './auth.js';

// Таблиця маршрутів: шаблон, назва файлу сторінки, вимога доступу
const ROUTES = [
  { path: '/', page: 'home' },
  { path: '/hub', page: 'hub' },
  { path: '/game/:id', page: 'game' },
  { path: '/leaderboard', page: 'leaderboard' },
  { path: '/achievements', page: 'achievements', auth: true },
  { path: '/profile', page: 'profile', auth: true },
  { path: '/about', page: 'about' },
  { path: '/admin', page: 'admin', admin: true },
  { path: '/login', page: 'login' },
  { path: '/register', page: 'register' }
];

const TRANSITION_MS = 250;

let container = null;
let cleanup = null;
let renderToken = 0;
const listeners = new Set();

// Поточний шлях із hash (без query)
export function currentPath() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const path = raw.split('?')[0];
  return path.startsWith('/') ? path : '/' + path;
}

// Підписка на зміну маршруту; повертає функцію відписки
export function onRoute(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function navigate(path) {
  if (currentPath() === path) resolve();
  else location.hash = '#' + path;
}

// Підбирає маршрут і параметри за шляхом
function match(path) {
  const parts = path.split('/').filter(Boolean);
  for (const route of ROUTES) {
    const rParts = route.path.split('/').filter(Boolean);
    if (rParts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rParts.length; i++) {
      if (rParts[i].startsWith(':')) params[rParts[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (rParts[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}

function runCleanup() {
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch (e) { /* cleanup не має ламати перехід */ }
  }
  cleanup = null;
}

function showMessage(title, text) {
  container.innerHTML = '';
  const box = document.createElement('section');
  box.className = 'placeholder';
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = text;
  box.append(h, p);
  container.append(box);
}

// Анімація переходу: клас fade+slide на #app
function playTransition() {
  container.classList.remove('page-enter');
  void container.offsetWidth;
  container.classList.add('page-enter');
  setTimeout(() => container.classList.remove('page-enter'), TRANSITION_MS + 50);
}

async function resolve() {
  const token = ++renderToken;
  const path = currentPath();

  runCleanup();
  abortAll();

  const found = match(path);
  let activePath = path;

  if (!found) {
    showMessage('404', 'Сторінку не знайдено');
    playTransition();
    listeners.forEach((fn) => fn(path));
    return;
  }

  const { route, params } = found;
  const user = getUser();

  // Guard: авторизація та роль адміна
  if ((route.auth || route.admin) && !user) {
    navigate('/login');
    return;
  }
  if (route.admin && !isAdmin()) {
    navigate('/');
    return;
  }

  listeners.forEach((fn) => fn(activePath));

  let module = null;
  try {
    module = await import(`./pages/${route.page}.js`);
  } catch (err) {
    module = null;
  }
  if (token !== renderToken) return;

  container.innerHTML = '';
  if (!module || typeof module.render !== 'function') {
    showMessage('Сторінка в розробці', 'Цей розділ скоро з\'явиться.');
    playTransition();
    return;
  }

  playTransition();
  try {
    const result = await module.render(container, { params, user: getUser() });
    if (token !== renderToken) {
      if (typeof result === 'function') result();
      return;
    }
    cleanup = typeof result === 'function' ? result : null;
  } catch (err) {
    if (err && err.aborted) return;
    showMessage('Помилка', 'Не вдалося завантажити сторінку. Спробуйте ще раз.');
  }
}

// Запуск роутера: контейнер сторінок і слухач hashchange
export function initRouter(appContainer) {
  container = appContainer;
  window.addEventListener('hashchange', resolve);
  return resolve();
}

// Повторне відображення поточної сторінки (наприклад, після входу чи виходу)
export function refresh() {
  return resolve();
}