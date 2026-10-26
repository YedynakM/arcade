const AUTO_CLOSE_MS = 4000;
const LEAVE_MS = 250;
const TYPES = ['success', 'error', 'info'];

// Закриває тост з анімацією виходу
function closeToast(toast) {
  if (toast.dataset.closing === '1') return;
  toast.dataset.closing = '1';
  clearTimeout(Number(toast.dataset.timer));
  toast.classList.add('leaving');
  setTimeout(() => toast.remove(), LEAVE_MS);
}

// Показує тост у #toasts; type: success | error | info
export function showToast(text, type = 'info') {
  const root = document.getElementById('toasts');
  if (!root) return null;

  const kind = TYPES.includes(type) ? type : 'info';

  const toast = document.createElement('div');
  toast.className = `toast toast-${kind}`;
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

  const message = document.createElement('span');
  message.className = 'toast-text';
  message.textContent = String(text);

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрити');
  close.textContent = '×';
  close.addEventListener('click', () => closeToast(toast));

  toast.append(message, close);
  root.append(toast);

  toast.dataset.timer = String(setTimeout(() => closeToast(toast), AUTO_CLOSE_MS));
  return toast;
}