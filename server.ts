import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Ensure storage directories exist
const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const SUBMISSIONS_FILE = path.resolve(DATA_DIR, 'submissions.json');
const TEACHER_CONFIG_FILE = path.resolve(DATA_DIR, 'teacher_config.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Submissions helpers
export interface Submission {
  id: string;
  originalName: string;
  savedFileName: string;
  fileSize: number;
  mimeType: string;
  studentName: string;
  studentClass: string;
  comment: string;
  uploadedAt: string;
  driveStatus: 'uploaded' | 'pending' | 'failed';
  driveFileId?: string;
  driveViewLink?: string;
  driveError?: string;
}

export interface TeacherConfig {
  accessToken: string;
  folderId: string;
  folderName: string;
  folderLink?: string;
  teacherEmail?: string;
  teacherName?: string;
  updatedAt: string;
}

function getSubmissions(): Submission[] {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading submissions:', err);
  }
  return [];
}

function saveSubmissions(list: Submission[]) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving submissions:', err);
  }
}

function getTeacherConfig(): TeacherConfig | null {
  try {
    if (fs.existsSync(TEACHER_CONFIG_FILE)) {
      const data = fs.readFileSync(TEACHER_CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading teacher config:', err);
  }
  return null;
}

function saveTeacherConfig(cfg: TeacherConfig) {
  try {
    fs.writeFileSync(TEACHER_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving teacher config:', err);
  }
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB
});

// Drive upload helper using Node Buffer
async function uploadFileToGoogleDrive(
  accessToken: string,
  folderId: string,
  filePath: string,
  targetFileName: string,
  mimeType: string,
  description: string
) {
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = '-------DriveServerUploadBoundary' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--\r\n`;

  const metadata = {
    name: targetFileName,
    parents: [folderId],
    description,
    properties: {
      uploadedVia: 'school-presentation-drop',
    },
  };

  const metadataPart = Buffer.from(
    `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`
  );
  const fileHeader = Buffer.from(
    `${delimiter}Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
  );
  const closingPart = Buffer.from(closeDelim);

  const fullBody = Buffer.concat([metadataPart, fileHeader, fileBuffer, closingPart]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': fullBody.length.toString(),
      },
      body: fullBody,
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errorBody}`);
  }

  return (await res.json()) as { id: string; name: string; webViewLink?: string };
}

app.use(express.json());

// API Routes
// 1. Student upload (NO REGISTRATION REQUIRED!)
app.post('/api/student/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл презентации не предоставлен' });
      return;
    }

    const password = (req.body.password || '').trim();
    if (password !== '1011') {
      try {
        if (req.file) fs.unlinkSync(req.file.path);
      } catch {}
      res.status(403).json({ error: 'Неверный пароль. Введите пароль: 1011' });
      return;
    }

    const studentName = (req.body.studentName || '').trim();
    const comment = (req.body.comment || '').trim();

    const subId = Math.random().toString(36).substring(2, 10);
    const uploadedAt = new Date().toISOString();

    const submission: Submission = {
      id: subId,
      originalName: req.file.originalname,
      savedFileName: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      studentName: studentName || 'Без подписи',
      studentClass: '',
      comment,
      uploadedAt,
      driveStatus: 'pending',
    };

    // Attempt direct upload to Google Drive if teacher configuration is present
    const teacherConfig = getTeacherConfig();
    if (teacherConfig && teacherConfig.accessToken && teacherConfig.folderId) {
      try {
        const driveFileName = req.file.originalname;
        const descriptionLines = [
          studentName ? `Подпись: ${studentName}` : null,
          comment ? `Комментарий: ${comment}` : null,
          `Дата отправки: ${new Date().toLocaleString('ru-RU')}`,
          `Размер: ${(req.file.size / (1024 * 1024)).toFixed(2)} МБ`,
        ]
          .filter(Boolean)
          .join('\n');

        const driveResult = await uploadFileToGoogleDrive(
          teacherConfig.accessToken,
          teacherConfig.folderId,
          req.file.path,
          driveFileName,
          req.file.mimetype,
          descriptionLines
        );

        submission.driveStatus = 'uploaded';
        submission.driveFileId = driveResult.id;
        submission.driveViewLink = driveResult.webViewLink;
      } catch (driveErr: any) {
        console.warn('Direct upload to Drive failed (will keep pending for sync):', driveErr.message);
        submission.driveStatus = 'pending';
        submission.driveError = driveErr.message;
      }
    }

    const currentList = getSubmissions();
    currentList.unshift(submission);
    saveSubmissions(currentList);

    res.json({
      success: true,
      submission: {
        id: submission.id,
        originalName: submission.originalName,
        studentName: submission.studentName,
        studentClass: submission.studentClass,
        uploadedAt: submission.uploadedAt,
        driveStatus: submission.driveStatus,
        driveViewLink: submission.driveViewLink,
      },
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Ошибка обработки файла' });
  }
});

// 2. Teacher: Status
app.get('/api/teacher/status', (_req: Request, res: Response) => {
  const cfg = getTeacherConfig();
  const submissions = getSubmissions();
  const pendingCount = submissions.filter((s) => s.driveStatus === 'pending').length;

  res.json({
    isConfigured: !!(cfg && cfg.folderId),
    folderName: cfg?.folderName || 'Презентации от учеников',
    folderId: cfg?.folderId || null,
    folderLink: cfg?.folderLink || null,
    teacherEmail: cfg?.teacherEmail || null,
    teacherName: cfg?.teacherName || null,
    hasToken: !!(cfg && cfg.accessToken),
    totalSubmissions: submissions.length,
    pendingSubmissions: pendingCount,
  });
});

// 3. Teacher: Save connection
app.post('/api/teacher/save-credentials', (req: Request, res: Response) => {
  const { accessToken, folderId, folderName, folderLink, teacherEmail, teacherName } = req.body;
  if (!folderId) {
    res.status(400).json({ error: 'folderId обязателен' });
    return;
  }

  const existing = getTeacherConfig() || ({} as TeacherConfig);
  const updated: TeacherConfig = {
    ...existing,
    accessToken: accessToken || existing.accessToken,
    folderId,
    folderName: folderName || existing.folderName || 'Презентации от учеников',
    folderLink: folderLink || existing.folderLink,
    teacherEmail: teacherEmail || existing.teacherEmail,
    teacherName: teacherName || existing.teacherName,
    updatedAt: new Date().toISOString(),
  };

  saveTeacherConfig(updated);
  res.json({ success: true, config: updated });
});

// 4. Teacher: Disconnect
app.post('/api/teacher/disconnect', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(TEACHER_CONFIG_FILE)) {
      fs.unlinkSync(TEACHER_CONFIG_FILE);
    }
  } catch {}
  res.json({ success: true });
});

// 5. Teacher: Get submissions list
app.get('/api/teacher/submissions', (_req: Request, res: Response) => {
  const list = getSubmissions();
  res.json({ submissions: list });
});

// 6. Teacher: Sync pending submissions to Google Drive
app.post('/api/teacher/sync-to-drive', async (req: Request, res: Response) => {
  const providedToken = req.body.accessToken;
  const cfg = getTeacherConfig();
  const tokenToUse = providedToken || cfg?.accessToken;
  const folderId = cfg?.folderId;

  if (!tokenToUse || !folderId) {
    res.status(400).json({ error: 'Токен доступа или ID папки отсутствуют' });
    return;
  }

  // Update token if provided
  if (providedToken && cfg) {
    cfg.accessToken = providedToken;
    saveTeacherConfig(cfg);
  }

  const submissions = getSubmissions();
  const pending = submissions.filter((s) => s.driveStatus !== 'uploaded');
  let syncedCount = 0;
  const errors: string[] = [];

  for (const sub of pending) {
    const filePath = path.resolve(UPLOADS_DIR, sub.savedFileName);
    if (!fs.existsSync(filePath)) {
      sub.driveStatus = 'failed';
      sub.driveError = 'Файл отсутствует на сервере';
      continue;
    }

    try {
      const prefix = sub.studentClass ? `[${sub.studentClass}] ` : '';
      const driveFileName = `${prefix}${sub.studentName} - ${sub.originalName}`;
      const descLines = [
        `Ученик: ${sub.studentName}`,
        sub.studentClass ? `Класс: ${sub.studentClass}` : null,
        sub.comment ? `Комментарий: ${sub.comment}` : null,
        `Дата отправки: ${new Date(sub.uploadedAt).toLocaleString('ru-RU')}`,
      ]
        .filter(Boolean)
        .join('\n');

      const result = await uploadFileToGoogleDrive(
        tokenToUse,
        folderId,
        filePath,
        driveFileName,
        sub.mimeType,
        descLines
      );

      sub.driveStatus = 'uploaded';
      sub.driveFileId = result.id;
      sub.driveViewLink = result.webViewLink;
      delete sub.driveError;
      syncedCount++;
    } catch (err: any) {
      console.error(`Failed to sync submission ${sub.id}:`, err);
      sub.driveError = err.message;
      errors.push(`${sub.studentName}: ${err.message}`);
    }
  }

  saveSubmissions(submissions);

  res.json({
    success: true,
    syncedCount,
    totalRemainingPending: submissions.filter((s) => s.driveStatus !== 'uploaded').length,
    errors,
  });
});

// 7. Teacher: Download submission file
app.get('/api/teacher/download/:id', (req: Request, res: Response) => {
  const sub = getSubmissions().find((s) => s.id === req.params.id);
  if (!sub) {
    res.status(404).send('Не найдено');
    return;
  }
  const filePath = path.resolve(UPLOADS_DIR, sub.savedFileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('Файл не найден на сервере');
    return;
  }
  res.download(filePath, sub.originalName);
});

// 8. Teacher: Delete submission
app.delete('/api/teacher/submission/:id', (req: Request, res: Response) => {
  const current = getSubmissions();
  const sub = current.find((s) => s.id === req.params.id);
  if (!sub) {
    res.status(404).json({ error: 'Запись не найдена' });
    return;
  }

  // Remove local file
  const filePath = path.resolve(UPLOADS_DIR, sub.savedFileName);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}

  const filtered = current.filter((s) => s.id !== req.params.id);
  saveSubmissions(filtered);

  res.json({ success: true });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Presentation Drop server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
