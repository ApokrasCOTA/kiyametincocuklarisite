// Arka plan parçacık motoru (kıvılcım, toz, yıldız, kül, özel görsel)
export const PDEF = {
  on: true, shape: "kivilcim", img_url: null, color: "#e2733a", blur: 1, opacity: 0.75, count: 45,
  sBirth: 0, sNormal: 2.2, sDeath: 0.4, life: 9, speed: 0.5, dir: "up", drift: 0.35,
};
export const SHAPES = [
  ["kivilcim", "Kıvılcım (parlayan)"], ["toz", "Toz / ışık zerresi"], ["yildiz", "Yıldız"], ["kul", "Kül / kar tanesi"], ["ozel", "Kendi görselim"],
];

const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const imgCache = new Map();
function getImg(url) {
  if (!url) return null;
  if (!imgCache.has(url)) { const im = new Image(); im.crossOrigin = "anonymous"; im.src = url; imgCache.set(url, im); }
  return imgCache.get(url);
}

function makeSprite(cfg) {
  const S = 64, c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d");
  const bl = Math.min(12, (cfg.blur * 16) / Math.max(0.5, cfg.sNormal));
  x.filter = bl > 0 ? `blur(${bl.toFixed(2)}px)` : "none";
  x.translate(S / 2, S / 2);
  if (cfg.shape === "ozel") {
    const im = getImg(cfg.img_url);
    if (im && im.complete && im.naturalWidth) { x.drawImage(im, -14, -14, 28, 28); return { c, ready: true }; }
    return { c, ready: false };
  }
  x.fillStyle = cfg.color;
  if (cfg.shape === "kivilcim") {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 14);
    g.addColorStop(0, "#fff6e0"); g.addColorStop(0.25, cfg.color); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill();
  } else if (cfg.shape === "toz") { x.beginPath(); x.arc(0, 0, 8, 0, 7); x.fill(); }
  else if (cfg.shape === "yildiz") {
    x.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 14, a = (i * Math.PI) / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
  } else if (cfg.shape === "kul") {
    x.beginPath(); x.moveTo(-9, -5); x.lineTo(4, -10); x.lineTo(11, 1); x.lineTo(2, 9); x.lineTo(-10, 5); x.closePath(); x.fill();
  } else { x.beginPath(); x.arc(0, 0, 10, 0, 7); x.fill(); }
  return { c, ready: true };
}

export class Emitter {
  constructor(canvas, getCfg, full = true) {
    this.canvas = canvas; this.getCfg = getCfg; this.full = full; this.alive = true;
    this.ctx = canvas.getContext("2d"); this.P = []; this.sig = ""; this.sprite = null; this.last = performance.now();
    this.size = this.size.bind(this); this.size();
    if (full) addEventListener("resize", this.size);
    requestAnimationFrame((t) => this.tick(t));
  }
  stop() { this.alive = false; if (this.full) removeEventListener("resize", this.size); }
  size() {
    const d = devicePixelRatio || 1;
    if (this.full) { this.w = innerWidth; this.h = innerHeight; }
    else { const r = this.canvas.getBoundingClientRect(); this.w = r.width; this.h = r.height; }
    this.canvas.width = this.w * d; this.canvas.height = this.h * d;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  spawn(cfg, fresh) {
    const { w, h } = this;
    return {
      x: Math.random() * w, y: fresh ? Math.random() * h : cfg.dir === "up" ? h + 10 : -10,
      age: fresh ? Math.random() * cfg.life : 0, life: cfg.life * (0.6 + Math.random() * 0.8),
      v: cfg.speed * (0.6 + Math.random() * 0.8), ph: Math.random() * 6.28, rot: Math.random() * 6.28, sz: 0.7 + Math.random() * 0.6,
    };
  }
  tick(now) {
    if (!this.alive) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const cfg = { ...PDEF, ...(this.getCfg() || {}) };
    const { ctx } = this;
    if (!this.full) { const r = this.canvas.getBoundingClientRect(); if (Math.abs(r.width - this.w) > 1 || Math.abs(r.height - this.h) > 1) this.size(); }
    ctx.clearRect(0, 0, this.w, this.h);
    if (cfg.on && !reduce) {
      const sig = JSON.stringify([cfg.shape, cfg.color, cfg.blur, cfg.sNormal, cfg.img_url]);
      if (sig !== this.sig || (this.sprite && !this.sprite.ready)) { this.sprite = makeSprite(cfg); if (this.sprite.ready) this.sig = sig; else this.sig = ""; }
      const P = this.P;
      while (P.length < cfg.count) P.push(this.spawn(cfg, true));
      if (P.length > cfg.count) P.length = cfg.count;
      ctx.globalCompositeOperation = cfg.shape === "kivilcim" ? "lighter" : "source-over";
      const rotates = cfg.shape === "yildiz" || cfg.shape === "kul" || cfg.shape === "ozel";
      for (let i = 0; i < P.length; i++) {
        const p = P[i]; p.age += dt; const t = p.age / p.life;
        if (t >= 1 || p.y < -20 || p.y > this.h + 20) { P[i] = this.spawn(cfg, false); continue; }
        p.y += p.v * 60 * dt * (cfg.dir === "up" ? -1 : 1);
        p.ph += dt; p.x += Math.sin(p.ph) * cfg.drift * 18 * dt; p.rot += dt * 0.6;
        let sz;
        if (t < 0.2) sz = cfg.sBirth + (cfg.sNormal - cfg.sBirth) * (t / 0.2);
        else if (t > 0.7) sz = cfg.sNormal + (cfg.sDeath - cfg.sNormal) * ((t - 0.7) / 0.3);
        else sz = cfg.sNormal;
        sz *= p.sz;
        const fade = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
        const a = cfg.opacity * fade * (cfg.shape === "kivilcim" ? 0.85 + 0.15 * Math.sin(p.ph * 7) : 1);
        if (sz <= 0.05 || a <= 0 || !this.sprite.ready) continue;
        const d = sz * 4.6;
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        if (rotates) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.drawImage(this.sprite.c, -d / 2, -d / 2, d, d); ctx.restore(); }
        else ctx.drawImage(this.sprite.c, p.x - d / 2, p.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    requestAnimationFrame((t) => this.tick(t));
  }
}
