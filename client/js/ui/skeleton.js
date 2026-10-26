const TYPES = ['card', 'row', 'text'];

// Створює контейнер із заглушками завантаження; type: card | row | text
export function createSkeleton(type = 'card', count = 3) {
  const kind = TYPES.includes(type) ? type : 'card';
  const total = Math.max(1, Math.floor(Number(count)) || 1);

  const wrap = document.createElement('div');
  wrap.className = kind === 'card' ? 'card-grid skeleton-wrap' : 'skeleton-wrap';
  wrap.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < total; i++) {
    const item = document.createElement('div');
    item.className = `skeleton skeleton-${kind}`;
    wrap.append(item);
  }

  return wrap;
}