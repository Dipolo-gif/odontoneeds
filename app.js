/* ═══════════════════════════════════════════════════════════
   ODONTONEEDS — Motor de cena
   1. Preloader            5. FLIP (painéis + modal)
   2. Campo de partículas  6. Roteamento por hash
   3. Cursor magnético     7. Acessibilidade
   4. Paralaxe do hero     8. Formulário
   ═══════════════════════════════════════════════════════════ */

(() => {
'use strict';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE    = matchMedia('(pointer: fine)').matches;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ── ESTADO GLOBAL ────────────────────────────────── */

const scene = {
  layer: 'loading',      // loading | hero | hub | panel | modal
  active: null,          // slug do painel aberto
  member: null,          // índice do membro no modal
  formation: 'orbit',
  busy: false,           // trava cliques durante transição
};

const PANELS = ['implantes','estetica','ortodontia','clinica','equipe','contato'];
const LABELS = {
  implantes:'Implantes', estetica:'Estética', ortodontia:'Ortodontia',
  clinica:'A Clínica', equipe:'Equipe', contato:'Contato',
};
const FORMATION_OF = {
  implantes:'arch', estetica:'bloom', ortodontia:'lattice',
  clinica:'halls', equipe:'constellation', contato:'orbit',
};

const TEAM = [
  { name:'Dra. Helena Marques', role:'Implantodontia · CRO-RN 48.221', art:7,
    bio:'Vinte e dois anos em implantodontia, mestrado em Reabilitação Oral pela USP. Conduz os casos de arcada completa e coordena o planejamento digital da clínica.',
    quote:'Cada caso começa com uma tomografia e termina com uma decisão que eu tomaria para mim mesma.' },
  { name:'Dr. Rafael Bittencourt', role:'Prótese & Estética · CRO-RN 62.904', art:8,
    bio:'Especialista em prótese dentária com formação complementar em fotografia odontológica. Responsável pelo ensaio restaurador e pela integração com o laboratório interno.',
    quote:'Prometo o resultado que a fotografia aguenta. O resto é venda.' },
  { name:'Dra. Camila Reis', role:'Ortodontia · CRO-RN 71.550', art:9,
    bio:'Ortodontista com certificação em alinhadores transparentes e mais de novecentos casos finalizados. Defende contenção definitiva como parte do plano, não como acessório.',
    quote:'Alinhar é a parte fácil. Manter alinhado é o tratamento.' },
  { name:'Dr. Anselmo Prado', role:'Cirurgia Bucomaxilofacial · CRO-RN 39.118', art:10,
    bio:'Cirurgião bucomaxilofacial, atua nos enxertos ósseos e nas reabilitações de casos com perda severa. Vinte e nove anos de sala cirúrgica.',
    quote:'Osso não se apressa. Ele se planeja.' },
  { name:'Dra. Lívia Nakamura', role:'Endodontia · CRO-RN 84.307', art:11,
    bio:'Endodontista com microscopia operatória. Retratamentos complexos e casos que outras clínicas indicaram para extração. Nem sempre o dente precisa sair.',
    quote:'Antes de trocar o dente por um implante, vale conferir se ele ainda tem chance.' },
  { name:'Dr. Tomás Vieira', role:'Periodontia · CRO-RN 55.762', art:12,
    bio:'Periodontista responsável pela saúde do tecido de suporte. Nenhum caso estético ou protético avança na clínica sem a liberação periodontal dele.',
    quote:'Sorriso bonito sobre gengiva doente é maquiagem com prazo de validade.' },
];

/* ═══ 1. PRELOADER ═══════════════════════════════════ */

const preloader = $('#preloader');
const countEl   = $('#count');
const barEl     = $('#bar');

let preloadDone = false;

function runPreloader() {
  if (REDUCED) { finishPreload(0); return; }
  // rede de segurança: rAF congela em aba de fundo — o site não pode ficar preso
  setTimeout(() => { if (!preloadDone) finishPreload(0); }, 3400);
  let p = 0;
  const tick = () => {
    if (preloadDone) return;
    // aceleração desigual — progresso linear parece falso
    p += (100 - p) * (0.035 + Math.random() * 0.05);
    if (p > 99.4) p = 100;
    countEl.textContent = String(Math.floor(p)).padStart(2, '0');
    barEl.style.width = p + '%';
    if (p < 100) requestAnimationFrame(tick);
    else finishPreload(420);
  };
  requestAnimationFrame(tick);
}

function finishPreload(delay) {
  if (preloadDone) return;
  preloadDone = true;
  countEl.textContent = '100';
  barEl.style.width = '100%';
  barEl.parentElement.classList.add('is-break');
  setTimeout(() => {
    preloader.classList.add('is-out');
    setLayer('hero');
    setFormation('orbit');
    setTimeout(() => preloader.remove(), 1000);
    // deep-link só depois do hero existir — senão o preloader sobrescreve o estado
    if (location.hash && location.hash !== '#/') {
      setTimeout(() => resolve(location.hash, { push: false }), REDUCED ? 0 : 520);
    }
  }, delay);
}

/* ═══ 2. CAMPO DE PARTÍCULAS ═════════════════════════ */

const canvas = $('#field');
const ctx = canvas.getContext('2d', { alpha: true });

let W = 0, H = 0, DPR = 1;
let particles = [];
let mouse = { x: -9999, y: -9999 };
let fieldRunning = !REDUCED;

/* tier de performance — nunca assuma que a máquina aguenta.
   Contagens reduzidas ~55% em relação à primeira versão: o custo por
   partícula caiu (fillRect no lugar de arc), mas menos partículas em
   tela é o que realmente devolve frames em máquina fraca. */
function particleCount() {
  const cores = navigator.hardwareConcurrency || 4;
  const area  = innerWidth * innerHeight;
  if (innerWidth < 760) return 190;
  if (cores <= 4)       return 380;
  return area > 2.4e6 ? 780 : 560;
}

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildFormation(scene.formation);
}

/* 3 baldes de cor com alfa fixo. Trocar fillStyle/globalAlpha por partícula
   custa mais que desenhar a partícula; agrupando, são 3 trocas por frame. */
const BUCKETS = [
  { color: 'rgba(27,127,196,0.30)' },   // azul
  { color: 'rgba(14,42,66,0.14)' },     // tinta
  { color: 'rgba(47,169,138,0.26)' },   // menta
];

function initParticles() {
  const n = particleCount();
  particles = Array.from({ length: n }, () => {
    const r = Math.random();
    return {
      x: Math.random() * W, y: Math.random() * H,
      tx: 0, ty: 0,
      vx: 0, vy: 0,
      ease: 0.014 + Math.random() * 0.03,
      size: Math.random() < 0.08 ? 2.4 : 1.4,
      bucket: r < 0.45 ? 0 : r < 0.86 ? 1 : 2,
      phase: Math.random() * Math.PI * 2,
      drift: 0.25 + Math.random() * 0.7,
    };
  });
  // ordenar por balde deixa o desenho sequencial, sem reordenar a cada frame
  particles.sort((a, b) => a.bucket - b.bucket);
}

/* ── Formações: cada seção tem sua geometria ──────── */

const FORMATIONS = {
  // anel orbital difuso — estado de repouso
  orbit(i, n) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const r = Math.min(W, H) * (0.26 + Math.random() * 0.20);
    return [W * 0.5 + Math.cos(a) * r * 1.5, H * 0.5 + Math.sin(a) * r * 0.82];
  },
  // arco dentário — implantes
  arch(i, n) {
    const t = i / n;
    const row = i % 2;
    const spread = Math.min(W, H) * (row ? 0.30 : 0.40);
    const a = -Math.PI * 0.12 + t * Math.PI * 1.24;
    const jitter = (Math.random() - 0.5) * 22;
    return [
      W * 0.5 + Math.cos(a) * spread * 1.35 + jitter,
      H * 0.54 + Math.sin(a) * spread * 0.72 + jitter * 0.5,
    ];
  },
  // dispersão em névoa dourada — estética
  bloom(i, n) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.55) * Math.min(W, H) * 0.62;
    return [W * 0.5 + Math.cos(a) * r * 1.4, H * 0.5 + Math.sin(a) * r];
  },
  // grade vertical de alinhamento — ortodontia
  lattice(i, n) {
    const cols = 26;
    const c = i % cols, r = Math.floor(i / cols);
    const gx = (c / (cols - 1)) * W * 0.9 + W * 0.05;
    const gy = ((r * 37) % (H * 0.86)) + H * 0.07;
    return [gx + (Math.random() - 0.5) * 12, gy + (Math.random() - 0.5) * 12];
  },
  // linhas arquitetônicas horizontais — a clínica
  halls(i, n) {
    const bands = 7;
    const b = i % bands;
    const y = H * (0.16 + (b / (bands - 1)) * 0.68);
    return [Math.random() * W, y + (Math.random() - 0.5) * 26];
  },
  // constelação de seis núcleos — equipe
  constellation(i, n) {
    const nodes = 6, k = i % nodes;
    const cx = W * (0.14 + (k % 3) * 0.36);
    const cy = H * (k < 3 ? 0.34 : 0.68);
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.7) * Math.min(W, H) * 0.13;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  },
};

