import { get, put, patch } from '../api.js';
import { GAMES } from '../games/registry.js';
import { createForm } from '../ui/form.js';
import { createSkeleton } from '../ui/skeleton.js';
import { openModal } from '../ui/modal.js';
import { animateNumber } from '../ui/counter.js';
import { showToast } from '../ui/toast.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Завантаження з skeleton і помилкою «Спробувати ще»
async function withLoad(body, isAlive, fetcher, build) {
  body.innerHTML = '';
  body.append(createSkeleton('row', 5));
  try {
    const data = await fetcher();
    if (!isAlive()) return;
    body.innerHTML = '';
    build(data);
  } catch (err) {
    if (!isAlive() || err.aborted) return;
    body.innerHTML = '';
    const box = el('div', 'card placeholder');
    box.append(el('p', '', err.message || 'Не вдалося завантажити дані'));
    const retry = el('button', 'btn btn-primary', 'Спробувати ще');
    retry.type = 'button';
    retry.addEventListener('click', () => withLoad(body, isAlive, fetcher, build));
    box.append(retry);
    body.append(box);
    showToast(err.message || 'Не вдалося завантажити дані', 'error');
  }
}

// Вкладка «Налаштування» (ФОРМА 5)
export async function renderSettings(body) {
  let alive = true;

  await withLoad(body, () => alive, () => get('/admin/settings'), (data) => {
    const form = createForm({
      fields: GAMES.map((g) => ({
        name: g.id, label: `${g.icon} ${g.title}: множник очок`, type: 'number',
        required: true, min: 0, max: 10, hint: 'Ціле число від 0 до 10'
      })),
      submitText: 'Зберегти',
      onSubmit: save
    });

    // Чекбокси увімкнення ігор
    const fieldset = el('fieldset', 'field');
    fieldset.append(el('legend', 'field-label', 'Увімкнені ігри'));
    const checks = {};
    for (const g of GAMES) {
      const label = el('label');
      label.style.display = 'block';
      const box = el('input');
      box.type = 'checkbox';
      box.addEventListener('change', clearManual);
      checks[g.id] = box;
      label.append(box, ` ${g.icon} ${g.title}`);
      fieldset.append(label);
    }
    const enabledErr = el('div', 'field-error');
    enabledErr.setAttribute('role', 'alert');
    fieldset.append(enabledErr);

    // Вибір гри дня
    const dailyWrap = el('div', 'field');
    const dailyLabel = el('label', 'field-label', 'Гра дня');
    dailyLabel.htmlFor = 'adminDaily';
    const daily = el('select');
    daily.id = 'adminDaily';
    daily.addEventListener('change', clearManual);
    for (const g of GAMES) {
      const opt = el('option', '', `${g.icon} ${g.title}`);
      opt.value = g.id;
      daily.append(opt);
    }
    const dailyErr = el('div', 'field-error');
    dailyErr.setAttribute('role', 'alert');
    dailyWrap.append(dailyLabel, daily, dailyErr);

    form.element.querySelector('button[type="submit"]').before(fieldset, dailyWrap);

    function clearManual() {
      enabledErr.textContent = '';
      dailyErr.textContent = '';
    }

    function apply(s) {
      form.setValues(s.multipliers);
      for (const g of GAMES) checks[g.id].checked = s.enabledGames.includes(g.id);
      if (s.dailyGame && s.dailyGame.gameId) daily.value = s.dailyGame.gameId;
    }

    async function save(values) {
      clearManual();
      const multipliers = {};
      const fieldErrors = {};
      for (const g of GAMES) {
        const n = Number(values[g.id]);
        if (!Number.isInteger(n) || n < 0 || n > 10) fieldErrors[g.id] = 'Ціле число від 0 до 10';
        multipliers[g.id] = n;
      }
      const enabledGames = GAMES.filter((g) => checks[g.id].checked).map((g) => g.id);
      let bad = Object.keys(fieldErrors).length > 0;
      if (!enabledGames.length) { enabledErr.textContent = 'Увімкніть принаймні одну гру'; bad = true; }
      if (!enabledGames.includes(daily.value)) { dailyErr.textContent = 'Гра дня має бути увімкненою'; bad = true; }
      if (bad) { form.setErrors(fieldErrors); return; }

      try {
        const saved = await put('/admin/settings', { multipliers, enabledGames, dailyGame: { gameId: daily.value } });
        apply(saved);
        showToast('Налаштування збережено', 'success');
      } catch (err) {
        if (err.status === 400) {
          const game = GAMES.find((g) => err.message.includes(`«${g.id}»`));
          if (game) {
            const e = new Error(err.message);
            e.fields = { [game.id]: err.message };
            throw e;
          }
          if (/гр/i.test(err.message)) { enabledErr.textContent = err.message; return; }
        }
        throw err;
      }
    }

    apply(data);
    const card = el('section', 'card');
    card.append(el('h2', '', 'Налаштування ігор'), form.element);
    body.append(card);
  });

  return () => { alive = false; };
}

