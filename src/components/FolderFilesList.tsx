import React, { useState } from 'react';
import {
  FileText,
  Search,
  ExternalLink,
  Trash2,
  RefreshCw,
  Folder,
  ArrowUpDown,
  Upload,
  Calendar,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { DriveFile, DriveFolder } from '../services/drive';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface FolderFilesListProps {
  files: DriveFile[];
  folder: DriveFolder | null;
  isLoading: boolean;
  onRefresh: () => void;
  onDeleteFile: (fileId: string) => Promise<void>;
  onGoToUpload: () => void;
}

export const FolderFilesList: React.FC<FolderFilesListProps> = ({
  files,
  folder,
  isLoading,
  onRefresh,
  onDeleteFile,
  onGoToUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatFileSize = (bytesStr?: string): string => {
    if (!bytesStr) return '—';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '—';
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

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBytes = files.reduce((acc, f) => acc + (f.size ? parseInt(f.size, 10) || 0 : 0), 0);

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteFile(fileToDelete.id);
      setFileToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Файлы на Google Диске
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {files.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-blue-600 inline" />
            <span>
              Папка: <strong>{folder?.name || 'Презентации'}</strong> • Всего:{' '}
              {formatFileSize(totalBytes.toString())}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {folder?.webViewLink && (
            <a
              href={folder.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
            >
              <Folder className="w-3.5 h-3.5 text-blue-600" />
              <span>Открыть на Диске</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition disabled:opacity-50"
            title="Обновить список"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Обновить</span>
          </button>

          <button
            onClick={onGoToUpload}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition shadow-xs ml-auto md:ml-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Загрузить ещё</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск презентаций по названию..."
          className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-slate-200/80 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs transition"
        />
      </div>

      {/* File List */}
      <div className="bg-white rounded-3xl p-2 sm:p-4 shadow-sm border border-slate-100 overflow-hidden">
        {isLoading && files.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm">Загружаем список презентаций из Google Диска...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <HardDrive className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">
              {searchQuery ? 'Ничего не найдено' : 'В папке пока нет презентаций'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
              {searchQuery
                ? 'Попробуйте изменить поисковый запрос'
                : 'Отправьте первую презентацию через форму загрузки'}
            </p>
            {!searchQuery && (
              <button
                onClick={onGoToUpload}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Загрузить презентацию</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="p-3 sm:p-4 hover:bg-slate-50/80 rounded-2xl transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="shrink-0">{getFileBadge(file.name)}</div>
                  <div className="truncate">
                    <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(file.createdTime)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                      title="Открыть на Google Диске"
                    >
                      <span>Открыть</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <button
                    onClick={() => setFileToDelete(file)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Удалить из Google Диска"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!fileToDelete}
        fileName={fileToDelete?.name || ''}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFileToDelete(null)}
      />
    </div>
  );
};