function buildFormation(name) {
  const fn = FORMATIONS[name] || FORMATIONS.orbit;
  const n = particles.length;
  particles.forEach((p, i) => { const [x, y] = fn(i, n); p.tx = x; p.ty = y; });
}

function setFormation(name) {
  if (scene.formation === name) return;
  scene.formation = name;
  if (particles.length) buildFormation(name);
}

let t = 0;
function render() {
  if (!fieldRunning) return;

  // painel/modal cobrem a tela inteira: desenhar por baixo é trabalho jogado fora
  if (scene.layer === 'panel' || scene.layer === 'modal') {
    ctx.clearRect(0, 0, W, H);
    requestAnimationFrame(render);
    return;
  }

  t += 0.006;
  ctx.clearRect(0, 0, W, H);

  const mx = mouse.x, my = mouse.y;
  let bucket = -1;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    if (p.bucket !== bucket) { bucket = p.bucket; ctx.fillStyle = BUCKETS[bucket].color; }

    // deriva orgânica — sem isso a formação parece congelada
    const nx = Math.cos(t * p.drift + p.phase) * 9;
    const ny = Math.sin(t * p.drift * 1.3 + p.phase) * 9;

    let ax = (p.tx + nx - p.x) * p.ease;
    let ay = (p.ty + ny - p.y) * p.ease;

    // repulsão pelo cursor (sem sqrt no caminho quente)
    const dx = p.x - mx, dy = p.y - my;
    const d2 = dx * dx + dy * dy;
    if (d2 < 22000 && d2 > 0.01) {
      const inv = 4.2 * (1 - d2 / 22000) * 0.9 / Math.sqrt(d2);
      ax += dx * inv;
      ay += dy * inv;
    }

    p.vx = (p.vx + ax) * 0.86;
    p.vy = (p.vy + ay) * 0.86;
    p.x += p.vx; p.y += p.vy;

    // fillRect em vez de arc(): sem path, sem tesselação de curva
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  requestAnimationFrame(render);
}

