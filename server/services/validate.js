'use strict';

// Усі функції повертають {ok, error}; error українською.

// Перевірка рядка: тип і довжина після trim
function isString(value, min = 0, max = Infinity) {
  if (typeof value !== 'string') {
    return { ok: false, error: 'Значення має бути рядком' };
  }
  const length = value.trim().length;
  if (length < min) {
    return { ok: false, error: `Мінімальна довжина: ${min} симв.` };
  }
  if (length > max) {
    return { ok: false, error: `Максимальна довжина: ${max} симв.` };
  }
  return { ok: true, error: null };
}

// Перевірка цілого числа в межах [min, max]
function isInt(value, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, error: 'Значення має бути цілим числом' };
  }
  if (value < min) {
    return { ok: false, error: `Мінімальне значення: ${min}` };
  }
  if (value > max) {
    return { ok: false, error: `Максимальне значення: ${max}` };
  }
  return { ok: true, error: null };
}

// Перевірка належності значення до списку дозволених
function isEnum(value, allowed) {
  if (!Array.isArray(allowed) || !allowed.includes(value)) {
    return { ok: false, error: 'Недопустиме значення' };
  }
  return { ok: true, error: null };
}

module.exports = { isString, isInt, isEnum };