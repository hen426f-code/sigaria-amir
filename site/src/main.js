import './styles.css';
import templateHtml from './template.html?raw';
import { initHero3D } from './hero3d.js';
import { supabase, exportDataFile, importDataFile, resetToSeed } from './store.js';
import heroPhoto from './assets/images/image copy 3.png';
import productPhotoOne from './assets/images/image.png';
import productPhotoTwo from './assets/images/image copy.png';
import productPhotoThree from './assets/images/image copy 2.png';

const suppliedImages = [productPhotoOne, productPhotoTwo, productPhotoThree];

// Inject template into app
document.getElementById('app').innerHTML = templateHtml;

let data = { settings: {}, categories: [], products: [] };
const picked = {};

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}
function fmt(n) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(Number(n) || 0);
}
function toast(t) {
  const el = document.getElementById('toast');
  el.textContent = t;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1600);
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }

/* ===== Data Loading ===== */
async function loadData() {
  const [settingsRes, catsRes, prodsRes] = await Promise.all([
    supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('products').select('*, product_flavors(*)').order('sort_order'),
  ]);

  data.settings = settingsRes.data || {};
  data.categories = (catsRes.data || []).map(c => c.name);
  data.products = (prodsRes.data || []).map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.price,
    oldPrice: p.old_price,
    category: p.category,
    brand: p.brand,
    stock: p.stock,
    badge: p.badge,
    desc: p.description,
    image: p.image_url,
    flavors: (p.product_flavors || []).sort((a, b) => a.sort_order - b.sort_order).map(f => ({ id: f.id, n: f.name, out: f.out })),
  }));
}

/* ===== WhatsApp ===== */
function waNumber() { return String(data.settings.whatsapp || '').replace(/\D/g, ''); }
function waLink(text) { const n = waNumber(); return n ? 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '') : '#'; }
function waGeneral() { return waLink('שלום, הגעתי מהקטלוג הסיטונאי של ' + (data.settings.business_name || '') + ' ואשמח לפרטים ומחירון.'); }
function waProduct(id) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  const sel = [...(picked[id] || [])];
  let t = 'שלום, אני מעוניין להזמין מהקטלוג הסיטונאי.\n\nמוצר: ' + p.name + '\nמק״ט: ' + (p.sku || '—');
  if (sel.length) t += '\nטעמים: ' + sel.join(', ');
  t += '\nכמות: ';
  window.open(waLink(t), '_blank');
}

/* ===== Flavor Picking ===== */
function pickFlavor(id, name) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  const f = (p.flavors || []).find(x => x.n === name);
  if (!f || f.out) return;
  if (!picked[id]) picked[id] = new Set();
  picked[id].has(name) ? picked[id].delete(name) : picked[id].add(name);
  renderProducts();
}
function flavorChips(p) {
  const list = p.flavors || [];
  if (!list.length) return '';
  const sel = picked[p.id] || new Set();
  const chips = list.map(f => {
    const cls = 'flav' + (f.out ? ' out' : '') + (sel.has(f.n) ? ' on' : '');
    const click = f.out ? '' : ` onclick="pickFlavor('${p.id}','${esc(f.n).replace(/'/g, "\\'")}')`;
    const ttl = f.out ? ' title="אזל מהמלאי"' : '';
    return `<span class="${cls}"${click}${ttl}>${esc(f.n)}${f.out ? ' ✕' : ''}</span>`;
  }).join('');
  const avail = list.filter(f => !f.out).length;
  return `<div class="flavHead">טעמים <small>${avail} מתוך ${list.length} במלאי</small></div><div class="flavs">${chips}</div>`;
}

