import { setLoading } from './spinner.js';
import { showToast } from './toast.js';

let formCounter = 0;

// Перевіряє значення одного поля; повертає текст помилки або ''
function validateField(field, value) {
  const v = typeof value === 'string' ? value.trim() : value;
  const text = typeof v === 'string' ? v : '';

  if (field.required && text === '') return 'Це поле обов\'язкове';
  if (text === '') return '';

  if (field.type === 'number') {
    const num = Number(text);
    if (!Number.isFinite(num)) return 'Введіть число';
    if (field.min !== undefined && num < field.min) return `Мінімальне значення: ${field.min}`;
    if (field.max !== undefined && num > field.max) return `Максимальне значення: ${field.max}`;
    return '';
  }

  if (field.min !== undefined && text.length < field.min) return `Мінімум ${field.min} симв.`;
  if (field.max !== undefined && text.length > field.max) return `Максимум ${field.max} симв.`;
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Вкажіть коректний email';
  if (field.pattern && !new RegExp(field.pattern).test(text)) {
    return field.patternMessage || 'Невірний формат';
  }
  return '';
}

// Створює форму: fields [{name,label,type,required,min,max,pattern,placeholder,hint}]
// onSubmit(values) може кидати Error з полем fields: {name: "помилка"}
export function createForm({ fields = [], submitText = 'Надіслати', onSubmit } = {}) {
  const id = ++formCounter;
  const form = document.createElement('form');
  form.className = 'form';
  form.noValidate = true;

  const inputs = {};
  const wraps = {};
  const errors = {};

  for (const field of fields) {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const inputId = `f${id}-${field.name}`;
    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = inputId;
    label.textContent = field.label || field.name;
    if (field.required) {
      const star = document.createElement('span');
      star.className = 'field-required';
      star.textContent = ' *';
      label.append(star);
    }

    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
    }
    input.id = inputId;
    input.name = field.name;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.type === 'password') {
      input.autocomplete = field.name === 'oldPassword' ? 'current-password' : 'new-password';
    }

    const error = document.createElement('div');
    error.className = 'field-error';
    error.id = `${inputId}-error`;
    error.setAttribute('role', 'alert');
    input.setAttribute('aria-describedby', error.id);

    wrap.append(label, input);
    if (field.hint) {
      const hint = document.createElement('div');
      hint.className = 'field-hint';
      hint.textContent = field.hint;
      wrap.append(hint);
    }
    wrap.append(error);
    form.append(wrap);

    inputs[field.name] = input;
    wraps[field.name] = wrap;
    errors[field.name] = error;

    // Помилка зникає, коли користувач починає виправляти поле
    input.addEventListener('input', () => setFieldError(field.name, ''));
  }

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn btn-primary';
  submit.textContent = submitText;
  form.append(submit);

  function setFieldError(name, message) {
    if (!errors[name]) return;
    errors[name].textContent = message || '';
    wraps[name].classList.toggle('has-error', !!message);
    if (message) inputs[name].setAttribute('aria-invalid', 'true');
    else inputs[name].removeAttribute('aria-invalid');
  }

  function getValues() {
    const values = {};
    for (const field of fields) {
      const raw = inputs[field.name].value;
      values[field.name] = field.type === 'password' ? raw : raw.trim();
    }
    return values;
  }

  function setValues(values = {}) {
    for (const field of fields) {
      if (values[field.name] !== undefined) inputs[field.name].value = values[field.name];
    }
  }

  // setErrors({name: "текст"}): показує помилки під полями
  function setErrors(map = {}) {
    for (const field of fields) setFieldError(field.name, map[field.name] || '');
  }

  function reset() {
    form.reset();
    setErrors({});
  }

  function validateAll(values) {
    const found = {};
    for (const field of fields) {
      const message = validateField(field, values[field.name]);
      if (message) found[field.name] = message;
    }
    return found;
  }

  let busy = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;

    const values = getValues();
    const found = validateAll(values);
    setErrors(found);

    const firstBad = fields.find((f) => found[f.name]);
    if (firstBad) {
      inputs[firstBad.name].focus();
      return;
    }
    if (typeof onSubmit !== 'function') return;

    busy = true;
    setLoading(submit, true);
    try {
      await onSubmit(values);
    } catch (err) {
      if (err && err.aborted) return;
      if (err && err.fields && typeof err.fields === 'object') {
        setErrors(err.fields);
      } else {
        showToast((err && err.message) || 'Сталася помилка. Спробуйте ще раз', 'error');
      }
    } finally {
      busy = false;
      setLoading(submit, false);
    }
  });

  return { element: form, setValues, setErrors, reset };
}