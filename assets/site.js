// Ziyaretçi sitesi
import { sb, PAGES, NAV, homeOrder, WIKI_SECTIONS, wikiLinks, HEROES, MOODS, TYPE_PAGE, TYPE_LABEL, $, $$, esc, safeUrl, md, fmtDate, visitorId, loadSettings, loadFonts, videoEmbed } from "./core.js";
import { Emitter, PDEF } from "./particles.js";

const PAGE = document.body.dataset.page || "anasayfa";
const params = new URLSearchParams(location.search);
const app = $("#app");
let S = {};
let lookKey = PAGE;

/* ---------- Ortak parçalar ---------- */
const SEAL_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#7a1814" stroke="#c8a24e" stroke-width="1.5"/><circle cx="24" cy="24" r="15" fill="none" stroke="#c8a24e" stroke-width=".8" stroke-dasharray="2 2.4"/><path d="M24 11 L27 22 L37 24 L27 26 L24 37 L21 26 L11 24 L21 22 Z" fill="#e9dfca"/></svg>';
const STAR_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(233,223,202,.6)" stroke-width="1.2"/><path d="M24 8 L27.5 20.5 L40 24 L27.5 27.5 L24 40 L20.5 27.5 L8 24 L20.5 20.5Z" fill="rgba(233,223,202,.75)"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.3-9C1 7.6 3.2 4 6.6 4c2.1 0 3.5 1.2 5.4 3.2C13.9 5.2 15.3 4 17.4 4 20.8 4 23 7.6 21.3 11 19 15.6 12 20 12 20z"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>';

const pic = (url, alt = "") => (safeUrl(url) ? `<img src="${safeUrl(url)}" alt="${esc(alt)}" loading="lazy">` : `<div class="ph-empty">${STAR_SVG}</div>`);
const likeBtn = (id) => `<button class="like" data-like="${id}" aria-pressed="false" aria-label="Beğen">${HEART}<span>·</span></button>`;
const ccSpan = (id, word) => `<span class="cc">${BUBBLE}<span data-cc="${id}">·</span>${word ? " yorum" : ""}</span>`;
const metaRow = (x, date) => `<div class="meta"><span class="date">${date || ""}</span>${likeBtn(x.id)}${ccSpan(x.id)}</div>`;
const pageHref = (k) => (PAGES.find((p) => p.k === k) || PAGES[0]).href;
const pageTitle = (k) => (PAGES.find((p) => p.k === k) || { t: "" }).t;

function renderChrome() {
  const P = (k) => PAGES.find((p) => p.k === k);
  const link = (k) => { const p = P(k); return `<a href="${p.href}" data-k="${p.k}">${p.t}</a>`; };
  $("#nav").innerHTML = NAV.map((n) => typeof n === "string" ? link(n)
    : `<div class="dd" data-g="${n.items.join(" ")}"><button type="button" class="dd-btn" aria-expanded="false">${n.g} <span aria-hidden="true">▾</span></button><div class="dd-menu">${n.items.map(link).join("")}</div></div>`).join("");
  $("#burger").onclick = () => { const o = $("#nav").classList.toggle("open"); $("#burger").setAttribute("aria-expanded", o); };
  $$(".dd-btn").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const dd = b.parentElement, open = !dd.classList.contains("open");
    $$(".dd.open").forEach((x) => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded", "false"); });
    dd.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
  }));
  document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) $$(".dd.open").forEach((x) => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded", "false"); }); });
}
function markNav(k) {
  $$("nav.main a").forEach((a) => a.classList.toggle("on", a.dataset.k === k));
  $$("nav.main .dd").forEach((d) => d.classList.toggle("on", d.dataset.g.split(" ").includes(k)));
}

function applyBrand() {
  const g = S.general || {};
  if (g.logo_url) $(".brand").innerHTML = `<img src="${safeUrl(g.logo_url)}" alt="${esc(g.site_name || "Kıyametin Çocukları")}">`;
  $("#footText").textContent = g.footer || "© İsmet Can Durmuşcan · Kıyametin Çocukları";
  if (g.favicon_url) setFavicon(g.favicon_url);
}

function setBgVideo(url) {
  let v = $("#bgVideo");
  const saveData = navigator.connection?.saveData;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!safeUrl(url) || saveData || reduce) { v?.remove(); document.body.classList.remove("has-video"); return; }
  if (!v) {
    v = document.createElement("video"); v.id = "bgVideo";
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true"); v.preload = "auto";
    document.body.prepend(v);
  }
  if (v.dataset.src !== url) { v.dataset.src = url; v.src = url; }
  v.play?.().catch(() => {});
  document.body.classList.add("has-video");
}
function setFavicon(url) {
  $$('link[rel~="icon"]').forEach((l) => l.remove());
  const l = document.createElement("link"); l.rel = "icon"; l.href = url; document.head.appendChild(l);
}
function applyLook(k) {
  lookKey = k;
  const m = MOODS[k] || MOODS.anasayfa;
  const root = document.documentElement.style;
  root.setProperty("--page-glow", m[0]);
  root.setProperty("--page-tint", m[1]);
  const L = (S.pages || {})[k] || {};
  document.body.classList.toggle("custom-bg", !!L.bg_url);
  if (L.bg_url) document.body.style.setProperty("--custom-bg", `url("${encodeURI(L.bg_url)}")`);
  document.body.style.setProperty("--bg-dim", L.dim ?? 0.72);
  $("#hero").style.setProperty("--hero-img", L.hero_url ? `url("${encodeURI(L.hero_url)}")` : "none");
  setBgVideo(L.video_url);
  markNav(k);
}

function hero(k, extra = "", over = null) {
  const L = (S.pages || {})[k] || {};
  const d = HEROES[k] || { e: "", t: "", p: "" };
  let p = L.subtitle || d.p;
  if (k === "anasayfa" && !L.subtitle) p = (S.general || {}).intro || "";
  const h = over || { e: L.eyebrow || d.e, t: L.title || d.t, p };
  $("#hero").className = "hero" + (k === "anasayfa" && !over ? " home" : "");
  $("#heroIn").innerHTML = `<div class="eyebrow">${h.e}</div><h1>${esc(h.t)}</h1>${h.p ? `<p>${esc(h.p)}</p>` : ""}${extra}`;
  document.title = (h.t && k !== "anasayfa" ? h.t + " · " : "") + ((S.general || {}).site_name || "Kıyametin Çocukları");
}

function fail(e) {
  console.error(e);
  app.innerHTML = `<div class="err">İçerik yüklenemedi. Sayfayı yenilemeyi dene. Sorun sürerse bize İletişim sayfasından haber ver.</div>`;
}

/* ---------- Veri ---------- */
const LIST_COLS = "id,type,title,summary,cover_url,file_url,links,meta,sort,created_at";
async function posts(type, limit) {
  let q = sb.from("posts").select(LIST_COLS).eq("type", type).eq("published", true);
  q = type === "haber" || type === "blog" ? q.order("created_at", { ascending: false }) : q.order("sort", { ascending: true }).order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function fillStats(ids) {
  ids = [...new Set(ids)].filter(Boolean);
  if (!ids.length) return;
  const { data } = await sb.rpc("post_stats", { p_ids: ids, p_visitor: visitorId() });
  (data || []).forEach((r) => {
    $$(`[data-like="${r.pid}"]`).forEach((b) => setLike(b, r.liked, r.like_count));
    $$(`[data-cc="${r.pid}"]`).forEach((s) => (s.textContent = r.comment_count));
  });
}
function setLike(b, on, n) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.querySelector("span").textContent = n; }