if (!REDUCED) {
  resize();
  initParticles();
  buildFormation('orbit');
  requestAnimationFrame(render);
  // resize dispara em rajada durante o arraste — realocar o array a cada
  // evento trava a janela; aqui só o último evento conta
  let rzT = 0;
  addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => { resize(); initParticles(); buildFormation(scene.formation); }, 140);
  }, { passive: true });
  // pausa quando a aba não está visível — bateria não é detalhe
  document.addEventListener('visibilitychange', () => {
    fieldRunning = !document.hidden;
    if (fieldRunning) requestAnimationFrame(render);
  });
}

/* ═══ 3. CURSOR MAGNÉTICO ════════════════════════════ */

const cursorEl = $('#cursor');
const cursorLabel = $('.cursor__label', cursorEl);

if (FINE && !REDUCED) {
  /* Sem interpolação. A versão anterior usava lerp 0.17 num loop de rAF:
     a ~60fps isso são uns 100ms para o ponto alcançar o mouse, e a mão
     percebe isso como travamento. Aqui o ponto é escrito direto no evento
     e só o tamanho/forma continua com transição. */
  let pending = false, mx = 0, my = 0;

  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    mouse.x = mx; mouse.y = my;
    if (pending) return;
    pending = true;
    // uma escrita de transform por frame, no máximo — evita layout em rajada
    requestAnimationFrame(() => {
      cursorEl.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      pending = false;
    });
  }, { passive: true });

  addEventListener('mouseleave', () => {
    cursorEl.classList.add('is-hidden');
    mouse.x = mouse.y = -9999;
  });
  addEventListener('mouseenter', () => cursorEl.classList.remove('is-hidden'));

  // morfologia por contexto — delegação única, sem listener por elemento
  document.addEventListener('mouseover', e => {
    const media = e.target.closest('.tile, .member');
    const link  = e.target.closest('button, a, input, select, textarea');
    cursorEl.classList.toggle('is-media', !!media);
    cursorEl.classList.toggle('is-link', !!link && !media);
    cursorLabel.textContent = media ? 'Abrir' : '';
  }, { passive: true });
}

