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
import { StudentUploadView } from './components/StudentUploadView';
import { TeacherPanel } from './components/TeacherPanel';
import { HardDrive, Lock, ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isTeacherView, setIsTeacherView] = useState<boolean>(() => {
    // Check URL parameters for ?teacher=1 or ?admin=1
    const params = new URLSearchParams(window.location.search);
    return params.get('teacher') === '1' || params.get('admin') === '1';
  });

  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        setAccessTokenState(token);
        setAccessToken(token);
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
      }
    } catch (err) {
      console.error('Sign in failed:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessTokenState(null);
    setAccessToken(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased">
      {/* Discreet Header */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <HardDrive className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base">
              Сдача презентаций
            </span>
          </div>

          <div>
            {isTeacherView ? (
              <button
                onClick={() => setIsTeacherView(false)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
              >
                Вернуться к форме ученика
              </button>
            ) : (
              <button
                onClick={() => setIsTeacherView(true)}
                className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1.5 transition px-2.5 py-1 rounded-lg hover:bg-slate-100"
                title="Панель учителя (просмотр работ и подключение Google Диска)"
              >
                <Lock className="w-3.5 h-3.5 opacity-60" />
                <span>Панель учителя</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {isTeacherView ? (
          <TeacherPanel
            user={user}
            accessToken={accessToken}
            onSignIn={handleSignIn}
            onLogout={handleLogout}
            onBackToStudentView={() => setIsTeacherView(false)}
          />
        ) : (
          <StudentUploadView />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 py-5 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Сервис приёма школьных презентаций</span>
          {!isTeacherView && (
            <button
              onClick={() => setIsTeacherView(true)}
              className="text-slate-400 hover:text-blue-600 underline text-[11px]"
            >
              Вход для учителя
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
