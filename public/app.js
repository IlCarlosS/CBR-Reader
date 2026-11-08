const $ = (s) => document.querySelector(s);
const viewer = $('#viewer');

// ---------- Estado ----------
const saved = JSON.parse(localStorage.getItem('cbr:settings') || '{}');
let comics = [];
let cur = null;           // cómic abierto
let page = 0;             // índice de página actual
let mode = saved.mode || 'single';
let fit = saved.fit || 'width';
let zoom = saved.zoom || 1;
let rtl = !!saved.rtl;

const saveSettings = () =>
  localStorage.setItem('cbr:settings', JSON.stringify({ mode, fit, zoom, rtl }));
const pageUrl = (i) => `/library/${cur.id}/pages/${cur.pages[i]}`;
const spreadStart = (p) => (mode !== 'double' || p === 0 ? p : p % 2 === 1 ? p : p - 1);

// ---------- Biblioteca ----------
async function loadLibrary() {
  comics = await (await fetch('/api/comics')).json();
  const list = $('#list');
  list.innerHTML = '';
  for (const c of comics) {
    const li = document.createElement('li');
    if (cur && cur.id === c.id) li.classList.add('active');
    li.innerHTML = '<span class="name"></span><span class="count"></span><button class="del" title="Eliminar">✕</button>';
    li.querySelector('.name').textContent = c.name;
    li.querySelector('.count').textContent = c.pages.length + ' p.';
    li.onclick = () => openComic(c);
    li.querySelector('.del').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar "${c.name}" de la biblioteca?`)) return;
      await fetch('/api/comics/' + c.id, { method: 'DELETE' });
      if (cur && cur.id === c.id) { cur = null; render(); }
      loadLibrary();
    };
    list.appendChild(li);
  }
}

function openComic(c) {
  cur = c;
  page = Math.min(+localStorage.getItem('cbr:page:' + c.id) || 0, c.pages.length - 1);
  $('#title').textContent = c.name;
  document.title = c.name + ' · CBR Reader';
  document.querySelectorAll('#list li').forEach((li, i) =>
    li.classList.toggle('active', comics[i].id === c.id));
  render();
}

// ---------- Render ----------
function render() {
  viewer.innerHTML = '';
  const effFit = mode === 'scroll' ? 'width' : fit;
  viewer.className = `mode-${mode} fit-${effFit}`;
  viewer.style.setProperty('--zoom', zoom);
  $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
  $('#mode').value = mode;
  $('#fit').value = fit;
  $('#fit').disabled = mode === 'scroll';
  $('#rtl').checked = rtl;
  $('#rtl').parentElement.style.display = mode === 'double' ? '' : 'none';

  if (!cur) {
    viewer.innerHTML = '<p class="empty">Añade o selecciona un cómic de la biblioteca.</p>';
    $('#total').textContent = '/ 0';
    return;
  }
  $('#total').textContent = '/ ' + cur.pages.length;
  $('#pageInput').max = cur.pages.length;

  if (mode === 'scroll') {
    cur.pages.forEach((_, i) => {
      const sp = document.createElement('div');
      sp.className = 'spread';
      const img = new Image();
      img.loading = 'lazy';
      img.dataset.i = i;
      img.onload = () => img.classList.add('loaded');
      img.src = pageUrl(i);
      sp.appendChild(img);
      viewer.appendChild(sp);
    });
    scrollToPage(page);
  } else {
    page = spreadStart(page);
    const idxs = mode === 'double' && page > 0 ? [page, page + 1] : [page];
    const valid = idxs.filter((i) => i < cur.pages.length);
    if (mode === 'double' && rtl) valid.reverse();
    const sp = document.createElement('div');
    sp.className = 'spread';
    valid.forEach((i) => { const img = new Image(); img.src = pageUrl(i); sp.appendChild(img); });
    viewer.appendChild(sp);
    viewer.scrollTop = 0;
    // Precargar la siguiente
    const nxt = next(page);
    if (nxt !== page) new Image().src = pageUrl(nxt);
  }
  updatePageUI();
}

function scrollToPage(i) {
  const img = viewer.querySelector(`img[data-i="${i}"]`);
  if (img) img.scrollIntoView();
}

function updatePageUI() {
  $('#pageInput').value = page + 1;
  if (cur) localStorage.setItem('cbr:page:' + cur.id, page);
}

// ---------- Navegación ----------
function next(p) {
  if (mode === 'double') return Math.min(p === 0 ? 1 : p + 2, cur.pages.length - 1);
  return Math.min(p + 1, cur.pages.length - 1);
}
function prev(p) {
  if (mode === 'double') return p <= 1 ? 0 : p - 2;
  return Math.max(p - 1, 0);
}
function goTo(n) {
  if (!cur) return;
  page = Math.max(0, Math.min(n, cur.pages.length - 1));
  if (mode === 'scroll') { scrollToPage(page); updatePageUI(); }
  else render();
}
const goNext = () => goTo(next(spreadStart(page)));
const goPrev = () => goTo(prev(spreadStart(page)));

// Página actual al hacer scroll (modo continuo)
let ticking = false;
viewer.addEventListener('scroll', () => {
  if (mode !== 'scroll' || !cur || ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const top = viewer.getBoundingClientRect().top + 40;
    const imgs = viewer.querySelectorAll('img');
    for (const img of imgs) {
      if (img.getBoundingClientRect().bottom > top) { page = +img.dataset.i; break; }
    }
    updatePageUI();
  });
});

// Clic en los laterales para cambiar de página
viewer.addEventListener('click', (e) => {
  if (mode === 'scroll' || !cur) return;
  const x = e.clientX / window.innerWidth;
  const rightIsNext = !(mode === 'double' && rtl);
  if (x > 0.7) rightIsNext ? goNext() : goPrev();
  else if (x < 0.3) rightIsNext ? goPrev() : goNext();
});

// ---------- Controles ----------
$('#next').onclick = () => (mode === 'double' && rtl ? goPrev() : goNext());
$('#prev').onclick = () => (mode === 'double' && rtl ? goNext() : goPrev());
$('#pageInput').onchange = (e) => goTo(+e.target.value - 1);
$('#mode').onchange = (e) => { mode = e.target.value; saveSettings(); render(); };
$('#fit').onchange = (e) => { fit = e.target.value; saveSettings(); render(); };
$('#rtl').onchange = (e) => { rtl = e.target.checked; saveSettings(); render(); };
$('#toggleSide').onclick = () => $('#sidebar').classList.toggle('hidden');
$('#fullscreen').onclick = toggleFullscreen;

function setZoom(z) {
  zoom = Math.max(0.3, Math.min(4, +z.toFixed(2)));
  viewer.style.setProperty('--zoom', zoom);
  $('#zoomLabel').textContent = Math.round(zoom * 100) + '%';
  saveSettings();
}
$('#zoomIn').onclick = () => setZoom(zoom + 0.1);
$('#zoomOut').onclick = () => setZoom(zoom - 0.1);

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const dir = mode === 'double' && rtl ? -1 : 1;
  switch (e.key) {
    case 'ArrowRight': if (mode !== 'scroll') (dir > 0 ? goNext : goPrev)(); break;
    case 'ArrowLeft':  if (mode !== 'scroll') (dir > 0 ? goPrev : goNext)(); break;
    case 'PageDown': if (mode !== 'scroll') { e.preventDefault(); goNext(); } break;
    case 'PageUp':   if (mode !== 'scroll') { e.preventDefault(); goPrev(); } break;
    case 'Home': goTo(0); break;
    case 'End': goTo(Infinity); break;
    case '+': case '=': setZoom(zoom + 0.1); break;
    case '-': setZoom(zoom - 0.1); break;
    case '0': setZoom(1); break;
    case 'f': case 'F': toggleFullscreen(); break;
  }
});

// ---------- Subida de archivos ----------
const status = (t) => ($('#status').textContent = t);

function upload(fileList) {
  const files = [...fileList].filter((f) => /\.(cbr|cbz|rar|zip)$/i.test(f.name));
  if (!files.length) return status('Ningún archivo válido (.cbr, .cbz)');

  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');
  xhr.upload.onprogress = (e) =>
    e.lengthComputable && status(`Subiendo ${files.length} archivo(s)… ${Math.round((e.loaded / e.total) * 100)}%`);
  xhr.upload.onload = () => status('Extrayendo páginas… (puede tardar con archivos grandes)');
  xhr.onerror = () => status('Error de conexión con el servidor');
  xhr.onload = async () => {
    const results = JSON.parse(xhr.responseText);
    const ok = results.filter((r) => r.ok);
    const bad = results.filter((r) => !r.ok);
    status(
      `✔ ${ok.length} añadido(s)` +
      bad.map((b) => `\n✘ ${b.name}: ${b.error}`).join('')
    );
    await loadLibrary();
    if (ok.length) openComic(comics.find((c) => c.id === ok[0].comic.id));
  };
  xhr.send(fd);
}

$('#file').onchange = (e) => { upload(e.target.files); e.target.value = ''; };

// Arrastrar y soltar
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('#drop').classList.add('on'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop').classList.remove('on'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop').classList.remove('on');
  upload(e.dataTransfer.files);
});

// ---------- Inicio ----------
loadLibrary();
render();