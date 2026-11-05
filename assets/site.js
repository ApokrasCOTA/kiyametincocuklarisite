// Ziyaretçi sitesi
import { sb, PAGES, HEROES, MOODS, TYPE_PAGE, TYPE_LABEL, $, $$, esc, safeUrl, md, fmtDate, visitorId, loadSettings, loadFonts, videoEmbed } from "./core.js";
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
  $("#nav").innerHTML = PAGES.map((p) => `<a href="${p.href}" data-k="${p.k}">${p.t}</a>`).join("");
  $("#burger").onclick = () => { const o = $("#nav").classList.toggle("open"); $("#burger").setAttribute("aria-expanded", o); };
}
function markNav(k) { $$("nav.main a").forEach((a) => a.classList.toggle("on", a.dataset.k === k)); }

function applyBrand() {
  const g = S.general || {};
  if (g.logo_url) $(".brand").innerHTML = `<img src="${safeUrl(g.logo_url)}" alt="${esc(g.site_name || "Kıyametin Çocukları")}">`;
  $("#footText").textContent = g.footer || "© İsmet Can Durmuşcan · Kıyametin Çocukları";
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
  q = type === "haber" ? q.order("created_at", { ascending: false }) : q.order("sort", { ascending: true }).order("created_at", { ascending: false });
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
    const [news, books, games, zines, eps, music] = await Promise.all([posts("haber", 3), posts("kitap", 6), posts("oyun", 3), posts("fanzin", 2), posts("frp"), posts("muzik", 3)]);
    const lastEps = [...eps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
    let h = "";
    if (news.length) h += section("Son Haberler", "/haberler", "Tümü", `<div class="lead-news">${newsCard(news[0], true)}${news.length > 1 ? `<div class="stack">${news.slice(1).map((x) => newsCard(x)).join("")}</div>` : ""}</div>`);
    if (books.length) h += section("Seri", "/kitaplar", "Tüm kitaplar", `<div class="books">${books.map(bookCard).join("")}</div>`);
    if (games.length) h += section("Oyunlar", "/oyunlar", "Tümü", `<div class="grid">${games.map(gameCard).join("")}</div>`);
    if (zines.length) h += section("Fanzinler", "/fanzinler", "Tüm sayılar", `<div class="zines">${zines.map(zineCard).join("")}</div>`);
    if (lastEps.length) h += section("FRP Albümü", "/frp", "Tüm bölümler", `<div class="grid">${lastEps.map(epCard).join("")}</div>`);
    if (music.length) h += section("Müzikler", "/muzikler", "Tümü", `<div class="tracks">${music.map(trackRow).join("")}</div>`);
    app.innerHTML = h || empty("Site hazırlanıyor. Çok yakında burada olacağız.");
    fillStats([...news, ...games, ...zines, ...lastEps, ...music].map((x) => x.id));
  },
  async haberler() { await listPage("haberler", "haber", (l) => `<div class="grid">${l.map((x) => newsCard(x)).join("")}</div>`, "Henüz haber yok."); },
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
    if (!cats?.length) { app.innerHTML = empty("Henüz ırk eklenmedi."); return; }
    let cur = params.get("kategori") || cats[0].id;
    if (!cats.some((c) => c.id === cur)) cur = cats[0].id;
    const draw = () => {
      const c = cats.find((x) => x.id === cur);
      const items = (races || []).filter((r) => r.category_id === c.id);
      app.innerHTML = `<section><div class="cats">${cats.map((x) => `<button data-cat="${x.id}" class="${x.id === c.id ? "on" : ""}">${esc(x.name)} <span style="color:var(--gold)">${(races || []).filter((r) => r.category_id === x.id).length}</span></button>`).join("")}</div>
        <div class="cat-block"><h2>${esc(c.name)}</h2>${c.description ? `<div class="cat-desc prose">${md(c.description)}</div>` : ""}
        <div class="grid">${items.map((x) => `<a class="race" href="/irk?id=${x.id}"><div class="portrait">${pic(x.image_url, x.name)}</div><h3>${esc(x.name)}</h3><p>${esc(x.summary)}</p></a>`).join("") || empty("Bu kategoride henüz ırk yok.")}</div></div></section>`;
      $$("[data-cat]").forEach((b) => (b.onclick = () => { cur = b.dataset.cat; history.replaceState(null, "", "?kategori=" + cur); draw(); }));
    };
    draw();
  },
  async irk() {
    const id = params.get("id");
    const { data: x, error } = await sb.from("races").select("*, race_categories(id,name)").eq("id", id).maybeSingle();
    if (error) throw error;
    applyLook("irklar");
    if (!x) { hero("irklar"); app.innerHTML = empty("Bu ırk bulunamadı."); return; }
    const cat = x.race_categories || {};
    hero("irklar", "", { e: `<a href="/irklar?kategori=${cat.id}" style="text-decoration:none">← Irklar · ${esc(cat.name)}</a>`, t: x.name, p: "" });
    const { data: sib } = await sb.from("races").select("id,name").eq("category_id", x.category_id).order("sort");
    app.innerHTML = `<section class="article"><div class="prose">${x.image_url ? `<figure><img src="${safeUrl(x.image_url)}" alt="${esc(x.name)}"></figure>` : ""}${x.summary ? `<p><strong>${esc(x.summary)}</strong></p>` : ""}${md(x.body)}</div>
      <aside class="aside"><h4>Kategori</h4><a href="/irklar?kategori=${cat.id}">${esc(cat.name)}</a><h4>Aynı kategoride</h4>${(sib || []).filter((r) => r.id !== x.id).map((r) => `<a href="/irk?id=${r.id}">${esc(r.name)}</a>`).join("") || '<span class="fine">Başka ırk yok</span>'}</aside></section>`;
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
    let season = null, photos = [], sibs = [];
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
    hero(k, "", { e: back + (season ? " · " + esc(season.title) : ""), t: (x.type === "frp" && x.sort ? x.sort + ". Bölüm: " : "") + x.title, p: "" });
    if (sub) $("#heroIn").insertAdjacentHTML("beforeend", `<p>${sub}</p>`);

    let top = "", side = "";
    const links = (x.links || []).filter((l) => safeUrl(l.url));
    const linkBtns = links.map((l, i) => `<a class="btn${i === 0 ? " seal" : ""}" href="${safeUrl(l.url)}" target="_blank" rel="noopener">${esc(l.label || "Bağlantı")}</a>`).join("");
    const fileUrl = safeUrl(x.file_url);
    if (x.type === "fanzin") {
      top = fileUrl ? `<iframe class="pdf" src="${fileUrl}#view=FitH" title="${esc(x.title)}"></iframe>` : "";
      side = (fileUrl ? `<a class="btn seal" href="${fileUrl}" target="_blank" rel="noopener">PDF'i aç / indir</a>` : "") + linkBtns + (x.meta?.pages ? `<span class="fine">${esc(x.meta.pages)} sayfa</span>` : "");
    } else if (x.type === "muzik") {
      top = x.cover_url ? `<figure><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      top += fileUrl ? `<audio class="audio-full" controls preload="none" src="${fileUrl}"></audio>` : "";
      side = `<span class="pill">${x.meta?.ai ? "AI destekli" : "AI kullanılmadan"}</span>${x.meta?.duration ? `<span class="fine">${esc(x.meta.duration)}</span>` : ""}${linkBtns}`;
    } else if (x.type === "frp") {
      const v = videoEmbed(x.meta?.video || "");
      top = v ? `<div class="video"><iframe src="${v}" title="${esc(x.title)}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe></div>` : x.cover_url ? `<figure><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      if (!v && safeUrl(x.meta?.video)) side += `<a class="btn seal" href="${safeUrl(x.meta.video)}" target="_blank" rel="noopener">Videoyu izle</a>`;
      side += linkBtns;
      if (sibs.length > 1) side += `<h4>Sezonun bölümleri</h4>` + sibs.map((y) => (y.id === x.id ? `<b>${y.sort ? y.sort + ". " : ""}${esc(y.title)}</b>` : `<a href="/icerik?id=${y.id}">${y.sort ? y.sort + ". " : ""}${esc(y.title)}</a>`)).join("");
    } else {
      top = x.cover_url ? `<figure><img src="${safeUrl(x.cover_url)}" alt="${esc(x.title)}"></figure>` : "";
      if (x.type === "kitap") { const st = STATUS[x.meta?.status] || STATUS.yayinda; side = `<span class="pill${st[1]}">${st[0]}</span>`; }
      if (x.type === "oyun" && x.meta?.tag) side = `<span class="pill">${esc(x.meta.tag)}</span>`;
      side += linkBtns + (fileUrl ? `<a class="btn${links.length ? "" : " seal"}" href="${fileUrl}" target="_blank" rel="noopener">${x.type === "oyun" ? "Dosyayı indir" : "Dosyayı aç"}</a>` : "");
    }
    let gallery = "";
    if (photos.length) {
      gallery = `<h2>Masadan fotoğraflar</h2><div class="gallery">${photos.map((p, i) => `<button class="ph" data-ph="${i}" aria-label="Fotoğraf ${i + 1}">${pic(p.url, p.caption)}</button>`).join("")}</div>`;
    }
    let nav = "";
    if (x.type === "frp" && sibs.length > 1) {
      const i = sibs.findIndex((y) => y.id === x.id), pv = sibs[i - 1], nx = sibs[i + 1];
      nav = `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:28px;flex-wrap:wrap">${pv ? `<a class="btn small" href="/icerik?id=${pv.id}">← Önceki bölüm</a>` : "<span></span>"}${nx ? `<a class="btn small" href="/icerik?id=${nx.id}">Sonraki bölüm →</a>` : ""}</div>`;
    }
    app.innerHTML = `<section class="article"><div class="prose"${x.type === "frp" || x.type === "fanzin" ? ' style="max-width:none"' : ""}>${top}${md(x.body)}${gallery}${nav}</div>
      <aside class="aside"><h4>${TYPE_LABEL[x.type]}</h4>${side}<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${likeBtn(x.id)}${ccSpan(x.id, true)}</div></aside></section>
      <section class="comments" id="yorumlar"><div class="sec-head"><h2>Yorumlar</h2></div><div id="cList"><p class="loading">Yükleniyor…</p></div>
       <form class="box" id="commentForm"><label for="c-n">Adın<input type="text" id="c-n" required maxlength="60"></label>
        <label for="c-b">Yorumun<textarea id="c-b" required maxlength="2000"></textarea></label>
        <p class="fine">Yorumlar yazar onayladıktan sonra yayınlanır. Yazdığın isim ve yorum saklanır; kişisel bilgi paylaşma.</p>
        <button class="btn seal" type="submit">Yorumu gönder</button><div id="cOut" aria-live="polite"></div></form></section>`;
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
