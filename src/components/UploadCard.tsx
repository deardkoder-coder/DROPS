import React, { useState, useRef } from 'react';
import {
  ArrowUp,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Folder,
  Loader2,
  Presentation,
  Upload,
  User,
  MessageSquare,
  Sparkles,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DriveFolder, DriveFile, uploadPresentation } from '../services/drive';

interface UploadCardProps {
  accessToken: string | null;
  targetFolder: DriveFolder | null;
  onLoginRequest: () => void;
  onUploadSuccess: (file: DriveFile) => void;
}

interface SelectedFileItem {
  id: string;
  file: File;
  senderName: string;
  comment: string;
}

export const UploadCard: React.FC<UploadCardProps> = ({
  accessToken,
  targetFolder,
  onLoginRequest,
  onUploadSuccess,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<DriveFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [comment, setComment] = useState('');
  const [showExtraFields, setShowExtraFields] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#10b981'],
      });
    } catch {
      // ignore
    }
  };

  const handleFilesAdded = (files: FileList | File[]) => {
    setErrorMessage(null);
    const validExtensions = ['.pptx', '.ppt', '.pdf', '.key', '.odp', '.zip'];
    const newItems: SelectedFileItem[] = [];

    Array.from(files).forEach((file) => {
      const lowerName = file.name.toLowerCase();
      const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

      if (!isValid) {
        setErrorMessage(
          `Файл "${file.name}" имеет неподдерживаемый формат. Загрузите презентацию (.pptx, .ppt, .pdf, .key, .odp).`
        );
        return;
      }

      // Check max size 150MB
      if (file.size > 150 * 1024 * 1024) {
        setErrorMessage(`Файл "${file.name}" слишком большой (максимум 150 МБ).`);
        return;
      }

      newItems.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        senderName,
        comment,
      });
    });

    if (newItems.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
    }
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
  };

  const getFileBadge = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
    let colorClass = 'bg-blue-100 text-blue-700 border-blue-200';
    if (ext === 'PPTX' || ext === 'PPT') {
      colorClass = 'bg-orange-100 text-orange-700 border-orange-200';
    } else if (ext === 'PDF') {
      colorClass = 'bg-red-100 text-red-700 border-red-200';
    } else if (ext === 'KEY') {
      colorClass = 'bg-cyan-100 text-cyan-700 border-cyan-200';
    }
    return (
      <span
        className={`px-2 py-0.5 text-[10px] font-bold rounded tracking-wide border ${colorClass}`}
      >
        {ext}
      </span>
    );
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Пожалуйста, выберите хотя бы один файл презентации.');
      return;
    }

    if (!accessToken) {
      onLoginRequest();
      return;
    }

    if (!targetFolder) {
      setErrorMessage('Папка Google Диска ещё не инициализирована. Подождите секунду...');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setErrorMessage(null);

    const uploadedList: DriveFile[] = [];

    try {
      const totalCount = selectedFiles.length;
      for (let i = 0; i < totalCount; i++) {
        const item = selectedFiles[i];
        const res = await uploadPresentation(
          accessToken,
          item.file,
          targetFolder.id,
          {
            senderName: senderName || undefined,
            comment: comment || undefined,
          },
          (filePercent) => {
            const overall = Math.round(((i + filePercent / 100) / totalCount) * 100);
            setUploadProgress(overall);
          }
        );
        uploadedList.push(res);
        onUploadSuccess(res);
      }

      setUploadProgress(100);
      setUploadedFiles(uploadedList);
      setSelectedFiles([]);
      setSenderName('');
      setComment('');
      triggerConfetti();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(err.message || 'Ошибка при загрузке на Google Диск.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadState = () => {
    setUploadedFiles([]);
    setSelectedFiles([]);
    setErrorMessage(null);
    setUploadProgress(0);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept=".pptx,.ppt,.pdf,.key,.odp,.zip"
        className="hidden"
      />

      {/* Main Container Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-lg shadow-slate-200/50 border border-slate-100 transition-all">
        {uploadedFiles.length > 0 ? (
          /* SUCCESS STATE */
          <div className="py-6 text-center animate-fade-in">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              Презентация успешно отправлена!
            </h3>
            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Файл{uploadedFiles.length > 1 ? 'ы' : ''} сохранён в вашу папку{' '}
              <strong className="text-slate-900 font-semibold">«{targetFolder?.name}»</strong> на
              Google Диске.
            </p>

            {/* List of uploaded files with direct links */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-left max-h-56 overflow-y-auto space-y-2">
              {uploadedFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-800 truncate">{f.name}</p>
                      {f.size && (
                        <p className="text-[11px] text-slate-500">
                          {formatFileSize(parseInt(f.size, 10))}
                        </p>
                      )}
                    </div>
                  </div>

                  {f.webViewLink && (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 shrink-0 hover:bg-blue-100 transition"
                    >
                      <span>Открыть</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {targetFolder?.webViewLink && (
                <a
                  href={targetFolder.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition"
                >
                  <Folder className="w-4 h-4 text-blue-600" />
                  <span>Открыть папку на Диске</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              )}

              <button
                onClick={resetUploadState}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0070f3] hover:bg-blue-600 text-white font-medium text-sm shadow-sm transition"
              >
                <span>Отправить ещё</span>
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD UPLOAD FORM - EXACT SCREENSHOT STRUCTURE */
          <div>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Отправьте презентацию
              </h1>
              {targetFolder && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-blue-600 inline" />
                  <span>
                    Назначение: Google Диск / <strong>{targetFolder.name}</strong>
                  </span>
                </p>
              )}
            </div>

            {/* Field Label */}
            <label className="block text-sm font-semibold text-slate-900 mb-2.5">
              Загрузите файл <span className="text-red-500">*</span>
            </label>

            {/* Dropzone Box */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl py-12 px-6 text-center cursor-pointer transition-all select-none ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.008]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/40 hover:bg-slate-50/80'
              }`}
            >
              {/* Blue Circular Icon with Up Arrow - exact match to user screenshot */}
              <div className="w-14 h-14 rounded-full border border-blue-500 flex items-center justify-center mx-auto mb-4 text-blue-500 bg-white shadow-xs">
                <ArrowUp className="w-6 h-6 stroke-[1.8]" />
              </div>

              {/* Exact text from user screenshot */}
              <p className="text-slate-600 text-base font-normal mb-1.5">
                Drop your files here or click to choose your files.
              </p>
              <p className="text-xs text-slate-400">
                Поддерживаются PowerPoint (.pptx, .ppt), PDF (.pdf), Keynote (.key), OpenDocument
                (.odp)
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="mt-5 space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Выбранные файлы ({selectedFiles.length}):</span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-red-500 hover:text-red-700 text-xs font-normal"
                  >
                    Очистить всё
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {selectedFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80 hover:bg-slate-100/70 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileBadge(item.file.name)}
                        <div className="truncate">
                          <p className="text-xs font-medium text-slate-900 truncate">
                            {item.file.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatFileSize(item.file.size)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(item.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                        title="Удалить файл"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Metadata Toggle: Sender & Comment */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowExtraFields(!showExtraFields)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1.5 transition"
              >
                <span>{showExtraFields ? '− Скрыть доп. поля' : '+ Указать автора или комментарий'}</span>
              </button>

              {showExtraFields && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 animate-fade-in">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Имя / Организация:</span>
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Иван Иванов • Компания"
                      className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-slate-400" />
                      <span>Комментарий к презентации:</span>
                    </label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Например: версия для спикера"
                      className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Загрузка на Google Диск...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bottom Button Row */}
            <div className="mt-8 flex items-center justify-end">
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={isUploading || selectedFiles.length === 0}
                className={`inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-medium text-sm text-white transition-all shadow-sm ${
                  isUploading || selectedFiles.length === 0
                    ? 'bg-blue-400 cursor-not-allowed opacity-80'
                    : 'bg-[#0070f3] hover:bg-blue-600 active:scale-[0.98]'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Отправка...</span>
                  </>
                ) : (
                  <span>Отправить файлы</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Helpful Hint Card below */}
      <div className="mt-4 px-2 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          Все файлы загружаются непосредственно в ваш Google Диск
        </span>
        {targetFolder?.webViewLink && (
          <a
            href={targetFolder.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex items-center gap-1"
          >
            <span>Папка «{targetFolder.name}»</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};
