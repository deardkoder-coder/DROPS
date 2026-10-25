import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  Folder,
  ExternalLink,
  RefreshCw,
  Share2,
  Check,
  Download,
  Trash2,
  HardDrive,
  Calendar,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Loader2,
  FileText,
  Search,
  Settings,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { FolderSettingsModal } from './FolderSettingsModal';
import { getOrCreateFolder, DriveFolder } from '../services/drive';

export interface SubmissionItem {
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

interface TeacherPanelProps {
  user: User | null;
  accessToken: string | null;
  onSignIn: () => Promise<void>;
  onLogout: () => Promise<void>;
  onBackToStudentView: () => void;
}

export const TeacherPanel: React.FC<TeacherPanelProps> = ({
  user,
  accessToken,
  onSignIn,
  onLogout,
  onBackToStudentView,
}) => {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [itemToDelete, setItemToDelete] = useState<SubmissionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [folderInfo, setFolderInfo] = useState<{
    id: string;
    name: string;
    link?: string;
  } | null>(null);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/teacher/submissions');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTeacherStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/status');
      if (res.ok) {
        const data = await res.json();
        if (data.folderId) {
          setFolderInfo({
            id: data.folderId,
            name: data.folderName,
            link: data.folderLink,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load teacher status:', err);
    }
  }, []);

  // When teacher is logged in and has access token, ensure Google Drive folder is initialized and saved
  useEffect(() => {
    async function setupDriveFolder() {
      if (!accessToken || !user) return;
      try {
        const targetFolderName = folderInfo?.name || 'Презентации от школьников';
        const folder = await getOrCreateFolder(accessToken, targetFolderName);
        setFolderInfo({
          id: folder.id,
          name: folder.name,
          link: folder.webViewLink,
        });

        // Save credentials & folder to backend
        await fetch('/api/teacher/save-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken,
            folderId: folder.id,
            folderName: folder.name,
            folderLink: folder.webViewLink,
            teacherEmail: user.email,
            teacherName: user.displayName,
          }),
        });

        // Trigger automatic sync of any pending submissions
        handleSync(accessToken);
      } catch (err) {
        console.error('Drive folder setup failed:', err);
      }
    }

    setupDriveFolder();
  }, [accessToken, user]);

  useEffect(() => {
    loadSubmissions();
    loadTeacherStatus();
  }, [loadSubmissions, loadTeacherStatus]);

  const handleSync = async (tokenToUse?: string) => {
    const token = tokenToUse || accessToken;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/teacher/sync-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      });
      if (res.ok) {
        await loadSubmissions();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/teacher/submission/${itemToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== itemToDelete.id));
        setItemToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateFolderName = async (newName: string) => {
    if (accessToken) {
      const folder = await getOrCreateFolder(accessToken, newName);
      setFolderInfo({
        id: folder.id,
        name: folder.name,
        link: folder.webViewLink,
      });
      await fetch('/api/teacher/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          folderId: folder.id,
          folderName: folder.name,
          folderLink: folder.webViewLink,
        }),
      });
    }
  };

  const copyStudentLink = () => {
    const studentUrl = window.location.origin;
    navigator.clipboard.writeText(studentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formatFileSize = (bytes: number): string => {
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

  const pendingSubmissions = submissions.filter((s) => s.driveStatus !== 'uploaded');

  const filteredSubmissions = submissions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.studentClass.toLowerCase().includes(q) ||
      s.originalName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Header with Back to Student View */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToStudentView}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 text-xs font-medium"
            title="Вернуться к форме для учеников"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Форма для учеников</span>
          </button>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <h2 className="text-lg font-bold text-slate-900">Панель учителя</h2>
        </div>

        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden md:inline">
              Подключен: <strong>{user.email}</strong>
            </span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              title="Настройки папки"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl transition font-medium"
            >
              Отключить Диск
            </button>
          </div>
        ) : (
          <GoogleSignInButton onClick={onSignIn} text="Подключить мой Google Диск" />
        )}
      </div>

      {/* Teacher Status & Share Link Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Google Drive Folder Info */}
        <div className="md:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Целевая папка Google Диска
              </span>
              {user ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Подключено
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertCircle className="w-3 h-3" />
                  Требуется вход
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Folder className="w-5 h-5 text-blue-600 shrink-0" />
              <span>{folderInfo?.name || 'Презентации от школьников'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Все загружаемые учениками презентации автоматически сохраняются в эту папку на вашем
              Google Диске.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            {folderInfo?.link ? (
              <a
                href={folderInfo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                <span>Открыть папку в Google Диске</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-xs text-slate-400">
                Войдите через Google, чтобы активировать папку
              </span>
            )}

            {pendingSubmissions.length > 0 && user && (
              <button
                onClick={() => handleSync()}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Синхронизировать ({pendingSubmissions.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Share Link for Students */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-5 rounded-3xl text-white shadow-md shadow-blue-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-100 mb-1">
              <Share2 className="w-3.5 h-3.5" />
              <span>Ссылка для школьников</span>
            </div>
            <h4 className="text-base font-bold">Отправьте ученикам</h4>
            <p className="text-xs text-blue-100/90 mt-1">
              Ученики открывают ссылку, вводят своё имя и отправляют презентацию без какой-либо
              регистрации.
            </p>
          </div>

          <button
            onClick={copyStudentLink}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white text-slate-900 rounded-xl text-xs font-semibold hover:bg-blue-50 transition shadow-xs"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Ссылка скопирована!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-blue-600" />
                <span>Скопировать ссылку для класса</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Submissions Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Сданные работы учеников ({submissions.length})
            </h3>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по ученику или файлу..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => loadSubmissions()}
              disabled={isLoading}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition"
              title="Обновить список"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Submissions Table / List */}
        {isLoading && submissions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
            Загрузка работ...
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-500" />
            <p className="text-sm font-medium text-slate-700">
              {searchQuery ? 'Работ не найдено' : 'Пока никто не загрузил презентации'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Попробуйте изменить поисковый запрос'
                : 'Отправьте ссылку ученикам в чат класса, чтобы они начали загрузку'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="py-3.5 px-3 hover:bg-slate-50/70 rounded-2xl transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{sub.studentName}</span>
                    {sub.studentClass && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-100">
                        {sub.studentClass}
                      </span>
                    )}

                    {sub.driveStatus === 'uploaded' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        Google Диск
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"
                        title={sub.driveError || 'Ожидает синхронизации с Google Диском'}
                      >
                        <Clock className="w-3 h-3" />
                        Ожидает синхронизации
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                    <span className="font-medium text-slate-700 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      {sub.originalName}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(sub.fileSize)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(sub.uploadedAt)}
                    </span>
                  </div>

                  {sub.comment && (
                    <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      «{sub.comment}»
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {sub.driveViewLink && (
                    <a
                      href={sub.driveViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                      title="Открыть на Google Диске"
                    >
                      <span>Открыть на Диске</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <a
                    href={`/api/teacher/download/${sub.id}`}
                    download={sub.originalName}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                    title="Скачать файл"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => setItemToDelete(sub)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Удалить запись"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        fileName={`${itemToDelete?.studentName || ''} - ${itemToDelete?.originalName || ''}`}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setItemToDelete(null)}
      />

      {/* Folder Settings */}
      <FolderSettingsModal
        isOpen={isSettingsOpen}
        currentFolder={
          folderInfo ? { id: folderInfo.id, name: folderInfo.name, webViewLink: folderInfo.link } : null
        }
        onClose={() => setIsSettingsOpen(false)}
        onUpdateFolderName={handleUpdateFolderName}
      />
    </div>
  );
};