// Вкладка «Користувачі»
export async function renderUsers(body) {
  let alive = true;

  await withLoad(body, () => alive, () => get('/admin/users'), (data) => {
    const wrap = el('div', 'table-wrap');
    const table = el('table');
    const head = el('tr');
    for (const h of ['Нік', 'Логін', 'Рівень', 'Очки', 'Статус', 'Дії']) head.append(el('th', '', h));
    const thead = el('thead');
    thead.append(head);
    const tbody = el('tbody');
    table.append(thead, tbody);
    wrap.append(table);
    body.append(wrap);

    async function confirmAndPatch(user, text, payload, okText) {
      const answer = await openModal({
        title: 'Підтвердження',
        content: text,
        actions: [
          { label: 'Скасувати', value: false, variant: 'ghost' },
          { label: 'Підтвердити', value: true, variant: 'danger' }
        ]
      });
      if (!answer || !alive) return;
      try {
        const res = await patch(`/admin/users/${encodeURIComponent(user.id)}`, payload);
        if (!alive) return;
        Object.assign(user, res.user);
        showToast(okText, 'success');
        draw();
      } catch (err) {
        if (err.aborted) return;
        showToast(err.message || 'Не вдалося виконати дію', 'error');
      }
    }

    function draw() {
      tbody.innerHTML = '';
      for (const u of data.users) {
        const tr = el('tr');
        const status = el('span', u.blocked ? 'badge badge-danger' : 'badge badge-success', u.blocked ? 'Заблоковано' : 'Активний');
        const statusCell = el('td');
        statusCell.append(status);

        const actions = el('td');
        actions.style.display = 'flex';
        actions.style.gap = '0.4rem';
        const block = el('button', 'btn', u.blocked ? 'Розблокувати' : 'Заблокувати');
        block.type = 'button';
        block.disabled = u.role === 'admin';
        if (block.disabled) block.title = 'Адміністратора не можна заблокувати';
        block.addEventListener('click', () => confirmAndPatch(
          u,
          `${u.blocked ? 'Розблокувати' : 'Заблокувати'} користувача «${u.username}»?`,
          { blocked: !u.blocked },
          u.blocked ? 'Користувача розблоковано' : 'Користувача заблоковано'
        ));
        const reset = el('button', 'btn', 'Скинути очки');
        reset.type = 'button';
        reset.addEventListener('click', () => confirmAndPatch(
          u, `Скинути очки користувача «${u.username}» до нуля?`, { resetPoints: true }, 'Очки скинуто'
        ));
        actions.append(block, reset);

        tr.append(
          el('td', '', `${u.avatar} ${u.nickname}`), el('td', '', u.username),
          el('td', '', u.level), el('td', '', String(u.points)), statusCell, actions
        );
        tbody.append(tr);
      }
    }
    draw();
  });

  return () => { alive = false; };
}

