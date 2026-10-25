/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StudentUploadView } from './components/StudentUploadView';
import { PresentationGallery } from './components/PresentationGallery';
import { HardDrive, Upload, FolderOpen } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery'>('upload');
  const [totalFiles, setTotalFiles] = useState<number>(0);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setTotalFiles(data.count || 0);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStats();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased">
      {/* Top Navigation */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <HardDrive className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base block leading-tight">
                Презентации
              </span>
              <span className="text-[11px] text-slate-500">Сервис сдачи и скачивания</span>
            </div>
          </div>

          {/* Navigation Switcher: Upload / Gallery */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('upload')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'upload'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Отправить</span>
            </button>

            <button
              onClick={() => setActiveTab('gallery')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'gallery'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Загруженные</span>
              {totalFiles > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">
                  {totalFiles}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {activeTab === 'upload' ? (
          <StudentUploadView onGoToGallery={() => setActiveTab('gallery')} />
        ) : (
          <PresentationGallery onGoToUpload={() => setActiveTab('upload')} />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 py-5 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Сервис приёма и скачивания презентаций</span>
          <span>Надёжное хранение без сторонних аккаунтов</span>
        </div>
      </footer>
    </div>
  );
}
