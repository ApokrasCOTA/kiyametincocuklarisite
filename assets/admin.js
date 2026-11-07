// Yönetim paneli
import { sb, BUCKET, PAGES, HOME_SECTIONS, homeOrder, WIKI_SECTIONS, HEROES, MOODS, TYPE_LABEL, $, $$, esc, safeUrl, md, fmtDate, loadSettings, loadFonts, publicUrl, safeName } from "./core.js";
import { Emitter, PDEF, SHAPES } from "./particles.js";

const app = $("#app");
const MAX_MB = 50;
let S = {};
let tab = 0;
let paneEmitter = null;
let pendingCount = 0;

const TABS = ["Sayfa görünümü", "Parçacıklar", "Fontlar", "Ana sayfa & anketler", "İçerikler", "Hikayeler", "FRP Albümü", "Wiki", "Yorumlar", "Mesajlar", "Harita", "Genel ayarlar"];
const CTAB = TABS.indexOf("Yorumlar");
const LOOK_PAGES = PAGES;
const PART_PAGES = [...PAGES, { k: "yonetim", t: "Yönetim paneli" }];

/* ---------- Küçük yardımcılar ---------- */
function toast(msg, bad = false) {
  const d = document.createElement("div"); d.textContent = msg; if (bad) d.className = "bad";
  $("#toast").appendChild(d); setTimeout(() => d.remove(), bad ? 6000 : 3200);
}
function errMsg(e) {
  const m = String(e?.message || e || "");
  if (/exceeded|too large|maximum allowed size|Payload too large/i.test(m)) return `Dosya çok büyük. Tek dosya en fazla ${MAX_MB} MB olabilir.`;
  if (/row-level security|permission/i.test(m)) return "Yetki hatası. Çıkış yapıp tekrar giriş yapmayı dene.";
  return "Bir hata oluştu: " + m;
}
async function run(p, okMsg) {
  try { const r = await p; if (r && r.error) throw r.error; if (okMsg) toast(okMsg); return r; }
  catch (e) { console.error(e); toast(errMsg(e), true); return null; }
}
const val = (id) => ($("#" + id)?.value ?? "").trim();
const num = (id) => { const n = parseInt(val(id), 10); return Number.isFinite(n) ? n : 0; };
const linesToLinks = (t) => t.split(/\n/).map((l) => l.split("|").map((x) => x.trim())).filter((a) => a[0] && a[1]).map(([label, url]) => ({ label, url }));
const linksToLines = (a) => (a || []).map((l) => `${l.label} | ${l.url}`).join("\n");
const confirmBox = (msg) => window.confirm(msg);