/* ═══ 4. PARALAXE DO HERO ════════════════════════════ */

if (FINE && !REDUCED) {
  const layers = $$('[data-depth]');
  const px = { x: 0, y: 0, tx: 0, ty: 0 };

  addEventListener('mousemove', e => {
    px.tx = (e.clientX - innerWidth / 2);
    px.ty = (e.clientY - innerHeight / 2);
  }, { passive: true });

  (function loop() {
    px.x += (px.tx - px.x) * 0.12;
    px.y += (px.ty - px.y) * 0.12;
    // abaixo de 900px a margem lateral é pequena demais: o deslocamento
    // jogava título e filete para fora do enquadramento
    if (scene.layer === 'hero' && innerWidth >= 900) {
      for (const el of layers) {
        const d = parseFloat(el.dataset.depth);
        const ox = clamp(-px.x * d, -18, 18);
        const oy = clamp(-px.y * d, -14, 14);
        el.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
      }
    }
    requestAnimationFrame(loop);
  })();
}

/* ═══ 5. MOTOR FLIP ══════════════════════════════════ */

const EASE_IN  = 'cubic-bezier(.87,0,.13,1)';
const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';

/* Espera a animação, mas nunca para sempre.

   `anim.finished` depende da linha do tempo do documento. Quando o navegador
   congela essa linha (aba em segundo plano, webview que não compõe frames),
   a promessa nunca resolve, `scene.busy` fica preso em true e o site inteiro
   deixa de navegar. Aqui a promessa corre contra um relógio: no estouro,
   `finish()` salta a animação para o estado final e a máquina segue. */
function settle(anim, duration) {
  if (REDUCED) { try { anim.finish(); } catch {} return Promise.resolve(); }

  return new Promise(resolve => {
    let done = false;
    const end = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };

    const timer = setTimeout(() => {
      try { anim.finish(); } catch {}
      end();
    }, duration + 120);

    anim.finished.then(end, end);
  });
}

/** Expande `el` a partir do retângulo de `origin` usando só transform. */
function flipOpen(el, origin, { duration = 480 } = {}) {
  el.classList.add('is-open');
  const target = el.getBoundingClientRect();
  const from = origin ? origin.getBoundingClientRect() : {
    left: innerWidth / 2 - 40, top: innerHeight / 2 - 40, width: 80, height: 80,
  };

  const sx = from.width  / target.width;
  const sy = from.height / target.height;
  const dx = (from.left + from.width / 2)  - (target.left + target.width / 2);
  const dy = (from.top  + from.height / 2) - (target.top  + target.height / 2);

  const anim = el.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.25, borderRadius: '24px' },
    { transform: 'none', opacity: 1, borderRadius: '0px' },
  ], { duration: REDUCED ? 1 : duration, easing: EASE_IN, fill: 'both' });

  // conteúdo entra depois do quadro — evita ver o texto esmagado
  setTimeout(() => el.classList.add('is-revealed'), REDUCED ? 0 : duration * 0.4);
  return settle(anim, duration);
}

