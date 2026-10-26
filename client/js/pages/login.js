import { createForm } from '../ui/form.js';
import { showToast } from '../ui/toast.js';
import { login } from '../auth.js';
import { navigate } from '../router.js';

// Додає кнопку «показати/сховати» до поля пароля
function addPasswordToggle(formEl) {
  const input = formEl.querySelector('input[name="password"]');
  if (!input) return;
  input.autocomplete = 'current-password';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-ghost';
  toggle.style.alignSelf = 'flex-start';
  toggle.textContent = 'Показати';
  toggle.setAttribute('aria-pressed', 'false');

  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Сховати' : 'Показати';
    toggle.setAttribute('aria-pressed', String(show));
  });

  input.after(toggle);
}

export async function render(container, ctx) {
  container.innerHTML = '';

  const card = document.createElement('section');
  card.className = 'card';
  card.style.maxWidth = '420px';
  card.style.margin = '0 auto';

  const title = document.createElement('h1');
  title.textContent = 'Вхід';

  const form = createForm({
    fields: [
      { name: 'username', label: 'Логін', type: 'text', required: true, max: 20, placeholder: 'Ваш логін' },
      { name: 'password', label: 'Пароль', type: 'password', required: true, max: 64, placeholder: 'Ваш пароль' }
    ],
    submitText: 'Увійти',
    onSubmit: async (values) => {
      try {
        const user = await login(values.username, values.password);
        showToast(`Вітаємо, ${user.nickname}!`, 'success');
        navigate('/');
      } catch (err) {
        // Невірні дані показуємо під полем пароля, решту помилок тостом
        if (err.status === 401 || err.status === 400) {
          const withField = new Error(err.message);
          withField.fields = { password: err.message };
          throw withField;
        }
        throw err;
      }
    }
  });

  addPasswordToggle(form.element);

  const footer = document.createElement('p');
  footer.style.marginTop = '1rem';
  footer.append('Немає акаунта? ');
  const link = document.createElement('a');
  link.href = '#/register';
  link.textContent = 'Реєстрація';
  footer.append(link);

  card.append(title, form.element, footer);
  container.append(card);

  form.element.querySelector('input[name="username"]').focus();

  return function cleanup() {
    // Слухачі прив'язані до елементів, які видаляються разом зі сторінкою
  };
}