async function upload(file, folder) {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`exceeded: ${file.name}`);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName(file.name)}`;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const MIME = { glb: "model/gltf-binary", gltf: "model/gltf+json", mp3: "audio/mpeg", pdf: "application/pdf", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf", mp4: "video/mp4", webm: "video/webm", apk: "application/vnd.android.package-archive" };
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: "31536000", upsert: false, contentType: MIME[ext] || file.type || "application/octet-stream" });
  if (error) throw error;
  return publicUrl(path);
}
function pathFromUrl(url) {
  const m = String(url || "").match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}
async function removeFile(url) { const p = pathFromUrl(url); if (p) await sb.storage.from(BUCKET).remove([p]); }

async function saveSetting(key, value) {
  const r = await run(sb.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }), "Kaydedildi.");
  if (r) S[key] = value;
  return !!r;
}

// Yükleme alanı: dosya seçilince hemen yüklenir, adresi gizli alana yazılır
function fileField(id, label, url, accept = "image/*", hint = "") {
  const isImg = accept.startsWith("image");
  return `<div class="drop" data-file="${id}" data-accept="${accept}"><b>${label}</b>
    <div class="cur" id="${id}-cur">${url ? (isImg ? `<img src="${safeUrl(url)}" alt="">` : `<a href="${safeUrl(url)}" target="_blank" rel="noopener">${esc(decodeURIComponent(url.split("/").pop()))}</a>`) + ` <button type="button" class="btn small" data-clear="${id}">Kaldır</button>` : '<span class="fine">Henüz dosya yok</span>'}</div>
    <input type="file" accept="${accept}" id="${id}-in" aria-label="${label}">${hint ? `<span class="fine">${hint}</span>` : ""}
    <input type="hidden" id="${id}" value="${esc(url || "")}"></div>`;
}
function bindFiles(root, folder) {
  $$("[data-file]", root).forEach((box) => {
    const id = box.dataset.file, inp = $("#" + id + "-in", box), isImg = box.dataset.accept.startsWith("image");
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      box.classList.add("busy"); $("#" + id + "-cur").innerHTML = '<span class="fine">Yükleniyor…</span>';
      try {
        const url = await upload(f, folder);
        $("#" + id).value = url;
        $("#" + id + "-cur").innerHTML = (isImg ? `<img src="${url}" alt="">` : `<a href="${url}" target="_blank" rel="noopener">${esc(f.name)}</a>`) + ` <button type="button" class="btn small" data-clear="${id}">Kaldır</button>`;
        box.dispatchEvent(new CustomEvent("uploaded", { bubbles: true, detail: { id, url } }));
      } catch (e) { toast(errMsg(e), true); $("#" + id + "-cur").innerHTML = '<span class="fine">Yüklenemedi</span>'; }
      box.classList.remove("busy"); inp.value = "";
    };
  });
  if (root._clearBound) return;
  root._clearBound = true;
  root.addEventListener("click", (e) => {
    const c = e.target.closest("[data-clear]"); if (!c) return;
    const id = c.dataset.clear; $("#" + id).value = ""; $("#" + id + "-cur").innerHTML = '<span class="fine">Kaldırıldı (kaydetmeyi unutma)</span>';
  });
}

// Metin editörü: araç çubuğu + görsel ekleme + önizleme
function editorHtml(id, value, label = "Metin") {
  return `<div style="display:grid;gap:8px"><label for="${id}">${label}</label>
   <div class="toolbar" data-tb="${id}">
    <button type="button" data-a="**" data-z="**" title="Kalın"><b>K</b></button><button type="button" data-a="*" data-z="*" title="İtalik"><i>İ</i></button>
    <button type="button" data-l="## " title="Ara başlık">Başlık</button><button type="button" data-l="> " title="Alıntı">Alıntı</button>
    <button type="button" data-l="- " title="Liste">Liste</button><button type="button" data-a="||" data-z="||" title="Spoiler: tıklanınca açılan gizli yazı">Spoiler</button>
    <button type="button" data-link="1">Link</button><button type="button" data-img="1">Görsel ekle</button><button type="button" data-prev="1">Önizle</button>
    <input type="file" accept="image/*" hidden data-imgin="${id}"></div>
   <textarea id="${id}" class="tall">${esc(value || "")}</textarea><div class="md-preview prose" id="${id}-pv" hidden></div>
   <p class="help">Paragrafları boş satırla ayır. Görsel ekleyince altına açıklama yazmak için köşeli parantezin içini doldur: ![Açıklama](adres)</p></div>`;
}
function bindEditor(id, folder) {
  const ta = $("#" + id), tb = $(`[data-tb="${id}"]`), fin = $(`[data-imgin="${id}"]`);
  const wrapSel = (a, b) => { const s = ta.selectionStart, e = ta.selectionEnd, t = ta.value.slice(s, e) || "metin"; ta.setRangeText(a + t + b, s, e, "select"); ta.focus(); };
  const lineStart = (p) => { const s = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1; ta.setRangeText(p, s, s, "end"); ta.focus(); };
  tb.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.a) wrapSel(b.dataset.a, b.dataset.z);
    else if (b.dataset.l) lineStart(b.dataset.l);
    else if (b.dataset.link) { const u = prompt("Link adresi (https://…)"); if (u) wrapSel("[", `](${u.trim()})`); }
    else if (b.dataset.img) fin.click();
    else if (b.dataset.prev) { const pv = $("#" + id + "-pv"); pv.hidden = !pv.hidden; ta.hidden = !pv.hidden; if (!pv.hidden) pv.innerHTML = md(ta.value) || '<p class="fine">Boş</p>'; b.textContent = pv.hidden ? "Önizle" : "Düzenle"; }
  };
  fin.onchange = async () => {
    const f = fin.files[0]; if (!f) return;
    toast("Görsel yükleniyor…");
    try { const url = await upload(f, folder); const p = ta.selectionStart; ta.setRangeText(`\n\n![Görsel açıklaması](${url})\n\n`, p, p, "end"); toast("Görsel eklendi. Açıklamasını düzenlemeyi unutma."); }
    catch (e) { toast(errMsg(e), true); }
    fin.value = "";
  };
}

/* ---------- Giriş ---------- */
async function boot() {
  try { S = await loadSettings(); loadFonts(S); } catch (e) { S = {}; }
  if (S.general?.favicon_url) { $$('link[rel~="icon"]').forEach((l) => l.remove()); const l = document.createElement("link"); l.rel = "icon"; l.href = S.general.favicon_url; document.head.appendChild(l); }
  const root = document.documentElement.style;
  root.setProperty("--page-glow", MOODS.yonetim[0]); root.setProperty("--page-tint", MOODS.yonetim[1]);
  new Emitter($("#embers"), () => ({ ...PDEF, ...((S.particles || {}).yonetim || {}) }), true);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return loginView();
  const { data: ok } = await sb.rpc("is_admin");
  if (!ok) { app.innerHTML = `<div class="login box"><h2>Yetkin yok</h2><p>Bu hesap yönetici değil.</p><button class="btn" id="out">Çıkış yap</button></div>`; $("#out").onclick = logout; return; }
  $("#adminTop").innerHTML = `<span>${esc(session.user.email)}</span><a class="btn small" href="/" target="_blank" rel="noopener">Siteyi aç</a><button class="btn small" id="out">Çıkış</button>`;
  $("#out").onclick = logout;
  const h = parseInt(location.hash.slice(1), 10); if (h >= 0 && h < TABS.length) tab = h;
  await refreshPending();
  shell();
}
function loginView() {
  app.innerHTML = `<form class="box login" id="lf"><h2>Yönetim girişi</h2>
    <label for="le">E-posta<input type="email" id="le" required autocomplete="username"></label>
    <label for="lp">Şifre<input type="password" id="lp" required autocomplete="current-password"></label>
    <button class="btn seal" type="submit">Giriş yap</button><div id="lo" aria-live="polite"></div></form>`;
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: val("le"), password: $("#lp").value });
    if (error) { $("#lo").innerHTML = '<div class="err">E-posta ya da şifre hatalı.</div>'; return; }
    location.reload();
  };
}
async function logout() { await sb.auth.signOut(); location.reload(); }
async function refreshPending() {
  const { count } = await sb.from("comments").select("id", { count: "exact", head: true }).eq("approved", false);
  pendingCount = count || 0;
}

function shell() {
  app.innerHTML = `<section class="admin"><aside>${TABS.map((t, i) => `<button data-tab="${i}" class="${i === tab ? "on" : ""}">${t}${i === CTAB && pendingCount ? `<span class="badge">${pendingCount}</span>` : ""}</button>`).join("")}</aside><div class="pane" id="pane"></div></section>`;
  $$("[data-tab]").forEach((b) => (b.onclick = () => { tab = +b.dataset.tab; location.hash = tab; shell(); }));
  if (paneEmitter) { paneEmitter.stop(); paneEmitter = null; }
  const p = $("#pane");
  [lookPane, particlesPane, fontsPane, homePane, contentPane, storyPane, frpPane, racesPane, commentsPane, messagesPane, mapPane, generalPane][tab](p);
}

/* ---------- 0. Sayfa görünümü ---------- */
function lookPane(p, k = p.dataset.k || "anasayfa") {
  p.dataset.k = k;
  const L = (S.pages || {})[k] || {}, d = HEROES[k];
  p.innerHTML = `<h2>Sayfa görünümü</h2><p class="help">Her sayfanın arka planını, üstteki başlık görselini ve başlık yazılarını ayrı ayrı ayarlarsın. Boş bırakılan alanlar varsayılan hâlinde kalır.</p>
   <label for="lk">Sayfa<select id="lk">${LOOK_PAGES.map((x) => `<option value="${x.k}"${x.k === k ? " selected" : ""}>${x.t}</option>`).join("")}</select></label>
   <div class="row">${fileField("l-bg", "Arka plan görseli", L.bg_url)}${fileField("l-hero", "Başlık (header) görseli", L.hero_url)}</div>
   ${fileField("l-vid", "Arka plan videosu (isteğe bağlı, sessiz döngü)", L.video_url, "video/mp4,video/webm", "MP4, 8–15 saniyelik döngü, ideali 3–8 MB. Video varsa arka plan görseli yerine o oynar; telefonda veri tasarrufu açıksa görsel gösterilir.")}
   <label for="l-dim">Arka plan karartma <output id="l-dim-o">${Math.round((L.dim ?? 0.72) * 100)}%</output><input type="range" id="l-dim" min="0" max="0.95" step="0.01" value="${L.dim ?? 0.72}"></label>
   <p class="help">Karartma, arka plan görselinin üstündeki yazıların okunabilmesi için. Görsel çok açık renkliyse artır.</p>
   <div class="row"><label for="l-e">Üst küçük yazı<input type="text" id="l-e" value="${esc(L.eyebrow || "")}" placeholder="${esc(d.e)}"></label>
   <label for="l-t">Başlık<input type="text" id="l-t" value="${esc(L.title || "")}" placeholder="${esc(d.t)}"></label></div>
   <label for="l-p">Alt yazı<input type="text" id="l-p" value="${esc(L.subtitle || "")}" placeholder="${esc(k === "anasayfa" ? "Boşsa Genel ayarlardaki tanıtım yazısı görünür" : d.p)}"></label>
   <div class="acts" style="justify-content:flex-start"><button class="btn seal" id="l-save">Kaydet</button><a class="btn" href="${PAGES.find((x) => x.k === k).href}" target="_blank" rel="noopener">Sayfayı aç</a></div>`;
  bindFiles(p, "gorunum");
  $("#lk").onchange = (e) => lookPane(p, e.target.value);
  $("#l-dim").oninput = (e) => ($("#l-dim-o").textContent = Math.round(e.target.value * 100) + "%");
  $("#l-save").onclick = () => {
    const pages = { ...(S.pages || {}) };
    pages[k] = { bg_url: val("l-bg") || null, video_url: val("l-vid") || null, hero_url: val("l-hero") || null, dim: +$("#l-dim").value, eyebrow: val("l-e"), title: val("l-t"), subtitle: val("l-p") };
    saveSetting("pages", pages);
  };
}

/* ---------- 1. Parçacıklar ---------- */
function particlesPane(p, k = p.dataset.k || "anasayfa") {
  p.dataset.k = k;
  const all = { ...(S.particles || {}) };
  const c = { ...PDEF, ...(all[k] || {}) };
  const rng = (key, lab, min, max, step, unit = "") => `<label for="pp-${key}">${lab} <output id="pp-${key}-o">${c[key]}${unit}</output><input type="range" id="pp-${key}" min="${min}" max="${max}" step="${step}" value="${c[key]}" data-unit="${unit}"></label>`;
  p.innerHTML = `<h2>Parçacıklar</h2><p class="help">Her sayfanın arka planında uçuşan parçacıkları ayrı ayrı ayarlarsın. Değişiklikler aşağıdaki kutuda anında görünür; siteye yansıması için Kaydet'e bas.</p>
   <div class="row"><label for="pp-page">Sayfa<select id="pp-page">${PART_PAGES.map((x) => `<option value="${x.k}"${x.k === k ? " selected" : ""}>${x.t}</option>`).join("")}</select></label>
    <label for="pp-on">Durum<select id="pp-on"><option value="1"${c.on ? " selected" : ""}>Açık</option><option value="0"${!c.on ? " selected" : ""}>Kapalı</option></select></label></div>
   <div class="part-preview"><canvas id="pp-cv"></canvas><span>${PART_PAGES.find((x) => x.k === k).t} · canlı önizleme</span></div>
   <div class="row"><label for="pp-shape">Parçacık<select id="pp-shape">${SHAPES.map(([v, t]) => `<option value="${v}"${c.shape === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>
    <label for="pp-color">Renk<input type="color" id="pp-color" value="${c.color}" class="swatch"></label>
    <label for="pp-dir">Yön<select id="pp-dir"><option value="up"${c.dir === "up" ? " selected" : ""}>Yukarı yükselsin</option><option value="down"${c.dir === "down" ? " selected" : ""}>Aşağı düşsün</option></select></label></div>
   <div id="pp-imgbox"${c.shape === "ozel" ? "" : " hidden"}>${fileField("pp-img", "Parçacık görseli", c.img_url, "image/png,image/webp,image/svg+xml", "Saydam arka planlı PNG önerilir")}</div>
   <div class="row">${rng("count", "Miktar", 0, 200, 1)}${rng("opacity", "Saydamlık (opaklık)", 0, 1, 0.05)}${rng("blur", "Bulanıklık", 0, 8, 0.25, "px")}</div>
   <div class="row">${rng("sBirth", "Doğma boyutu", 0, 12, 0.1, "px")}${rng("sNormal", "Normal boyut", 0.2, 12, 0.1, "px")}${rng("sDeath", "Kaybolma boyutu", 0, 12, 0.1, "px")}</div>
   <div class="row">${rng("speed", "Hız", 0.05, 3, 0.05)}${rng("life", "Ömür", 2, 20, 0.5, " sn")}${rng("drift", "Salınım", 0, 2, 0.05)}</div>
   <div class="acts" style="justify-content:flex-start"><button class="btn seal" id="pp-save">Kaydet</button><button class="btn" id="pp-all">Bu ayarı tüm sayfalara uygula</button><button class="btn" id="pp-reset">Varsayılana döndür</button></div>`;
  if (paneEmitter) paneEmitter.stop();
  paneEmitter = new Emitter($("#pp-cv"), () => c, false);
  bindFiles(p, "parcacik");
  p._pc = c;
  if (!p._upBound) { p._upBound = true; p.addEventListener("uploaded", (e) => { if (e.detail.id === "pp-img" && p._pc) p._pc.img_url = e.detail.url; }); }
  $("#pp-page").onchange = (e) => particlesPane(p, e.target.value);
  $("#pp-on").onchange = (e) => (c.on = e.target.value === "1");
  $("#pp-shape").onchange = (e) => { c.shape = e.target.value; $("#pp-imgbox").hidden = c.shape !== "ozel"; };
  $("#pp-color").oninput = (e) => (c.color = e.target.value);
  $("#pp-dir").onchange = (e) => (c.dir = e.target.value);
  ["count", "opacity", "blur", "sBirth", "sNormal", "sDeath", "speed", "life", "drift"].forEach((key) => {
    const el = $("#pp-" + key); el.oninput = () => { c[key] = +el.value; $("#pp-" + key + "-o").textContent = el.value + el.dataset.unit; };
  });
  const collect = () => ({ ...c, img_url: val("pp-img") || null });
  $("#pp-save").onclick = () => saveSetting("particles", { ...(S.particles || {}), [k]: collect() });
  $("#pp-all").onclick = () => { if (!confirmBox("Bu ayar bütün sayfalara uygulanacak. Emin misin?")) return; const v = collect(); saveSetting("particles", Object.fromEntries(PART_PAGES.map((x) => [x.k, { ...v }]))); };
  $("#pp-reset").onclick = () => { const n = { ...(S.particles || {}) }; delete n[k]; saveSetting("particles", n).then(() => particlesPane(p, k)); };
}

/* ---------- 2. Fontlar ---------- */
async function fontsPane(p) {
  p.innerHTML = '<p class="loading">Yükleniyor…</p>';
  const { data: fonts } = await sb.from("fonts").select("*").order("created_at");
  const f = S.fonts || {};
  const css = (fonts || []).map((x) => `@font-face{font-family:"kc-${x.id}";src:url("${x.url}")}`).join("");
  const opts = (sel, def) => `<option value="">${def}</option>` + (fonts || []).map((x) => `<option value="${x.id}"${x.id === sel ? " selected" : ""}>${esc(x.name)}</option>`).join("");
  p.innerHTML = `<style>${css}</style><h2>Fontlar</h2><p class="help">.ttf, .otf, .woff veya .woff2 dosyası yükle, sonra başlıklarda ve metinde hangisinin kullanılacağını seç. Türkçe harfleri (ğ ş ı İ ö ü ç) içerdiğinden emin ol.</p>
   <div class="row"><label for="fn-name">Font adı<input type="text" id="fn-name" placeholder="Örn. Gotik Başlık"></label><div class="drop"><b>Font dosyası</b><input type="file" id="fn-file" accept=".ttf,.otf,.woff,.woff2"></div></div>
   <div class="row"><label for="fn-h">Başlık fontu<select id="fn-h">${opts(f.heading, "Varsayılan (Cinzel)")}</select></label><label for="fn-b">Metin fontu<select id="fn-b">${opts(f.body, "Varsayılan (EB Garamond)")}</select></label></div>
   <div class="font-sample"><p id="fs-h" style="font-size:32px;margin:0;font-weight:700">KIYAMETİN ÇOCUKLARI · Kıyametin Çocukları</p><p id="fs-b" style="margin:8px 0 0;font-size:19px">Doksan dokuz mühür, uyanmayı bekleyen kadim bir varlık. ğüşıöç ĞÜŞİÖÇ 0123456789</p></div>
   <div class="acts" style="justify-content:flex-start"><button class="btn seal" id="fn-save">Kaydet</button></div>
   <h2>Yüklü fontlar</h2><div>${(fonts || []).map((x) => `<div class="q"><span></span><div><b style="font-family:'kc-${x.id}';font-size:22px">${esc(x.name)}</b><p>ĞÜŞİÖÇ ğüşıöç</p></div><div class="acts"><button class="btn small" data-delfont="${x.id}">Sil</button></div></div>`).join("") || '<p class="fine">Henüz font yüklenmedi.</p>'}</div>`;
  const prev = () => { const h = val("fn-h"), b = val("fn-b"); $("#fs-h").style.fontFamily = h ? `"kc-${h}"` : "Cinzel"; $("#fs-b").style.fontFamily = b ? `"kc-${b}"` : "EB Garamond"; };
  prev(); $("#fn-h").onchange = prev; $("#fn-b").onchange = prev;
  $("#fn-file").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const name = val("fn-name") || file.name.replace(/\.[^.]+$/, "");
    toast("Font yükleniyor…");
    try { const url = await upload(file, "fontlar"); await run(sb.from("fonts").insert({ name, url }), "Font yüklendi."); fontsPane(p); }
    catch (er) { toast(errMsg(er), true); }
  };
  $("#fn-save").onclick = async () => { if (await saveSetting("fonts", { heading: val("fn-h") || null, body: val("fn-b") || null })) loadFonts(S); };
  $$("[data-delfont]", p).forEach((b) => (b.onclick = async () => {
    if (!confirmBox("Bu font silinsin mi?")) return;
    const x = fonts.find((y) => y.id === b.dataset.delfont);
    await run(sb.from("fonts").delete().eq("id", x.id), "Font silindi."); removeFile(x.url);
    if (f.heading === x.id || f.body === x.id) await saveSetting("fonts", { heading: f.heading === x.id ? null : f.heading, body: f.body === x.id ? null : f.body });
    fontsPane(p);
  }));
}

