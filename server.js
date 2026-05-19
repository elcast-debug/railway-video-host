const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const volumeMountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.UPLOAD_DIR || '/app/videos';
const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 1024);

fs.mkdirSync(volumeMountPath, { recursive: true });
app.use(express.urlencoded({ extended: true }));

const sanitizeBaseName = (name) =>
  path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'video';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, volumeMountPath),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = sanitizeBaseName(file.originalname || 'video');
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.mimetype === 'video/mp4' || ext === '.mp4') return cb(null, true);
    cb(new Error('Only MP4 files are allowed.'));
  }
});

app.use('/videos', express.static(volumeMountPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

function getBaseUrl(req) {
  if (publicBaseUrl) return publicBaseUrl.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function listVideos() {
  return fs.readdirSync(volumeMountPath)
    .filter(name => name.toLowerCase().endsWith('.mp4'))
    .sort((a, b) => b.localeCompare(a));
}

function renderPage({ files = [], uploadedUrl = '', error = '', message = '' }) {
  const rows = files.length
    ? files.map(name => {
        const href = `/videos/${encodeURIComponent(name)}`;
        return `<tr>
          <td>${name}</td>
          <td><a href="${href}" target="_blank" rel="noopener noreferrer">Open</a></td>
          <td><button type="button" data-copy-url="${href}">Copy link</button></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="3">No uploaded videos yet.</td></tr>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Railway Volume Video Upload</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f172a;
      --panel: #111827;
      --panel-2: #1f2937;
      --line: #334155;
      --text: #e5e7eb;
      --muted: #94a3b8;
      --accent: #2dd4bf;
      --accent-2: #14b8a6;
      --danger: #fca5a5;
      --ok: #99f6e4;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: linear-gradient(180deg, #020617, #0f172a 30%, #111827); color: var(--text); }
    .wrap { max-width: 980px; margin: 0 auto; padding: 32px 16px 64px; }
    .grid { display: grid; gap: 20px; grid-template-columns: 1.1fr 0.9fr; }
    .card { background: rgba(17,24,39,0.92); border: 1px solid var(--line); border-radius: 18px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
    h1,h2,h3,p { margin-top: 0; }
    p { color: var(--muted); line-height: 1.6; }
    .hero { margin-bottom: 20px; }
    .status-ok { color: var(--ok); }
    .status-err { color: var(--danger); }
    .upload-box { border: 1px dashed #475569; border-radius: 16px; padding: 18px; background: rgba(15,23,42,0.55); }
    label { display: block; font-weight: 600; margin-bottom: 10px; }
    input[type=file] { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #475569; background: #0f172a; color: var(--text); }
    button, .btn { appearance: none; border: 0; border-radius: 12px; padding: 12px 16px; font-weight: 700; cursor: pointer; background: linear-gradient(180deg, var(--accent), var(--accent-2)); color: #042f2e; }
    button.secondary { background: #1e293b; color: var(--text); border: 1px solid #334155; }
    .stack { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 14px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 12px 10px; border-top: 1px solid #243041; vertical-align: top; }
    th { color: #cbd5e1; font-size: 14px; }
    a { color: #5eead4; }
    .pill { display: inline-block; padding: 6px 10px; border-radius: 999px; background: rgba(45,212,191,0.12); color: #99f6e4; font-size: 13px; margin-bottom: 12px; }
    code, pre { background: #020617; border: 1px solid #1e293b; color: #e2e8f0; border-radius: 10px; }
    pre { padding: 14px; overflow: auto; }
    .small { font-size: 14px; color: var(--muted); }
    @media (max-width: 780px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero card">
      <span class="pill">Railway Volume Upload App</span>
      <h1>Upload MP4 files and serve direct VRChat links</h1>
      <p>This page uploads files into your Railway mounted volume and serves each MP4 from a direct <span class="mono">/videos/...</span> URL.</p>
      ${message ? `<p class="status-ok">${message}</p>` : ''}
      ${error ? `<p class="status-err">${error}</p>` : ''}
      ${uploadedUrl ? `<h3>Uploaded file URL</h3><pre class="mono">${uploadedUrl}</pre>` : ''}
    </section>

    <section class="grid">
      <section class="card">
        <h2>Upload</h2>
        <div class="upload-box">
          <form action="/upload" method="post" enctype="multipart/form-data">
            <label for="video">Choose MP4 file</label>
            <input id="video" type="file" name="video" accept="video/mp4" required>
            <div class="stack">
              <button type="submit">Upload video</button>
            </div>
          </form>
        </div>
        <p class="small">Files are saved to <span class="mono">${volumeMountPath}</span>. On Railway, mount your volume there or let the app use <span class="mono">RAILWAY_VOLUME_MOUNT_PATH</span>.</p>
      </section>

      <section class="card">
        <h2>Railway settings</h2>
        <ol>
          <li>Create and attach a Volume to this service.</li>
          <li>Mount it to <span class="mono">/app/videos</span>.</li>
          <li>Deploy the app and open the root domain.</li>
          <li>Upload an MP4 and copy the direct link into VRChat.</li>
        </ol>
        <p class="small">The app also supports Railway’s runtime mount path environment variable automatically.</p>
      </section>
    </section>

    <section class="card" style="margin-top:20px;">
      <h2>Uploaded videos</h2>
      <table>
        <thead>
          <tr><th>Filename</th><th>Open</th><th>Action</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </main>

  <script>
    document.querySelectorAll('[data-copy-url]').forEach(button => {
      button.addEventListener('click', async () => {
        const absolute = `${window.location.origin}${button.getAttribute('data-copy-url')}`;
        try {
          await navigator.clipboard.writeText(absolute);
          button.textContent = 'Copied';
          setTimeout(() => button.textContent = 'Copy link', 1200);
        } catch {
          window.prompt('Copy this URL', absolute);
        }
      });
    });
  </script>
</body>
</html>`;
}

app.get('/', (req, res) => {
  res.send(renderPage({ files: listVideos() }));
});

app.post('/upload', (req, res) => {
  upload.single('video')(req, res, (err) => {
    const files = listVideos();
    if (err instanceof multer.MulterError) {
      return res.status(400).send(renderPage({ error: err.message, files }));
    }
    if (err) {
      return res.status(400).send(renderPage({ error: err.message, files }));
    }
    if (!req.file) {
      return res.status(400).send(renderPage({ error: 'No file uploaded.', files }));
    }

    const directUrl = `${getBaseUrl(req)}/videos/${encodeURIComponent(req.file.filename)}`;
    return res.send(renderPage({ files: listVideos(), uploadedUrl: directUrl, message: 'Upload complete. File stored on the mounted volume.' }));
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, volumeMountPath, maxFileSizeMb });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Using persistent upload path: ${volumeMountPath}`);
});