/* ---------- Kart şablonları ---------- */
const newsCard = (x, big) => `<a class="card${big ? " big" : ""}" href="/icerik?id=${x.id}"><div class="art">${pic(x.cover_url, x.title)}</div><div class="body"><span class="pill">Haber</span><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p>${metaRow(x, fmtDate(x.created_at))}</div></a>`;
const gameCard = (x) => `<a class="card" href="/icerik?id=${x.id}"><div class="art">${pic(x.cover_url, x.title)}</div><div class="body">${x.meta?.tag ? `<span class="pill">${esc(x.meta.tag)}</span>` : ""}<h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p>${metaRow(x)}</div></a>`;
const blogCard = (x) => `<a class="card" href="/icerik?id=${x.id}"><div class="art">${pic(x.cover_url, x.title)}</div><div class="body"><span class="pill">Blog</span><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p>${metaRow(x, fmtDate(x.created_at))}</div></a>`;
const modelCard = (x) => `<a class="card model-card" href="/icerik?id=${x.id}"><div class="art">${pic(x.cover_url, x.title)}<span class="ep-badge">3D</span></div><div class="body">${x.meta?.tag ? `<span class="pill">${esc(x.meta.tag)}</span>` : ""}<h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p>${metaRow(x)}</div></a>`;
const seriesCard = (x, count) => `<a class="card series-card" href="/seri?id=${x.id}"><div class="art">${pic(x.cover_url, x.title)}</div><div class="body"><span class="pill">${count} bölüm</span><h3>${esc(x.title)}</h3><p>${esc(x.description || "")}</p></div></a>`;
function charCard(x) {
  const sp = x.meta?.spoiler;
  return `<a class="char${sp ? " spoil" : ""}" href="/icerik?id=${x.id}"${sp ? ' data-spoil="1"' : ""}><div class="portrait">${pic(x.cover_url, x.title)}${sp ? '<span class="spoil-veil"><b>Spoiler</b><small>Görmek için dokun</small></span>' : ""}</div>${x.meta?.epithet ? `<span class="epithet">${esc(x.meta.epithet)}</span>` : ""}<h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p></a>`;
}
const chapterCard = (x) => `<a class="card" href="/icerik?id=${x.id}"><div class="art">${pic(x.cover_url, x.title)}</div><div class="body"><span class="pill">Hikaye</span><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p>${metaRow(x, fmtDate(x.created_at))}</div></a>`;
const zineCard = (x) => `<a class="zine" href="/icerik?id=${x.id}"><div class="cover">${pic(x.cover_url, x.title)}</div><div class="body"><span class="pill">PDF${x.meta?.pages ? " · " + esc(x.meta.pages) + " sayfa" : ""}</span><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p>${metaRow(x, x.meta?.issue_date || fmtDate(x.created_at))}</div></a>`;
const STATUS = { yayinda: ["Yayında", " red"], yakinda: ["Yakında", ""], muhurlu: ["Mühürlü", " dim"] };
function bookCard(x) {
  const st = STATUS[x.meta?.status] || STATUS.yayinda;
  const sealed = x.meta?.status === "muhurlu";
  const inner = `<div class="cover">${pic(x.cover_url, x.title)}</div><span class="no">${x.sort ? x.sort + ". KİTAP" : "KİTAP"}</span><h3>${esc(x.title)}</h3><span class="pill${st[1]}">${st[0]}</span>`;
  return sealed ? `<div class="book sealed">${inner}</div>` : `<a class="book" href="/icerik?id=${x.id}">${inner}</a>`;
}
const epCard = (x) => `<a class="card" href="/icerik?id=${x.id}"><div class="art">${pic(x.cover_url, x.title)}<span class="ep-badge">${x.sort ? x.sort + ". BÖLÜM" : "BÖLÜM"}</span>${x.meta?.video ? '<span class="ep-play">▶</span>' : ""}${x.meta?.duration ? `<span class="ep-dur">${esc(x.meta.duration)}</span>` : ""}</div><div class="body">${x.meta?.players ? `<span class="pill">${esc(x.meta.players)}</span>` : ""}<h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p>${metaRow(x, fmtDate(x.created_at))}</div></a>`;
const trackRow = (x, i) => `<div class="track" data-track="${x.id}"><span class="n">${i + 1}</span><div class="thumb">${pic(x.cover_url, x.title)}</div><div><h3><a href="/icerik?id=${x.id}" style="color:inherit;text-decoration:none">${esc(x.title)}</a></h3><small>${esc(x.summary || (x.meta?.ai ? "AI destekli" : "AI kullanılmadan"))}${x.meta?.duration ? " · " + esc(x.meta.duration) : ""}</small></div>${likeBtn(x.id)}${x.file_url ? `<button class="play" data-play="${x.id}" data-src="${safeUrl(x.file_url)}" aria-label="${esc(x.title)} çal">▶</button>` : "<span></span>"}<div class="bar" data-bar="${x.id}"><i></i></div></div>`;

const section = (title, href, more, body) => `<section><div class="sec-head"><h2>${title}</h2>${href ? `<a href="${href}">${more} →</a>` : ""}</div>${body}</section>`;
const empty = (t) => `<div class="empty">${t}</div>`;