/* ---------- 3. İçerikler ---------- */
const CONTENT_TYPES = ["haber", "blog", "karakter", "oyun", "fanzin", "kitap", "muzik", "model"];
async function contentPane(p, type = p.dataset.type || "haber") {
  p.dataset.type = type;
  p.innerHTML = '<p class="loading">Yükleniyor…</p>';
  let q = sb.from("posts").select("id,title,summary,cover_url,published,sort,created_at,meta").eq("type", type);
  q = type === "haber" || type === "blog" ? q.order("created_at", { ascending: false }) : q.order("sort").order("created_at", { ascending: false });
  const { data } = await q;
  p.innerHTML = `<h2>İçerikler</h2><div class="pills">${CONTENT_TYPES.map((t) => `<button data-ct="${t}" class="${t === type ? "on" : ""}">${TYPE_LABEL[t]}</button>`).join("")}</div>
   <div><button class="btn seal" id="newPost">Yeni ${TYPE_LABEL[type].toLowerCase()} ekle</button></div>
   ${type === "muzik" ? `<div class="box bulk"><b style="font-family:var(--font-display);letter-spacing:.1em">Toplu müzik yükle</b>
     <p class="help">Birden fazla müzik dosyasını aynı anda seç. Her biri ayrı bir müzik olarak eklenir; adı dosyanın adından, süresi dosyadan otomatik alınır. Kapak görselini ve açıklamayı sonra "Düzenle"den ekleyebilirsin.</p>
     <label class="check"><input type="checkbox" id="bk-ai"> Bu müzikler AI destekli (işaretsizse AI'sız bölümüne eklenir)</label>
     <input type="file" id="bk-in" accept="audio/*,.mp3,.wav,.ogg,.m4a" multiple aria-label="Müzik dosyaları">
     <div class="progress" id="bk-prog" hidden><i></i></div><div id="bk-log" class="fine"></div></div>` : ""}
   <div>${postRows(data, type === "kitap")}</div>`;
  $$("[data-ct]", p).forEach((b) => (b.onclick = () => contentPane(p, b.dataset.ct)));
  $("#newPost").onclick = () => postEditor(p, { type }, () => contentPane(p, type));
  if (type === "muzik") $("#bk-in").onchange = (e) => bulkMusic([...e.target.files], data || [], () => contentPane(p, type));
  bindRows(p, data, () => contentPane(p, type));
}
// Müziğin adı = dosyanın adı (uzantı atılır, alt çizgiler boşluğa döner)
function titleFromFile(name) {
  let t = name.replace(/\.[^.]+$/, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return t || name;
}
function audioDuration(file) {
  return new Promise((res) => {
    const au = document.createElement("audio"), url = URL.createObjectURL(file);
    const done = (v) => { URL.revokeObjectURL(url); res(v); };
    au.preload = "metadata";
    au.onloadedmetadata = () => { const s = Math.round(au.duration || 0); done(s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : ""); };
    au.onerror = () => done("");
    setTimeout(() => done(""), 8000);
    au.src = url;
  });
}
async function bulkMusic(files, existing, back) {
  if (!files.length) return;
  const ai = $("#bk-ai").checked, prog = $("#bk-prog"), log = $("#bk-log"), inp = $("#bk-in");
  prog.hidden = false; inp.disabled = true;
  let sort = existing.reduce((m, x) => Math.max(m, x.sort || 0), 0);
  let ok = 0; const fails = [];
  const now = Date.now();
  for (const [i, f] of files.entries()) {
    log.textContent = `Yükleniyor: ${i + 1} / ${files.length} · ${f.name}`;
    try {
      const [url, duration] = await Promise.all([upload(f, "muzik"), audioDuration(f)]);
      const { error } = await sb.from("posts").insert({ type: "muzik", title: titleFromFile(f.name), summary: "", body: "", file_url: url, links: [], meta: { ai, duration }, sort: ++sort, published: true, created_at: new Date(now + i * 1000).toISOString() });
      if (error) throw error;
      ok++;
    } catch (e) { console.error(e); fails.push(f.name + (/exceeded/.test(String(e?.message)) ? ` (${MAX_MB} MB'tan büyük)` : "")); }
    $("i", prog).style.width = ((i + 1) / files.length) * 100 + "%";
  }
  inp.disabled = false;
  toast(`${ok} müzik eklendi.${fails.length ? ` ${fails.length} dosya yüklenemedi.` : ""}`, !!fails.length && !ok);
  if (fails.length) { log.innerHTML = "Yüklenemeyenler: " + fails.map(esc).join(", "); return; }
  back();
}
function postRows(data, showNo = false) {
  return (data || []).map((x) => `<div class="q"><div class="thumb">${x.cover_url ? `<img src="${safeUrl(x.cover_url)}" alt="">` : ""}</div><div><b>${showNo && x.sort ? x.sort + ". " : ""}${esc(x.title)}</b> ${x.published ? "" : '<span class="pill dim">Taslak</span>'}<p>${esc(x.summary || "")} · ${fmtDate(x.created_at)}</p></div>
    <div class="acts"><a class="btn small" href="/icerik?id=${x.id}" target="_blank" rel="noopener">Gör</a><button class="btn small" data-edit="${x.id}">Düzenle</button><button class="btn small" data-del="${x.id}">Sil</button></div></div>`).join("") || '<p class="fine">Henüz içerik yok.</p>';
}
function bindRows(p, data, back) {
  $$("[data-edit]", p).forEach((b) => (b.onclick = async () => { const { data: x } = await sb.from("posts").select("*").eq("id", b.dataset.edit).single(); postEditor(p, x, back); }));
  $$("[data-del]", p).forEach((b) => (b.onclick = async () => {
    const x = data.find((y) => y.id === b.dataset.del);
    if (!confirmBox(`"${x.title}" silinsin mi? Yorumları ve beğenileri de silinir.`)) return;
    if (await run(sb.from("posts").delete().eq("id", x.id), "Silindi.")) back();
  }));
}

function toLocalInput(d) { const t = new Date(d || Date.now()); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 16); }

async function postEditor(p, x, back) {
  const t = x.type, m = x.meta || {}, isNew = !x.id;
  let seasons = [];
  if (t === "frp") seasons = (await sb.from("frp_seasons").select("id,title").order("sort")).data || [];
  let series = [], groups = [];
  if (t === "hikaye") series = (await sb.from("story_series").select("id,title").order("sort")).data || [];
  if (t === "karakter") groups = [...new Set(((await sb.from("posts").select("meta").eq("type", "karakter")).data || []).map((x) => x.meta?.group).filter(Boolean))];
  const sortLabel = t === "kitap" ? "Kitap numarası" : t === "frp" || t === "hikaye" ? "Bölüm numarası" : t === "haber" || t === "blog" ? "Sıra (burada tarih esas alınır)" : "Sıra (küçük sayı önce)";
  const fileAcc = { fanzin: "application/pdf", muzik: "audio/*", oyun: "*/*", haber: "*/*", blog: "*/*", kitap: "*/*", model: ".glb,.gltf,model/gltf-binary" }[t];
  const fileLab = { fanzin: "PDF dosyası", muzik: "Müzik dosyası (MP3)", oyun: "İndirilebilir dosya (APK vb., isteğe bağlı)", haber: "Ek dosya (isteğe bağlı)", blog: "Ek dosya (isteğe bağlı)", kitap: "Ek dosya, örn. ilk bölüm PDF (isteğe bağlı)", model: "3D model dosyası (GLB)" }[t];
  const linkHelp = { kitap: "Satın alma linkleri", oyun: "Oyun linkleri (Google Play, tarayıcıda oyna…)", fanzin: "Ek linkler", muzik: "Ek linkler (Spotify, YouTube…)", haber: "Ek linkler", blog: "Ek linkler", frp: "Ek linkler", hikaye: "Ek linkler", karakter: "Ek linkler", model: "Ek linkler (Sketchfab, baskı dosyası…)" }[t];
  let extra = "";
  if (t === "oyun") extra = `<label for="m-tag">Etiket (kartta görünür)<input type="text" id="m-tag" value="${esc(m.tag || "")}" placeholder="Android · Tarayıcı"></label>
    <label for="m-embed">Sitede oynatılacak oyunun adresi (oyun bu sayfanın içinde açılır)<input type="text" id="m-embed" value="${esc(m.embed || "")}" placeholder="https://apokrascota.github.io/kartsavasi/"></label>`;
  if (t === "hikaye") extra = `<label for="m-series">Seri<select id="m-series"><option value="">Seriye ait değil (tek bölümlük hikaye)</option>${series.map((s) => `<option value="${s.id}"${m.series === s.id ? " selected" : ""}>${esc(s.title)}</option>`).join("")}</select></label>`;
  if (t === "karakter") extra = `<div class="row"><label for="m-epithet">Unvan / lakap (kartta görünür)<input type="text" id="m-epithet" value="${esc(m.epithet || "")}" placeholder="Bilen · Üç Maymun'dan biri"></label>
    <label for="m-group">Grup (karakterler bu başlıklar altında listelenir)<input type="text" id="m-group" list="m-groups" value="${esc(m.group || "")}" placeholder="Protektorlar"><datalist id="m-groups">${groups.map((g) => `<option value="${esc(g)}">`).join("")}</datalist></label></div>
    <div class="row"><label for="m-race">Irk<input type="text" id="m-race" value="${esc(m.race || "")}"></label><label for="m-books">Göründüğü kitaplar<input type="text" id="m-books" value="${esc(m.books || "")}" placeholder="Alogran Çıkmazı, Nur Şahbazları"></label></div>
    <label class="check"><input type="checkbox" id="m-spoiler"${m.spoiler ? " checked" : ""}> Spoiler içeriyor (okur tıklayana kadar portre ve tanıtım gizli kalır)</label>`;
  if (t === "model") extra = `<div class="row"><label for="m-tag">Etiket (kartta görünür)<input type="text" id="m-tag" value="${esc(m.tag || "")}" placeholder="Karakter · Minyatür"></label>
    <label class="check" style="align-self:end"><input type="checkbox" id="m-dl"${m.download ? " checked" : ""}> Ziyaretçiler GLB dosyasını indirebilsin</label></div>
    <p class="help">Model dosyası GLB formatında olmalı (Tripo, Blender vb. "GLB" olarak dışa aktarır), en fazla ${MAX_MB} MB. Kapak görseli listede ve model yüklenirken görünür.</p>`;
  if (t === "fanzin") extra = `<div class="row"><label for="m-pages">Sayfa sayısı<input type="number" id="m-pages" value="${esc(m.pages || "")}"></label><label for="m-idate">Sayı tarihi (kartta görünür)<input type="text" id="m-idate" value="${esc(m.issue_date || "")}" placeholder="Kasım 2026"></label></div>`;
  if (t === "kitap") extra = `<label for="m-status">Durum<select id="m-status">${[["yayinda", "Yayında"], ["yakinda", "Yakında"], ["muhurlu", "Mühürlü (henüz açıklanmadı)"]].map(([v, l]) => `<option value="${v}"${(m.status || "yayinda") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
  if (t === "muzik") extra = `<div class="row"><label class="check"><input type="checkbox" id="m-ai"${m.ai ? " checked" : ""}> AI destekli (işaretli değilse AI'sız bölümünde görünür)</label><label for="m-dur">Süre<input type="text" id="m-dur" value="${esc(m.duration || "")}" placeholder="3:13"></label></div>`;
  if (t === "frp") extra = `<div class="row"><label for="m-season">Sezon<select id="m-season"><option value="">Sezonsuz</option>${seasons.map((s) => `<option value="${s.id}"${m.season === s.id ? " selected" : ""}>${esc(s.title)}</option>`).join("")}</select></label>
    <label for="m-video">Video linki (YouTube veya Twitch)<input type="text" id="m-video" value="${esc(m.video || "")}" placeholder="https://youtube.com/watch?v=…"></label></div>
    <div class="row"><label for="m-dur">Süre<input type="text" id="m-dur" value="${esc(m.duration || "")}" placeholder="3 sa 12 dk"></label><label for="m-players">Oyuncular (kartta görünür)<input type="text" id="m-players" value="${esc(m.players || "")}" placeholder="6 oyuncu"></label></div>`;

  p.innerHTML = `<div class="acts" style="justify-content:space-between"><h2>${isNew ? "Yeni " + TYPE_LABEL[t].toLowerCase() : "Düzenle: " + esc(x.title)}</h2><button class="btn small" id="ed-back">← Listeye dön</button></div>
   <form class="box" id="ed" onsubmit="return false">
    <label for="ed-title">Başlık<input type="text" id="ed-title" required value="${esc(x.title || "")}"></label>
    <label for="ed-sum">Kısa özet (kartlarda görünür)<input type="text" id="ed-sum" value="${esc(x.summary || "")}"></label>
    ${extra}
    <div class="row">${fileField("ed-cover", t === "karakter" ? "Portre (dikey görsel önerilir)" : "Kapak görseli", x.cover_url)}${t !== "frp" && t !== "karakter" && t !== "hikaye" ? fileField("ed-file", fileLab, x.file_url, fileAcc, `En fazla ${MAX_MB} MB`) : ""}</div>
    ${editorHtml("ed-body", x.body, t === "frp" ? "Oturum özeti" : t === "hikaye" ? "Bölümün metni" : t === "karakter" ? "Karakter tanıtımı" : "Metin")}
    <label for="ed-links">${linkHelp}: her satıra bir tane, "Yazı | link" şeklinde<textarea id="ed-links" placeholder="Satın al | https://…">${esc(linksToLines(x.links))}</textarea></label>
    <div class="row"><label for="ed-sort">${sortLabel}<input type="number" id="ed-sort" value="${x.sort ?? 0}"></label><label for="ed-date">Tarih<input type="datetime-local" id="ed-date" value="${toLocalInput(x.created_at)}"></label>
     <label class="check" style="align-self:end"><input type="checkbox" id="ed-pub"${x.published !== false ? " checked" : ""}> Yayında (işaretsizse taslak)</label></div>
    <div class="acts" style="justify-content:flex-start"><button class="btn seal" id="ed-save">${isNew ? "Kaydet ve yayınla" : "Kaydet"}</button></div>
   </form><div id="photosBox"></div>`;
  bindFiles(p, t);
  bindEditor("ed-body", "metin");
  $("#ed-back").onclick = back;
  if (t === "frp" && !isNew) photosManager($("#photosBox"), x.id);
  if (t === "frp" && isNew) $("#photosBox").innerHTML = '<p class="help">Fotoğrafları eklemek için önce bölümü kaydet.</p>';
  $("#ed-save").onclick = async () => {
    if (!val("ed-title")) { toast("Başlık boş olamaz.", true); return; }
    const meta = { ...m };
    if (t === "oyun") { meta.tag = val("m-tag"); meta.embed = val("m-embed"); }
    if (t === "model") { meta.tag = val("m-tag"); meta.download = $("#m-dl").checked; }
    if (t === "hikaye") meta.series = val("m-series") || null;
    if (t === "karakter") { meta.epithet = val("m-epithet"); meta.group = val("m-group"); meta.race = val("m-race"); meta.books = val("m-books"); meta.spoiler = $("#m-spoiler").checked; }
    if (t === "fanzin") { meta.pages = val("m-pages"); meta.issue_date = val("m-idate"); }
    if (t === "kitap") meta.status = val("m-status");
    if (t === "muzik") { meta.ai = $("#m-ai").checked; meta.duration = val("m-dur"); }
    if (t === "frp") { meta.season = val("m-season") || null; meta.video = val("m-video"); meta.duration = val("m-dur"); meta.players = val("m-players"); }
    const row = {
      type: t, title: val("ed-title"), summary: val("ed-sum"), body: $("#ed-body").value, cover_url: val("ed-cover") || null,
      file_url: $("#ed-file") ? val("ed-file") || null : null, links: linesToLinks($("#ed-links").value), meta,
      sort: num("ed-sort"), published: $("#ed-pub").checked, created_at: new Date($("#ed-date").value || Date.now()).toISOString(),
    };
    const r = isNew ? await run(sb.from("posts").insert(row).select().single(), "Kaydedildi.") : await run(sb.from("posts").update(row).eq("id", x.id).select().single(), "Kaydedildi.");
    if (r && isNew && t === "frp") postEditor(p, r.data, back);
    else if (r && isNew) back();
  };
}

async function photosManager(box, postId) {
  const { data } = await sb.from("post_photos").select("*").eq("post_id", postId).order("sort").order("created_at");
  box.innerHTML = `<div class="box" style="display:grid;gap:14px"><h2>Masadan fotoğraflar</h2>
   <div class="drop"><b>Fotoğraf ekle</b><input type="file" id="ph-in" accept="image/*" multiple><span class="fine">Birden fazla fotoğrafı aynı anda seçebilirsin.</span><div class="progress" hidden id="ph-prog"><i></i></div></div>
   <div class="photos">${(data || []).map((x) => `<div class="photo" data-pid="${x.id}"><img src="${safeUrl(x.url)}" alt=""><input type="text" value="${esc(x.caption)}" placeholder="Açıklama" data-cap="${x.id}" aria-label="Fotoğraf açıklaması"><div class="acts" style="justify-content:space-between"><input type="number" value="${x.sort}" data-psort="${x.id}" style="width:70px" aria-label="Sıra"><button class="btn small" data-pdel="${x.id}">Sil</button></div></div>`).join("") || '<p class="fine">Henüz fotoğraf yok.</p>'}</div>
   ${(data || []).length ? '<div><button class="btn seal small" id="ph-save">Açıklamaları ve sırayı kaydet</button></div>' : ""}</div>`;
  $("#ph-in").onchange = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    const prog = $("#ph-prog"); prog.hidden = false; let done = 0; const base = (data || []).length;
    for (const [i, f] of files.entries()) {
      try { const url = await upload(f, "frp"); await sb.from("post_photos").insert({ post_id: postId, url, sort: base + i + 1 }); }
      catch (er) { toast(errMsg(er), true); }
      done++; $("#ph-prog i").style.width = (done / files.length) * 100 + "%";
    }
    toast(`${done} fotoğraf yüklendi.`); photosManager(box, postId);
  };
  $$("[data-pdel]", box).forEach((b) => (b.onclick = async () => {
    if (!confirmBox("Bu fotoğraf silinsin mi?")) return;
    const x = data.find((y) => y.id === b.dataset.pdel);
    await run(sb.from("post_photos").delete().eq("id", x.id), "Silindi."); removeFile(x.url); photosManager(box, postId);
  }));
  const sv = $("#ph-save");
  if (sv) sv.onclick = async () => {
    for (const x of data) await sb.from("post_photos").update({ caption: $(`[data-cap="${x.id}"]`).value.trim(), sort: parseInt($(`[data-psort="${x.id}"]`).value, 10) || 0 }).eq("id", x.id);
    toast("Kaydedildi."); photosManager(box, postId);
  };
}

/* ---------- 4. FRP Albümü ---------- */
async function frpPane(p) {
  p.innerHTML = '<p class="loading">Yükleniyor…</p>';
  const [{ data: seasons }, { data: eps }] = await Promise.all([
    sb.from("frp_seasons").select("*").order("sort").order("created_at"),
    sb.from("posts").select("id,title,summary,cover_url,published,sort,created_at,meta").eq("type", "frp").order("sort"),
  ]);
  const back = () => frpPane(p);
  const groups = [...(seasons || []).map((s) => ({ s, eps: (eps || []).filter((e) => e.meta?.season === s.id) })), { s: null, eps: (eps || []).filter((e) => !(seasons || []).some((s) => s.id === e.meta?.season)) }];
  p.innerHTML = `<h2>FRP Albümü</h2><p class="help">Önce sezon aç, sonra bölüm ekle. Bölümün videosunu, özetini ve fotoğraflarını bölümü düzenlerken eklersin.</p>
   <div class="acts" style="justify-content:flex-start"><button class="btn seal" id="newEp">Yeni bölüm ekle</button><button class="btn" id="newSeason">Yeni sezon</button></div>
   ${groups.filter((g) => g.s || g.eps.length).map((g) => `<div class="box" style="display:grid;gap:6px"><div class="acts" style="justify-content:space-between"><div><b style="font-family:var(--font-display);font-size:18px">${g.s ? esc(g.s.title) : "Sezonsuz bölümler"}</b>${g.s?.description ? `<p class="fine" style="margin:2px 0 0">${esc(g.s.description)}</p>` : ""}</div>${g.s ? `<div class="acts"><button class="btn small" data-sedit="${g.s.id}">Sezonu düzenle</button><button class="btn small" data-sdel="${g.s.id}">Sezonu sil</button></div>` : ""}</div>${postRows(g.eps, true)}</div>`).join("")}`;
  $("#newEp").onclick = () => postEditor(p, { type: "frp", meta: {} }, back);
  $("#newSeason").onclick = () => seasonEditor(p, {}, back);
  $$("[data-sedit]", p).forEach((b) => (b.onclick = () => seasonEditor(p, seasons.find((s) => s.id === b.dataset.sedit), back)));
  $$("[data-sdel]", p).forEach((b) => (b.onclick = async () => { if (!confirmBox("Sezon silinsin mi? Bölümler silinmez, 'Sezonsuz' olarak kalır.")) return; if (await run(sb.from("frp_seasons").delete().eq("id", b.dataset.sdel), "Sezon silindi.")) back(); }));
  bindRows(p, eps || [], back);
}
function seasonEditor(p, s, back) {
  p.innerHTML = `<div class="acts" style="justify-content:space-between"><h2>${s.id ? "Sezonu düzenle" : "Yeni sezon"}</h2><button class="btn small" id="sb">← Geri</button></div>
   <form class="box" onsubmit="return false"><label for="s-t">Sezon adı<input type="text" id="s-t" value="${esc(s.title || "")}" placeholder="1. Sezon · Mühürlerin Gölgesinde"></label>
   <label for="s-d">Açıklama<textarea id="s-d">${esc(s.description || "")}</textarea></label><label for="s-s">Sıra<input type="number" id="s-s" value="${s.sort ?? 0}"></label>
   <div><button class="btn seal" id="s-save">Kaydet</button></div></form>`;
  $("#sb").onclick = back;
  $("#s-save").onclick = async () => {
    if (!val("s-t")) { toast("Sezon adı boş olamaz.", true); return; }
    const row = { title: val("s-t"), description: val("s-d"), sort: num("s-s") };
    if (await run(s.id ? sb.from("frp_seasons").update(row).eq("id", s.id) : sb.from("frp_seasons").insert(row), "Kaydedildi.")) back();
  };
}

/* ---------- 5. Irklar ---------- */
async function racesPane(p) {
  p.innerHTML = '<p class="loading">Yükleniyor…</p>';
  const [{ data: cats }, { data: races }] = await Promise.all([sb.from("race_categories").select("*").order("sort").order("created_at"), sb.from("races").select("id,category_id,name,summary,image_url,sort").order("sort").order("created_at")]);
  const back = () => racesPane(p);
  const secs = [...new Set([...WIKI_SECTIONS, ...(cats || []).map((c) => c.section || "Irklar")])];
  p.innerHTML = `<h2>Wiki</h2><p class="help">Wiki bölümlerden (Ülkeler, Irklar, Tanrılar, Mitler…), bölümler kategorilerden, kategoriler maddelerden oluşur. Önce bir kategori aç ve hangi bölüme ait olduğunu seç, sonra içine madde ekle. Yeni bir bölüm açmak için kategori açarken bölüm adına yeni bir isim yazman yeterli. Madde yazarken başka bir maddenin adını [[Sientum]] şeklinde çift köşeli parantezle yazarsan sitede o maddeye link olur.</p>
   <div><button class="btn seal" id="newCat">Yeni kategori</button></div>
   ${secs.map((sec) => { const sc = (cats || []).filter((c) => (c.section || "Irklar") === sec); if (!sc.length) return `<h3 class="adm-sec">${esc(sec)} <span class="fine">· henüz kategori yok</span></h3>`; return `<h3 class="adm-sec">${esc(sec)}</h3>` + sc.map((c) => `<div class="box" style="display:grid;gap:6px"><div class="acts" style="justify-content:space-between"><b style="font-family:var(--font-display);font-size:18px">${esc(c.name)}</b><div class="acts"><button class="btn small seal" data-radd="${c.id}">Madde ekle</button><button class="btn small" data-cedit="${c.id}">Kategoriyi düzenle</button><button class="btn small" data-cdel="${c.id}">Sil</button></div></div>
     ${(races || []).filter((r) => r.category_id === c.id).map((r) => `<div class="q"><div class="thumb">${r.image_url ? `<img src="${safeUrl(r.image_url)}" alt="">` : ""}</div><div><b>${esc(r.name)}</b><p>${esc(r.summary)}</p></div><div class="acts"><a class="btn small" href="/irk?id=${r.id}" target="_blank" rel="noopener">Gör</a><button class="btn small" data-redit="${r.id}">Düzenle</button><button class="btn small" data-rdel="${r.id}">Sil</button></div></div>`).join("") || '<p class="fine">Bu kategoride madde yok.</p>'}</div>`).join(""); }).join("")}`;
  $("#newCat").onclick = () => catEditor(p, {}, back, secs);
  $$("[data-cedit]", p).forEach((b) => (b.onclick = () => catEditor(p, cats.find((c) => c.id === b.dataset.cedit), back, secs)));
  $$("[data-cdel]", p).forEach((b) => (b.onclick = async () => { if (!confirmBox("Kategori ve içindeki TÜM maddeler silinsin mi?")) return; if (await run(sb.from("race_categories").delete().eq("id", b.dataset.cdel), "Silindi.")) back(); }));
  $$("[data-radd]", p).forEach((b) => (b.onclick = () => raceEditor(p, { category_id: b.dataset.radd }, cats, back)));
  $$("[data-redit]", p).forEach((b) => (b.onclick = async () => { const { data } = await sb.from("races").select("*").eq("id", b.dataset.redit).single(); raceEditor(p, data, cats, back); }));
  $$("[data-rdel]", p).forEach((b) => (b.onclick = async () => { if (!confirmBox("Bu madde silinsin mi?")) return; if (await run(sb.from("races").delete().eq("id", b.dataset.rdel), "Silindi.")) back(); }));
}
function catEditor(p, c, back, secs = WIKI_SECTIONS) {
  p.innerHTML = `<div class="acts" style="justify-content:space-between"><h2>${c.id ? "Kategoriyi düzenle" : "Yeni kategori"}</h2><button class="btn small" id="cb">← Geri</button></div>
   <form class="box" onsubmit="return false"><div class="row"><label for="c-sec">Bölüm<input type="text" id="c-sec" list="c-secs" value="${esc(c.section || "Irklar")}"><datalist id="c-secs">${secs.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></label>
   <label for="c-n">Kategori adı<input type="text" id="c-n" value="${esc(c.name || "")}" placeholder="Lanetliler"></label></div>
   ${editorHtml("c-d", c.description, "Açıklama")}<label for="c-s">Sıra<input type="number" id="c-s" value="${c.sort ?? 0}"></label><div><button class="btn seal" id="c-save">Kaydet</button></div></form>`;
  bindEditor("c-d", "wiki");
  $("#cb").onclick = back;
  $("#c-save").onclick = async () => {
    if (!val("c-n")) { toast("Kategori adı boş olamaz.", true); return; }
    const row = { name: val("c-n"), section: val("c-sec") || "Irklar", description: $("#c-d").value, sort: num("c-s") };
    if (await run(c.id ? sb.from("race_categories").update(row).eq("id", c.id) : sb.from("race_categories").insert(row), "Kaydedildi.")) back();
  };
}
function raceEditor(p, r, cats, back) {
  p.innerHTML = `<div class="acts" style="justify-content:space-between"><h2>${r.id ? "Düzenle: " + esc(r.name) : "Yeni madde"}</h2><button class="btn small" id="rb">← Geri</button></div>
   <form class="box" onsubmit="return false"><div class="row"><label for="r-n">Madde adı<input type="text" id="r-n" value="${esc(r.name || "")}"></label>
    <label for="r-c">Kategori<select id="r-c">${cats.map((c) => `<option value="${c.id}"${c.id === r.category_id ? " selected" : ""}>${esc((c.section || "Irklar") + " › " + c.name)}</option>`).join("")}</select></label></div>
   <label for="r-s">Kısa tanıtım (kartta görünür)<input type="text" id="r-s" value="${esc(r.summary || "")}"></label>
   ${fileField("r-img", "Ana görsel", r.image_url)}
   ${editorHtml("r-b", r.body, "Maddenin metni ve görselleri")}
   <label for="r-o">Sıra<input type="number" id="r-o" value="${r.sort ?? 0}"></label><div><button class="btn seal" id="r-save">Kaydet</button></div></form>`;
  bindFiles(p, "wiki"); bindEditor("r-b", "wiki");
  $("#rb").onclick = back;
  $("#r-save").onclick = async () => {
    if (!val("r-n")) { toast("Madde adı boş olamaz.", true); return; }
    const row = { name: val("r-n"), category_id: val("r-c"), summary: val("r-s"), image_url: val("r-img") || null, body: $("#r-b").value, sort: num("r-o") };
    if (await run(r.id ? sb.from("races").update(row).eq("id", r.id) : sb.from("races").insert(row), "Kaydedildi.")) back();
  };
}

/* ---------- Hikayeler ---------- */
async function storyPane(p) {
  p.innerHTML = '<p class="loading">Yükleniyor…</p>';
  const [{ data: series }, { data: chs }] = await Promise.all([
    sb.from("story_series").select("*").order("sort").order("created_at"),
    sb.from("posts").select("id,title,summary,cover_url,published,sort,created_at,meta").eq("type", "hikaye").order("sort").order("created_at"),
  ]);
  const back = () => storyPane(p);
  const groups = [...(series || []).map((s) => ({ s, items: (chs || []).filter((c) => c.meta?.series === s.id) })), { s: null, items: (chs || []).filter((c) => !(series || []).some((s) => s.id === c.meta?.series)) }];
  p.innerHTML = `<h2>Hikayeler</h2><p class="help">Önce bir seri aç (kapak ve açıklamasıyla), sonra bölüm ekle ve bölümü seriye bağla. Bölüm numarası okuma sırasını belirler. Seriye bağlı olmayan bölümler "tek bölümlük hikaye" olarak görünür.</p>
   <div class="acts" style="justify-content:flex-start"><button class="btn seal" id="newCh">Yeni bölüm ekle</button><button class="btn" id="newSer">Yeni seri</button></div>
   ${groups.filter((g) => g.s || g.items.length).map((g) => `<div class="box" style="display:grid;gap:6px"><div class="acts" style="justify-content:space-between"><div style="display:flex;gap:12px;align-items:center">${g.s?.cover_url ? `<img src="${safeUrl(g.s.cover_url)}" alt="" style="width:44px;height:64px;object-fit:cover;border:1px solid var(--line)">` : ""}<b style="font-family:var(--font-display);font-size:18px">${g.s ? esc(g.s.title) : "Tek bölümlük hikayeler"}</b></div>${g.s ? `<div class="acts"><a class="btn small" href="/seri?id=${g.s.id}" target="_blank" rel="noopener">Gör</a><button class="btn small" data-sedit="${g.s.id}">Seriyi düzenle</button><button class="btn small" data-sdel="${g.s.id}">Seriyi sil</button></div>` : ""}</div>${postRows(g.items, true)}</div>`).join("")}`;
  $("#newCh").onclick = () => postEditor(p, { type: "hikaye", meta: {}, sort: (chs || []).length + 1 }, back);
  $("#newSer").onclick = () => seriesEditor(p, {}, back);
  $$("[data-sedit]", p).forEach((b) => (b.onclick = () => seriesEditor(p, series.find((s) => s.id === b.dataset.sedit), back)));
  $$("[data-sdel]", p).forEach((b) => (b.onclick = async () => { if (!confirmBox("Seri silinsin mi? Bölümler silinmez, tek bölümlük hikaye olarak kalır.")) return; if (await run(sb.from("story_series").delete().eq("id", b.dataset.sdel), "Seri silindi.")) back(); }));
  bindRows(p, chs || [], back);
}
function seriesEditor(p, s, back) {
  p.innerHTML = `<div class="acts" style="justify-content:space-between"><h2>${s.id ? "Seriyi düzenle" : "Yeni seri"}</h2><button class="btn small" id="sb2">← Geri</button></div>
   <form class="box" onsubmit="return false"><label for="ss-t">Seri adı<input type="text" id="ss-t" value="${esc(s.title || "")}"></label>
   ${fileField("ss-cover", "Seri kapağı (dikey görsel önerilir)", s.cover_url)}
   ${editorHtml("ss-d", s.description, "Seri açıklaması")}
   <label for="ss-s">Sıra<input type="number" id="ss-s" value="${s.sort ?? 0}"></label><div><button class="btn seal" id="ss-save">Kaydet</button></div></form>`;
  bindFiles(p, "hikaye"); bindEditor("ss-d", "hikaye");
  $("#sb2").onclick = back;
  $("#ss-save").onclick = async () => {
    if (!val("ss-t")) { toast("Seri adı boş olamaz.", true); return; }
    const row = { title: val("ss-t"), cover_url: val("ss-cover") || null, description: $("#ss-d").value, sort: num("ss-s") };
    if (await run(s.id ? sb.from("story_series").update(row).eq("id", s.id) : sb.from("story_series").insert(row), "Kaydedildi.")) back();
  };
}

/* ---------- Ana sayfa & anketler ---------- */
async function homePane(p) {
  p.innerHTML = '<p class="loading">Yükleniyor…</p>';
  const home = S.home || {};
  let order = homeOrder(home);
  const A = home.announce || {};
  const { data: polls } = await sb.from("polls").select("*").order("sort").order("created_at", { ascending: false });
  const label = Object.fromEntries(HOME_SECTIONS);
  const drawOrder = () => `<div class="order">${order.map((x, i) => `<div class="order-row"><label class="check"><input type="checkbox" data-on="${i}"${x.on ? " checked" : ""}> ${esc(label[x.k])}</label><span class="acts"><button type="button" class="btn small" data-up="${i}"${i === 0 ? " disabled" : ""} aria-label="Yukarı">↑</button><button type="button" class="btn small" data-down="${i}"${i === order.length - 1 ? " disabled" : ""} aria-label="Aşağı">↓</button></span></div>`).join("")}</div>`;
  p.innerHTML = `<h2>Ana sayfa düzeni</h2><p class="help">Ana sayfada hangi bölümlerin hangi sırayla görüneceğini seç. İçeriği olmayan bölümler zaten görünmez.</p>
   <div id="orderBox">${drawOrder()}</div>
   <div><button class="btn seal" id="ord-save">Düzeni kaydet</button></div>
   <h2>Duyuru kutusu</h2><p class="help">Ana sayfada öne çıkan bir kutu: yeni kitap, etkinlik, imza günü… Başlık ve metin boşsa görünmez.</p>
   <form class="box" onsubmit="return false"><div class="row"><label for="a-eb">Üst küçük yazı<input type="text" id="a-eb" value="${esc(A.eyebrow || "")}" placeholder="Yeni"></label><label for="a-t">Başlık<input type="text" id="a-t" value="${esc(A.title || "")}"></label></div>
    ${fileField("a-img", "Görsel (isteğe bağlı)", A.image_url)}
    ${editorHtml("a-body", A.body, "Metin")}
    <div class="row"><label for="a-bl">Düğme yazısı<input type="text" id="a-bl" value="${esc(A.button_label || "")}" placeholder="Hemen oku"></label><label for="a-bu">Düğme linki<input type="text" id="a-bu" value="${esc(A.button_url || "")}" placeholder="https://kiyametincocuklari.net/…"></label></div>
    <div class="acts" style="justify-content:flex-start"><button class="btn seal" id="a-save">Duyuruyu kaydet</button><button class="btn" id="a-clear">Duyuruyu kaldır</button></div></form>
   <h2>Anketler</h2><p class="help">Açık anketler ana sayfada görünür. Her tarayıcıdan bir oy sayılır, ziyaretçi oyunu sonradan değiştirebilir.</p>
   <div><button class="btn seal" id="newPoll">Yeni anket</button></div>
   <div id="pollList">${(polls || []).map((x) => `<div class="box poll-adm" data-pid="${x.id}"><div class="acts" style="justify-content:space-between"><div><b>${esc(x.question)}</b> ${x.active ? '<span class="pill red">Açık</span>' : '<span class="pill dim">Kapalı</span>'}</div><div class="acts"><button class="btn small" data-pedit="${x.id}">Düzenle</button><button class="btn small" data-ptog="${x.id}">${x.active ? "Kapat" : "Yeniden aç"}</button><button class="btn small" data-pdel2="${x.id}">Sil</button></div></div><div class="poll-res" id="res-${x.id}"><span class="fine">Sonuçlar yükleniyor…</span></div></div>`).join("") || '<p class="fine">Henüz anket yok.</p>'}</div>`;
  bindFiles(p, "anasayfa"); bindEditor("a-body", "anasayfa");
  const ob = $("#orderBox");
  ob.onclick = (e) => {
    const up = e.target.closest("[data-up]"), dn = e.target.closest("[data-down]");
    if (up) { const i = +up.dataset.up; [order[i - 1], order[i]] = [order[i], order[i - 1]]; ob.innerHTML = drawOrder(); }
    if (dn) { const i = +dn.dataset.down; [order[i + 1], order[i]] = [order[i], order[i + 1]]; ob.innerHTML = drawOrder(); }
  };
  ob.onchange = (e) => { const c = e.target.closest("[data-on]"); if (c) order[+c.dataset.on].on = c.checked; };
  const saveHome = (patch) => saveSetting("home", { ...(S.home || {}), ...patch });
  $("#ord-save").onclick = () => saveHome({ sections: order });
  $("#a-save").onclick = () => saveHome({ announce: { eyebrow: val("a-eb"), title: val("a-t"), image_url: val("a-img") || null, body: $("#a-body").value, button_label: val("a-bl"), button_url: val("a-bu") } });
  $("#a-clear").onclick = async () => { if (!confirmBox("Duyuru kaldırılsın mı?")) return; if (await saveHome({ announce: {} })) homePane(p); };
  $("#newPoll").onclick = () => pollEditor(p, { options: ["", ""], active: true, show_results: true });
  $$("[data-pedit]", p).forEach((b) => (b.onclick = () => pollEditor(p, polls.find((x) => x.id === b.dataset.pedit))));
  $$("[data-ptog]", p).forEach((b) => (b.onclick = async () => { const x = polls.find((y) => y.id === b.dataset.ptog); if (await run(sb.from("polls").update({ active: !x.active }).eq("id", x.id), x.active ? "Anket kapatıldı." : "Anket açıldı.")) homePane(p); }));
  $$("[data-pdel2]", p).forEach((b) => (b.onclick = async () => { if (!confirmBox("Anket ve bütün oyları silinsin mi?")) return; if (await run(sb.from("polls").delete().eq("id", b.dataset.pdel2), "Anket silindi.")) homePane(p); }));
  for (const x of polls || []) {
    const { data: r } = await sb.rpc("poll_results", { p_poll: x.id, p_visitor: null });
    const total = r?.total || 0, box = $("#res-" + x.id); if (!box) continue;
    box.innerHTML = `<div class="poll-bars">${(x.options || []).map((o, i) => { const n = r?.counts?.[i] || 0, pct = total ? Math.round((n / total) * 100) : 0; return `<div class="pb"><span>${esc(o)}</span><span class="pb-bar"><i style="width:${pct}%"></i></span><span class="pb-n">${n} oy · %${pct}</span></div>`; }).join("")}</div><p class="fine">Toplam ${total} oy</p>`;
  }
}
function pollEditor(p, x) {
  p.innerHTML = `<div class="acts" style="justify-content:space-between"><h2>${x.id ? "Anketi düzenle" : "Yeni anket"}</h2><button class="btn small" id="pb2">← Geri</button></div>
   <form class="box" onsubmit="return false"><label for="pl-q">Soru<input type="text" id="pl-q" value="${esc(x.question || "")}" placeholder="Bir sonraki kitapta en çok kimi görmek istersin?"></label>
   <label for="pl-o">Seçenekler: her satıra bir tane<textarea id="pl-o" placeholder="Wira&#10;Hanjab&#10;Ateş">${esc((x.options || []).filter(Boolean).join("\n"))}</textarea></label>
   ${x.id ? '<p class="help">Oy verilmiş bir anketin seçeneklerinin sırasını değiştirme; oylar sıraya göre sayılır. Yeni seçeneği en alta ekle.</p>' : ""}
   <div class="row"><label class="check"><input type="checkbox" id="pl-a"${x.active !== false ? " checked" : ""}> Açık (ana sayfada görünsün)</label><label class="check"><input type="checkbox" id="pl-r"${x.show_results !== false ? " checked" : ""}> Oy verenler sonuçları görsün</label></div>
   <label for="pl-s">Sıra<input type="number" id="pl-s" value="${x.sort ?? 0}"></label>
   <div><button class="btn seal" id="pl-save">Kaydet</button></div></form>`;
  $("#pb2").onclick = () => homePane(p);
  $("#pl-save").onclick = async () => {
    const opts = $("#pl-o").value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!val("pl-q")) { toast("Soru boş olamaz.", true); return; }
    if (opts.length < 2) { toast("En az iki seçenek yaz.", true); return; }
    const row = { question: val("pl-q"), options: opts, active: $("#pl-a").checked, show_results: $("#pl-r").checked, sort: num("pl-s") };
    if (await run(x.id ? sb.from("polls").update(row).eq("id", x.id) : sb.from("polls").insert(row), "Kaydedildi.")) homePane(p);
  };
}