/* ===== Rendering ===== */
function applySettings() {
  const s = data.settings;
  const heroImage = document.getElementById('heroImage');
  if (heroImage && !heroImage.src) heroImage.src = heroPhoto;
  if (s.primary_color) document.documentElement.style.setProperty('--primary', s.primary_color);
  if (s.secondary_color) document.documentElement.style.setProperty('--secondary', s.secondary_color);
  if (s.accent_color) document.documentElement.style.setProperty('--accent', s.accent_color);

  setText('brandNameTop', s.business_name);
  setText('brandSubTop', s.business_sub);
  setText('heroEyebrow', s.hero_eyebrow);
  setHTML('heroTitle', esc(s.hero_title || '').replace(/\. /g, '.<br>'));
  setText('heroText', s.hero_text);
  setText('aboutTitle', s.about_title);
  setText('aboutText', s.about_text);
  setText('footerBrand', s.business_name);
  setText('footerText', s.footer_text);

  const lm = document.getElementById('logoMark');
  if (s.logo) {
    lm.innerHTML = `<img src="${esc(s.logo)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;
  } else {
    lm.textContent = (s.business_name || 'N').trim().charAt(0).toUpperCase();
  }

  document.querySelectorAll('.waLink').forEach(a => {
    a.href = waGeneral();
    a.classList.toggle('hidden', !waNumber());
  });
  setText('footerPhone', s.phone);
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val || ''; }
function setHTML(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val || ''; }

function renderCategories() {
  const box = document.getElementById('categoryCards');
  const icons = ['◈', '✦', '⬡', '✺'];
  box.innerHTML = data.categories.map((c, i) =>
    `<div class="cat" onclick="filterCategory('${esc(c).replace(/'/g, "\\'")}')">
      <div class="icon">${icons[i % 4]}</div>
      <h3>${esc(c)}</h3>
      <p>${data.products.filter(p => p.category === c).length} מוצרים</p>
    </div>`
  ).join('');

  const cf = document.getElementById('catFilter');
  const pc = document.getElementById('pCategory');
  [cf, pc].forEach((el, idx) => {
    const current = el.value;
    el.innerHTML = (idx === 0 ? '<option value="">כל הקטגוריות</option>' : '') + data.categories.map(c => `<option>${esc(c)}</option>`).join('');
    if ([...el.options].some(o => o.value === current)) el.value = current;
  });

  setText('statCategories', data.categories.length);
  setText('dashCats', data.categories.length);
}

function filterCategory(c) {
  document.getElementById('catFilter').value = c;
  renderProducts();
  scrollToCatalog();
}

function renderProducts() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const cat = document.getElementById('catFilter').value;
  const brand = document.getElementById('brandFilter').value;
  const sort = document.getElementById('sort').value;

  let arr = data.products.filter(p =>
    (!q || [p.name, p.sku, p.brand, p.desc, (p.flavors || []).map(f => f.n).join(' ')].join(' ').toLowerCase().includes(q)) &&
    (!cat || p.category === cat) &&
    (!brand || p.brand === brand)
  );

  if (sort === 'priceAsc') arr.sort((a, b) => a.price - b.price);
  if (sort === 'priceDesc') arr.sort((a, b) => b.price - a.price);
  if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name, 'he'));

  setText('resultsCount', `${arr.length} מוצרים`);

  document.getElementById('productsGrid').innerHTML = arr.length
    ? arr.map(p => {
        const nSel = (picked[p.id] || new Set()).size;
        return `<article class="product">
          <div class="pic">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : `<img src="${suppliedImages[data.products.indexOf(p) % suppliedImages.length]}" alt="${esc(p.name)}">`}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}<span class="picIndex">${String(data.products.indexOf(p) + 1).padStart(2, '0')}</span></div>
          <div class="productBody">
            <div class="meta">
              <span class="pill">${esc(p.category)}</span>
              <span class="pill">${esc(p.brand || 'ללא מותג')}</span>
              <span class="pill">מק״ט ${esc(p.sku)}</span>
            </div>
            <h3>${esc(p.name)}</h3>
            <div class="desc">${esc(p.desc)}</div>
            ${flavorChips(p)}
            <div class="priceRow">
              <div>
                <div class="price">${fmt(p.price)} <small>לפני מע״מ*</small></div>
                ${p.oldPrice ? `<div style="color:var(--muted);text-decoration:line-through;font-size:12px">${fmt(p.oldPrice)}</div>` : ''}
              </div>
              <span class="stock${p.stock > 0 ? '' : ' warn'}">${p.stock > 0 ? `במלאי: ${p.stock}` : 'לבירור מלאי'}</span>
            </div>
            <button class="btn wa full" onclick="waProduct('${p.id}')">הזמנה בוואטסאפ${nSel ? ` · ${nSel} טעמים` : ''}</button>
          </div>
        </article>`;
      }).join('')
    : `<div class="empty" style="grid-column:1/-1">לא נמצאו מוצרים</div>`;

  setText('statProducts', data.products.length);
  setText('dashProducts', data.products.length);
  setText('dashStock', data.products.reduce((s, p) => s + (Number(p.stock) || 0), 0));
  const df = document.getElementById('dashFlavorsOut');
  if (df) df.textContent = data.products.reduce((s, p) => s + (p.flavors || []).filter(f => f.out).length, 0);
}

function renderBrands() {
  const el = document.getElementById('brandFilter');
  const cur = el.value;
  const brands = [...new Set(data.products.map(p => p.brand).filter(Boolean))].sort();
  el.innerHTML = '<option value="">כל המותגים</option>' + brands.map(b => `<option>${esc(b)}</option>`).join('');
  if (brands.includes(cur)) el.value = cur;
}

function renderAdminProducts() {
  document.getElementById('adminProducts').innerHTML = data.products.map(p => {
    const fl = p.flavors || [];
    const out = fl.filter(f => f.out).length;
    return `<tr>
      <td>${p.image ? `<img class="miniImg" src="${esc(p.image)}">` : `<div class="miniImg" style="display:grid;place-items:center">◈</div>`}</td>
      <td><b>${esc(p.name)}</b><div style="color:var(--muted);font-size:11px">${esc(p.sku)}</div></td>
      <td>${fmt(p.price)}</td>
      <td>${esc(p.category)}</td>
      <td>${p.stock}</td>
      <td>${fl.length ? `${fl.length - out}/${fl.length}${out ? ` <span style="color:var(--danger)">(${out} אזלו)</span>` : ''}` : '—'}</td>
      <td>
        <button class="iconBtn" onclick="editProduct('${p.id}')">✏️</button>
        <button class="iconBtn" onclick="duplicateProduct('${p.id}')">⧉</button>
        <button class="iconBtn" onclick="deleteProduct('${p.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function renderAdminCats() {
  document.getElementById('adminCats').innerHTML = data.categories.map(c =>
    `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <span>${esc(c)} <small style="color:var(--muted)">(${data.products.filter(p => p.category === c).length})</small></span>
      <button class="iconBtn" onclick="deleteCategory('${esc(c).replace(/'/g, "\\'")}')">מחק</button>
    </div>`
  ).join('');
}

