import { put, abortAll } from '../api.js';
import { getUser, loadMe } from '../auth.js';
import { createForm } from '../ui/form.js';
import { animateNumber } from '../ui/counter.js';
import { showToast } from '../ui/toast.js';

const AVATARS = ['🙂', '😎', '🦊', '🐺', '🦉', '🐲', '🌻', '🚀', '☁️', '🛡️', '🐱', '🎮'];

// Пороги рівнів: Новачок 0, Профі 500, Легенда 2000
const LEVELS = [
  { name: 'Новачок', from: 0 },
  { name: 'Профі', from: 500 },
  { name: 'Легенда', from: 2000 }
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Прогрес до наступного рівня
function levelProgress(points) {
  let index = 0;
  LEVELS.forEach((l, i) => { if (points >= l.from) index = i; });
  const next = LEVELS[index + 1];
  if (!next) return { percent: 100, text: 'Максимальний рівень досягнуто' };
  const span = next.from - LEVELS[index].from;
  const percent = Math.min(100, Math.round(((points - LEVELS[index].from) / span) * 100));
  return { percent, text: `До рівня «${next.name}»: ${next.from - points} очок` };
}

export async function render(container, ctx) {
  let alive = true;
  let user = getUser();
  let avatar = user.avatar;

  container.innerHTML = '';
  container.append(el('h1', '', 'Профіль'));

  // Блок статусу: рівень, очки, прогрес
  const status = el('section', 'card');
  const levelLine = el('h2', '', '');
  const pointsLine = el('p');
  pointsLine.append('Очки: ');
  const pointsNum = el('strong', '', '0');
  pointsLine.append(pointsNum);
  const progress = el('div', 'progress');
  const bar = el('div', 'progress-bar');
  progress.append(bar);
  const progressText = el('p', 'field-hint');
  progressText.style.marginTop = '0.4rem';
  status.append(levelLine, pointsLine, progress, progressText);

  function refreshStatus() {
    levelLine.textContent = `${user.avatar} ${user.nickname} · ${user.level}`;
    animateNumber(pointsNum, user.points, 800);
    const p = levelProgress(user.points);
    bar.style.width = `${p.percent}%`;
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-valuenow', String(p.percent));
    progressText.textContent = p.text;
  }
  refreshStatus();

  // ФОРМА 3: нік і аватар
  const profileCard = el('section', 'card');
  profileCard.style.marginTop = '1rem';
  profileCard.append(el('h2', '', 'Редагування профілю'));

  const profileForm = createForm({
    fields: [
      { name: 'nickname', label: 'Нік', type: 'text', required: true, min: 2, max: 20, hint: '2-20 символів' }
    ],
    submitText: 'Зберегти',
    onSubmit: async (values) => {
      try {
        await put('/me', { nickname: values.nickname, avatar });
        await loadMe();
        user = getUser();
        refreshStatus();
        showToast('Профіль збережено', 'success');
      } catch (err) {
        if (err.status === 400 && /нік/i.test(err.message)) {
          const e = new Error(err.message);
          e.fields = { nickname: err.message };
          throw e;
        }
        throw err;
      }
    }
  });
  profileForm.setValues({ nickname: user.nickname });

  // Вибір аватара кнопками
  const picker = el('div');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Аватар');
  picker.style.display = 'flex';
  picker.style.flexWrap = 'wrap';
  picker.style.gap = '0.4rem';
  picker.style.marginBottom = '1rem';
  const avatarButtons = AVATARS.map((emoji) => {
    const b = el('button', 'icon-btn', emoji);
    b.type = 'button';
    b.setAttribute('aria-label', `Аватар ${emoji}`);
    b.addEventListener('click', () => {
      avatar = emoji;
      mark();
    });
    picker.append(b);
    return b;
  });
  function mark() {
    avatarButtons.forEach((b) => {
      const on = b.textContent === avatar;
      b.style.borderColor = on ? 'var(--primary)' : '';
      b.style.borderWidth = on ? '2px' : '';
      b.setAttribute('aria-pressed', String(on));
    });
  }
  mark();

  profileCard.append(el('p', 'field-label', 'Аватар'), picker, profileForm.element);

  // Підформа зміни пароля
  const passCard = el('section', 'card');
  passCard.style.marginTop = '1rem';
  passCard.append(el('h2', '', 'Зміна пароля'));

  const passForm = createForm({
    fields: [
      { name: 'oldPassword', label: 'Старий пароль', type: 'password', required: true, max: 64 },
      { name: 'newPassword', label: 'Новий пароль', type: 'password', required: true, min: 6, max: 64, hint: '6-64 символи' },
      { name: 'confirm', label: 'Повтор нового пароля', type: 'password', required: true, min: 6, max: 64 }
    ],
    submitText: 'Змінити пароль',
    onSubmit: async (values) => {
      if (values.newPassword !== values.confirm) {
        const e = new Error('Паролі не збігаються');
        e.fields = { confirm: 'Паролі не збігаються' };
        throw e;
      }
      try {
        await put('/me/password', { oldPassword: values.oldPassword, newPassword: values.newPassword });
        passForm.reset();
        showToast('Пароль змінено', 'success');
      } catch (err) {
        if (err.status === 400 && /старий/i.test(err.message)) {
          const e = new Error(err.message);
          e.fields = { oldPassword: err.message };
          throw e;
        }
        throw err;
      }
    }
  });
  passCard.append(passForm.element);

  container.append(status, profileCard, passCard);

  return function cleanup() {
    alive = false;
    abortAll();
  };
}