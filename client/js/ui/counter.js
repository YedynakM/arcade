const rafIds = new WeakMap();

// Плавна зміна числа в елементі від поточного значення до `to` за `ms` мілісекунд
export function animateNumber(el, to, ms = 800) {
  if (!el) return;

  // Скасовуємо попередню анімацію цього елемента
  const prev = rafIds.get(el);
  if (prev) cancelAnimationFrame(prev);

  const target = Math.round(Number(to) || 0);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || ms <= 0) {
    el.textContent = target.toLocaleString('uk-UA');
    return;
  }

  const from = parseInt(String(el.textContent).replace(/\D/g, ''), 10) || 0;
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / ms);
    // easeOutCubic
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(from + (target - from) * eased);
    el.textContent = value.toLocaleString('uk-UA');

    if (t < 1) {
      rafIds.set(el, requestAnimationFrame(frame));
    } else {
      rafIds.delete(el);
    }
  }

  rafIds.set(el, requestAnimationFrame(frame));
}