function renderAll() {
  applySettings();
  renderCategories();
  renderBrands();
  renderProducts();
  renderAdminProducts();
  renderAdminCats();
  fillAdminForms();
}

function scrollToCatalog() { document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' }); }

let adminUnlocked = false;

function openAdmin() {
  adminUnlocked = true;
  document.getElementById('adminOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderAll();
}
function closeAdminGate() {
  const g = document.getElementById('adminGate');
  if (g) g.classList.add('hidden');
  document.body.style.overflow = '';
}
function tryAdminLogin() { openAdmin(); }
function publishData() { exportDataFile(); toast('הקובץ הורד. העלה אותו למאגר כדי לפרסם'); }
async function loadDataFile(e) {
  const f = e.target.files[0]; if (!f) return;
  try { await importDataFile(f); await loadData(); renderAll(); toast('הנתונים נטענו'); }
  catch (err) { alert('הקובץ אינו תקין'); }
}
function closeAdmin() { document.getElementById('adminOverlay').classList.add('hidden'); document.body.style.overflow = ''; }
function switchAdmin(page, btn) {
  document.querySelectorAll('.adminPage').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.side button').forEach(x => x.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* ===== Flavor Editor (Admin) ===== */
let flavorDraft = [];

function renderFlavorEditor() {
  const box = document.getElementById('flavorEditor');
  if (!flavorDraft.length) { box.innerHTML = '<div style="color:var(--muted);font-size:13px">לא הוגדרו טעמים למוצר הזה.</div>'; return; }
  box.innerHTML = flavorDraft.map((f, i) =>
    `<div class="flavRow${f.out ? ' isOut' : ''}">
      <label class="flavTick"><input type="checkbox" ${f.out ? 'checked' : ''} onchange="setFlavorOut(${i},this.checked)"> אזל</label>
      <input class="input flavName" value="${esc(f.n)}" oninput="setFlavorName(${i},this.value)">
      <button class="iconBtn" onclick="removeFlavor(${i})">🗑️</button>
    </div>`
  ).join('');
}
function setFlavorOut(i, v) { flavorDraft[i].out = v; renderFlavorEditor(); }
function setFlavorName(i, v) { flavorDraft[i].n = v; }
function removeFlavor(i) { flavorDraft.splice(i, 1); renderFlavorEditor(); }
function addFlavor() {
  const el = document.getElementById('newFlavor');
  const raw = el.value.trim();
  if (!raw) return;
  raw.split(',').map(x => x.trim()).filter(Boolean).forEach(n => {
    if (!flavorDraft.some(f => f.n === n)) flavorDraft.push({ n, out: false });
  });
  el.value = '';
  renderFlavorEditor();
}
function allFlavorsIn() { flavorDraft.forEach(f => f.out = false); renderFlavorEditor(); }
function allFlavorsOut() { flavorDraft.forEach(f => f.out = true); renderFlavorEditor(); }

/* ===== Product Modal ===== */
let editingProductId = null;

function openProductModal() {
  editingProductId = null;
  document.getElementById('productModalTitle').textContent = 'מוצר חדש';
  ['pId', 'pName', 'pSku', 'pPrice', 'pOldPrice', 'pBrand', 'pStock', 'pBadge', 'pDesc', 'pImage'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pCategory').value = data.categories[0] || '';
  flavorDraft = [];
  renderFlavorEditor();
  document.getElementById('productModal').classList.add('open');
}
function closeProductModal() { document.getElementById('productModal').classList.remove('open'); }

async function editProduct(id) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  document.getElementById('productModalTitle').textContent = 'עריכת מוצר';
  const fields = [['pName', 'name'], ['pSku', 'sku'], ['pPrice', 'price'], ['pOldPrice', 'oldPrice'], ['pCategory', 'category'], ['pBrand', 'brand'], ['pStock', 'stock'], ['pBadge', 'badge'], ['pDesc', 'desc'], ['pImage', 'image']];
  for (const [elId, key] of fields) document.getElementById(elId).value = p[key] ?? '';
  flavorDraft = clone(p.flavors);
  renderFlavorEditor();
  document.getElementById('productModal').classList.add('open');
}

async function saveProduct() {
  const obj = {
    name: document.getElementById('pName').value.trim() || 'מוצר ללא שם',
    sku: document.getElementById('pSku').value.trim(),
    price: Number(document.getElementById('pPrice').value) || 0,
    old_price: Number(document.getElementById('pOldPrice').value) || 0,
    category: document.getElementById('pCategory').value,
    brand: document.getElementById('pBrand').value.trim(),
    stock: Number(document.getElementById('pStock').value) || 0,
    badge: document.getElementById('pBadge').value.trim(),
    description: document.getElementById('pDesc').value.trim(),
    image_url: document.getElementById('pImage').value.trim(),
  };

  if (editingProductId) {
    const { error } = await supabase.from('products').update(obj).eq('id', editingProductId);
    if (error) { alert('שגיאה בעדכון: ' + error.message); return; }
    // Sync flavors
    await supabase.from('product_flavors').delete().eq('product_id', editingProductId);
    if (flavorDraft.length) {
      const flavRows = flavorDraft.map((f, i) => ({ product_id: editingProductId, name: f.n, out: f.out, sort_order: i }));
      await supabase.from('product_flavors').insert(flavRows);
    }
  } else {
    const { data: newProd, error } = await supabase.from('products').insert([obj]).select().single();
    if (error) { alert('שגיאה בהוספה: ' + error.message); return; }
    if (flavorDraft.length) {
      const flavRows = flavorDraft.map((f, i) => ({ product_id: newProd.id, name: f.n, out: f.out, sort_order: i }));
      await supabase.from('product_flavors').insert(flavRows);
    }
  }

  await loadData();
  renderAll();
  closeProductModal();
  toast('המוצר נשמר');
}

async function duplicateProduct(id) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  const { data: newProd, error } = await supabase.from('products').insert([{
    name: p.name + ' - עותק', sku: p.sku, price: p.price, old_price: p.oldPrice,
    category: p.category, brand: p.brand, stock: p.stock, badge: p.badge,
    description: p.desc, image_url: p.image,
  }]).select().single();
  if (error) { alert('שגיאה: ' + error.message); return; }
  if (p.flavors.length) {
    const flavRows = p.flavors.map((f, i) => ({ product_id: newProd.id, name: f.n, out: f.out, sort_order: i }));
    await supabase.from('product_flavors').insert(flavRows);
  }
  await loadData();
  renderAll();
  toast('המוצר שוכפל');
}

async function deleteProduct(id) {
  if (!confirm('למחוק את המוצר?')) return;
  await supabase.from('product_flavors').delete().eq('product_id', id);
  await supabase.from('products').delete().eq('id', id);
  await loadData();
  renderAll();
  toast('המוצר נמחק');
}

async function addCategory() {
  const v = document.getElementById('newCat').value.trim();
  if (!v || data.categories.includes(v)) return;
  const maxOrder = data.categories.length;
  await supabase.from('categories').insert([{ name: v, sort_order: maxOrder }]);
  document.getElementById('newCat').value = '';
  await loadData();
  renderAll();
  toast('הקטגוריה נוספה');
}

async function deleteCategory(c) {
  if (data.products.some(p => p.category === c)) {
    alert('יש מוצרים בקטגוריה הזאת. העבר אותם לקטגוריה אחרת לפני המחיקה.');
    return;
  }
  if (!confirm('למחוק את הקטגוריה?')) return;
  await supabase.from('categories').delete().eq('name', c);
  await loadData();
  renderAll();
  toast('הקטגוריה נמחקה');
}

/* ===== Settings Forms ===== */
function fillAdminForms() {
  const s = data.settings;
  const ids = {
    setHeroEyebrow: 'hero_eyebrow', setHeroTitle: 'hero_title', setHeroText: 'hero_text',
    setAboutTitle: 'about_title', setAboutText: 'about_text',
    setBusinessName: 'business_name', setBusinessSub: 'business_sub',
    setPhone: 'phone', setEmail: 'email', setWhatsapp: 'whatsapp', setFooterText: 'footer_text',
    setPrimary: 'primary_color', setPrimaryText: 'primary_color',
    setSecondary: 'secondary_color', setSecondaryText: 'secondary_color',
    setAccent: 'accent_color', setAccentText: 'accent_color',
  };
  for (const [id, k] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.value = s[k] || '';
  }
  const pr = document.getElementById('logoPreview');
  if (s.logo) { pr.src = s.logo; pr.classList.remove('hidden'); } else pr.classList.add('hidden');
}

async function saveHomepage() {
  const s = data.settings;
  const updates = {
    hero_eyebrow: document.getElementById('setHeroEyebrow').value,
    hero_title: document.getElementById('setHeroTitle').value,
    hero_text: document.getElementById('setHeroText').value,
    about_title: document.getElementById('setAboutTitle').value,
    about_text: document.getElementById('setAboutText').value,
  };
  await supabase.from('site_settings').update(updates).eq('id', 1);
  await loadData();
  renderAll();
  toast('השינויים נשמרו');
}

async function saveBusiness() {
  const updates = {
    business_name: document.getElementById('setBusinessName').value,
    business_sub: document.getElementById('setBusinessSub').value,
    phone: document.getElementById('setPhone').value,
    email: document.getElementById('setEmail').value,
    whatsapp: document.getElementById('setWhatsapp').value,
    footer_text: document.getElementById('setFooterText').value,
  };
  await supabase.from('site_settings').update(updates).eq('id', 1);
  await loadData();
  renderAll();
  toast('פרטי העסק נשמרו');
}

async function saveDesign() {
  const updates = {
    primary_color: document.getElementById('setPrimary').value || document.getElementById('setPrimaryText').value,
    secondary_color: document.getElementById('setSecondary').value || document.getElementById('setSecondaryText').value,
    accent_color: document.getElementById('setAccent').value || document.getElementById('setAccentText').value,
  };
  await supabase.from('site_settings').update(updates).eq('id', 1);
  await loadData();
  renderAll();
  toast('הצבעים עודכנו');
}

async function resetDesign() {
  const updates = { primary_color: '#7c5cff', secondary_color: '#21e6c1', accent_color: '#ff4fd8' };
  await supabase.from('site_settings').update(updates).eq('id', 1);
  await loadData();
  renderAll();
  toast('חזר לברירת מחדל');
}

/* ===== Image Upload ===== */
function resizeImage(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        w = Math.round(w * ratio); h = Math.round(h * ratio);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function uploadLogo(e) {
  const f = e.target.files[0];
  if (!f) return;
  const src = await resizeImage(f, 500, 500, 0.9);
  await supabase.from('site_settings').update({ logo: src }).eq('id', 1);
  await loadData();
  renderAll();
  toast('הלוגו נשמר');
}

async function uploadHeroImage(e) {
  const f = e.target.files[0];
  if (!f) return;
  const src = await resizeImage(f, 1200, 1200, 0.85);
  await supabase.from('site_settings').update({ hero_image: src }).eq('id', 1);
  await loadData();
  renderAll();
  toast('תמונת הבאנר נשמרה');
}

async function removeHeroImage() {
  await supabase.from('site_settings').update({ hero_image: '' }).eq('id', 1);
  await loadData();
  renderAll();
  toast('תמונת הבאנר הוסרה');
}

async function productImageUpload(e) {
  const f = e.target.files[0];
  if (!f) return;
  const src = await resizeImage(f, 1000, 1000, 0.82);
  document.getElementById('pImage').value = src;
  toast('התמונה נטענה');
}

/* ===== CSV Import/Export ===== */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function flavorsToCell(fl) { return (fl || []).map(f => (f.out ? '!' : '') + f.n).join('|'); }
function flavorsFromCell(s) {
  return String(s || '').split('|').map(x => x.trim()).filter(Boolean)
    .map(x => x.startsWith('!') ? { n: x.slice(1).trim(), out: true } : { n: x, out: false })
    .filter(x => x.n);
}
function csvVal(v) { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

function exportData() {
  download('b2b-catalog-backup.json', JSON.stringify(data, null, 2), 'application/json');
}

function exportCSV() {
  const head = ['name', 'sku', 'price', 'oldPrice', 'category', 'brand', 'stock', 'badge', 'desc', 'image', 'flavors'];
  const rows = [head.join(','), ...data.products.map(p => head.map(k => csvVal(k === 'flavors' ? flavorsToCell(p.flavors) : k === 'oldPrice' ? p.oldPrice : k === 'desc' ? p.desc : k === 'image' ? p.image : p[k])).join(','))];
  download('products.csv', '\ufeff' + rows.join('\n'), 'text/csv;charset=utf-8');
}

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (ch === '"' && q && nx === '"') { cell += '"'; i++; }
    else if (ch === '"') q = !q;
    else if (ch === ',' && !q) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && nx === '\n') i++;
      row.push(cell);
      if (row.some(x => x !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(x => x !== '')) rows.push(row);
  return rows;
}

async function importCSV(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    const rows = parseCSV(r.result.replace(/^\ufeff/, ''));
    if (rows.length < 2) return alert('הקובץ ריק');
    const head = rows[0].map(x => x.trim());
    // Delete existing products first
    await supabase.from('product_flavors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const o = {};
      head.forEach((h, j) => o[h] = row[j] ?? '');
      // Ensure category exists
      if (o.category && !data.categories.includes(o.category)) {
        await supabase.from('categories').insert([{ name: o.category, sort_order: data.categories.length }]);
        data.categories.push(o.category);
      }
      const { data: newProd } = await supabase.from('products').insert([{
        name: o.name || 'מוצר', sku: o.sku || '', price: Number(o.price) || 0, old_price: Number(o.oldPrice) || 0,
        category: o.category || data.categories[0] || 'כללי', brand: o.brand || '',
        stock: Number(o.stock) || 0, badge: o.badge || '', description: o.desc || '', image_url: o.image || '',
      }]).select().single();
      const flavs = flavorsFromCell(o.flavors);
      if (flavs.length && newProd) {
        await supabase.from('product_flavors').insert(flavs.map((f, idx) => ({ product_id: newProd.id, name: f.n, out: f.out, sort_order: idx })));
      }
    }
    await loadData();
    renderAll();
    toast('המוצרים יובאו מהקובץ');
  };
  r.readAsText(f);
}

async function importData(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const x = JSON.parse(r.result);
      if (!x.settings || !Array.isArray(x.products)) throw 0;
      // Update settings
      const s = x.settings;
      const supSet = {};
      if (s.businessName) supSet.business_name = s.businessName;
      if (s.businessSub) supSet.business_sub = s.businessSub;
      if (s.phone) supSet.phone = s.phone;
      if (s.email) supSet.email = s.email;
      if (s.whatsapp) supSet.whatsapp = s.whatsapp;
      if (s.footerText) supSet.footer_text = s.footerText;
      if (s.heroEyebrow) supSet.hero_eyebrow = s.heroEyebrow;
      if (s.heroTitle) supSet.hero_title = s.heroTitle;
      if (s.heroText) supSet.hero_text = s.heroText;
      if (s.aboutTitle) supSet.about_title = s.aboutTitle;
      if (s.aboutText) supSet.about_text = s.aboutText;
      if (s.primary) supSet.primary_color = s.primary;
      if (s.secondary) supSet.secondary_color = s.secondary;
      if (s.accent) supSet.accent_color = s.accent;
      if (Object.keys(supSet).length) await supabase.from('site_settings').update(supSet).eq('id', 1);
      await loadData();
      renderAll();
      toast('הגיבוי יובא בהצלחה');
    } catch (_) {
      alert('קובץ הגיבוי לא תקין');
    }
  };
  r.readAsText(f);
}