// Вкладка «Статистика» з polling кожні 5 с
export async function renderStats(body) {
  let alive = true;
  let timer = 0;

  await withLoad(body, () => alive, () => get('/admin/stats'), (data) => {
    const cards = el('div', 'card-grid');
    const values = {};
    for (const [key, label] of [['activePlayers24h', 'Активні гравці за 24 год'], ['totalPoints', 'Всього очок'], ['totalGames', 'Всього партій']]) {
      const card = el('div', 'card');
      card.style.textAlign = 'center';
      const num = el('div', '', '0');
      num.style.fontSize = '2.2rem';
      num.style.fontWeight = '800';
      values[key] = num;
      card.append(num, el('div', 'field-hint', label));
      cards.append(card);
    }

    // Діаграма на CSS: стовпчики партій по іграх
    const chart = el('section', 'card');
    chart.style.marginTop = '1rem';
    chart.append(el('h2', '', 'Партії по іграх'));
    const row = el('div');
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    const bars = {};
    for (const g of GAMES) {
      const col = el('div');
      col.style.flex = '1';
      col.style.textAlign = 'center';
      col.style.minWidth = '0';
      const count = el('div', '', '0');
      const track = el('div');
      track.style.height = '150px';
      track.style.display = 'flex';
      track.style.alignItems = 'flex-end';
      const bar = el('div', 'progress-bar');
      bar.style.width = '100%';
      bar.style.height = '0';
      bar.style.transition = 'height 0.5s ease';
      bar.style.borderRadius = '6px 6px 0 0';
      track.append(bar);
      const name = el('div', '', g.icon);
      name.title = g.title;
      name.style.fontSize = '1.4rem';
      bars[g.id] = { count, bar };
      col.append(count, track, name);
      row.append(col);
    }
    chart.append(row);
    body.append(cards, chart);

    function update(s) {
      for (const key of Object.keys(values)) animateNumber(values[key], s[key], 600);
      const max = Math.max(1, ...GAMES.map((g) => s.gamesByGame[g.id] || 0));
      for (const g of GAMES) {
        const n = s.gamesByGame[g.id] || 0;
        animateNumber(bars[g.id].count, n, 600);
        bars[g.id].bar.style.height = `${Math.round((n / max) * 100)}%`;
      }
    }
    update(data);

    // Polling без накладання запитів
    let busy = false;
    let notified = false;
    timer = setInterval(async () => {
      if (busy || !alive) return;
      busy = true;
      try {
        const fresh = await get('/admin/stats');
        if (alive) update(fresh);
        notified = false;
      } catch (err) {
        if (alive && !err.aborted && !notified) {
          notified = true;
          showToast(err.message || 'Не вдалося оновити статистику', 'error');
        }
      } finally {
        busy = false;
      }
    }, 5000);
  });

  return () => {
    alive = false;
    clearInterval(timer);
  };
}

// Вкладка «Повідомлення»
export async function renderFeedback(body) {
  let alive = true;

  await withLoad(body, () => alive, () => get('/admin/feedback'), (data) => {
    if (!data.items.length) {
      body.append(el('p', 'card placeholder', 'Повідомлень поки немає.'));
      return;
    }
    const list = el('div', 'stagger');
    list.style.display = 'grid';
    list.style.gap = '0.75rem';
    data.items.forEach((item, i) => {
      const card = el('article', 'card');
      card.style.setProperty('--i', String(Math.min(i, 10)));
      const head = el('div');
      head.append(el('strong', '', item.name), ` · ${item.email} · `);
      head.append(el('span', 'field-hint', new Date(item.createdAt).toLocaleString('uk-UA')));
      const text = el('p', '', item.message);
      text.style.margin = '0.5rem 0 0';
      text.style.whiteSpace = 'pre-wrap';
      card.append(head, text);
      list.append(card);
    });
    body.append(list);
  });

  return () => { alive = false; };
}