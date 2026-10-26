import { getToken, handleUnauthorized } from './auth.js';

const TIMEOUT_MS = 8000;
const API_BASE = '/api';

// Активні запити поточної сторінки
const active = new Set();

// Єдиний формат помилки: Error з message українською та status
function makeError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Базова функція запиту з таймаутом і можливістю скасування
async function request(method, url, body) {
  const controller = new AbortController();
  const entry = { controller, timedOut: false, cancelled: false };
  active.add(entry);

  const timer = setTimeout(() => {
    entry.timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(API_BASE + url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      // 401 поза формою входу означає недійсний токен: виходимо
      if (res.status === 401 && token) handleUnauthorized();
      const message = (data && data.error) || 'Помилка сервера. Спробуйте пізніше';
      throw makeError(message, res.status);
    }
    return data;
  } catch (err) {
    if (err.status) throw err;
    if (err.name === 'AbortError') {
      if (entry.timedOut) throw makeError('Сервер не відповідає. Спробуйте ще раз', 0);
      const aborted = makeError('Запит скасовано', 0);
      aborted.aborted = true;
      throw aborted;
    }
    throw makeError('Немає зв\'язку з сервером. Перевірте з\'єднання', 0);
  } finally {
    clearTimeout(timer);
    active.delete(entry);
  }
}

// Скасовує всі активні запити (при зміні сторінки)
export function abortAll() {
  for (const entry of active) {
    entry.cancelled = true;
    entry.controller.abort();
  }
  active.clear();
}

export function get(url) {
  return request('GET', url);
}

export function post(url, body) {
  return request('POST', url, body === undefined ? {} : body);
}

export function put(url, body) {
  return request('PUT', url, body === undefined ? {} : body);
}

export function patch(url, body) {
  return request('PATCH', url, body === undefined ? {} : body);
}

export { request };
export default { request, get, post, put, patch, abortAll };