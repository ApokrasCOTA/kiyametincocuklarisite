// Ortak yardımcılar: Supabase bağlantısı, ayarlar, fontlar, metin biçimlendirme
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://tcccdknqlcztlvthugbu.supabase.co";
export const SUPABASE_KEY = "sb_publishable_17x2Eka110Xm6RpXnicUNg_Ubz-qtk7";
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
export const BUCKET = "media";

export const PAGES = [
  { k: "anasayfa", t: "Ana Sayfa", href: "/" },
  { k: "haberler", t: "Haberler", href: "/haberler", type: "haber" },
  { k: "oyunlar", t: "Oyunlar", href: "/oyunlar", type: "oyun" },
  { k: "fanzinler", t: "Fanzinler", href: "/fanzinler", type: "fanzin" },
  { k: "kitaplar", t: "Kitaplar", href: "/kitaplar", type: "kitap" },
  { k: "harita", t: "Evrenin Haritası", href: "/harita" },
  { k: "muzikler", t: "Müzikler", href: "/muzikler", type: "muzik" },
  { k: "frp", t: "FRP Albümü", href: "/frp", type: "frp" },
  { k: "irklar", t: "Irklar", href: "/irklar" },
  { k: "hakkimda", t: "Hakkımda", href: "/hakkimda" },
  { k: "iletisim", t: "İletişim", href: "/iletisim" },
];
export const ADMIN_PAGE = { k: "yonetim", t: "Yönetim paneli" };
export const TYPE_PAGE = { haber: "haberler", oyun: "oyunlar", fanzin: "fanzinler", kitap: "kitaplar", muzik: "muzikler", frp: "frp" };
export const TYPE_LABEL = { haber: "Haber", oyun: "Oyun", fanzin: "Fanzin", kitap: "Kitap", muzik: "Müzik", frp: "FRP Bölümü" };

// Varsayılan sayfa başlıkları ve atmosferi (panelden değiştirilebilir)
export const HEROES = {
  anasayfa: { e: "10 kitaplık destansı fantastik seri", t: "Kıyametin Çocukları", p: "" },
  haberler: { e: "Duyurular", t: "Haberler", p: "Yeni kitaplar, oyun güncellemeleri ve evrenden son gelişmeler." },
  oyunlar: { e: "Oyna", t: "Oyunlar", p: "Kıyametin Çocukları evreninde geçen oyunlar: indir, tarayıcıda oyna ya da masaya kur." },
  fanzinler: { e: "E-dergiler", t: "Fanzinler", p: "Evrenden öyküler, çizimler ve söyleşiler. Sitede oku ya da PDF olarak indir." },
  kitaplar: { e: "Seri", t: "Kitaplar", p: "On kitap. Açılan her mühür bir sonrakine giden yolu gösterir." },
  harita: { e: "Atlas", t: "Evrenin Haritası", p: "Sürükleyerek gez, tekerlek ya da iki parmakla yakınlaştır." },
  muzikler: { e: "Ses", t: "Müzikler", p: "Evrenin müzikleri, AI destekli ve AI kullanılmadan üretilenler olarak iki ayrı bölümde." },
  frp: { e: "Masadan kayıtlar", t: "FRP Albümü", p: "Oynadığımız oturumlar sezon sezon, bölüm bölüm: videolar, masadan fotoğraflar ve her bölümün özeti." },
  irklar: { e: "Halklar ve soylar", t: "Irklar", p: "Evrende yaşayan ırklar, kategorilerine göre." },
  hakkimda: { e: "Yazar", t: "Hakkımda", p: "Kıyametin Çocukları evreninin yaratıcısı." },
  iletisim: { e: "Yazara ulaş", t: "İletişim", p: "Soruların, önerilerin ve iş birliği teklifleri için." },
  yonetim: { e: "Sadece sen görürsün", t: "Yönetim Paneli", p: "" },
};
export const MOODS = {
  anasayfa: ["rgba(158,36,32,.40)", "#2a120f"],
  haberler: ["rgba(200,162,78,.22)", "#1d1710"],
  oyunlar: ["rgba(70,110,160,.30)", "#10161f"],
  fanzinler: ["rgba(170,120,60,.30)", "#21170e"],
  kitaplar: ["rgba(158,36,32,.30)", "#24110e"],
  harita: ["rgba(80,130,110,.28)", "#0f1714"],
  muzikler: ["rgba(120,70,150,.30)", "#181020"],
  frp: ["rgba(60,140,120,.26)", "#0e1715"],
  irklar: ["rgba(190,70,40,.32)", "#22110b"],
  hakkimda: ["rgba(158,36,32,.28)", "#1c100d"],
  iletisim: ["rgba(200,162,78,.18)", "#16130f"],
  yonetim: ["rgba(158,36,32,.25)", "#160f0d"],
};

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? esc(u) : "");

