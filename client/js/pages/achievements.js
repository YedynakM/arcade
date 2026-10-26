import { get, abortAll } from '../api.js';
import { createSkeleton } from '../ui/skeleton.js';
import { animateNumber } from '../ui/counter.js';
import { showToast } from '../ui/toast.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function render(container, ctx) {
  let alive = true;

  function buildBadge(item, index) {
    const card = el('div', 'card');
    card.style.setProperty('--i', String(index));
    card.style.textAlign = 'center';
    card.style.position = 'relative';
    if (!item.unlocked) card.style.opacity = '0.5';

    const icon = el('div', '', item.icon);
    icon.style.fontSize = '2.6rem';
    if (!item.unlocked) icon.style.filter = 'grayscale(1)';

    const title = el('h3', '', item.title);
    title.style.margin = '0.3rem 0';
    const desc = el('p', 'field-hint', item.description);
    desc.style.margin = '0';

    card.append(icon, title, desc);

    if (!item.unlocked) {
      const lock = el('span', '', '🔒');
      lock.style.position = 'absolute';
      lock.style.top = '0.5rem';
      lock.style.right = '0.6rem';
      lock.setAttribute('aria-label', 'Закрито');
      card.append(lock);
    } else {
      card.classList.add('card-hover');
      card.style.borderColor = 'var(--accent)';
    }
    return card;
  }

  async function load() {
    container.innerHTML = '';
    container.append(el('h1', '', 'Досягнення'), createSkeleton('card', 8));

    try {
      const data = await get('/achievements');
      if (!alive) return;

      const items = data.items || [];
      const opened = items.filter((i) => i.unlocked).length;

      container.innerHTML = '';
      container.append(el('h1', '', 'Досягнення'));

      const counter = el('p');
      counter.style.fontSize = '1.1rem';
      counter.append('Відкрито ');
      const num = el('strong', '', '0');
      counter.append(num, ` з ${items.length}`);
      container.append(counter);
      animateNumber(num, opened, 800);

      const grid = el('div', 'card-grid stagger');
      items.forEach((item, i) => grid.append(buildBadge(item, i)));
      container.append(grid);
    } catch (err) {
      if (!alive || err.aborted) return;
      container.innerHTML = '';
      container.append(el('h1', '', 'Досягнення'));
      const box = el('div', 'card placeholder');
      box.append(el('p', '', err.message || 'Не вдалося завантажити досягнення'));
      const retry = el('button', 'btn btn-primary', 'Спробувати ще');
      retry.type = 'button';
      retry.addEventListener('click', load);
      box.append(retry);
      container.append(box);
      showToast(err.message || 'Не вдалося завантажити досягнення', 'error');
    }
  }

  await load();

  return function cleanup() {
    alive = false;
    abortAll();
  };
}