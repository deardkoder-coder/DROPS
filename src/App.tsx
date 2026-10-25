/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  setAccessToken,
} from './services/auth';
import { getOrCreateFolder, DriveFolder } from './services/drive';
import { StudentUploadView } from './components/StudentUploadView';
import { HardDrive, CheckCircle2, ExternalLink, Folder } from 'lucide-react';
import { GoogleSignInButton } from './components/GoogleSignInButton';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [folder, setFolder] = useState<DriveFolder | null>(null);

  // Setup Google Drive folder and sync token with server
  const syncWithServer = async (token: string, userObj: User) => {
    try {
      const driveFolder = await getOrCreateFolder(token, 'Презентации');
      setFolder(driveFolder);

      await fetch('/api/teacher/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          folderId: driveFolder.id,
          folderName: driveFolder.name,
          folderLink: driveFolder.webViewLink,
          teacherEmail: userObj.email,
          teacherName: userObj.displayName,
        }),
      });
    } catch (err) {
      console.error('Failed to sync Drive credentials to server:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      async (authUser, token) => {
        setUser(authUser);
        setAccessTokenState(token);
        setAccessToken(token);
        await syncWithServer(token, authUser);
      },
      () => {
        setUser(null);
        setAccessTokenState(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessTokenState(res.accessToken);
        setAccessToken(res.accessToken);
        await syncWithServer(res.accessToken, res.user);
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased">
      {/* Top Header */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <HardDrive className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base block leading-tight">
                Презентации
              </span>
              <span className="text-[11px] text-slate-500">Загрузка на Google Диск</span>
            </div>
          </div>

          <div>
            {user && folder ? (
              <a
                href={folder.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 text-xs font-semibold transition"
                title="Открыть целевую папку в Google Диске"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Папка «{folder.name}»</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            ) : (
              <button
                onClick={handleSignIn}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl transition shadow-xs"
              >
                <span>Подключить Google Диск</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container - The Upload Form */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        <StudentUploadView />
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 py-5 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Сервис загрузки презентаций</span>
          <span>Файлы сохраняются в отдельную папку на Google Диске</span>
        </div>
      </footer>
    </div>
  );
}