/* ---------- 6. Yorumlar ---------- */
async function commentsPane(p, mode = p.dataset.mode || "bekleyen") {
  p.dataset.mode = mode;
  p.innerHTML = '<p class="loading">Yükleniyor…</p>';
  const { data } = await sb.from("comments").select("*, posts(id,title,type)").eq("approved", mode === "onayli").order("created_at", { ascending: false }).limit(200);
  p.innerHTML = `<h2>Yorumlar</h2><div class="pills"><button data-m="bekleyen" class="${mode === "bekleyen" ? "on" : ""}">Onay bekleyen${pendingCount ? " (" + pendingCount + ")" : ""}</button><button data-m="onayli" class="${mode === "onayli" ? "on" : ""}">Yayında</button></div>
   ${mode === "bekleyen" && (data || []).length > 1 ? '<div><button class="btn small seal" id="appAll">Hepsini onayla</button></div>' : ""}
   <div>${(data || []).map((c) => `<div class="q"><span></span><div><b>${esc(c.name)}</b> <span class="fine">· <a href="/icerik?id=${c.posts?.id}#yorumlar" target="_blank" rel="noopener">${esc(c.posts?.title || "")}</a> · ${fmtDate(c.created_at)}</span><p>${esc(c.body)}</p></div>
     <div class="acts">${mode === "bekleyen" ? `<button class="btn small seal" data-ap="${c.id}">Onayla</button>` : `<button class="btn small" data-un="${c.id}">Yayından kaldır</button>`}<button class="btn small" data-cd="${c.id}">Sil</button></div></div>`).join("") || `<p class="fine">${mode === "bekleyen" ? "Onay bekleyen yorum yok." : "Yayında yorum yok."}</p>`}</div>`;
  const re = async () => { await refreshPending(); const b = $(`[data-tab="${CTAB}"]`); if (b) b.innerHTML = TABS[CTAB] + (pendingCount ? `<span class="badge">${pendingCount}</span>` : ""); commentsPane(p, mode); };
  $$("[data-m]", p).forEach((b) => (b.onclick = () => commentsPane(p, b.dataset.m)));
  $$("[data-ap]", p).forEach((b) => (b.onclick = async () => { if (await run(sb.from("comments").update({ approved: true }).eq("id", b.dataset.ap), "Onaylandı.")) re(); }));
  $$("[data-un]", p).forEach((b) => (b.onclick = async () => { if (await run(sb.from("comments").update({ approved: false }).eq("id", b.dataset.un), "Yayından kaldırıldı.")) re(); }));
  $$("[data-cd]", p).forEach((b) => (b.onclick = async () => { if (!confirmBox("Yorum silinsin mi?")) return; if (await run(sb.from("comments").delete().eq("id", b.dataset.cd), "Silindi.")) re(); }));
  const all = $("#appAll");
  if (all) all.onclick = async () => { if (await run(sb.from("comments").update({ approved: true }).in("id", data.map((c) => c.id)), "Hepsi onaylandı.")) re(); };
}