async function resetAll() {
  if (!confirm('לאפס את כל הנתונים לגרסה שמגיעה עם האתר?')) return;
  resetToSeed();
  await loadData();
  renderAll();
  toast('האתר אופס');
}
/* ===== Expose to window ===== */
Object.assign(window, {
  publishData, loadDataFile,
  pickFlavor, waProduct, filterCategory, scrollToCatalog,
  openAdmin, closeAdmin, closeAdminGate, tryAdminLogin, switchAdmin,
  openProductModal, closeProductModal, editProduct, saveProduct,
  duplicateProduct, deleteProduct, addCategory, deleteCategory,
  renderFlavorEditor, setFlavorOut, setFlavorName, removeFlavor, addFlavor,
  allFlavorsIn, allFlavorsOut,
  saveHomepage, saveBusiness, saveDesign, resetDesign,
  uploadLogo, uploadHeroImage, removeHeroImage, productImageUpload,
  exportData, exportCSV, importCSV, importData, resetAll,
  renderProducts,
});

/* ===== Init ===== */
async function init() {
  try {
    await loadData();
  } catch (err) {
    console.error('Database load failed:', err);
  }
  try {
    renderAll();
  } catch (err) {
    console.error('Render failed:', err);
  }

  // Init 3D hero (non-blocking, graceful failure)
  try {
    const hero3dContainer = document.getElementById('hero3d');
    if (hero3dContainer) initHero3D(hero3dContainer);
  } catch (err) {
    console.error('3D hero failed:', err);
  }

  // Color picker sync
  ['setPrimary', 'setSecondary', 'setAccent'].forEach(id => {
    const t = document.getElementById(id + 'Text');
    if (t) t.addEventListener('change', e => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) document.getElementById(id).value = e.target.value;
    });
  });

  // Flavor input enter key
  const nf = document.getElementById('newFlavor');
  if (nf) nf.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addFlavor(); }
  });

  // Age gate
  if (sessionStorage.getItem('b2bGateOk') !== '1') {
    showAgeGate();
  }
}

function showAgeGate() {
  const g = document.createElement('div');
  g.className = 'gate';
  g.innerHTML = `<div class="gateBox">
    <div class="gateLogo">${(data.settings.business_name || 'N').trim().charAt(0)}</div>
    <h2>כניסה לבתי עסק בלבד</h2>
    <p>הקטלוג מיועד לעסקים מורשים לצורך רכישה סיטונאית. המוצרים מכילים ניקוטין, שהוא חומר ממכר, ומכירתם אסורה למי שטרם מלאו לו שמונה עשרה.</p>
    <button class="btn primary" id="gateYes">אני מעל גיל 18 ומייצג בית עסק</button>
  </div>`;
  document.body.appendChild(g);
  document.body.style.overflow = 'hidden';
  g.querySelector('#gateYes').onclick = function () {
    sessionStorage.setItem('b2bGateOk', '1');
    g.remove();
    document.body.style.overflow = '';
  };
}

init();