/** Recolhe para o retângulo de origem. Sempre mais rápido que a entrada. */
function flipClose(el, origin, { duration = 300 } = {}) {
  el.classList.remove('is-revealed');
  const target = el.getBoundingClientRect();
  const to = origin ? origin.getBoundingClientRect() : {
    left: innerWidth / 2 - 40, top: innerHeight / 2 - 40, width: 80, height: 80,
  };

  const sx = to.width  / target.width;
  const sy = to.height / target.height;
  const dx = (to.left + to.width / 2)  - (target.left + target.width / 2);
  const dy = (to.top  + to.height / 2) - (target.top  + target.height / 2);

  const anim = el.animate([
    { transform: 'none', opacity: 1, borderRadius: '0px' },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0, borderRadius: '24px' },
  ], { duration: REDUCED ? 1 : duration, easing: EASE_IN, fill: 'both' });

  return settle(anim, duration).then(() => {
    el.classList.remove('is-open');
    el.getAnimations().forEach(a => a.cancel());
  });
}

/* ═══ 6. NAVEGAÇÃO ═══════════════════════════════════ */

const body      = document.body;
const crumb     = $('#crumb');
const closeBtn  = $('#closeBtn');
const announcer = $('#announcer');
const sibling   = $('#sibling');
const sibPrev   = $('#sibPrev'), sibNext = $('#sibNext'), sibCta = $('#sibCta');

let originEl = null;   // elemento que originou o painel aberto

/* Fila de navegação.
   Sem isso, qualquer clique (ou o botão voltar do navegador) disparado
   durante uma transição em curso era simplesmente descartado — o usuário
   ficava numa tela que não corresponde à URL. Guardamos a última intenção
   e executamos assim que a transição atual termina. */
let pending = null;       // função a executar quando a transição atual acabar
let pendingSlug;          // destino que ela representa (undefined = fila vazia)

function enqueue(fn, slug) {
  if (!scene.busy) return false;
  pending = fn;
  pendingSlug = slug;
  return true;
}
function flush() {
  const next = pending;
  pending = null;
  pendingSlug = undefined;
  if (next) next();
}

/* Onde o usuário vai parar se nada mais for clicado.
   Com a fila cheia é o destino enfileirado; vazia, é o que está aberto. */
function destino() {
  return pending ? pendingSlug : scene.active;
}

const backLabel = $('#backLabel');
const navBtns   = $$('#mainnav button');

function setLayer(layer) {
  scene.layer = layer;
  body.dataset.layer = layer;
  closeBtn.classList.toggle('is-on', layer !== 'hero' && layer !== 'loading');
  // o botão diz para onde leva, não apenas que existe
  backLabel.textContent =
    layer === 'modal' ? 'Voltar à equipe' :
    layer === 'panel' ? 'Voltar' : 'Início';
}

function setCrumb(text) {
  crumb.textContent = text ? '/ ' + text : '';
  crumb.classList.toggle('is-on', !!text);
}

/* menu principal reflete onde o usuário está */
function markNav(slug) {
  for (const b of navBtns) {
    if (b.dataset.nav === slug) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  }
}

function announce(msg) { announcer.textContent = msg; }

