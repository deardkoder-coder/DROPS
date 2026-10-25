import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Archive,
  Calendar,
  Lock,
  ArrowLeft,
  AlertCircle,
  Loader2,
  FolderOpen,
  Settings,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

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

interface PresentationGalleryProps {
  onGoToUpload: () => void;
  apiBaseUrl?: string;
}

const GAS_SCRIPT_CODE = `function doPost(e) {
  try {
    var body = e.postData.contents;
    var data = JSON.parse(body);
    if (data.password !== "1011") {
      return ContentService.createTextOutput(JSON.stringify({ error: "Неверный пароль доступа" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var folderName = "Презентации";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    var decoded = Utilities.base64Decode(data.fileBase64);
    var blob = Utilities.newBlob(decoded, data.mimeType || "application/octet-stream", data.fileName);
    var file = folder.createFile(blob);
    if (data.comment) {
      file.setDescription("Подпись: " + data.comment);
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const PresentationGallery: React.FC<PresentationGalleryProps> = ({
  onGoToUpload,
  apiBaseUrl = '',
}) => {
  const [password, setPassword] = useState<string>(() => {
    return sessionStorage.getItem('presentation_admin_pass') || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [inputPass, setInputPass] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [presentations, setPresentations] = useState<StoredPresentation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [itemToDelete, setItemToDelete] = useState<StoredPresentation | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Google Apps Script integration state for GitHub Pages
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('gas_upload_url') || '';
  });
  const [isGasSettingsOpen, setIsGasSettingsOpen] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [gasInput, setGasInput] = useState<string>(() => {
    return localStorage.getItem('gas_upload_url') || '';
  });
  const [gasSaved, setGasSaved] = useState<boolean>(false);

  const fetchPresentations = useCallback(
    async (passToUse: string) => {
      setIsLoading(true);
      setAuthError(null);
      try {
        const url = `${apiBaseUrl}/api/presentations?password=${encodeURIComponent(passToUse)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPresentations(data.presentations || []);
          setIsAuthenticated(true);
          sessionStorage.setItem('presentation_admin_pass', passToUse);
        } else if (res.status === 403) {
          setIsAuthenticated(false);
          setAuthError('Неверный пароль доступа');
        } else {
          setAuthError(`Ошибка загрузки данных (${res.status})`);
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        // If fetch fails (e.g. static site), allow auth if password is 1011
        if (passToUse === '1011') {
          setIsAuthenticated(true);
        } else {
          setAuthError('Сетевая ошибка при получении списка презентаций');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    if (password === '1011') {
      fetchPresentations(password);
    }
  }, [password, fetchPresentations]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPass.trim()) {
      setAuthError('Введите пароль');
      return;
    }
    setPassword(inputPass.trim());
    fetchPresentations(inputPass.trim());
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const url = `${apiBaseUrl}/api/presentations/${itemToDelete.id}?password=${encodeURIComponent(
        password
      )}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        setPresentations((prev) => prev.filter((p) => p.id !== itemToDelete.id));
        setItemToDelete(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveGasUrl = () => {
    const trimmed = gasInput.trim();
    setGasUrl(trimmed);
    if (trimmed) {
      localStorage.setItem('gas_upload_url', trimmed);
    } else {
      localStorage.removeItem('gas_upload_url');
    }
    setGasSaved(true);
    setTimeout(() => setGasSaved(false), 2500);
  };

  const copyScriptCode = () => {
    navigator.clipboard.writeText(GAS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 Б';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
  };

  const formatDate = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const getFileBadge = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
    let color = 'bg-blue-100 text-blue-700 border-blue-200';
    if (ext === 'PPTX' || ext === 'PPT') {
      color = 'bg-orange-100 text-orange-700 border-orange-200';
    } else if (ext === 'PDF') {
      color = 'bg-red-100 text-red-700 border-red-200';
    } else if (ext === 'KEY') {
      color = 'bg-cyan-100 text-cyan-700 border-cyan-200';
    }
    return (
      <span className={`px-2 py-0.5 text-[10px] font-bold rounded tracking-wide border ${color}`}>
        {ext}
      </span>
    );
  };

  const filtered = presentations.filter((p) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = p.fileName.toLowerCase().includes(q);
    const sigMatch = (p.signature || '').toLowerCase().includes(q);
    return nameMatch || sigMatch;
  });

  const totalBytes = presentations.reduce((acc, p) => acc + (p.fileSize || 0), 0);

  // Password prompt
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md mx-auto py-12 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 shadow-lg shadow-slate-200/50 border border-slate-100 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Lock className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-1">
            Загруженные презентации
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Для просмотра и скачивания файлов введите пароль доступа
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={inputPass}
                onChange={(e) => {
                  setInputPass(e.target.value);
                  if (authError) setAuthError(null);
                }}
                placeholder="Введите пароль"
                className="w-full text-center text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white tracking-widest transition"
                autoFocus
              />
            </div>

            {authError && (
              <p className="text-xs text-red-600 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{authError}</span>
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onGoToUpload}
                className="w-1/2 py-2.5 px-4 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-1/2 py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {isLoading ? 'Проверка...' : 'Войти'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Top Bar with Stats and Actions */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onGoToUpload}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition mr-1"
              title="Вернуться к форме загрузки"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Загруженные презентации
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {presentations.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-8">
            Всего сохранено в базе данных: <strong>{formatFileSize(totalBytes)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {presentations.length > 0 && (
            <a
              href={`${apiBaseUrl}/api/download-all?password=${encodeURIComponent(password)}`}
              download
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              title="Скачать все презентации одним ZIP-архивом"
            >
              <Archive className="w-4 h-4" />
              <span>Скачать все (ZIP)</span>
            </a>
          )}

          <button
            onClick={() => setIsGasSettingsOpen(!isGasSettingsOpen)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
            title="Настройка для GitHub Pages"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={() => fetchPresentations(password)}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* GitHub Pages Google Drive Helper Card (collapsible) */}
      {isGasSettingsOpen && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200 rounded-3xl p-6 text-xs text-slate-700 space-y-4 animate-fade-in shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Прямая отправка в Google Диск с GitHub Pages</span>
              </h3>
              <p className="text-slate-600 mt-1">
                Если вы хотите раздавать ученикам ссылку с GitHub Pages, файлы могут падать прямо на
                ваш Google Диск через Google Apps Script без собственного сервера.
              </p>
            </div>
            <button
              onClick={() => setIsGasSettingsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 bg-white/80 p-4 rounded-2xl border border-blue-100">
            <p className="font-semibold text-slate-800">
              Шаг 1. Откройте{' '}
              <a
                href="https://script.google.com/home"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline inline-flex items-center gap-0.5"
              >
                <span>script.google.com</span>
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              и создайте новый проект:
            </p>

            <button
              type="button"
              onClick={copyScriptCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              {copiedScript ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Код скрипта скопирован!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Скопировать готовый код скрипта</span>
                </>
              )}
            </button>

            <p className="font-semibold text-slate-800 mt-2">
              Шаг 2. Нажмите <strong>«Развернуть»</strong> → <strong>«Новое развертывание»</strong>{' '}
              → выберите тип <strong>«Веб-приложение»</strong> (выполнять от: <em>«Меня»</em>,
              доступ: <em>«Все»</em>).
            </p>

            <p className="font-semibold text-slate-800 mt-2">
              Шаг 3. Вставьте полученную ссылку веб-приложения:
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={gasInput}
                onChange={(e) => setGasInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveGasUrl}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
              >
                {gasSaved ? 'Сохранено!' : 'Сохранить'}
              </button>
            </div>
            {gasUrl && (
              <p className="text-[11px] text-emerald-700">
                ✓ Скрипт подключён! Презентации с GitHub Pages будут сохраняться в ваш Google Диск в
                папку «Презентации».
              </p>
            )}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по названию файла или автору..."
          className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs transition"
        />
      </div>

      {/* Presentations List */}
      <div className="bg-white rounded-3xl p-3 sm:p-5 shadow-sm border border-slate-200/80">
        {isLoading && presentations.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-xs">Загружаем список файлов...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
              <FolderOpen className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              {searchQuery ? 'Ничего не найдено' : 'Пока нет загруженных презентаций'}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              {searchQuery
                ? 'Попробуйте изменить поисковый запрос'
                : 'Школьники могут отправлять работы через форму загрузки'}
            </p>
            {!searchQuery && (
              <button
                onClick={onGoToUpload}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition shadow-xs"
              >
                <span>Перейти к форме отправки</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="py-3.5 px-3 hover:bg-slate-50/80 rounded-2xl transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="shrink-0 mt-0.5 sm:mt-0">{getFileBadge(item.fileName)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition">
                      {item.fileName}
                    </p>
                    <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-0.5 flex-wrap">
                      <span>{formatFileSize(item.fileSize)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(item.uploadedAt)}
                      </span>
                      {item.signature && (
                        <>
                          <span>•</span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {item.signature}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <a
                    href={`${apiBaseUrl}/api/download/${item.id}`}
                    download={item.fileName}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition"
                    title="Скачать презентацию"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать</span>
                  </a>

                  <button
                    onClick={() => setItemToDelete(item)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    title="Удалить файл"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        fileName={itemToDelete?.fileName || ''}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
