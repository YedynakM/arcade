import { createForm } from '../ui/form.js';
import { showToast } from '../ui/toast.js';
import { register } from '../auth.js';
import { navigate } from '../router.js';

// Оцінка надійності пароля: 0 слабкий, 1 середній, 2 сильний
function passwordStrength(value) {
  let score = 0;
  if (value.length >= 6) score += 1;
  if (value.length >= 10) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^a-zA-Z0-9]/.test(value)) score += 1;
  if (score >= 4) return 2;
  if (score >= 3) return 1;
  return 0;
}

const STRENGTH_LABELS = ['слабкий', 'середній', 'сильний'];
const STRENGTH_CLASSES = ['badge-danger', 'badge-accent', 'badge-success'];
const STRENGTH_WIDTH = [33, 66, 100];

// Створює індикатор надійності й підключає його до поля пароля
function addStrengthMeter(formEl) {
  const input = formEl.querySelector('input[name="password"]');
  if (!input) return;

  const wrap = document.createElement('div');
  wrap.setAttribute('aria-live', 'polite');

  const progress = document.createElement('div');
  progress.className = 'progress';
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  progress.append(bar);

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.style.marginTop = '0.4rem';

  wrap.append(progress, badge);
  wrap.hidden = true;
  input.after(wrap);

  input.addEventListener('input', () => {
    const value = input.value;
    if (!value) {
      wrap.hidden = true;
      return;
    }
    const level = passwordStrength(value);
    wrap.hidden = false;
    bar.style.width = `${STRENGTH_WIDTH[level]}%`;
    badge.className = `badge ${STRENGTH_CLASSES[level]}`;
    badge.textContent = `Надійність: ${STRENGTH_LABELS[level]}`;
  });
}

export async function render(container, ctx) {
  container.innerHTML = '';

  const card = document.createElement('section');
  card.className = 'card';
  card.style.maxWidth = '420px';
  card.style.margin = '0 auto';

  const title = document.createElement('h1');
  title.textContent = 'Реєстрація';

  const form = createForm({
    fields: [
      {
        name: 'username',
        label: 'Логін',
        type: 'text',
        required: true,
        min: 3,
        max: 20,
        pattern: '^[a-zA-Z0-9_]+$',
        patternMessage: 'Лише латинські літери, цифри та _',
        placeholder: 'Наприклад, player_1',
        hint: '3-20 символів: літери, цифри, _'
      },
      {
        name: 'password',
        label: 'Пароль',
        type: 'password',
        required: true,
        min: 6,
        max: 64,
        placeholder: 'Ваш пароль',
        hint: '6-64 символи'
      },
      {
        name: 'confirm',
        label: 'Повтор пароля',
        type: 'password',
        required: true,
        min: 6,
        max: 64,
        placeholder: 'Повторіть пароль'
      }
    ],
    submitText: 'Зареєструватися',
    onSubmit: async (values) => {
      if (values.password !== values.confirm) {
        const mismatch = new Error('Паролі не збігаються');
        mismatch.fields = { confirm: 'Паролі не збігаються' };
        throw mismatch;
      }
      try {
        const user = await register(values.username, values.password);
        showToast(`Вітаємо, ${user.nickname}!`, 'success');
        navigate('/');
      } catch (err) {
        // Зайнятий логін показуємо під полем логіна
        if (err.status === 409 || err.status === 400) {
          const withField = new Error(err.message);
          withField.fields = { username: err.message };
          throw withField;
        }
        throw err;
      }
    }
  });

  addStrengthMeter(form.element);

  const footer = document.createElement('p');
  footer.style.marginTop = '1rem';
  footer.append('Уже є акаунт? ');
  const link = document.createElement('a');
  link.href = '#/login';
  link.textContent = 'Вхід';
  footer.append(link);

  card.append(title, form.element, footer);
  container.append(card);

  form.element.querySelector('input[name="username"]').focus();

  return function cleanup() {
    // Слухачі прив'язані до елементів, які видаляються разом зі сторінкою
  };
}