/* — focus trap — */
let trapHandler = null;
function trapFocus(container) {
  releaseFocus();
  const sel = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  trapHandler = e => {
    if (e.key !== 'Tab') return;
    const items = $$(sel, container).filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', trapHandler);
}
function releaseFocus() {
  if (trapHandler) document.removeEventListener('keydown', trapHandler);
  trapHandler = null;
}

/* — Hub — */
async function goHub({ push = true } = {}) {
  if (enqueue(() => goHub({ push }), null)) return;
  scene.busy = true;

  try {
    if (push) route('#/hub');
    // estado do chrome muda já; o painel fecha por cima de um hub que
    // o usuário já está vendo — a sobreposição é o que dá sensação de rapidez
    releaseFocus();
    setLayer('hub');
    setCrumb('tratamentos');
    markNav(null);
    setFormation('orbit');
    announce('Menu de seções');

    if (scene.active) {
      const panel = $(`#p-${scene.active}`);
      panel.setAttribute('aria-hidden', 'true');
      await flipClose(panel, originEl);
      scene.active = null;
    }
    originEl = null;
  } finally {
    scene.busy = false;
    flush();
  }
}

/* — Hero — */
async function goHero({ push = true } = {}) {
  if (enqueue(() => goHero({ push }), null)) return;
  if (scene.active) { await goHub({ push: false }); }
  setLayer('hero');
  setCrumb('');
  markNav(null);
  setFormation('orbit');
  if (push) route('#/');
}

/* — Painel — */
async function goPanel(slug, origin, { push = true, forced = false } = {}) {
  if (!PANELS.includes(slug)) return;
  // Dedupe contra o destino, não contra o painel aberto: numa rajada de
  // cliques `scene.active` ainda é o de duas transições atrás. `forced`
  // marca a reentrada vinda da fila, que não pode ser barrada por si mesma.
  if (!forced && destino() === slug) return;
  if (enqueue(() => goPanel(slug, origin, { push, forced: true }), slug)) return;
  scene.busy = true;

  try {
    // troca entre painéis irmãos: fecha o atual sem voltar ao hub.
    // Ritmo encurtado — atravessar seções precisa parecer instantâneo.
    const isSibling = !!scene.active;
    if (isSibling) {
      const old = $(`#p-${scene.active}`);
      old.setAttribute('aria-hidden', 'true');
      await flipClose(old, originEl, { duration: 220 });
    }

    originEl = origin || $(`.tile[data-nav="${slug}"]`);
    const panel = $(`#p-${slug}`);
    scene.active = slug;
    setLayer('panel');
    setCrumb(LABELS[slug].toLowerCase());
    markNav(slug);
    setFormation(FORMATION_OF[slug]);
    updateSibling(slug);
    panel.setAttribute('aria-hidden', 'false');
    // URL antes da animação: durante a transição a barra de endereço já
    // corresponde ao que o usuário pediu, e o botão voltar fica coerente
    if (push) route('#/' + slug);

    await flipOpen(panel, originEl, { duration: isSibling ? 300 : 480 });
    trapFocus(panel);
    announce(LABELS[slug] + ', painel aberto');
  } finally {
    scene.busy = false;
    flush();
  }
}

function updateSibling(slug) {
  const panel = $(`#p-${slug}`);
  const prev = panel.dataset.prev, next = panel.dataset.next;
  sibPrev.querySelector('b').textContent = LABELS[prev];
  sibNext.querySelector('b').textContent = LABELS[next];
  sibPrev.onclick = () => goPanel(prev);
  sibNext.onclick = () => goPanel(next);
  sibling.setAttribute('aria-hidden', 'false');
}
sibCta.onclick = () => goPanel('contato');

/* — Modal equipe — */
const modal = $('#modal');
const mArt = $('#modalArt'), mIdx = $('#modalIdx'), mName = $('#modalName');
const mRole = $('#modalRole'), mBio = $('#modalBio'), mQuote = $('#modalQuote');
let modalOrigin = null;

function fillModal(i) {
  const m = TEAM[i];
  mArt.setAttribute('data-art', m.art);
  mIdx.textContent = String(i + 1).padStart(2, '0') + ' / 06';
  mName.textContent = m.name;
  mRole.textContent = m.role;
  mBio.textContent = m.bio;
  mQuote.textContent = '“' + m.quote + '”';
}

async function openModal(i, origin) {
  if (enqueue(() => openModal(i, origin), destino())) return;
  scene.busy = true;
  try {
    scene.member = i;
    modalOrigin = origin;
    fillModal(i);
    modal.setAttribute('aria-hidden', 'false');
    setLayer('modal');
    await flipOpen(modal, origin, { duration: 520 });
    trapFocus(modal);
    $('#modalClose').focus();
    announce(TEAM[i].name);
  } finally {
    scene.busy = false;
    flush();
  }
}

async function closeModal() {
  if (scene.member === null) return;
  if (enqueue(() => closeModal(), destino())) return;
  scene.busy = true;
  try {
    modal.setAttribute('aria-hidden', 'true');
    await flipClose(modal, modalOrigin, { duration: 320 });
    releaseFocus();
    setLayer('panel');
    if (scene.active) trapFocus($(`#p-${scene.active}`));
    modalOrigin?.focus();
    scene.member = null;
  } finally {
    scene.busy = false;
    flush();
  }
}

function cycleModal(dir) {
  const next = (scene.member + dir + TEAM.length) % TEAM.length;
  scene.member = next;
  const card = $(`.member[data-member="${next}"]`);
  modalOrigin = card || modalOrigin;
  // troca de conteúdo com fade curto — não vale reanimar o quadro inteiro
  modal.classList.remove('is-revealed');
  setTimeout(() => { fillModal(next); modal.classList.add('is-revealed'); announce(TEAM[next].name); }, 120);
}

$('#modalClose').onclick = closeModal;
$('#mPrev').onclick = () => cycleModal(-1);
$('#mNext').onclick = () => cycleModal(1);

/* — bindings — */

$('#enterBtn').onclick = () => goHub();

$$('[data-nav]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const target = el.dataset.nav;
    if (target === 'hero') goHero();
    else if (target === 'hub') goHub();
    else goPanel(target, el.classList.contains('tile') ? el : null);
  });
});