/* ---------- 7. Mesajlar ---------- */
async function messagesPane(p) {
  p.innerHTML = '<p class="loading">Yükleniyor…</p>';
  const { data } = await sb.from("messages").select("*").order("created_at", { ascending: false }).limit(300);
  p.innerHTML = `<h2>Gelen mesajlar</h2><div>${(data || []).map((m) => `<div class="q"><span>${m.is_read ? "" : '<span class="pill red">Yeni</span>'}</span><div><b>${esc(m.name)}</b> <span class="fine">${m.contact ? "· " + esc(m.contact) : ""} · ${fmtDate(m.created_at)}</span><p style="white-space:pre-wrap">${esc(m.body)}</p></div>
    <div class="acts">${m.is_read ? "" : `<button class="btn small" data-rd="${m.id}">Okundu</button>`}<button class="btn small" data-md="${m.id}">Sil</button></div></div>`).join("") || '<p class="fine">Henüz mesaj yok.</p>'}</div>`;
  $$("[data-rd]", p).forEach((b) => (b.onclick = async () => { if (await run(sb.from("messages").update({ is_read: true }).eq("id", b.dataset.rd))) messagesPane(p); }));
  $$("[data-md]", p).forEach((b) => (b.onclick = async () => { if (!confirmBox("Mesaj silinsin mi?")) return; if (await run(sb.from("messages").delete().eq("id", b.dataset.md), "Silindi.")) messagesPane(p); }));
}

