import { get, post } from './api.js';

const TOKEN_KEY = 'arcade_token';

let user = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn(user);
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // localStorage недоступний: працюємо без збереження
  }
}

export function getUser() {
  return user;
}

export function isAdmin() {
  return !!user && user.role === 'admin';
}

// Підписка на зміну стану користувача; повертає функцію відписки
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Оновлює поточного користувача (наприклад, після зміни профілю чи нарахування очок)
export function setUser(next) {
  user = next;
  notify();
}

export async function login(username, password) {
  const data = await post('/login', { username, password });
  setToken(data.token);
  setUser(data.user);
  return data.user;
}

export async function register(username, password) {
  const data = await post('/register', { username, password });
  setToken(data.token);
  setUser(data.user);
  return data.user;
}

export async function logout() {
  setToken(null);
  setUser(null);
}

// Завантажує користувача за збереженим токеном; без токена або при помилці: гість
export async function loadMe() {
  if (!getToken()) {
    setUser(null);
    return null;
  }
  try {
    const data = await get('/me');
    setUser(data.user);
    return data.user;
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      setToken(null);
    }
    setUser(null);
    return null;
  }
}

// Викликається з api.js при 401: очищає токен і стан, веде на сторінку входу
export function handleUnauthorized() {
  setToken(null);
  setUser(null);
  if (location.hash !== '#/login') location.hash = '#/login';
}