/* ---------- Sayfalar ---------- */
const R = {
  async anasayfa() {
    applyLook("anasayfa");
    hero("anasayfa", `<div class="hero-actions"><a class="btn seal" href="/kitaplar">Seriyi keşfet</a><a class="btn" href="/harita">Haritayı aç</a></div>`);
    app.innerHTML = '<p class="loading">Yükleniyor…</p>';
    const order = homeOrder(S.home).filter((x) => x.on);
    const want = new Set(order.map((x) => x.k));
    const get = (k, fn) => (want.has(k) ? fn() : Promise.resolve([]));
    const [news, books, games, zines, eps, music, blogs, models, chars, series, chapters, polls] = await Promise.all([
      get("haberler", () => posts("haber", 3)), get("kitaplar", () => posts("kitap", 6)), get("oyunlar", () => posts("oyun", 3)),
      get("fanzinler", () => posts("fanzin", 2)), get("frp", () => posts("frp")), get("muzikler", () => posts("muzik", 3)),
      get("blog", () => posts("blog", 3)), get("modeller", () => posts("model", 4)), get("karakterler", () => posts("karakter", 6)),
      get("hikayeler", async () => (await sb.from("story_series").select("*").order("sort").order("created_at").limit(3)).data || []),
      get("hikayeler", () => posts("hikaye")),
      get("anket", async () => (await sb.from("polls").select("*").eq("active", true).order("sort").order("created_at", { ascending: false })).data || []),
    ]);
    const lastEps = [...eps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
    const A = S.home?.announce || {};
    const parts = {
      duyuru: () => (A.title || A.body) ? `<section class="announce">${A.image_url ? `<div class="announce-img">${pic(A.image_url, A.title)}</div>` : ""}<div class="announce-body">${A.eyebrow ? `<div class="eyebrow">${esc(A.eyebrow)}</div>` : ""}${A.title ? `<h2>${esc(A.title)}</h2>` : ""}<div class="prose">${md(A.body || "")}</div>${A.button_label && safeUrl(A.button_url) ? `<div><a class="btn seal" href="${safeUrl(A.button_url)}">${esc(A.button_label)}</a></div>` : ""}</div></section>` : "",
      anket: () => polls.length ? section(polls.length > 1 ? "Anketler" : "Anket", "", "", `<div class="polls">${polls.map(pollBox).join("")}</div>`) : "",
      haberler: () => news.length ? section("Son Haberler", "/haberler", "Tümü", `<div class="lead-news">${newsCard(news[0], true)}${news.length > 1 ? `<div class="stack">${news.slice(1).map((x) => newsCard(x)).join("")}</div>` : ""}</div>`) : "",
      blog: () => blogs.length ? section("Blog", "/blog", "Tüm yazılar", `<div class="grid">${blogs.map(blogCard).join("")}</div>`) : "",
      kitaplar: () => books.length ? section("Seri", "/kitaplar", "Tüm kitaplar", `<div class="books">${books.map(bookCard).join("")}</div>`) : "",
      hikayeler: () => series.length ? section("Hikaye Serileri", "/hikayeler", "Tüm seriler", `<div class="grid">${series.map((x) => seriesCard(x, chapters.filter((c) => c.meta?.series === x.id).length)).join("")}</div>`) : "",
      karakterler: () => chars.length ? section("Karakterler", "/karakterler", "Tüm karakterler", `<div class="chars">${chars.map(charCard).join("")}</div>`) : "",
      oyunlar: () => games.length ? section("Oyunlar", "/oyunlar", "Tümü", `<div class="grid">${games.map(gameCard).join("")}</div>`) : "",
      fanzinler: () => zines.length ? section("Fanzinler", "/fanzinler", "Tüm sayılar", `<div class="zines">${zines.map(zineCard).join("")}</div>`) : "",
      frp: () => lastEps.length ? section("FRP Albümü", "/frp", "Tüm bölümler", `<div class="grid">${lastEps.map(epCard).join("")}</div>`) : "",
      modeller: () => models.length ? section("3D Modeller", "/modeller", "Tümü", `<div class="grid">${models.map(modelCard).join("")}</div>`) : "",
      muzikler: () => music.length ? section("Müzikler", "/muzikler", "Tümü", `<div class="tracks">${music.map(trackRow).join("")}</div>`) : "",
    };
    const h = order.map((x) => (parts[x.k] ? parts[x.k]() : "")).join("");
    app.innerHTML = h || empty("Site hazırlanıyor. Çok yakında burada olacağız.");
    bindSpoilers();
    polls.forEach(loadPoll);
    fillStats([...news, ...blogs, ...games, ...zines, ...lastEps, ...music, ...models].map((x) => x.id));
  },
  async hikayeler() {
    applyLook("hikayeler"); hero("hikayeler");
    const [{ data: series, error }, chapters] = await Promise.all([sb.from("story_series").select("*").order("sort").order("created_at"), posts("hikaye")]);
    if (error) throw error;
    const orphans = chapters.filter((c) => !(series || []).some((x) => x.id === c.meta?.series));
    let h = (series || []).length ? `<section><div class="grid">${series.map((x) => seriesCard(x, chapters.filter((c) => c.meta?.series === x.id).length)).join("")}</div></section>` : "";
    if (orphans.length) h += section("Tek bölümlük hikayeler", "", "", `<div class="grid">${orphans.map(chapterCard).join("")}</div>`);
    app.innerHTML = h || empty("Henüz hikaye eklenmedi.");
    fillStats(orphans.map((x) => x.id));
  },
  async seri() {
    const id = params.get("id");
    const [{ data: x, error }, chapters] = await Promise.all([sb.from("story_series").select("*").eq("id", id).maybeSingle(), posts("hikaye")]);
    if (error) throw error;
    applyLook("hikayeler");
    if (!x) { hero("hikayeler"); app.innerHTML = empty("Bu seri bulunamadı."); return; }
    const list = chapters.filter((c) => c.meta?.series === x.id);
    hero("hikayeler", list.length ? `<div class="hero-actions"><a class="btn seal" href="/icerik?id=${list[0].id}">Okumaya başla</a>${list.length > 1 ? `<a class="btn" href="/icerik?id=${list[list.length - 1].id}">Son bölüm</a>` : ""}</div>` : "", { e: `<a href="/hikayeler" style="text-decoration:none">← Hikayeler</a>`, t: x.title, p: "" });
    app.innerHTML = `<section class="series-head">${x.cover_url ? `<div class="series-cover">${pic(x.cover_url, x.title)}</div>` : ""}<div class="prose">${md(x.description || "")}<p class="fine">${list.length} bölüm</p></div></section>
      <section><div class="sec-head"><h2>Bölümler</h2></div><ol class="chapters">${list.map((c, i) => `<li><a href="/icerik?id=${c.id}"><span class="ch-no">${c.sort || i + 1}</span><span class="ch-t"><b>${esc(c.title)}</b>${c.summary ? `<small>${esc(c.summary)}</small>` : ""}</span><span class="ch-d">${fmtDate(c.created_at)}</span></a>${likeBtn(c.id)}</li>`).join("") || '<li class="fine">Henüz bölüm yok.</li>'}</ol></section>`;
    fillStats(list.map((c) => c.id));
  },
  async karakterler() {
    applyLook("karakterler"); hero("karakterler");
    const list = await posts("karakter");
    if (!list.length) { app.innerHTML = empty("Henüz karakter eklenmedi."); return; }
    const groups = [];
    list.forEach((c) => { const g = c.meta?.group || "Diğer"; let x = groups.find((y) => y.g === g); if (!x) groups.push((x = { g, items: [] })); x.items.push(c); });
    const multi = groups.length > 1;
    app.innerHTML = groups.map((g) => `<section>${multi ? `<div class="sec-head"><h2>${esc(g.g)}</h2><span class="fine">${g.items.length}</span></div>` : ""}<div class="chars">${g.items.map(charCard).join("")}</div></section>`).join("");
    bindSpoilers();
  },
  async haberler() { await listPage("haberler", "haber", (l) => `<div class="grid">${l.map((x) => newsCard(x)).join("")}</div>`, "Henüz haber yok."); },
  async blog() { await listPage("blog", "blog", (l) => `<div class="grid">${l.map(blogCard).join("")}</div>`, "Henüz blog yazısı yok."); },
  async modeller() { await listPage("modeller", "model", (l) => `<div class="grid">${l.map(modelCard).join("")}</div>`, "Henüz 3D model eklenmedi."); },
  async oyunlar() { await listPage("oyunlar", "oyun", (l) => `<div class="grid">${l.map(gameCard).join("")}</div>`, "Henüz oyun eklenmedi."); },
  async fanzinler() { await listPage("fanzinler", "fanzin", (l) => `<div class="zines">${l.map(zineCard).join("")}</div>`, "Henüz fanzin yok."); },
  async kitaplar() { await listPage("kitaplar", "kitap", (l) => `<div class="books">${l.map(bookCard).join("")}</div>`, "Henüz kitap eklenmedi."); },
  async muzikler() {
    applyLook("muzikler"); hero("muzikler");
    const all = await posts("muzik");
    let tab = location.hash === "#ai-siz" ? "el" : "ai";
    const draw = () => {
      const list = all.filter((x) => !!x.meta?.ai === (tab === "ai"));
      app.innerHTML = `<section><div class="tabs" role="tablist"><button role="tab" data-tab="ai" class="${tab === "ai" ? "on" : ""}" aria-selected="${tab === "ai"}">AI Destekli</button><button role="tab" data-tab="el" class="${tab === "el" ? "on" : ""}" aria-selected="${tab === "el"}">AI'sız</button></div>
        <div class="tracks">${list.map(trackRow).join("") || empty("Bu bölümde henüz müzik yok.")}</div></section>`;
      $$("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, "", tab === "el" ? "#ai-siz" : "#ai-destekli"); stopAudio(); draw(); }));
      fillStats(list.map((x) => x.id));
    };
    draw();
  },
  async frp() {
    applyLook("frp"); hero("frp");
    const [{ data: seasons, error }, eps] = await Promise.all([sb.from("frp_seasons").select("*").order("sort").order("created_at"), posts("frp")]);
    if (error) throw error;
    const groups = (seasons || []).map((s) => ({ s, eps: eps.filter((e) => e.meta?.season === s.id) }));
    const orphan = eps.filter((e) => !(seasons || []).some((s) => s.id === e.meta?.season));
    if (orphan.length) groups.push({ s: { title: "Diğer bölümler", description: "" }, eps: orphan });
    app.innerHTML = groups.filter((g) => g.eps.length).map((g) => `<section><div class="sec-head"><h2>${esc(g.s.title)}</h2><span class="fine">${g.eps.length} bölüm</span></div>${g.s.description ? `<p class="cat-desc" style="margin:-8px 0 20px">${esc(g.s.description)}</p>` : ""}<div class="grid">${g.eps.map(epCard).join("")}</div></section>`).join("") || empty("Henüz bölüm eklenmedi.");
    fillStats(eps.map((x) => x.id));
  },
  async irklar() {
    applyLook("irklar"); hero("irklar");
    const [{ data: cats, error }, { data: races }] = await Promise.all([sb.from("race_categories").select("*").order("sort").order("created_at"), sb.from("races").select("id,category_id,name,summary,image_url,sort").order("sort").order("created_at")]);
    if (error) throw error;
    if (!cats?.length) { app.innerHTML = empty("Wiki henüz boş."); return; }
    const secs = [...new Set([...WIKI_SECTIONS.filter((x) => cats.some((c) => (c.section || "Irklar") === x)), ...cats.map((c) => c.section || "Irklar")])];
    const st = { sec: params.get("bolum"), cat: params.get("kategori"), q: params.get("ara") || "" };
    if (st.cat) { const c = cats.find((x) => x.id === st.cat); if (c) st.sec = c.section || "Irklar"; }
    if (!secs.includes(st.sec)) st.sec = secs[0];
    const entry = (x) => { const c = cats.find((y) => y.id === x.category_id); return `<a class="race" href="/irk?id=${x.id}"><div class="portrait">${pic(x.image_url, x.name)}</div><h3>${esc(x.name)}</h3>${st.q && c ? `<span class="epithet">${esc((c.section || "Irklar") + " · " + c.name)}</span>` : ""}<p>${esc(x.summary)}</p></a>`; };
    const sync = () => { const u = new URLSearchParams(); if (st.q) u.set("ara", st.q); else { u.set("bolum", st.sec); if (st.cat) u.set("kategori", st.cat); } history.replaceState(null, "", "?" + u); };
    const draw = () => {
      let body;
      if (st.q) {
        const q = st.q.toLocaleLowerCase("tr");
        const hits = (races || []).filter((r) => (r.name + " " + (r.summary || "")).toLocaleLowerCase("tr").includes(q));
        body = `<div class="cat-block"><h2>"${esc(st.q)}" için ${hits.length} sonuç</h2><div class="grid">${hits.map(entry).join("") || empty("Eşleşen madde yok.")}</div></div>`;
      } else {
        const scats = cats.filter((c) => (c.section || "Irklar") === st.sec);
        if (st.cat && !scats.some((c) => c.id === st.cat)) st.cat = null;
        const shown = st.cat ? scats.filter((c) => c.id === st.cat) : scats;
        body = `${scats.length > 1 ? `<div class="cats"><button data-cat="" class="${!st.cat ? "on" : ""}">Tümü</button>${scats.map((x) => `<button data-cat="${x.id}" class="${x.id === st.cat ? "on" : ""}">${esc(x.name)} <span style="color:var(--gold)">${(races || []).filter((r) => r.category_id === x.id).length}</span></button>`).join("")}</div>` : ""}
          ${shown.map((c) => { const items = (races || []).filter((r) => r.category_id === c.id); return `<div class="cat-block"><h2>${esc(c.name)}</h2>${c.description ? `<div class="cat-desc prose">${md(wikiLinks(c.description, races))}</div>` : ""}<div class="grid">${items.map(entry).join("") || empty("Bu kategoride henüz madde yok.")}</div></div>`; }).join("")}`;
      }
      app.innerHTML = `<section class="wiki"><div class="wiki-top"><div class="tabs wiki-tabs" role="tablist">${secs.map((x) => `<button role="tab" data-sec="${esc(x)}" class="${!st.q && x === st.sec ? "on" : ""}" aria-selected="${!st.q && x === st.sec}">${esc(x)}</button>`).join("")}</div>
        <label class="wiki-search" for="wq"><span class="sr">Wiki'de ara</span><input type="search" id="wq" placeholder="Wiki'de ara…" value="${esc(st.q)}"></label></div>${body}</section>`;
      $$("[data-sec]").forEach((b) => (b.onclick = () => { st.sec = b.dataset.sec; st.cat = null; st.q = ""; sync(); draw(); }));
      $$("[data-cat]").forEach((b) => (b.onclick = () => { st.cat = b.dataset.cat || null; sync(); draw(); }));
      const wq = $("#wq");
      wq.oninput = () => { clearTimeout(wq._t); wq._t = setTimeout(() => { st.q = wq.value.trim(); sync(); draw(); const n = $("#wq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    };
    draw();
  },
  async irk() {
    const id = params.get("id");
    const { data: x, error } = await sb.from("races").select("*, race_categories(id,name,section)").eq("id", id).maybeSingle();
    if (error) throw error;
    applyLook("irklar");
    if (!x) { hero("irklar"); app.innerHTML = empty("Bu madde bulunamadı."); return; }
    const cat = x.race_categories || {}, sec = cat.section || "Irklar";
    hero("irklar", "", { e: `<a href="/wiki?bolum=${encodeURIComponent(sec)}" style="text-decoration:none">← Wiki · ${esc(sec)}</a> · <a href="/wiki?kategori=${cat.id}" style="text-decoration:none">${esc(cat.name)}</a>`, t: x.name, p: "" });
    const { data: all } = await sb.from("races").select("id,name,category_id").order("sort");
    const sib = (all || []).filter((r) => r.category_id === x.category_id && r.id !== x.id);
    app.innerHTML = `<section class="article"><div class="prose">${x.image_url ? `<figure><img src="${safeUrl(x.image_url)}" alt="${esc(x.name)}"></figure>` : ""}${x.summary ? `<p><strong>${esc(x.summary)}</strong></p>` : ""}${md(wikiLinks(x.body, all))}</div>
      <aside class="aside"><h4>${esc(sec)}</h4><a href="/wiki?kategori=${cat.id}">${esc(cat.name)}</a><h4>Aynı kategoride</h4>${sib.map((r) => `<a href="/irk?id=${r.id}">${esc(r.name)}</a>`).join("") || '<span class="fine">Başka madde yok</span>'}<a class="btn small" href="/wiki" style="margin-top:6px">Wiki'de ara</a></aside></section>`;
    bindSpoilers();
  },
  async harita() {
    applyLook("harita"); hero("harita");
    const m = S.map || {};
    if (!m.base) { app.innerHTML = `<section><div class="map-empty">Harita henüz yüklenmedi.</div></section>`; return; }
    app.innerHTML = `<section><div class="map-wrap" id="map"></div></section>`;
    await loadLeaflet();
    const L = window.L, T = m.tile || 512, mz = m.maxZoom;
    const map = L.map("map", { crs: L.CRS.Simple, minZoom: -2, maxZoom: mz + 2, zoomSnap: 0.25, attributionControl: false });
    const bounds = L.latLngBounds(map.unproject([0, m.h], mz), map.unproject([m.w, 0], mz));
    L.tileLayer(`${m.base}/{z}/{x}_{y}.${m.ext || "webp"}`, { tileSize: T, minZoom: -2, maxZoom: mz + 2, minNativeZoom: 0, maxNativeZoom: mz, bounds, noWrap: true }).addTo(map);
    map.fitBounds(bounds);
    map.setMinZoom(map.getZoom() - 0.5);
    map.setMaxBounds(bounds.pad(0.25));
  },
  async hakkimda() {
    applyLook("hakkimda"); hero("hakkimda");
    const a = S.about || {};
    app.innerHTML = `<section class="about"><div class="about-photo"><div class="frame">${pic(a.photo_url, a.name)}</div></div>
      <div class="prose">${a.name ? `<h2 style="margin-top:0">${esc(a.name)}</h2>` : ""}${md(a.body || "")}
      ${(a.works || []).length ? `<h2>Yayınlar</h2><div class="timeline">${a.works.map((w) => `<div><b>${esc(w.title)}</b><span>${esc(w.note)}</span></div>`).join("")}</div>` : ""}</div></section>`;
  },
  async iletisim() {
    applyLook("iletisim"); hero("iletisim");
    const c = S.contact || {};
    app.innerHTML = `<section class="contact"><div style="display:grid;gap:16px;align-content:start"><div class="prose">${md(c.body || "")}</div>
      ${(c.socials || []).length ? `<div class="socials">${c.socials.map((s) => `<a href="${safeUrl(s.url) || "#"}" target="_blank" rel="noopener">${esc(s.label)} <span>${esc(s.note || "")}</span></a>`).join("")}</div>` : ""}</div>
      <form class="box" id="contactForm"><h2 style="font-size:24px">Mesaj gönder</h2>
       <label for="cf-n">Adın<input type="text" id="cf-n" required maxlength="80"></label>
       <label for="cf-e">Sana nasıl dönelim? (isteğe bağlı)<input type="text" id="cf-e" maxlength="120" placeholder="E-posta ya da sosyal medya"></label>
       <label for="cf-m">Mesajın<textarea id="cf-m" required maxlength="4000"></textarea></label>
       <p class="fine">Mesajın yalnızca yazara iletilir ve sana dönüş yapmak dışında kullanılmaz.</p>
       <button class="btn seal" type="submit">Gönder</button><div id="cfOut" aria-live="polite"></div></form></section>`;
    $("#contactForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button"); btn.disabled = true;
      const { error } = await sb.from("messages").insert({ name: $("#cf-n").value.trim(), contact: $("#cf-e").value.trim(), body: $("#cf-m").value.trim() });
      btn.disabled = false;
      $("#cfOut").innerHTML = error ? '<div class="err">Mesaj gönderilemedi. Biraz sonra tekrar dene.</div>' : '<div class="notice">Mesajın iletildi. Teşekkürler!</div>';
      if (!error) e.target.reset();
    };
  },
  async icerik() {
    const id = params.get("id");
    const { data: x, error } = await sb.from("posts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!x) { applyLook("anasayfa"); hero("anasayfa", "", { e: "", t: "Bulunamadı", p: "Aradığın içerik kaldırılmış ya da taşınmış olabilir." }); app.innerHTML = ""; return; }
    const k = TYPE_PAGE[x.type];
    applyLook(k);
    const back = `<a href="${pageHref(k)}" style="text-decoration:none">← ${pageTitle(k)}</a>`;
    let sub = x.type === "haber" ? fmtDate(x.created_at) : "";
    let season = null, photos = [], sibs = [], storySeries = null;
    if (x.type === "hikaye") {
      const [ss, e] = await Promise.all([
        x.meta?.series ? sb.from("story_series").select("id,title").eq("id", x.meta.series).maybeSingle() : Promise.resolve({ data: null }),
        sb.from("posts").select("id,title,sort,meta,created_at").eq("type", "hikaye").eq("published", true).order("sort").order("created_at"),
      ]);
      storySeries = ss.data;
      sibs = (e.data || []).filter((y) => (y.meta?.series || null) === (x.meta?.series || null));
      sub = fmtDate(x.created_at);
    }
    if (x.type === "frp") {
      const [s, p, e] = await Promise.all([
        x.meta?.season ? sb.from("frp_seasons").select("*").eq("id", x.meta.season).maybeSingle() : Promise.resolve({ data: null }),
        sb.from("post_photos").select("*").eq("post_id", x.id).order("sort").order("created_at"),
        sb.from("posts").select("id,title,sort,meta").eq("type", "frp").eq("published", true).order("sort"),
      ]);
      season = s.data; photos = p.data || [];
      sibs = (e.data || []).filter((y) => (y.meta?.season || null) === (x.meta?.season || null));
      sub = [fmtDate(x.created_at), x.meta?.duration, x.meta?.players].filter(Boolean).map(esc).join(" · ");
    }
    if (x.type === "karakter" && x.meta?.spoiler && !sessionStorageGet("sp_" + x.id)) {
      hero(k, "", { e: back, t: "Spoiler içeren karakter", p: "" });
      app.innerHTML = `<section class="spoil-gate"><p>Bu karakterin sayfası kitaplardaki önemli olayları açık edebilir.</p><button class="btn seal" id="spOk">Yine de göster</button> <a class="btn" href="${pageHref(k)}">Geri dön</a></section>`;
      $("#spOk").onclick = () => { sessionStorageSet("sp_" + x.id); R.icerik(); };
      return;
    }
    const backExtra = x.type === "hikaye" && storySeries ? ` · <a href="/seri?id=${storySeries.id}" style="text-decoration:none">${esc(storySeries.title)}</a>` : season ? " · " + esc(season.title) : "";
    hero(k, "", { e: back + backExtra, t: ((x.type === "frp" || x.type === "hikaye") && x.sort && sibs.length > 1 ? x.sort + ". Bölüm: " : "") + x.title, p: "" });
    if (sub) $("#heroIn").insertAdjacentHTML("beforeend", `<p>${sub}</p>`);

    let top = "", side = "";
    const links = (x.links || []).filter((l) => safeUrl(l.url));
    const linkBtns = links.map((l, i) => `<a class="btn${i === 0 ? " seal" : ""}" href="${safeUrl(l.url)}" target="_blank" rel="noopener">${esc(l.label || "Bağlantı")}</a>`).join("");
    const fileUrl = safeUrl(x.file_url);
    if (x.type === "fanzin") {
      top = fileUrl ? `<div class="reader" id="reader"><div class="reader-bar"><button type="button" class="rd-btn" id="rdPrev" aria-label="Önceki sayfa">‹</button><span id="rdPage">Yükleniyor…</span><button type="button" class="rd-btn" id="rdNext" aria-label="Sonraki sayfa">›</button><span class="rd-sp"></span><button type="button" class="rd-btn" id="rdFs" aria-label="Tam ekran">⤢</button></div><div class="reader-stage" id="rdStage"></div></div>` : "";
      side = (fileUrl ? `<a class="btn seal" href="${fileUrl}" target="_blank" rel="noopener">PDF'i aç / indir</a>` : "") + linkBtns + (x.meta?.pages ? `<span class="fine">${esc(x.meta.pages)} sayfa</span>` : "");
    } else if (x.type === "muzik") {
      top = x.cover_url ? `<figure><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      top += fileUrl ? `<audio class="audio-full" controls preload="none" src="${fileUrl}"></audio>` : "";
      side = `<span class="pill">${x.meta?.ai ? "AI destekli" : "AI kullanılmadan"}</span>${x.meta?.duration ? `<span class="fine">${esc(x.meta.duration)}</span>` : ""}${linkBtns}`;
    } else if (x.type === "hikaye") {
      top = x.cover_url ? `<figure><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      if (storySeries) side += `<a href="/seri?id=${storySeries.id}"><b>${esc(storySeries.title)}</b></a>`;
      side += linkBtns;
      if (sibs.length > 1) side += `<h4>Bölümler</h4>` + sibs.map((y, i) => (y.id === x.id ? `<b>${y.sort || i + 1}. ${esc(y.title)}</b>` : `<a href="/icerik?id=${y.id}">${y.sort || i + 1}. ${esc(y.title)}</a>`)).join("");
    } else if (x.type === "karakter") {
      const m = x.meta || {};
      top = x.cover_url ? `<figure class="char-portrait"><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      side = [m.epithet && `<span class="epithet">${esc(m.epithet)}</span>`, m.group && `<h4>Grup</h4><span>${esc(m.group)}</span>`, m.race && `<h4>Irk</h4><span>${esc(m.race)}</span>`, m.books && `<h4>Göründüğü kitaplar</h4><span>${esc(m.books)}</span>`].filter(Boolean).join("") + linkBtns;
    } else if (x.type === "model") {
      top = fileUrl
        ? `<div class="model-stage" id="modelStage"><model-viewer id="mv" src="${fileUrl}" ${x.cover_url ? `poster="${safeUrl(x.cover_url)}"` : ""} alt="${esc(x.title)}" camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="1500" rotation-per-second="18deg" shadow-intensity="1" exposure="1" environment-image="neutral" ar ar-modes="webxr scene-viewer quick-look" interaction-prompt="auto"><button slot="ar-button" class="btn seal mv-ar">Odana yerleştir (AR)</button><div slot="progress-bar" class="mv-progress"><i id="mvBar"></i></div></model-viewer></div>
           <div class="acts game-acts"><button class="btn" id="mvRotate">Döndürmeyi durdur</button><button class="btn" id="mvReset">Görünümü sıfırla</button><button class="btn" id="mvFs">Tam ekran</button></div>
           <p class="fine" style="margin:-.6em 0 1.4em">Sürükleyerek döndür, tekerlek ya da iki parmakla yakınlaştır, sağ tık ya da iki parmakla kaydır.</p>`
        : x.cover_url ? `<figure><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      side = (x.meta?.tag ? `<span class="pill">${esc(x.meta.tag)}</span>` : "") + linkBtns + (fileUrl && x.meta?.download ? `<a class="btn" href="${fileUrl}" target="_blank" rel="noopener">Modeli indir (GLB)</a>` : "");
    } else if (x.type === "frp") {
      const v = videoEmbed(x.meta?.video || "");
      top = v ? `<div class="video"><iframe src="${v}" title="${esc(x.title)}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe></div>` : x.cover_url ? `<figure><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      if (!v && safeUrl(x.meta?.video)) side += `<a class="btn seal" href="${safeUrl(x.meta.video)}" target="_blank" rel="noopener">Videoyu izle</a>`;
      side += linkBtns;
      if (sibs.length > 1) side += `<h4>Sezonun bölümleri</h4>` + sibs.map((y) => (y.id === x.id ? `<b>${y.sort ? y.sort + ". " : ""}${esc(y.title)}</b>` : `<a href="/icerik?id=${y.id}">${y.sort ? y.sort + ". " : ""}${esc(y.title)}</a>`)).join("");
    } else {
      const gameUrl = x.type === "oyun" ? safeUrl(x.meta?.embed) : "";
      top = gameUrl
        ? `<div class="game-frame" id="gameFrame"><iframe src="${gameUrl}" title="${esc(x.title)}" allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe></div><div class="acts game-acts"><button class="btn seal" id="gameFs">Tam ekran oyna</button></div>`
        : x.cover_url ? `<figure><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      if (x.type === "kitap") { const st = STATUS[x.meta?.status] || STATUS.yayinda; side = `<span class="pill${st[1]}">${st[0]}</span>`; }
      if (x.type === "oyun" && x.meta?.tag) side = `<span class="pill">${esc(x.meta.tag)}</span>`;
      side += linkBtns + (fileUrl ? `<a class="btn${links.length ? "" : " seal"}" href="${fileUrl}" target="_blank" rel="noopener">${x.type === "oyun" ? "Dosyayı indir" : "Dosyayı aç"}</a>` : "");
    }
    let gallery = "";
    if (photos.length) {
      gallery = `<h2>Masadan fotoğraflar</h2><div class="gallery">${photos.map((p, i) => `<button class="ph" data-ph="${i}" aria-label="Fotoğraf ${i + 1}">${pic(p.url, p.caption)}</button>`).join("")}</div>`;
    }
    let nav = "";
    if ((x.type === "frp" || x.type === "hikaye") && sibs.length > 1) {
      const i = sibs.findIndex((y) => y.id === x.id), pv = sibs[i - 1], nx = sibs[i + 1];
      nav = `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:28px;flex-wrap:wrap">${pv ? `<a class="btn small" href="/icerik?id=${pv.id}">← Önceki bölüm</a>` : "<span></span>"}${nx ? `<a class="btn small" href="/icerik?id=${nx.id}">Sonraki bölüm →</a>` : ""}</div>`;
    }
    app.innerHTML = `<section class="article"><div class="prose"${x.type === "frp" || x.type === "fanzin" || x.type === "model" || (x.type === "oyun" && x.meta?.embed) ? ' style="max-width:none"' : ""}>${top}${md(x.body)}${gallery}${nav}</div>
      <aside class="aside"><h4>${TYPE_LABEL[x.type]}</h4>${side}<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${likeBtn(x.id)}${ccSpan(x.id, true)}</div></aside></section>
      <section class="comments" id="yorumlar"><div class="sec-head"><h2>Yorumlar</h2></div><div id="cList"><p class="loading">Yükleniyor…</p></div>
       <form class="box" id="commentForm"><label for="c-n">Adın<input type="text" id="c-n" required maxlength="60"></label>
        <label for="c-b">Yorumun<textarea id="c-b" required maxlength="2000"></textarea></label>
        <p class="fine">Yorumlar yazar onayladıktan sonra yayınlanır. Yazdığın isim ve yorum saklanır; kişisel bilgi paylaşma.</p>
        <button class="btn seal" type="submit">Yorumu gönder</button><div id="cOut" aria-live="polite"></div></form></section>`;
    if (x.type === "fanzin" && fileUrl) openReader(x.file_url);
    if (x.type === "model" && fileUrl) initModel();
    const fs = $("#gameFs");
    if (fs) fs.onclick = () => { const el = $("#gameFrame"); (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); };
    if (photos.length) $$("[data-ph]").forEach((b) => (b.onclick = () => openLb(photos, +b.dataset.ph)));
    fillStats([x.id]);
    loadComments(x.id);
    $("#commentForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button"); btn.disabled = true;
      const { error } = await sb.from("comments").insert({ post_id: x.id, name: $("#c-n").value.trim(), body: $("#c-b").value.trim() });
      btn.disabled = false;
      $("#cOut").innerHTML = error ? '<div class="err">Yorum gönderilemedi. Biraz sonra tekrar dene.</div>' : '<div class="notice">Yorumun alındı. Yazar onayladıktan sonra burada görünecek.</div>';
      if (!error) e.target.reset();
    };
  },
  async yok() {
    applyLook("anasayfa");
    hero("anasayfa", `<div class="hero-actions"><a class="btn seal" href="/">Ana sayfaya dön</a></div>`, { e: "404", t: "Bu sayfa mühürlü", p: "Aradığın sayfa bulunamadı." });
    app.innerHTML = "";
  },
};

async function listPage(k, type, tpl, none) {
  applyLook(k); hero(k);
  const l = await posts(type);
  app.innerHTML = `<section>${l.length ? tpl(l) : empty(none)}</section>`;
  fillStats(l.map((x) => x.id));
}

async function loadComments(id) {
  const { data } = await sb.from("comments").select("name,body,created_at").eq("post_id", id).eq("approved", true).order("created_at");
  $("#cList").innerHTML = (data || []).length ? data.map((c) => `<div class="comment"><b>${esc(c.name)}</b><time>${fmtDate(c.created_at)}</time><p>${esc(c.body).replace(/\n/g, "<br>")}</p></div>`).join("") : '<p class="fine">Henüz yorum yok. İlk yorumu sen yaz.</p>';
}

/* ---------- Spoiler kartları ---------- */
function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k) { try { sessionStorage.setItem(k, "1"); } catch {} }
function bindSpoilers() {
  $$('[data-spoil="1"]').forEach((a) => {
    const id = new URLSearchParams(a.getAttribute("href").split("?")[1] || "").get("id");
    if (sessionStorageGet("sp_" + id)) { a.classList.remove("spoil"); a.querySelector(".spoil-veil")?.remove(); return; }
    a.addEventListener("click", (e) => {
      if (!a.classList.contains("spoil")) return;
      e.preventDefault(); a.classList.remove("spoil"); a.querySelector(".spoil-veil")?.remove(); sessionStorageSet("sp_" + id);
    });
  });
}

/* ---------- Anketler ---------- */
function pollBox(p) {
  const opts = Array.isArray(p.options) ? p.options : [];
  return `<div class="poll box" data-poll="${p.id}"><h3>${esc(p.question)}</h3><div class="poll-opts">${opts.map((o, i) => `<button type="button" class="poll-opt" data-choice="${i}"><span class="po-bar"></span><span class="po-t">${esc(o)}</span><span class="po-n"></span></button>`).join("")}</div><p class="fine poll-foot">Oy vermek için bir seçeneğe dokun.</p></div>`;
}
function drawPoll(box, r, showResults) {
  const counts = r?.counts || [], total = r?.total || 0, mine = r?.mine;
  const voted = mine !== null && mine !== undefined;
  const reveal = voted && showResults !== "never";
  $$(".poll-opt", box).forEach((b, i) => {
    const n = counts[i] || 0, pct = total ? Math.round((n / total) * 100) : 0;
    b.classList.toggle("mine", mine === i);
    b.classList.toggle("shown", reveal);
    b.querySelector(".po-bar").style.width = reveal ? pct + "%" : "0";
    b.querySelector(".po-n").textContent = reveal ? `%${pct}` : "";
  });
  $(".poll-foot", box).textContent = !voted ? "Oy vermek için bir seçeneğe dokun." : reveal ? `Toplam ${total} oy · Oyunu değiştirmek için başka bir seçeneğe dokunabilirsin.` : "Oyun kaydedildi. Teşekkürler!";
}
async function loadPoll(p) {
  const box = $(`[data-poll="${p.id}"]`); if (!box) return;
  const show = p.show_results ? "after" : "never";
  const { data } = await sb.rpc("poll_results", { p_poll: p.id, p_visitor: visitorId() });
  drawPoll(box, data, show);
  $$(".poll-opt", box).forEach((b) => (b.onclick = async () => {
    box.classList.add("busy");
    const { data: r, error } = await sb.rpc("vote_poll", { p_poll: p.id, p_visitor: visitorId(), p_choice: +b.dataset.choice });
    box.classList.remove("busy");
    if (error) { $(".poll-foot", box).textContent = "Oy kaydedilemedi. Anket kapanmış olabilir."; return; }
    drawPoll(box, r, show);
  }));
}

/* ---------- 3D model görüntüleyici ---------- */
const MODEL_VIEWER = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
function initModel() {
  if (!customElements.get("model-viewer")) { const sc = document.createElement("script"); sc.type = "module"; sc.src = MODEL_VIEWER; document.head.appendChild(sc); }
  const mv = $("#mv");
  mv.addEventListener("progress", (e) => { const b = $("#mvBar"); if (b) b.style.width = Math.round(e.detail.totalProgress * 100) + "%"; if (e.detail.totalProgress >= 1) b?.parentElement?.classList.add("done"); });
  mv.addEventListener("error", () => { $("#modelStage").insertAdjacentHTML("beforeend", '<div class="err" style="position:absolute;left:16px;right:16px;bottom:16px">Model yüklenemedi. Dosyanın GLB formatında olduğundan emin ol.</div>'); });
  $("#mvRotate").onclick = (e) => { mv.autoRotate = !mv.autoRotate; e.target.textContent = mv.autoRotate ? "Döndürmeyi durdur" : "Kendiliğinden dönsün"; };
  $("#mvReset").onclick = () => { mv.cameraOrbit = "auto auto auto"; mv.fieldOfView = "auto"; mv.cameraTarget = "auto auto auto"; mv.jumpCameraToGoal?.(); };
  $("#mvFs").onclick = () => { const el = $("#modelStage"); if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); };
}

/* ---------- Fanzin okuyucu: PDF.js + sayfa çevirme ---------- */
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/";
const PAGEFLIP = "https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js";
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function openReader(url) {
  const stage = $("#rdStage"), label = $("#rdPage"), reader = $("#reader");
  let pdf;
  try {
    const lib = await import(PDFJS + "pdf.min.mjs");
    lib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
    pdf = await lib.getDocument({ url }).promise;
  } catch (e) {
    console.error(e);
    stage.innerHTML = `<div class="empty">Fanzin burada açılamadı. Yandaki "PDF'i aç / indir" düğmesiyle okuyabilirsin.</div>`;
    label.textContent = ""; return;
  }
  const flipOk = await loadScript(PAGEFLIP).then(() => !!window.St?.PageFlip).catch(() => false);
  const n = pdf.numPages;
  const v1 = (await pdf.getPage(1)).getViewport({ scale: 1 });
  const ratio = v1.height / v1.width;
  const cache = new Map(); // sayfa no -> {canvas, w}
  let book = null, cur = 0, single = false, pageW = 0, pageH = 0, fallbackEls = [];

  const layout = () => {
    const fs = document.fullscreenElement === reader;
    const availW = stage.clientWidth - 16;
    const availH = fs ? innerHeight - 70 : Math.min(innerHeight * 0.82, 1100);
    single = availW < 720 || n === 1;
    pageW = Math.floor(single ? Math.min(availW, availH / ratio) : Math.min(availW / 2, availH / ratio));
    pageH = Math.floor(pageW * ratio);
  };
  const renderPage = async (i) => {
    if (i < 1 || i > n) return;
    const need = pageW * Math.min(2, devicePixelRatio || 1);
    const c = cache.get(i);
    if (c && c.w >= need * 0.85) return attach(i);
    cache.set(i, { canvas: c?.canvas || null, w: need }); // aynı anda iki kez çizilmesin
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: need / page.getViewport({ scale: 1 }).width });
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await page.render({ canvasContext: cv.getContext("2d"), canvas: cv, viewport: vp }).promise;
    cache.set(i, { canvas: cv, w: need });
    attach(i);
  };
  const attach = (i) => {
    const c = cache.get(i); if (!c?.canvas) return;
    $$(`[data-pg="${i}"]`, stage).forEach((el) => { if (el.firstChild !== c.canvas) el.replaceChildren(c.canvas); });
  };
  const around = (idx) => { for (let i = idx - 1; i <= idx + 4; i++) renderPage(i); };
  const setLabel = () => {
    const a = cur + 1;
    const b = !single && a > 1 && a < n ? (a % 2 === 0 ? a + 1 : a) : a;
    const first = !single && a > 1 && a % 2 === 1 ? a - 1 : a;
    label.textContent = first === b ? `Sayfa ${first} / ${n}` : `Sayfa ${first}–${b} / ${n}`;
  };
  const makePages = () => Array.from({ length: n }, (_, k) => { const d = document.createElement("div"); d.className = "flip-page"; d.dataset.pg = k + 1; d.dataset.density = k === 0 || k === n - 1 ? "hard" : "soft"; return d; });

  const build = () => {
    layout();
    if (book) { try { book.destroy(); } catch (e) {} book = null; }
    stage.innerHTML = "";
    if (flipOk) {
      const root = document.createElement("div"); root.className = "flip-book";
      stage.appendChild(root);
      const pages = makePages(); pages.forEach((p) => root.appendChild(p));
      book = new window.St.PageFlip(root, {
        width: pageW, height: pageH, size: "fixed", showCover: true, usePortrait: single,
        autoSize: false, drawShadow: true, maxShadowOpacity: 0.55, flippingTime: 750,
        mobileScrollSupport: false, startPage: cur, showPageCorners: true,
      });
      book.loadFromHTML(pages);
      book.on("flip", (e) => { cur = e.data; setLabel(); around(cur); });
    } else {
      // Yedek: kütüphane yüklenemezse kaydırmalı sayfa geçişi
      const root = document.createElement("div"); root.className = "slide-book"; stage.appendChild(root);
      fallbackEls = makePages(); fallbackEls.forEach((p) => { p.style.width = pageW + "px"; p.style.height = pageH + "px"; root.appendChild(p); });
      showSlide();
    }
    for (let i = 1; i <= n; i++) { if (cache.get(i)?.canvas) attach(i); }
    setLabel(); around(cur);
  };
  const showSlide = () => {
    const vis = single ? [cur] : cur === 0 ? [0] : [cur - (cur % 2 === 0 ? 1 : 0), cur + (cur % 2 === 0 ? 0 : 1)];
    fallbackEls.forEach((el, k) => (el.hidden = !vis.includes(k)));
  };
  const go = (d) => {
    if (book) { d > 0 ? book.flipNext() : book.flipPrev(); return; }
    const step = single || (cur === 0 && d > 0) || (cur <= 2 && d < 0) ? 1 : 2;
    cur = Math.max(0, Math.min(n - 1, cur + d * step));
    if (!single && cur > 0 && cur % 2 === 0) cur -= 1;
    showSlide(); setLabel(); around(cur);
  };
  $("#rdPrev").onclick = () => go(-1);
  $("#rdNext").onclick = () => go(1);
  $("#rdFs").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else (reader.requestFullscreen || reader.webkitRequestFullscreen)?.call(reader); };
  document.addEventListener("keydown", (e) => { if (e.target.closest?.("input,textarea")) return; if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); });
  document.addEventListener("fullscreenchange", () => setTimeout(build, 120));
  let lastW = stage.clientWidth;
  addEventListener("resize", () => { clearTimeout(stage._t); stage._t = setTimeout(() => { if (Math.abs(stage.clientWidth - lastW) > 40 || document.fullscreenElement) { lastW = stage.clientWidth; build(); } }, 250); });
  build();
}

