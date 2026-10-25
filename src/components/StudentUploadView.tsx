import React, { useState, useRef } from 'react';
import {
  ArrowUp,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  GraduationCap,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface StudentUploadViewProps {
  onSuccess?: () => void;
}

export const StudentUploadView: React.FC<StudentUploadViewProps> = () => {
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [comment, setComment] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastUploadedName, setLastUploadedName] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#0070f3', '#3b82f6', '#60a5fa', '#10b981'],
      });
    } catch {}
  };

  const handleFile = (file: File) => {
    setErrorMessage(null);
    const validExtensions = ['.pptx', '.ppt', '.pdf', '.key', '.odp'];
    const lower = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lower.endsWith(ext));

    if (!isValid) {
      setErrorMessage(
        'Пожалуйста, выберите презентацию (.pptx, .ppt, .pdf, .key, .odp).'
      );
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      setErrorMessage('Размер файла превышает 150 МБ.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
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

  const handleSubmit = async () => {
    if (!studentName.trim()) {
      setErrorMessage('Пожалуйста, укажите ваши фамилию и имя');
      return;
    }
    if (!selectedFile) {
      setErrorMessage('Пожалуйста, выберите файл презентации для загрузки');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append('studentName', studentName.trim());
    formData.append('studentClass', studentClass.trim());
    formData.append('comment', comment.trim());
    formData.append('file', selectedFile);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/student/upload');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success) {
              setLastUploadedName(selectedFile.name);
              setIsSuccess(true);
              triggerConfetti();
            } else {
              setErrorMessage(data.error || 'Ошибка при отправке');
            }
          } catch {
            setIsSuccess(true);
          }
        } else if (xhr.status === 404) {
          setErrorMessage(
            'Бэкенд-сервер недоступен (GitHub Pages поддерживает только статические файлы). Для работы приёма презентаций без регистрации запустите сервис с сервером Node.js или используйте облачный хостинг.'
          );
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            setErrorMessage(err.error || 'Ошибка сервера при загрузке');
          } catch {
            setErrorMessage(`Ошибка загрузки (${xhr.status})`);
          }
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setErrorMessage('Сетевая ошибка. Проверьте интернет-соединение.');
      };

      xhr.send(formData);
    } catch (err: any) {
      setIsUploading(false);
      setErrorMessage(err.message || 'Не удалось отправить файл');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setIsSuccess(false);
    setUploadProgress(0);
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        accept=".pptx,.ppt,.pdf,.key,.odp"
        className="hidden"
      />

      {/* Main Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-lg shadow-slate-200/50 border border-slate-100 transition-all">
        {isSuccess ? (
          /* SUCCESS STATE */
          <div className="py-8 text-center animate-fade-in">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              Презентация успешно отправлена!
            </h3>
            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Спасибо, <strong className="text-slate-800">{studentName}</strong>
              {studentClass ? ` (${studentClass})` : ''}! Ваша презентация сохранена и передана
              учителю на проверку.
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200/70 text-left max-w-md mx-auto flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600 shrink-0" />
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {lastUploadedName}
                </p>
                <p className="text-[11px] text-emerald-600 font-medium">✓ Передано учителю</p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-[#0070f3] hover:bg-blue-600 text-white font-medium text-sm shadow-sm transition"
            >
              Отправить ещё одну презентацию
            </button>
          </div>
        ) : (
          /* FORM MATCHING USER PHOTO */
          <div>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Отправьте презентацию
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Файл автоматически сохранится в папке учителя на Google Диске
              </p>
            </div>

            {/* Student info fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-900 mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Фамилия и Имя <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Например: Иванов Иван"
                  className="w-full text-sm px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1.5 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>Класс / Группа:</span>
                </label>
                <input
                  type="text"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder="10А"
                  className="w-full text-sm px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* File Label */}
            <label className="block text-sm font-semibold text-slate-900 mb-2.5">
              Загрузите файл <span className="text-red-500">*</span>
            </label>

            {/* Dropzone Box - Exact match to user photo */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl py-12 px-6 text-center cursor-pointer transition-all select-none ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.008]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/40 hover:bg-slate-50/80'
              }`}
            >
              {/* Blue Circular Icon with Up Arrow - exact match */}
              <div className="w-14 h-14 rounded-full border border-blue-500 flex items-center justify-center mx-auto mb-4 text-blue-500 bg-white shadow-xs">
                <ArrowUp className="w-6 h-6 stroke-[1.8]" />
              </div>

              {/* Exact text from user photo */}
              <p className="text-slate-600 text-base font-normal mb-1.5">
                Drop your files here or click to choose your files.
              </p>
              <p className="text-xs text-slate-400">
                Поддерживаются .pptx, .ppt, .pdf, .key, .odp
              </p>
            </div>

            {/* Selected File Display */}
            {selectedFile && (
              <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  {getFileBadge(selectedFile.name)}
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                  title="Удалить файл"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Optional Comment */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Тема презентации или комментарий (необязательно):</span>
              </label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: Проект по истории, 2 вариант"
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    Отправка презентации учителю...
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
                onClick={handleSubmit}
                disabled={isUploading || !selectedFile}
                className={`inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-medium text-sm text-white transition-all shadow-sm ${
                  isUploading || !selectedFile
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
    </div>
  );
};
