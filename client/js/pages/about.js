import { post, abortAll } from '../api.js';
import { createForm } from '../ui/form.js';
import { showToast } from '../ui/toast.js';

const STACK = [
  'Клієнт: JavaScript ES2020+, HTML5, CSS3, ES-модулі без збірки',
  'Сервер: Node.js 18+, Express (CommonJS)',
  'Автентифікація: JWT, bcryptjs',
  'Сховище: JSON-файл з чергою атомарного запису',
  'Анімації: CSS і requestAnimationFrame'
];

const MAX_MESSAGE = 500;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function render(container, ctx) {
  container.innerHTML = '';
  container.append(el('h1', '', 'Про нас'));

  const about = el('section', 'card');
  about.append(
    el('h2', '', 'Про проєкт'),
    el('p', '', 'Аркада: локальний сайт-обгортка для міні-ігор з рейтингом, досягненнями, профілями гравців та адмінкою. Ігри додаються як окремі модулі, а підсумкові очки рахує сервер.')
  );
  const stackTitle = el('h3', '', 'Стек технологій');
  const list = el('ul');
  for (const item of STACK) list.append(el('li', '', item));
  about.append(stackTitle, list);

  // ФОРМА 4: зворотний зв'язок
  const feedback = el('section', 'card');
  feedback.style.marginTop = '1rem';
  feedback.append(el('h2', '', 'Зворотний зв\'язок'));

  const form = createForm({
    fields: [
      { name: 'name', label: 'Ім\'я', type: 'text', required: true, min: 2, max: 40 },
      { name: 'email', label: 'Email', type: 'email', required: true, max: 100, placeholder: 'name@example.com' },
      { name: 'message', label: 'Повідомлення', type: 'textarea', required: true, min: 10, max: MAX_MESSAGE, hint: '10-500 символів' }
    ],
    submitText: 'Надіслати',
    onSubmit: async (values) => {
      try {
        await post('/feedback', values);
        form.reset();
        updateCounter();
        showToast('Дякуємо! Повідомлення надіслано', 'success');
      } catch (err) {
        if (err.status === 429) {
          showToast('Забагато повідомлень. Спробуйте за хвилину', 'error');
          return;
        }
        if (err.status === 400) {
          const fields = {};
          if (/ім'я/i.test(err.message)) fields.name = err.message;
          else if (/email/i.test(err.message)) fields.email = err.message;
          else if (/повідомлення/i.test(err.message)) fields.message = err.message;
          if (Object.keys(fields).length) {
            const e = new Error(err.message);
            e.fields = fields;
            throw e;
          }
        }
        throw err;
      }
    }
  });

  // Лічильник символів повідомлення
  const textarea = form.element.querySelector('textarea[name="message"]');
  const counter = el('div', 'field-hint');
  counter.setAttribute('aria-live', 'polite');
  textarea.after(counter);
  function updateCounter() {
    counter.textContent = `${textarea.value.length} / ${MAX_MESSAGE}`;
  }
  textarea.addEventListener('input', updateCounter);
  form.element.addEventListener('reset', () => setTimeout(updateCounter, 0));
  updateCounter();

  feedback.append(form.element);
  container.append(about, feedback);

  return function cleanup() {
    abortAll();
  };
}