/* ---------- Harita kütüphanesi ---------- */
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; js.onload = res; js.onerror = rej; document.head.appendChild(js);
  });
}

/* ---------- Fotoğraf görüntüleyici ---------- */
let lb = null;
function openLb(photos, i) {
  lb = { photos, i };
  let el = $("#lb");
  if (!el) { el = document.createElement("div"); el.id = "lb"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  drawLb();
}
function drawLb() {
  const p = lb.photos[lb.i];
  $("#lb").innerHTML = `<div class="lb-img"><img src="${safeUrl(p.url)}" alt="${esc(p.caption)}"></div><div class="lb-bar"><button data-lb="-1" aria-label="Önceki">←</button><span class="lb-cap">${lb.i + 1} / ${lb.photos.length}${p.caption ? " · " + esc(p.caption) : ""}</span><button data-lb="1" aria-label="Sonraki">→</button><button data-lb="x" aria-label="Kapat">✕</button></div>`;
}
function closeLb() { $("#lb")?.remove(); lb = null; }
document.addEventListener("keydown", (e) => {
  if (!lb) return;
  if (e.key === "Escape") closeLb();
  if (e.key === "ArrowRight") { lb.i = (lb.i + 1) % lb.photos.length; drawLb(); }
  if (e.key === "ArrowLeft") { lb.i = (lb.i - 1 + lb.photos.length) % lb.photos.length; drawLb(); }
});

/* ---------- Müzik çalar ---------- */
const audio = new Audio();
let playing = null;
function stopAudio() {
  audio.pause();
  if (playing) { const b = $(`[data-play="${playing}"]`); if (b) { b.classList.remove("on"); b.textContent = "▶"; b.closest(".track")?.classList.remove("playing"); } }
  playing = null;
}
audio.addEventListener("timeupdate", () => { if (!playing || !audio.duration) return; const bar = $(`[data-bar="${playing}"] i`); if (bar) bar.style.width = (audio.currentTime / audio.duration) * 100 + "%"; });
audio.addEventListener("ended", stopAudio);

/* ---------- Tıklamalar ---------- */
document.addEventListener("click", async (e) => {
  const lk = e.target.closest("[data-like]");
  if (lk) {
    e.preventDefault(); e.stopPropagation();
    if (lk.disabled) return; lk.disabled = true;
    const id = lk.dataset.like;
    const { data, error } = await sb.rpc("toggle_like", { p_post: id, p_visitor: visitorId() });
    lk.disabled = false;
    if (!error && data) $$(`[data-like="${id}"]`).forEach((b) => setLike(b, data.liked, data.count));
    return;
  }
  const pl = e.target.closest("[data-play]");
  if (pl) {
    e.preventDefault();
    const id = pl.dataset.play, was = playing === id;
    stopAudio(); if (was) return;
    audio.src = pl.dataset.src; playing = id;
    try { await audio.play(); pl.classList.add("on"); pl.textContent = "❚❚"; pl.closest(".track")?.classList.add("playing"); } catch { playing = null; }
    return;
  }
  const bar = e.target.closest("[data-bar]");
  if (bar && playing === bar.dataset.bar && audio.duration) { const r = bar.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; return; }
  const lbb = e.target.closest("[data-lb]");
  if (lbb) { const a = lbb.dataset.lb; if (a === "x") closeLb(); else { lb.i = (lb.i + +a + lb.photos.length) % lb.photos.length; drawLb(); } return; }
  if (e.target.id === "lb") { closeLb(); return; }
  const sp = e.target.closest(".spoiler");
  if (sp) sp.classList.toggle("open");
});
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("spoiler")) { e.preventDefault(); e.target.classList.toggle("open"); } });

/* ---------- Başlat ---------- */
async function init() {
  renderChrome();
  applyLook(PAGE === "icerik" || PAGE === "irk" || PAGE === "yok" ? "anasayfa" : PAGE);
  new Emitter($("#embers"), () => ({ ...PDEF, ...((S.particles || {})[lookKey] || {}) }), true);
  try {
    S = await loadSettings();
  } catch (e) { S = {}; console.error(e); }
  applyBrand();
  loadFonts(S).catch(console.error);
  try { await (R[PAGE] || R.yok)(); } catch (e) { fail(e); }
}
init();
