const PARTICLE_COUNT = 40;

// Ініціалізує повільні частинки на canvas; повертає функцію stop()
export function initBackground(canvas) {
  if (!canvas || !canvas.getContext) return () => {};

  const ctx = canvas.getContext('2d');
  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  let width = 0;
  let height = 0;
  let particles = [];
  let rafId = 0;
  let running = true;
  let color = '';

  // Колір частинок береться зі змінної теми
  function readColor() {
    color = getComputedStyle(document.documentElement).getPropertyValue('--bg-particle').trim() || 'rgba(128,128,255,0.35)';
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 2 + Math.random() * 5,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;
    }
  }

  function loop() {
    if (!running || document.hidden) {
      rafId = 0;
      return;
    }
    step();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (!rafId && running && !document.hidden) rafId = requestAnimationFrame(loop);
  }

  // Пауза при прихованій вкладці, відновлення при поверненні
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else {
      start();
    }
  }

  // Зміна теми оновлює колір частинок
  const observer = new MutationObserver(() => {
    readColor();
    if (reducedQuery && reducedQuery.matches) draw();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function onResize() {
    resize();
    createParticles();
    if (reducedQuery && reducedQuery.matches) draw();
  }

  readColor();
  resize();
  createParticles();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);

  if (reducedQuery && reducedQuery.matches) {
    // Без руху: один статичний кадр
    draw();
  } else {
    start();
  }

  return function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    ctx.clearRect(0, 0, width, height);
  };
}