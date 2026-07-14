// modules/splash.js — Hero particle field and word-stagger animations

let _rafId = null;
let _canvas = null;
let _ctx = null;
let _particles = [];
let _mX = -999;
let _mY = -999;
let _running = false;

const _mobile  = window.innerWidth <= 768;
const _reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const COUNT    = _mobile ? 35 : 65;
const CONN_D   = 120;
const REP_D    = 150;

// ── Canvas ────────────────────────────────────────────────────────────────────
function _resize() {
  if (!_canvas) return;
  _canvas.width  = window.innerWidth;
  _canvas.height = window.innerHeight;
}

function _mkParticles() {
  const W = window.innerWidth, H = window.innerHeight;
  _particles = Array.from({ length: COUNT }, () => ({
    x:  Math.random() * W,
    y:  Math.random() * H,
    vx: (Math.random() - .5) * .34,
    vy: (Math.random() - .5) * .34,
    r:  Math.random() * 1.4 + .4,
    op: Math.random() * .21 + .07,
  }));
}

function _tick() {
  if (!_canvas || !_ctx || !_running) return;
  const W = _canvas.width, H = _canvas.height;
  _ctx.clearRect(0, 0, W, H);

  for (const p of _particles) {
    if (!_mobile) {
      const dx = p.x - _mX, dy = p.y - _mY;
      const d  = Math.hypot(dx, dy);
      if (d < REP_D && d > 0) {
        const f = ((REP_D - d) / REP_D) * .031;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
    }
    p.vx *= .99; p.vy *= .99;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > .7) { p.vx = p.vx / sp * .7; p.vy = p.vy / sp * .7; }
    p.x = (p.x + p.vx + W) % W;
    p.y = (p.y + p.vy + H) % H;
  }

  // Lines between nearby particles
  for (let i = 0; i < _particles.length; i++) {
    for (let j = i + 1; j < _particles.length; j++) {
      const d = Math.hypot(_particles[i].x - _particles[j].x, _particles[i].y - _particles[j].y);
      if (d < CONN_D) {
        _ctx.beginPath();
        _ctx.moveTo(_particles[i].x, _particles[i].y);
        _ctx.lineTo(_particles[j].x, _particles[j].y);
        _ctx.strokeStyle = `rgba(255,255,255,${(1 - d / CONN_D) * .052})`;
        _ctx.lineWidth = .5;
        _ctx.stroke();
      }
    }
  }

  // Dots
  for (const p of _particles) {
    _ctx.beginPath();
    _ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    _ctx.fillStyle = p.op > .17
      ? `rgba(165,180,252,${p.op})`
      : `rgba(255,255,255,${p.op})`;
    _ctx.fill();
  }

  _rafId = requestAnimationFrame(_tick);
}

// ── Word stagger ───────────────────────────────────────────────────────────────
function _staggerWords() {
  const words = document.querySelectorAll('.hero-word');
  words.forEach((w, i) => setTimeout(() => w.classList.add('hw-in'), 60 + i * 82));
  const done = 60 + words.length * 82;
  setTimeout(() => document.querySelector('.hero-sub')?.classList.add('hw-in'), done + 370);
  setTimeout(() => {
    document.querySelector('.hero-ctas')?.classList.add('hw-in');
    document.querySelector('.hero-microcopy')?.classList.add('hw-in');
    document.querySelector('.hero-demo-link')?.classList.add('hw-in');
  }, done + 570);
}

// ── Scroll indicator ───────────────────────────────────────────────────────────
function _scrollInd() {
  const el = document.querySelector('.hero-scroll-ind');
  if (!el) return;
  window.addEventListener('scroll', () => {
    el.style.opacity = window.scrollY > 60 ? '0' : '1';
  }, { passive: true });
  el.addEventListener('click', () => {
    document.querySelector('.splash-below')?.scrollIntoView({ behavior: 'smooth' });
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function initSplash() {
  _canvas = document.getElementById('splash-canvas');
  if (!_canvas) return;
  _ctx = _canvas.getContext('2d');
  _resize();
  window.addEventListener('resize', _resize);
  if (!_mobile) {
    window.addEventListener('mousemove', e => { _mX = e.clientX; _mY = e.clientY; });
  }
  if (!_reduced) {
    _mkParticles();
    _running = true;
    _rafId = requestAnimationFrame(_tick);
  }
  _staggerWords();
  _scrollInd();
}

export function pauseSplash() {
  _running = false;
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_canvas) _canvas.style.display = 'none';
}

export function resumeSplash() {
  if (!_canvas) { initSplash(); return; }
  _canvas.style.display = '';
  if (!_reduced && !_running) {
    _running = true;
    _rafId = requestAnimationFrame(_tick);
  }
}
