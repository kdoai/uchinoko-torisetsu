/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './lib/firebase';
import {
  buildDemoChildLock,
  buildDemoUserAccount,
  type DemoRoleView,
} from './lib/demoSandboxStore';
import { loadUserProfile } from './lib/firestoreService';
import type { ActiveChildModeLock, UserAccountDoc } from './types/models';
import { AuthLandingScreen, RoleOnboardingScreen } from './components/AuthAndOnboarding';
import { ChildAdventureApp } from './components/ChildAdventureApp';
import { ParentDashboard } from './components/ParentDashboard';
import { SafetyOfficerDashboard } from './components/SafetyOfficerDashboard';
import { SchoolAdminDashboard } from './components/SchoolAdminDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';

const CHILD_LOCK_STORAGE_KEY = 'uchinoko_active_child_lock_v1';

interface StoredChildLockPayload {
  ownerUid: string;
  lock: ActiveChildModeLock;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FFFDF8] p-6 text-[#3A3128]">
          <div className="max-w-lg rounded-3xl border border-[#EAE2D3] bg-white p-7 shadow-[0_6px_24px_rgba(92,74,50,0.06)]">
            <h1 className="text-lg font-bold text-[#B83227]">画面の表示中に問題が発生しました</h1>
            <p className="mt-2 text-sm text-[#6E6254]">
              ページを再読み込みしても解消しない場合は、権限または通信状態をご確認ください。
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-[#FAF5EC] p-3 text-xs text-[#6E6254]">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-[46px] rounded-xl bg-[#2F7A54] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#256344]"
            >
              再読み込みする
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserAccountDoc | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [initialInviteCode] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return (params.get('invite') || '').trim();
  });

  const [initialQrToken] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return (params.get('qr') || '').trim();
  });

  const [childLock, setChildLock] = useState<ActiveChildModeLock | null>(null);
  const [schoolDeviceLock, setSchoolDeviceLock] = useState<ActiveChildModeLock | null>(null);

  const [demoRole, setDemoRole] = useState<DemoRoleView | null>(() => {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search).get('demo');
    if (p === 'child' || p === 'parent' || p === 'teacher' || p === 'safety') return p;
    if (p === '1' || p === 'true') return 'child';
    return null;
  });

  const [cleanDemoViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('clean') === '1';
  });

  const switchDemoRole = (next: DemoRoleView | null) => {
    setDemoRole(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (next) {
        url.searchParams.set('demo', next);
      } else {
        url.searchParams.delete('demo');
        url.searchParams.delete('clean');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const fetchProfile = useCallback(async (uid: string) => {
    setLoadingProfile(true);
    try {
      const profile = await loadUserProfile(uid);
      setUserProfile(profile);

      // Restore persisted Child Mode PIN lock if active for an adult session
      try {
        const raw = localStorage.getItem(CHILD_LOCK_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredChildLockPayload;
          if (parsed && parsed.ownerUid === uid && parsed.lock?.studentId) {
            setChildLock(parsed.lock);
          } else {
            localStorage.removeItem(CHILD_LOCK_STORAGE_KEY);
          }
        }
      } catch {
        // Ignore storage read failure
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setUserProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setAuthReady(true);
      if (u) {
        void fetchProfile(u.uid);
      } else {
        setUserProfile(null);
        setChildLock(null);
      }
    });
    return () => unsub();
  }, [fetchProfile]);

  const handleEnterChildMode = (lock: ActiveChildModeLock) => {
    if (!firebaseUser) return;
    setChildLock(lock);
    try {
      const payload: StoredChildLockPayload = {
        ownerUid: firebaseUser.uid,
        lock,
      };
      localStorage.setItem(CHILD_LOCK_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write failure
    }
  };

  const handleExitChildMode = () => {
    setChildLock(null);
    try {
      localStorage.removeItem(CHILD_LOCK_STORAGE_KEY);
    } catch {
      // Ignore storage removal failure
    }
  };

  const handleEnterSchoolDeviceMode = (lock: ActiveChildModeLock) => {
    if (typeof window !== 'undefined' && window.location.search.includes('qr=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    setSchoolDeviceLock(lock);
  };

  const handleExitSchoolDeviceMode = () => {
    setSchoolDeviceLock(null);
    // If a student logged in with a school Google account (no adult userProfile), sign out cleanly
    if (firebaseUser && !userProfile) {
      void signOut(auth).catch(() => {});
    }
  };

  return (
    <AppErrorBoundary>
      {demoRole ? (
        <div>
          {!cleanDemoViewport && (
            <div className="border-b border-[#E6C785] bg-[#FFF8E8] px-3 py-2 text-xs font-bold text-[#8F5210]">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
                <span>
                  体験デモ（架空データ：ひだまり小 2年1組・はるさん — 実在の児童データは含みません）
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { key: 'child', label: '1. 児童の冒険ゲーム' },
                      { key: 'parent', label: '2. 保護者の画面' },
                      { key: 'teacher', label: '3. 担任の先生の画面' },
                      { key: 'safety', label: '4. 安全担当者の画面' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => switchDemoRole(item.key)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap ${
                        demoRole === item.key
                          ? 'bg-[#2F7A54] text-white'
                          : 'bg-white text-[#3A3128] border border-[#E6C785] hover:bg-[#FAF5EC]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => switchDemoRole(null)}
                    className="rounded-lg border border-[#DFD5C5] bg-white px-2.5 py-1 text-xs font-bold text-[#6E6254] hover:bg-[#FAF5EC] whitespace-nowrap"
                  >
                    デモ終了
                  </button>
                </div>
              </div>
            </div>
          )}

          {demoRole === 'child' ? (
            <ChildAdventureApp
              lock={buildDemoChildLock()}
              onExitChildMode={() => switchDemoRole(cleanDemoViewport ? 'parent' : null)}
            />
          ) : demoRole === 'parent' ? (
            <ParentDashboard
              user={buildDemoUserAccount('parent')}
              onEnterChildMode={() => switchDemoRole('child')}
              onAccountWithdrawn={() => switchDemoRole(null)}
            />
          ) : demoRole === 'teacher' ? (
            <TeacherDashboard
              user={buildDemoUserAccount('teacher')}
              onEnterChildMode={() => switchDemoRole('child')}
            />
          ) : (
            <SafetyOfficerDashboard user={buildDemoUserAccount('safety')} />
          )}
        </div>
      ) : schoolDeviceLock ? (
        <ChildAdventureApp
          lock={schoolDeviceLock}
          onExitChildMode={handleExitSchoolDeviceMode}
        />
      ) : !authReady || loadingProfile ? (
        <div className="flex min-h-screen items-center justify-center bg-[#FFFDF8] px-4 text-[#3A3128]">
          <div className="rounded-3xl border border-[#EAE2D3] bg-white px-9 py-8 text-center shadow-[0_8px_30px_rgba(92,74,50,0.06)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDF7F0] text-[#2F7A54]">
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <path
                  d="M14 23V11M14 13C14 8 19 5 23 6C23 11 19 14 14 13ZM14 16C14 11 9 8 5 9C5 14 9 17 14 16Z"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="font-heading text-lg font-bold text-[#3A3128]">
              うちの子トリセツ をひらいています...
            </p>
            <p className="mt-1.5 text-xs text-[#6E6254]">
              学校で気づき、家庭で確かめ、一緒に育てる。
            </p>
          </div>
        </div>
      ) : !firebaseUser ? (
        <AuthLandingScreen
          initialInviteCode={initialInviteCode}
          initialQrToken={initialQrToken}
          onEnterSchoolDevice={handleEnterSchoolDeviceMode}
          onStartDemoMode={() => switchDemoRole('child')}
        />
      ) : !userProfile ? (
        <RoleOnboardingScreen
          firebaseUser={firebaseUser}
          initialInviteCode={initialInviteCode}
          initialQrToken={initialQrToken}
          onEnterSchoolDevice={handleEnterSchoolDeviceMode}
          onCompleted={() => {
            if (window.location.search.includes('invite=')) {
              window.history.replaceState({}, '', window.location.pathname);
            }
            void fetchProfile(firebaseUser.uid);
          }}
        />
      ) : childLock && (userProfile.role === 'teacher' || userProfile.role === 'parent') ? (
        <ChildAdventureApp
          lock={childLock}
          adultViewerRole={userProfile.role}
          adultViewerUid={userProfile.uid}
          onExitChildMode={handleExitChildMode}
        />
      ) : userProfile.role === 'school_admin' ? (
        <SchoolAdminDashboard user={userProfile} />
      ) : userProfile.role === 'safety_officer' ? (
        <SafetyOfficerDashboard user={userProfile} />
      ) : userProfile.role === 'teacher' ? (
        <TeacherDashboard user={userProfile} onEnterChildMode={handleEnterChildMode} />
      ) : (
        <ParentDashboard
          user={userProfile}
          onEnterChildMode={handleEnterChildMode}
          onAccountWithdrawn={() => {
            setUserProfile(null);
            setChildLock(null);
          }}
        />
      )}
    </AppErrorBoundary>
  );
}