const TR_DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
export const fmtDate = (d) => (d ? TR_DATE.format(new Date(d)) : "");

export function visitorId() {
  try {
    let v = localStorage.getItem("kc_visitor");
    if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem("kc_visitor", v); }
    return v;
  } catch { return "gecici-" + String(Math.random()).slice(2, 12); }
}

// Mini biçimlendirme: paragraf, ## başlık, **kalın**, *italik*, > alıntı, - liste, ||spoiler||, [yazı](link), ![açıklama](görsel)
function inline(s) {
  return s
    .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" tabindex="0" role="button" title="Spoiler: göstermek için tıkla">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
export function md(src = "") {
  const lines = esc(src).split(/\r?\n/);
  let html = "", para = [], list = null;
  const flushP = () => { if (para.length) { html += "<p>" + inline(para.join("<br>")) + "</p>"; para = []; } };
  const flushL = () => { if (list) { html += "<ul>" + list.map((li) => "<li>" + inline(li) + "</li>").join("") + "</ul>"; list = null; } };
  for (const raw of lines) {
    const t = raw.trim();
    let m;
    if (!t) { flushP(); flushL(); continue; }
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { flushP(); flushL(); const n = Math.min(4, m[1].length + 1); html += `<h${n}>${inline(m[2])}</h${n}>`; continue; }
    if ((m = t.match(/^!\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/))) { flushP(); flushL(); html += `<figure><img src="${m[2]}" alt="${m[1]}" loading="lazy">${m[1] ? `<figcaption>${inline(m[1])}</figcaption>` : ""}</figure>`; continue; }
    if ((m = t.match(/^&gt;\s?(.*)$/))) { flushP(); flushL(); html += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
    if ((m = t.match(/^[-*]\s+(.*)$/))) { flushP(); (list ||= []).push(m[1]); continue; }
    flushL(); para.push(t);
  }
  flushP(); flushL();
  return html;
}

let settingsCache = null;
export async function loadSettings(force = false) {
  if (settingsCache && !force) return settingsCache;
  const { data, error } = await sb.from("settings").select("key,value");
  if (error) throw error;
  settingsCache = Object.fromEntries((data || []).map((r) => [r.key, r.value || {}]));
  return settingsCache;
}

export async function loadFonts(settings) {
  const f = settings.fonts || {};
  const ids = [f.heading, f.body].filter(Boolean);
  const root = document.documentElement.style;
  if (!ids.length) { root.removeProperty("--font-display"); root.removeProperty("--font-body"); return []; }
  const { data } = await sb.from("fonts").select("*").in("id", ids);
  const css = (data || []).map((x) => `@font-face{font-family:"kc-${x.id}";src:url("${x.url}");font-display:swap}`).join("\n");
  let st = document.getElementById("kc-fonts");
  if (!st) { st = document.createElement("style"); st.id = "kc-fonts"; document.head.appendChild(st); }
  st.textContent = css;
  if (f.heading) root.setProperty("--font-display", `"kc-${f.heading}","Cinzel",Georgia,serif`);
  if (f.body) root.setProperty("--font-body", `"kc-${f.body}","EB Garamond",Georgia,serif`);
  return data || [];
}

export function publicUrl(path) {
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Dosya adı Türkçe karakter ve boşluk içerse de güvenli hale gelir
export function safeName(name) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };
  const base = String(name).replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c]).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80);
  return base || "dosya";
}

// Video linkinden gömülebilir oynatıcı adresi
export function videoEmbed(url) {
  if (!url) return "";
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/))) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  const host = location.hostname || "kiyametincocuklari.net";
  const parents = [...new Set([host, "kiyametincocuklari.net", "www.kiyametincocuklari.net"])].map((p) => "parent=" + p).join("&");
  if ((m = url.match(/twitch\.tv\/videos\/(\d+)/))) return `https://player.twitch.tv/?video=${m[1]}&${parents}&autoplay=false`;
  if ((m = url.match(/twitch\.tv\/([\w]+)\/?$/))) return `https://player.twitch.tv/?channel=${m[1]}&${parents}&autoplay=false`;
  return "";
}
