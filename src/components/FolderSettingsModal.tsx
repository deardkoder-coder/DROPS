import React, { useState } from 'react';
import { Folder, X, Check, ExternalLink, Loader2 } from 'lucide-react';
import { DriveFolder } from '../services/drive';

interface FolderSettingsModalProps {
  isOpen: boolean;
  currentFolder: DriveFolder | null;
  onClose: () => void;
  onUpdateFolderName: (newName: string) => Promise<void>;
}

export const FolderSettingsModal: React.FC<FolderSettingsModalProps> = ({
  isOpen,
  currentFolder,
  onClose,
  onUpdateFolderName,
}) => {
  const [folderName, setFolderName] = useState(currentFolder?.name || 'Презентации');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError('Имя папки не может быть пустым');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onUpdateFolderName(folderName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления папки');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Настройки папки Google Диска</h3>
              <p className="text-xs text-slate-500">Куда сохраняются загруженные презентации</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Имя папки в Google Диске:
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Презентации"
              className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Если такой папки ещё нет, сервис автоматически создаст её в вашем Google Диске.
            </p>
          </div>

          {currentFolder?.webViewLink && (
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
              <div className="truncate mr-2">
                <span className="text-slate-500 block text-[10px]">Текущая папка:</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {currentFolder.name}
                </span>
              </div>
              <a
                href={currentFolder.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium shrink-0"
              >
                <span>Открыть в Диске</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Применить</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
