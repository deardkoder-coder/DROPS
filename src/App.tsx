/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  setAccessToken,
} from './services/auth';
import { getOrCreateFolder, DriveFolder } from './services/drive';
import { StudentUploadView } from './components/StudentUploadView';
import { HardDrive } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [targetFolder, setTargetFolder] = useState<DriveFolder | null>(null);

  // Sync Google Drive folder and token with the backend server
  const syncWithServer = useCallback(async (token: string, userObj?: User | null) => {
    try {
      const driveFolder = await getOrCreateFolder(token, 'Презентации');
      setTargetFolder(driveFolder);

      // Tell backend server about this folder and token
      await fetch('/api/teacher/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          folderId: driveFolder.id,
          folderName: driveFolder.name,
          folderLink: driveFolder.webViewLink,
          teacherEmail: userObj?.email || '',
          teacherName: userObj?.displayName || '',
        }),
      });
      return driveFolder;
    } catch (err) {
      console.error('Failed to sync Drive credentials to server:', err);
      return null;
    }
  }, []);

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
  }, [syncWithServer]);

  // Request Google Drive OAuth when needed (e.g. on first upload by owner)
  const handleEnsureDriveAuth = async (): Promise<string | null> => {
    if (accessToken) return accessToken;
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessTokenState(res.accessToken);
        setAccessToken(res.accessToken);
        await syncWithServer(res.accessToken, res.user);
        return res.accessToken;
      }
    } catch (err) {
      console.error('Google authorization error:', err);
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased">
      {/* Clean Header - NO login buttons */}
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
              <span className="text-[11px] text-slate-500">Загрузка файлов</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Upload Card */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        <StudentUploadView
          accessToken={accessToken}
          targetFolder={targetFolder}
          onRequestDriveAuth={handleEnsureDriveAuth}
        />
      </main>

      {/* Clean Footer */}
      <footer className="w-full border-t border-slate-200/80 py-5 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Сервис загрузки презентаций</span>
          <span>Прямая отправка в Google Диск</span>
        </div>
      </footer>
    </div>
  );
}