$$('.member').forEach(el => {
  el.addEventListener('click', () => openModal(+el.dataset.member, el));
});

closeBtn.onclick = () => {
  if (scene.layer === 'modal') closeModal();
  else if (scene.layer === 'panel') goHub();
  else goHero();
};

/* — teclado — */
addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (scene.layer === 'modal') closeModal();
    else if (scene.layer === 'panel') goHub();
    else if (scene.layer === 'hub') goHero();
  }
  if (scene.layer === 'panel' && !scene.busy) {
    const p = $(`#p-${scene.active}`);
    if (e.key === 'ArrowRight') goPanel(p.dataset.next);
    if (e.key === 'ArrowLeft')  goPanel(p.dataset.prev);
  }
  if (scene.layer === 'modal') {
    if (e.key === 'ArrowRight') cycleModal(1);
    if (e.key === 'ArrowLeft')  cycleModal(-1);
  }
});

/* — hover de tile realimenta o campo de partículas — */
$$('.tile[data-formation]').forEach(el => {
  let restore = null;
  el.addEventListener('mouseenter', () => {
    if (scene.layer !== 'hub') return;
    clearTimeout(restore);
    setFormation(el.dataset.formation);
  });
  el.addEventListener('mouseleave', () => {
    if (scene.layer !== 'hub') return;
    restore = setTimeout(() => setFormation('orbit'), 420);
  });
});

/* ═══ 7. ROTEAMENTO ══════════════════════════════════ */

let ignoreHash = false;
function route(hash) {
  ignoreHash = true;
  history.pushState({ hash }, '', hash);
  setTimeout(() => { ignoreHash = false; }, 30);
}

function resolve(hash, { push = false } = {}) {
  const slug = (hash || '').replace(/^#\/?/, '');
  if (!slug)            return goHero({ push });
  if (slug === 'hub')   return goHub({ push });
  if (PANELS.includes(slug)) return goPanel(slug, null, { push });
  return goHero({ push });
}

addEventListener('popstate', () => {
  if (ignoreHash) return;
  resolve(location.hash);
});

/* ═══ 8. FORMULÁRIO ══════════════════════════════════ */

const WHATSAPP = '5584994137144';
const form = $('#form'), note = $('#formNote');

form.addEventListener('submit', e => {
  e.preventDefault();
  const nome = $('#f-nome').value.trim();
  const fone = $('#f-fone').value.trim();
  const alvo = $('#f-int');
  const msg  = $('#f-msg').value.trim();

  if (nome.length < 3) { note.textContent = 'Informe seu nome completo.'; note.classList.add('is-err'); return; }
  if (fone.replace(/\D/g, '').length < 10) { note.textContent = 'Telefone incompleto. Inclua o DDD.'; note.classList.add('is-err'); return; }

  note.classList.remove('is-err');

  const texto =
    `Olá! Vim pelo site da OdontoNeeds.\n\n` +
    `Nome: ${nome}\n` +
    `Telefone: ${fone}\n` +
    `Interesse: ${alvo.options[alvo.selectedIndex].text}` +
    (msg ? `\n\nContexto: ${msg}` : '');

  // abre a conversa já preenchida — o envio final é sempre do usuário
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');

  note.textContent = 'Abrimos o WhatsApp com sua mensagem pronta. É só enviar.';
  form.reset();
});

/* ═══ BOOT ═══════════════════════════════════════════ */

runPreloader();

})();


