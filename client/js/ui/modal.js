const LEAVE_MS = 200;
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

let opened = false;

// Відкриває модальне вікно; Promise повертає value натиснутої дії (null при закритті Esc/фоном)
// actions: [{label, value, variant}], variant: primary | ghost | danger
// content: рядок або DOM-вузол
export function openModal({ title = '', content = '', actions = [] } = {}) {
  const root = document.getElementById('modal');
  if (!root) return Promise.resolve(null);

  // Лише одне модальне вікно одночасно
  if (opened) return Promise.resolve(null);
  opened = true;

  return new Promise((resolve) => {
    const previousFocus = document.activeElement;

    root.className = 'modal-root';
    root.innerHTML = '';

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;

    const heading = document.createElement('h2');
    heading.className = 'modal-title';
    heading.id = 'modalTitle';
    heading.textContent = title;
    dialog.setAttribute('aria-labelledby', 'modalTitle');

    const body = document.createElement('div');
    body.className = 'modal-body';
    if (content instanceof Node) body.append(content);
    else body.textContent = String(content);

    const footer = document.createElement('div');
    footer.className = 'modal-actions';

    const finish = (value) => {
      document.removeEventListener('keydown', onKeydown, true);
      root.classList.add('closing');
      setTimeout(() => {
        root.hidden = true;
        root.innerHTML = '';
        root.className = 'modal-root';
        opened = false;
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
        resolve(value);
      }, LEAVE_MS);
    };

    for (const action of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const variant = action.variant ? ` btn-${action.variant}` : '';
      btn.className = `btn${variant}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => finish(action.value === undefined ? null : action.value));
      footer.append(btn);
    }

    // Esc закриває, Tab утримується всередині вікна
    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    // Клік на фон закриває вікно
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) finish(null);
    });

    dialog.append(heading, body, footer);
    backdrop.append(dialog);
    root.append(backdrop);
    root.hidden = false;
    document.addEventListener('keydown', onKeydown, true);

    const firstFocusable = dialog.querySelector(FOCUSABLE);
    (firstFocusable || dialog).focus();
  });
}