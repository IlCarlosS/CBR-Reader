const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { createExtractorFromFile } = require('node-unrar-js');

const PORT = 3000;
const LIB = path.join(__dirname, 'library');
const TMP = path.join(__dirname, 'tmp');
fs.mkdirSync(LIB, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const upload = multer({ dest: TMP });
const IMG = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Lista recursiva de archivos (rutas relativas con "/")
function walk(dir, base = dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

async function importComic(filePath, originalName) {
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(LIB, id);
  const raw = path.join(dir, 'raw');
  const pagesDir = path.join(dir, 'pages');
  fs.mkdirSync(raw, { recursive: true });
  fs.mkdirSync(pagesDir);

  try {
    // Detectar formato por los primeros bytes (no por la extensión)
    const head = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, head, 0, 4, 0);
    fs.closeSync(fd);

    if (head.toString('latin1') === 'Rar!') {
      const extractor = await createExtractorFromFile({ filepath: filePath, targetPath: raw });
      const { files } = extractor.extract();
      [...files]; // hay que iterar el generador para que extraiga
    } else if (head[0] === 0x50 && head[1] === 0x4b) {
      new AdmZip(filePath).extractAllTo(raw, true);
    } else {
      throw new Error('Formato no soportado (se esperaba RAR o ZIP)');
    }

    const imgs = walk(raw)
      .filter((p) => IMG.test(p) && !p.includes('__MACOSX') && !path.basename(p).startsWith('._'))
      .sort(collator.compare);

    if (!imgs.length) throw new Error('No se encontraron imágenes dentro del archivo');

    const pages = imgs.map((rel, i) => {
      const name = String(i + 1).padStart(4, '0') + path.extname(rel).toLowerCase();
      fs.renameSync(path.join(raw, rel), path.join(pagesDir, name));
      return name;
    });
    fs.rmSync(raw, { recursive: true, force: true });

    const meta = {
      id,
      name: originalName.replace(/\.(cbr|cbz|rar|zip)$/i, ''),
      pages,
      createdAt: Date.now(),
    };
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
    return meta;
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/library', express.static(LIB));

app.get('/api/comics', (req, res) => {
  const comics = [];
  for (const id of fs.readdirSync(LIB)) {
    const metaPath = path.join(LIB, id, 'meta.json');
    if (fs.existsSync(metaPath)) comics.push(JSON.parse(fs.readFileSync(metaPath, 'utf8')));
  }
  comics.sort((a, b) => collator.compare(a.name, b.name));
  res.json(comics);
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
  const results = [];
  for (const f of req.files || []) {
    // multer entrega los nombres como latin1; los convertimos a UTF-8
    const name = Buffer.from(f.originalname, 'latin1').toString('utf8');
    try {
      results.push({ ok: true, comic: await importComic(f.path, name) });
    } catch (e) {
      results.push({ ok: false, name, error: e.message });
    } finally {
      fs.rm(f.path, { force: true }, () => {});
    }
  }
  res.json(results);
});

app.delete('/api/comics/:id', (req, res) => {
  if (!/^[a-f0-9]{16}$/.test(req.params.id)) return res.status(400).end();
  fs.rmSync(path.join(LIB, req.params.id), { recursive: true, force: true });
  res.status(204).end();
});

app.listen(PORT, () => console.log(`CBR Reader en http://localhost:${PORT}`));