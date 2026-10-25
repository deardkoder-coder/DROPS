import React from 'react';
import { User } from 'firebase/auth';
import { Folder, LogOut, ExternalLink, HardDrive, Sparkles, Settings } from 'lucide-react';
import { DriveFolder } from '../services/drive';

interface NavbarProps {
  user: User | null;
  folder: DriveFolder | null;
  activeTab: 'upload' | 'files';
  setActiveTab: (tab: 'upload' | 'files') => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onLoginClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  folder,
  activeTab,
  setActiveTab,
  onLogout,
  onOpenSettings,
  onLoginClick,
}) => {
  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">Presentation Drop</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Google Drive
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Прямая загрузка презентаций в Google Диск
            </p>
          </div>
        </div>

        {/* Center Tabs */}
        {user && (
          <nav className="flex items-center bg-slate-100/90 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'upload'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Загрузка
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'files'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Файлы на Диске
            </button>
          </nav>
        )}

        {/* Right side: User & Folder */}
        <div className="flex items-center gap-2.5">
          {folder && folder.webViewLink && (
            <a
              href={folder.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть папку на Google Диске"
              className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Folder className="w-3.5 h-3.5 text-blue-600" />
              <span>{folder.name}</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenSettings}
                title="Настройки папки"
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Пользователь'}
                    className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center">
                    {user.email?.slice(0, 2).toUpperCase() || 'GD'}
                  </div>
                )}
                <div className="hidden lg:block text-left text-xs leading-tight">
                  <div className="font-medium text-slate-800 truncate max-w-[120px]">
                    {user.displayName || 'Google аккаунт'}
                  </div>
                  <div className="text-slate-400 truncate max-w-[120px]">{user.email}</div>
                </div>

                <button
                  onClick={onLogout}
                  title="Выйти"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            onLoginClick && (
              <button
                onClick={onLoginClick}
                className="inline-flex items-center gap-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl transition shadow-sm"
              >
                Войти через Google
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};
