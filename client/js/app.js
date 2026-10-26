import { initTheme, toggleTheme } from './ui/theme.js';
import { loadMe, logout, getUser, isAdmin, onChange } from './auth.js';
import { initRouter, onRoute, currentPath, navigate, refresh } from './router.js';
import { initBackground } from './ui/background.js';

const nav = document.getElementById('nav');
const burger = document.getElementById('burger');
const navAdmin = document.getElementById('navAdmin');
const userAvatar = document.getElementById('userAvatar');
const userInfo = document.getElementById('userInfo');
const userNick = document.getElementById('userNick');
const userLevel = document.getElementById('userLevel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggle = document.getElementById('themeToggle');

// Підсвічує активну вкладку за поточним шляхом
function updateActiveTab(path) {
  const current = path || currentPath();
  for (const link of nav.querySelectorAll('.nav-link')) {
    const route = link.dataset.route;
    const active = route === '/' ? current === '/' : current === route || current.startsWith(route + '/');
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

// Оновлює блок користувача й видимість вкладки «Адмінка»
function updateUserUi() {
  const user = getUser();
  const logged = !!user;

  userAvatar.hidden = !logged;
  userInfo.hidden = !logged;
  logoutBtn.hidden = !logged;
  loginBtn.hidden = logged;
  navAdmin.hidden = !isAdmin();

  if (logged) {
    userAvatar.textContent = user.avatar;
    userNick.textContent = user.nickname;
    userLevel.textContent = user.level;
  }
}

function closeMenu() {
  nav.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
}

function bindEvents() {
  themeToggle.addEventListener('click', toggleTheme);
  burger.addEventListener('click', toggleMenu);

  // Меню закривається після вибору вкладки
  nav.addEventListener('click', (e) => {
    if (e.target.closest('.nav-link')) closeMenu();
  });

  logoutBtn.addEventListener('click', async () => {
    await logout();
    closeMenu();
    if (currentPath() === '/') refresh();
    else navigate('/');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

async function init() {
  initTheme();
  bindEvents();

  onChange(updateUserUi);
  onRoute(updateActiveTab);

  await loadMe();
  updateUserUi();

  await initRouter(document.getElementById('app'));
  updateActiveTab();
}

init();