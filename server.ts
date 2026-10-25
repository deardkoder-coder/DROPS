import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cors from 'cors';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const ACCESS_PASSWORD = '1011';

// Storage directories
const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface StoredPresentation {
  id: string;
  fileName: string;
  storedFileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  signature?: string;
  comment?: string;
}

function getDatabase(): StoredPresentation[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading database:', err);
  }
  return [];
}

function saveDatabase(items: StoredPresentation[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// UTF-8 Cyrillic filename decoding helper
function decodeFilename(raw: string): string {
  if (/[а-яА-ЯёЁ]/.test(raw)) {
    return raw;
  }
  try {
    const candidate = Buffer.from(raw, 'latin1').toString('utf8');
    if (/[а-яА-ЯёЁ]/.test(candidate)) {
      return candidate;
    }
  } catch {}
  return raw;
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = decodeFilename(file.originalname);
    const safeExt = path.extname(cleanName) || '.pptx';
    const safeBase = path.basename(cleanName, safeExt).replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_');
    cb(null, `${timestamp}_${safeBase}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// API Routes

// 1. Upload Presentation
app.post(
  ['/api/upload', '/api/student/upload'],
  upload.single('file'),
  (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Файл презентации не предоставлен' });
        return;
      }

      const password = (req.body.password || '').trim();
      if (password !== ACCESS_PASSWORD) {
        try {
          if (req.file) fs.unlinkSync(req.file.path);
        } catch {}
        res.status(403).json({ error: 'Неверный пароль доступа' });
        return;
      }

      const originalName = decodeFilename(req.file.originalname);

      const signature = (req.body.comment || req.body.studentName || '').trim();
      const id = Math.random().toString(36).substring(2, 10);
      const uploadedAt = new Date().toISOString();

      const item: StoredPresentation = {
        id,
        fileName: originalName,
        storedFileName: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt,
        signature: signature || undefined,
        comment: signature || undefined,
      };

      const db = getDatabase();
      db.unshift(item);
      saveDatabase(db);

      res.json({
        success: true,
        presentation: item,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      res.status(500).json({ error: err.message || 'Ошибка обработки файла' });
    }
  }
);

// 2. Get All Presentations
app.get('/api/presentations', (req: Request, res: Response) => {
  const password = (req.query.password || req.headers['x-access-password'] || '').toString().trim();
  if (password !== ACCESS_PASSWORD) {
    res.status(403).json({ error: 'Неверный пароль для просмотра презентаций' });
    return;
  }

  const items = getDatabase();
  res.json({ presentations: items });
});

// 3. Download Single Presentation
app.get('/api/download/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const item = db.find((p) => p.id === req.params.id);
  if (!item) {
    res.status(404).send('Файл не найден');
    return;
  }

  const filePath = path.resolve(UPLOADS_DIR, item.storedFileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('Файл отсутствует на сервере');
    return;
  }

  res.download(filePath, item.fileName);
});

// 4. Download All as ZIP archive
app.get('/api/download-all', (req: Request, res: Response) => {
  const password = (req.query.password || '').toString().trim();
  if (password !== ACCESS_PASSWORD) {
    res.status(403).send('Неверный пароль доступа');
    return;
  }

  const db = getDatabase();
  if (db.length === 0) {
    res.status(404).send('В базе нет файлов для скачивания');
    return;
  }

  const archive = archiver('zip', { zlib: { level: 6 } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Презентации_${new Date().toISOString().slice(0, 10)}.zip"`
  );

  archive.pipe(res);

  // Add all existing files to zip
  db.forEach((item) => {
    const filePath = path.resolve(UPLOADS_DIR, item.storedFileName);
    if (fs.existsSync(filePath)) {
      const zipFileName = item.signature
        ? `[${item.signature.replace(/[/\\?%*:|"<>]/g, '_')}] ${item.fileName}`
        : item.fileName;
      archive.file(filePath, { name: zipFileName });
    }
  });

  archive.finalize();
});

// 5. Delete Presentation
app.delete('/api/presentations/:id', (req: Request, res: Response) => {
  const password = (req.query.password || req.headers['x-access-password'] || '').toString().trim();
  if (password !== ACCESS_PASSWORD) {
    res.status(403).json({ error: 'Неверный пароль доступа' });
    return;
  }

  const db = getDatabase();
  const item = db.find((p) => p.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Файл не найден' });
    return;
  }

  // Delete file from disk
  const filePath = path.resolve(UPLOADS_DIR, item.storedFileName);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Error unlinking file:', err);
  }

  const updated = db.filter((p) => p.id !== req.params.id);
  saveDatabase(updated);

  res.json({ success: true });
});

// 6. Stats endpoint
app.get('/api/stats', (_req: Request, res: Response) => {
  const db = getDatabase();
  const totalBytes = db.reduce((acc, p) => acc + (p.fileSize || 0), 0);
  res.json({
    count: db.length,
    totalBytes,
  });
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Presentation service is running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('Server error:', err);
  });
}

startServer();
