// Вмикає або вимикає стан завантаження кнопки:
// блокує її, додає спінер і зберігає початковий текст
export function setLoading(btn, loading) {
  if (!btn) return;

  if (loading) {
    if (btn.dataset.loading === '1') return;
    btn.dataset.loading = '1';
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.textContent = btn.dataset.originalText;

    btn.textContent = '';
    btn.append(spinner, label);
  } else {
    if (btn.dataset.loading !== '1') return;
    btn.textContent = btn.dataset.originalText || '';
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    delete btn.dataset.loading;
    delete btn.dataset.originalText;
  }
}