/* ---------- 8. Harita ---------- */
function mapPane(p) {
  const m = S.map || {};
  p.innerHTML = `<h2>Evrenin Haritası</h2>
   <p class="help">PNG, JPG ya da WEBP harita dosyanı seç. Panel haritayı bu bilgisayarda küçük parçalara böler ve siteye yükler. Büyük haritalarda bu birkaç dakika sürebilir; bitene kadar sekmeyi kapatma. Telefondan değil bilgisayardan yükle.</p>
   ${m.base ? `<div class="notice">Şu anki harita: ${m.w}×${m.h} piksel, ${m.count || "?"} parça · ${fmtDate(m.updated)} <a href="/harita" target="_blank" rel="noopener">Haritayı aç</a></div>` : '<div class="notice">Henüz harita yüklenmedi.</div>'}
   <div class="drop"><b>Harita dosyası</b><input type="file" id="mp-in" accept="image/png,image/jpeg,image/webp"></div>
   <div id="mp-st" hidden style="display:grid;gap:8px"><span id="mp-txt" class="fine"></span><div class="progress"><i id="mp-bar"></i></div></div>`;
  $("#mp-in").onchange = (e) => { const f = e.target.files[0]; if (f) buildMap(f, p); };
}
async function buildMap(file, p) {
  const st = $("#mp-st"), txt = $("#mp-txt"), bar = $("#mp-bar");
  st.hidden = false; $("#mp-in").disabled = true;
  const say = (t) => (txt.textContent = t);
  let bmp;
  try { say("Harita açılıyor…"); bmp = await createImageBitmap(file); }
  catch (e) { say("Görsel açılamadı. Dosya çok büyük olabilir ya da bozuk olabilir."); $("#mp-in").disabled = false; return; }
  const W = bmp.width, H = bmp.height, T = 512;
  const mz = Math.max(0, Math.ceil(Math.log2(Math.max(W, H) / T)));
  const jobs = [];
  for (let z = 0; z <= mz; z++) { const f = 2 ** (mz - z); const cols = Math.ceil(W / f / T), rows = Math.ceil(H / f / T); for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) jobs.push({ z, x, y, f }); }
  const ver = "v" + Date.now(), dir = `harita/${ver}`;
  const cv = document.createElement("canvas"); cv.width = cv.height = T;
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const webp = await new Promise((r) => cv.toBlob((b) => r(!!b && b.type === "image/webp"), "image/webp", 0.8));
  const ext = webp ? "webp" : "jpg", mime = webp ? "image/webp" : "image/jpeg";
  let done = 0, failed = 0, i = 0;
  const render = (j) => new Promise((res) => {
    ctx.clearRect(0, 0, T, T);
    if (!webp) { ctx.fillStyle = "#0e0d0b"; ctx.fillRect(0, 0, T, T); }
    const sx = j.x * T * j.f, sy = j.y * T * j.f, sw = Math.min(T * j.f, W - sx), sh = Math.min(T * j.f, H - sy);
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw / j.f, sh / j.f);
    cv.toBlob(res, mime, 0.85);
  });
  say(`${jobs.length} parça hazırlanıyor ve yükleniyor…`);
  const worker = async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      const blob = await render(j);
      let ok = false;
      for (let a = 0; a < 3 && !ok; a++) { const { error } = await sb.storage.from(BUCKET).upload(`${dir}/${j.z}/${j.x}_${j.y}.${ext}`, blob, { contentType: mime, cacheControl: "31536000", upsert: true }); ok = !error; }
      if (!ok) failed++;
      done++; bar.style.width = (done / jobs.length) * 100 + "%"; say(`Yükleniyor: ${done} / ${jobs.length} parça${failed ? ` (${failed} hata)` : ""}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  bmp.close?.();
  if (failed) { say(`${failed} parça yüklenemedi. İnternet bağlantını kontrol edip haritayı tekrar yükle.`); $("#mp-in").disabled = false; return; }
  const old = S.map || {};
  const base = publicUrl(dir);
  if (await saveSetting("map", { base, w: W, h: H, maxZoom: mz, tile: T, ext, count: jobs.length, updated: new Date().toISOString(), dir })) {
    say("Harita yüklendi. Eski harita dosyaları temizleniyor…");
    if (old.dir) await cleanupMap(old.dir, old.maxZoom);
    mapPane(p);
  }
}
async function cleanupMap(dir, mz) {
  for (let z = 0; z <= (mz ?? 8); z++) {
    for (let page = 0; page < 20; page++) {
      const { data } = await sb.storage.from(BUCKET).list(`${dir}/${z}`, { limit: 1000 });
      if (!data?.length) break;
      await sb.storage.from(BUCKET).remove(data.map((f) => `${dir}/${z}/${f.name}`));
    }
  }
}

/* ---------- 9. Genel ayarlar ---------- */
function generalPane(p) {
  const g = S.general || {}, a = S.about || {}, c = S.contact || {};
  p.innerHTML = `<h2>Genel</h2><form class="box" onsubmit="return false">
    <label for="g-name">Site adı<input type="text" id="g-name" value="${esc(g.site_name || "")}"></label>
    <div class="row">${fileField("g-logo", "Logo (boşsa mühür ve yazı görünür)", g.logo_url)}${fileField("g-fav", "Sekme simgesi (kare PNG, en az 64×64)", g.favicon_url, "image/png,image/svg+xml,image/x-icon,image/webp")}</div>
    <label for="g-intro">Ana sayfa tanıtım yazısı<textarea id="g-intro">${esc(g.intro || "")}</textarea></label>
    <label for="g-foot">Alt bilgi yazısı<input type="text" id="g-foot" value="${esc(g.footer || "")}"></label>
    <div><button class="btn seal" id="g-save">Kaydet</button></div></form>
   <h2>Hakkımda sayfası</h2><form class="box" onsubmit="return false">
    <div class="row"><label for="a-name">İsim<input type="text" id="a-name" value="${esc(a.name || "")}"></label>${fileField("a-photo", "Fotoğraf", a.photo_url)}</div>
    ${editorHtml("a-body", a.body, "Biyografi")}
    <label for="a-works">Yayınlar: her satıra bir tane, "Eser adı | not"<textarea id="a-works">${esc((a.works || []).map((w) => `${w.title} | ${w.note}`).join("\n"))}</textarea></label>
    <div><button class="btn seal" id="a-save">Kaydet</button></div></form>
   <h2>İletişim sayfası</h2><form class="box" onsubmit="return false">
    ${editorHtml("c-body", c.body, "Üst yazı")}
    <label for="c-soc">Bağlantılar: her satıra bir tane, "Ad | link | yanında görünecek not"<textarea id="c-soc" placeholder="YouTube | https://youtube.com/@… | Kanalım">${esc((c.socials || []).map((s) => [s.label, s.url, s.note].filter((v) => v !== undefined && v !== "").join(" | ")).join("\n"))}</textarea></label>
    <div><button class="btn seal" id="c-save">Kaydet</button></div></form>`;
  bindFiles(p, "genel"); bindEditor("a-body", "genel"); bindEditor("c-body", "genel");
  $("#g-save").onclick = () => saveSetting("general", { ...g, site_name: val("g-name"), logo_url: val("g-logo") || null, favicon_url: val("g-fav") || null, intro: $("#g-intro").value.trim(), footer: val("g-foot") });
  $("#a-save").onclick = () => saveSetting("about", { ...a, name: val("a-name"), photo_url: val("a-photo") || null, body: $("#a-body").value, works: $("#a-works").value.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[0]).map(([title, note = ""]) => ({ title, note })) });
  $("#c-save").onclick = () => saveSetting("contact", { ...c, body: $("#c-body").value, socials: $("#c-soc").value.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[0] && x[1]).map(([label, url, note = ""]) => ({ label, url, note })) });
}

boot();
