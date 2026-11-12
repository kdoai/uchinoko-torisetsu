import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  Building2,
  CheckCircle2,
  Home,
  KeyRound,
  Laptop,
  LogIn,
  LogOut,
  QrCode,
  ShieldCheck,
  Sprout,
  Sun,
  Users,
} from 'lucide-react';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import {
  enterWithSchoolGoogleAccount,
  enterWithStudentQrCard,
  redeemStaffInviteCode,
  registerHomeOnlyParentAccount,
  registerSchoolAdminAccount,
  requestParentSchoolLink,
} from '../lib/firestoreService';
import type { ActiveChildModeLock, UserAccountDoc } from '../types/models';
import { MomoAvatar, SunriseSproutIllustration } from './GameIllustrations';

function friendlyEntryError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  // Unwrap FirestoreErrorInfo JSON only if permission error occurred; otherwise show clean message
  try {
    const parsed = JSON.parse(err.message) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      return fallback;
    }
  } catch {
    // Plain user-facing Error message
  }
  return err.message || fallback;
}

/**
 * Reusable 1-per-Student School Tablet Entry Card (Chromebook / iPad / Windows Browser)
 * Supports:
 * 1) School Google Account (SHA-256 pseudonymous hash — zero raw UID/email stored)
 * 2) Nameless Printable QR Card (`SQR_...` — zero Google login required)
 * 3) Classroom Lesson Window (`授業で遊ぶ`) vs. Take-Home School Device (`持ち帰り`)
 */
const StudentSchoolDeviceEntryCard: React.FC<{
  initialQrToken?: string;
  currentGoogleUser?: User | null;
  onEnterSchoolDevice: (lock: ActiveChildModeLock) => void;
}> = ({ initialQrToken = '', currentGoogleUser = null, onEnterSchoolDevice }) => {
  const [method, setMethod] = useState<'google' | 'qr'>(initialQrToken ? 'qr' : 'google');
  const [playMode, setPlayMode] = useState<'classroom' | 'take_home'>('classroom');
  const [classJoinCode, setClassJoinCode] = useState('');
  const [needsAttendanceForClass, setNeedsAttendanceForClass] = useState<string | null>(null);
  const [attendanceNumber, setAttendanceNumber] = useState<number>(1);
  const [qrInput, setQrInput] = useState(initialQrToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSchoolGoogleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classJoinCode.trim()) {
      setError('せんせいから おしえてもらった「じゅぎょうコード」を いれてね。');
      return;
    }
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase設定が未構成です。トップ画面の「架空データで全画面を体験（デモ）」をご利用ください。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let activeUser = currentGoogleUser || auth.currentUser;
      if (!activeUser) {
        const cred = await signInWithPopup(auth, googleProvider);
        activeUser = cred.user;
      }
      const res = await enterWithSchoolGoogleAccount({
        googleUid: activeUser.uid,
        classJoinCode: classJoinCode.trim(),
        attendanceNumber: needsAttendanceForClass ? attendanceNumber : undefined,
        mode: playMode,
      });
      if (res.status === 'needs_attendance_number') {
        setNeedsAttendanceForClass(res.className);
        return;
      }
      onEnterSchoolDevice(res.lock);
    } catch (err) {
      setError(
        friendlyEntryError(
          err,
          'はいれませんでした。せんせいが「授業で遊ぶ」を おしているか、コードを たしかめてね。'
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const handleQrStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) {
      setError('QRカードの コード（SQR_から はじまる もじ）を いれてね。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const lock = await enterWithStudentQrCard({
        rawQrInput: qrInput.trim(),
        mode: playMode,
      });
      onEnterSchoolDevice(lock);
    } catch (err) {
      setError(
        friendlyEntryError(
          err,
          'QRカードで はいれませんでした。せんせいが「授業で遊ぶ」を おしているか たしかめてね。'
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border-2 border-[#CFE3D5] bg-[#FFFDF8] p-6 sm:p-7 shadow-[0_10px_32px_rgba(47,122,84,0.08)]">
      <div className="flex items-center gap-3.5">
        <MomoAvatar size={54} />
        <div>
          <div className="text-xs font-bold text-[#2F7A54]">
            じどう・せいと用（Chromebook・iPad・Windows）
          </div>
          <h2 className="font-heading text-xl font-bold text-[#3A3128]">
            がっこうの タブレット・パソコンで はいる
          </h2>
        </div>
      </div>

      {/* Mode Selector: Classroom vs Take-Home */}
      <div className="mt-4">
        <div className="text-xs font-bold text-[#6E6254] mb-1.5">どこで あそぶ？</div>
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#FAF5EC] border border-[#EAE2D3]">
          <button
            type="button"
            onClick={() => {
              setPlayMode('classroom');
              setError('');
            }}
            className={`min-h-[42px] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              playMode === 'classroom'
                ? 'bg-[#2F7A54] text-white'
                : 'text-[#6E6254] hover:text-[#3A3128]'
            }`}
          >
            いま じゅぎょうで あそぶ
          </button>
          <button
            type="button"
            onClick={() => {
              setPlayMode('take_home');
              setError('');
            }}
            className={`min-h-[42px] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              playMode === 'take_home'
                ? 'bg-[#C86428] text-white'
                : 'text-[#6E6254] hover:text-[#3A3128]'
            }`}
          >
            いえに もちかえって あそぶ
          </button>
        </div>
      </div>

      {/* Login Method Selector: School Google Account vs Nameless QR Card */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#EEF7F0] border border-[#CFE3D5]">
        <button
          type="button"
          onClick={() => {
            setMethod('google');
            setError('');
          }}
          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
            method === 'google'
              ? 'bg-[#FFFDF8] text-[#215C3E] shadow-2xs'
              : 'text-[#526B5B] hover:text-[#215C3E]'
          }`}
        >
          <Laptop className="h-4 w-4 shrink-0" />
          <span>学校のアカウント</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod('qr');
            setError('');
          }}
          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
            method === 'qr'
              ? 'bg-[#FFFDF8] text-[#215C3E] shadow-2xs'
              : 'text-[#526B5B] hover:text-[#215C3E]'
          }`}
        >
          <QrCode className="h-4 w-4 shrink-0" />
          <span>QRカード</span>
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-[#B83227]/30 bg-[#FDF1F0] p-3.5 text-xs sm:text-sm font-bold text-[#B83227]">
          {error}
        </div>
      )}

      {method === 'google' ? (
        <form onSubmit={handleSchoolGoogleStart} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-[#3A3128]">
              せんせいの じゅぎょうコード（CLS_から はじまる もじ）
            </label>
            <input
              type="text"
              maxLength={32}
              value={classJoinCode}
              onChange={(e) => {
                setClassJoinCode(e.target.value.toUpperCase());
                setNeedsAttendanceForClass(null);
              }}
              placeholder="れい：CLS_AB23CD"
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-[#DFD5C5] bg-white px-4 font-mono text-base font-bold text-[#3A3128] focus:border-[#2F7A54]"
            />
          </div>

          {needsAttendanceForClass && (
            <div className="rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] p-3.5 space-y-2">
              <p className="text-xs font-bold text-[#215C3E]">
                はじめて はいるので、「{needsAttendanceForClass}」の しゅっせきばんごうを えらんでね（つぎからは いりません）
              </p>
              <select
                value={attendanceNumber}
                onChange={(e) => setAttendanceNumber(Number(e.target.value))}
                className="min-h-[46px] w-full rounded-xl border border-[#BFE0C9] bg-white px-3.5 text-base font-bold text-[#3A3128] tabular-nums"
              >
                {Array.from({ length: 45 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}ばん
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2F7A54] border-b-4 border-[#1F563B] px-6 py-3 font-heading text-base font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#256344] disabled:opacity-60"
          >
            <Laptop className="h-5 w-5" />
            <span>
              {busy
                ? 'じゅんび して います...'
                : needsAttendanceForClass
                  ? 'この ばんごうで たんけんに はいる！'
                  : '学校のアカウントで たんけんに はいる'}
            </span>
          </button>

          <p className="text-[11px] leading-relaxed text-[#6E6254]">
            ※学校のGoogleアカウントのIDやメールアドレスはそのまま保存せず、復元できない仮の記号に変換して扱います。
          </p>
        </form>
      ) : (
        <form onSubmit={handleQrStart} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-[#3A3128]">
              せんせいから もらった QRカードの コード（SQR_...）
            </label>
            <input
              type="text"
              maxLength={120}
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="カメラで QRを よむか、SQR_... を いれてね"
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-[#DFD5C5] bg-white px-4 font-mono text-sm font-bold text-[#3A3128] focus:border-[#2F7A54]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C86428] border-b-4 border-[#964718] px-6 py-3 font-heading text-base font-bold text-white whitespace-nowrap transition-transform active:translate-y-0.5 hover:bg-[#B0541E] disabled:opacity-60"
          >
            <QrCode className="h-5 w-5" />
            <span>{busy ? 'かくにん して います...' : 'QRカードで たんけんに はいる'}</span>
          </button>

          <p className="text-[11px] leading-relaxed text-[#6E6254]">
            ※学校のアカウントがない場合でも、氏名を入れない1人1枚のQRカードでブラウザからそのまま参加できます。
          </p>
        </form>
      )}
    </div>
  );
};

export const AuthLandingScreen: React.FC<{
  initialInviteCode: string;
  initialQrToken?: string;
  onEnterSchoolDevice: (lock: ActiveChildModeLock) => void;
  onStartDemoMode?: () => void;
}> = ({ initialInviteCode, initialQrToken = '', onEnterSchoolDevice, onStartDemoMode }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase環境変数が未設定です。「架空データで全画面を体験（デモ）」から全画面をお試しいただけます。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      setError(
        'Googleログインを完了できませんでした。ポップアップのブロック設定をご確認ください。'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#3A3128]">
      {/* Clean Top Bar Contract: Brand Wordmark on Left, 1 Primary Adult Login Action on Right */}
      <header className="border-b border-[#EAE2D3] bg-white/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EDF7F0] text-[#2F7A54]">
              <Sprout className="h-5 w-5" />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-[#3A3128] whitespace-nowrap">
              うちの子トリセツ
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={busy}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl bg-[#2F7A54] px-5 py-2.5 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344] disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            <span>{busy ? 'ログイン中...' : '保護者・先生のログイン'}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-12">
        {/* Hero Split: Left Brand Story + Right 1-per-Student School Device Entry & Adult Login */}
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-bold text-[#215C3E]">
                <Sun className="h-4 w-4 text-[#C86428]" />
                <span>学校の1人1台端末とご家庭をつなぐ関わり方の記録帳</span>
              </div>

              <h1 className="mt-3 font-heading text-3xl font-bold leading-snug text-[#3A3128] sm:text-4xl">
                学校で気づき、家庭で確かめ、
                <br className="hidden sm:inline" />
                一緒に育てる。
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6E6254]">
                学校のChromebook・iPad・Windowsブラウザから学級みんなで同じ時間に「がっこう たんけん」を遊べます。
                お子さま自身の声、おかいもの・はいたつゲームで見えた条件の違い、先生とご家庭の気づきを並べて、安心して力を発揮できる工夫を見つけます。
              </p>
            </div>

            {initialInviteCode && (
              <div className="rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] p-4 sm:p-5">
                <p className="text-sm font-bold text-[#215C3E]">
                  招待コード（<span className="font-mono">{initialInviteCode}</span>
                  ）を受け取りました
                </p>
                <p className="mt-1 text-xs text-[#3A3128]">
                  下の「保護者・先生・学校管理者の方はこちら」からGoogleログインすると登録画面へ進みます。
                </p>
              </div>
            )}

            <SunriseSproutIllustration />

            {/* Adult Login Card (Parents, Teachers, Safety Officers, School Admins) */}
            <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-xs">
              <h2 className="font-heading text-lg font-bold text-[#3A3128]">
                保護者・担任の先生・安全担当・学校管理者の方はこちら
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#6E6254]">
                授業での一斉プレイ開始（「授業で遊ぶ」ボタン）、氏名なしQRカードの印刷、ご家庭での任意プレイや「参加しない（記録を取らない）」設定はこちらから行えます。
              </p>

              {error && (
                <div className="mt-3 rounded-2xl border border-[#B83227]/30 bg-[#FDF1F0] p-3 text-xs font-bold text-[#B83227]">
                  {error}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={busy}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 border-[#2F7A54] bg-[#EDF7F0] px-6 py-2.5 text-sm font-bold text-[#215C3E] whitespace-nowrap transition-colors hover:bg-[#DFF0E5] disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4 text-[#2F7A54]" />
                  <span>{busy ? '認証画面を開いています...' : '大人用画面へGoogleでログイン'}</span>
                </button>

                {onStartDemoMode && (
                  <button
                    type="button"
                    onClick={onStartDemoMode}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 border-[#E6C785] bg-[#FFF8E8] px-5 py-2.5 text-sm font-bold text-[#8F5210] whitespace-nowrap transition-colors hover:bg-[#FCEFD0]"
                  >
                    <Users className="h-4 w-4 text-[#C86428]" />
                    <span>架空データで全画面を体験（デモ）</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Primary Right Column: 1-per-Student School Tablet Entry */}
          <div className="lg:col-span-6">
            <StudentSchoolDeviceEntryCard
              initialQrToken={initialQrToken}
              onEnterSchoolDevice={onEnterSchoolDevice}
            />
          </div>
        </div>

        {/* 3 Warm Reassurance Promises */}
        <section className="mt-14 border-t border-[#EAE2D3] pt-10">
          <h2 className="font-heading text-lg font-bold text-[#3A3128]">
            学校の1人1台端末でも安心して使うための3つの約束
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <div className="rounded-3xl border border-[#EAE2D3] bg-[#FAF5EC]/70 p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-[#215C3E]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2F7A54]" />
                <span>学校アカウントのIDは保存しません</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[#6E6254]">
                Google Workspace for Education等のIDやメールアドレスはそのまま保存せず仮の記号に変えて扱い、氏名のないQRカードにも対応しています。
              </p>
            </div>

            <div className="rounded-3xl border border-[#EAE2D3] bg-[#FAF5EC]/70 p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-[#9A4816]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#C86428]" />
                <span>授業の時間だけ開き、人数だけ表示</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[#6E6254]">
                先生が「授業で遊ぶ」を押した時間だけ学級から入れます。授業中の先生画面には入っている人数だけを表示し、誰の結果も出しません。
              </p>
            </div>

            <div className="rounded-3xl border border-[#EAE2D3] bg-[#FAF5EC]/70 p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-[#1F5654]">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2B6E6B]" />
                <span>「参加しない」選択も周りに分かりません</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[#6E6254]">
                保護者の方は「参加しない」を選べます。参加しないお子さまも同じ見た目のゲーム・ガチャで過ごせるため周りに分からず、記録は一切残しません。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

// ============================================================================
// Initial Role Setup Screen (Shown after Google Sign-In when users/{uid} is new)
// Includes "児童・生徒（学校の1人1台端末）" so students who signed in first never create adult accounts!
// ============================================================================
type SetupTab =
  | 'student_device'
  | 'parent_invite'
  | 'parent_home_only'
  | 'staff_invite'
  | 'school_admin';

export const RoleOnboardingScreen: React.FC<{
  firebaseUser: User;
  initialInviteCode: string;
  initialQrToken?: string;
  onEnterSchoolDevice: (lock: ActiveChildModeLock) => void;
  onCompleted: () => void;
}> = ({
  firebaseUser,
  initialInviteCode,
  initialQrToken = '',
  onEnterSchoolDevice,
  onCompleted,
}) => {
  const defaultTab: SetupTab = initialInviteCode.startsWith('STF_')
    ? 'staff_invite'
    : initialInviteCode.startsWith('FAM_')
      ? 'parent_invite'
      : 'student_device';

  const [tab, setTab] = useState<SetupTab>(defaultTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Parent with invite state
  const [parentInviteCode, setParentInviteCode] = useState(
    initialInviteCode.startsWith('STF_') ? '' : initialInviteCode
  );

  // Parent home-only state
  const [homeNickname, setHomeNickname] = useState('');
  const [homeGrade, setHomeGrade] = useState(1);

  // Staff invite state
  const [staffCode, setStaffCode] = useState(
    initialInviteCode.startsWith('STF_') ? initialInviteCode : ''
  );
  const [staffDisplayLabel, setStaffDisplayLabel] = useState('');

  // School admin state
  const [schoolCodeLabel, setSchoolCodeLabel] = useState('');
  const [academicYear, setAcademicYear] = useState(`${new Date().getFullYear()}年度`);
  const [retentionMonths, setRetentionMonths] = useState(12);
  const [primaryLabel, setPrimaryLabel] = useState('養護教諭（主担当）');
  const [deputyLabel, setDeputyLabel] = useState('生徒指導・教育相談担当（副担当）');
  const [managerLabel, setManagerLabel] = useState('教頭・校長（管理職）');

  const handleParentInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentInviteCode.trim()) {
      setError('学校から配られた招待コードを入力してください。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await requestParentSchoolLink({
        uid: firebaseUser.uid,
        inviteCode: parentInviteCode.trim(),
        existingUser: null,
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待コードの確認に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleParentHomeOnlySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeNickname.trim()) {
      setError('お子さんのニックネーム（実名ではない呼び名）を入力してください。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await registerHomeOnlyParentAccount({
        uid: firebaseUser.uid,
        nickname: homeNickname.trim(),
        grade: homeGrade,
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '家庭利用の登録に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleStaffInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffCode.trim()) {
      setError('学校管理者から発行された教職員用招待コードを入力してください。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await redeemStaffInviteCode({
        uid: firebaseUser.uid,
        inviteCode: staffCode.trim(),
        displayLabel: staffDisplayLabel.trim() || '担当教職員',
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '教職員招待コードの登録に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleSchoolAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolCodeLabel.trim()) {
      setError('学校の識別コードまたは管理用名称を入力してください。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await registerSchoolAdminAccount({
        uid: firebaseUser.uid,
        schoolCodeLabel: schoolCodeLabel.trim(),
        academicYear,
        retentionMonths,
        primaryOfficerLabel: primaryLabel,
        deputyOfficerLabel: deputyLabel,
        managerOfficerLabel: managerLabel,
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '学校管理者アカウントの作成に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#3A3128]">
      <header className="border-b border-[#EAE2D3] bg-white/95">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EDF7F0] text-[#2F7A54]">
              <Sprout className="h-5 w-5" />
            </div>
            <h1 className="font-heading text-base font-bold text-[#3A3128] whitespace-nowrap">
              うちの子トリセツ — はじめの設定
            </h1>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DFD5C5] bg-white px-4 py-2 text-xs font-bold text-[#6E6254] whitespace-nowrap transition-colors hover:bg-[#FAF5EC]"
          >
            <LogOut className="h-4 w-4" />
            <span>ログアウト・別のアカウントへ</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-9 sm:px-6">
        <h2 className="font-heading text-2xl font-bold text-[#3A3128]">
          ご利用の立場を選んでください
        </h2>
        <p className="mt-1.5 text-sm text-[#6E6254]">
          学校のタブレットで遊ぶ児童・生徒のみなさんは一番左の「児童・生徒（がっこう たんけん）」を選んでね。
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => {
              setTab('student_device');
              setError('');
            }}
            className={`flex min-h-[88px] flex-col items-start justify-between rounded-2xl border-2 p-4 text-left transition-colors ${
              tab === 'student_device'
                ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#3A3128]'
                : 'border-[#EAE2D3] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
            }`}
          >
            <Laptop className="h-5 w-5 text-[#2F7A54]" />
            <span className="mt-2.5 text-sm font-bold text-[#3A3128]">
              児童・生徒（がっこう たんけん）
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('parent_invite');
              setError('');
            }}
            className={`flex min-h-[88px] flex-col items-start justify-between rounded-2xl border-2 p-4 text-left transition-colors ${
              tab === 'parent_invite'
                ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#3A3128]'
                : 'border-[#EAE2D3] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
            }`}
          >
            <KeyRound className="h-5 w-5 text-[#2F7A54]" />
            <span className="mt-2.5 text-sm font-bold text-[#3A3128]">
              保護者（学校の招待コード）
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('parent_home_only');
              setError('');
            }}
            className={`flex min-h-[88px] flex-col items-start justify-between rounded-2xl border-2 p-4 text-left transition-colors ${
              tab === 'parent_home_only'
                ? 'border-[#C86428] bg-[#FFF3E6] text-[#3A3128]'
                : 'border-[#EAE2D3] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
            }`}
          >
            <Home className="h-5 w-5 text-[#C86428]" />
            <span className="mt-2.5 text-sm font-bold text-[#3A3128]">
              保護者（家庭だけで使う）
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('staff_invite');
              setError('');
            }}
            className={`flex min-h-[88px] flex-col items-start justify-between rounded-2xl border-2 p-4 text-left transition-colors ${
              tab === 'staff_invite'
                ? 'border-[#2B6E6B] bg-[#EAF5F4] text-[#3A3128]'
                : 'border-[#EAE2D3] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
            }`}
          >
            <Users className="h-5 w-5 text-[#2B6E6B]" />
            <span className="mt-2.5 text-sm font-bold text-[#3A3128]">
              先生・安全担当（招待）
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('school_admin');
              setError('');
            }}
            className={`flex min-h-[88px] flex-col items-start justify-between rounded-2xl border-2 p-4 text-left transition-colors ${
              tab === 'school_admin'
                ? 'border-[#2B6E6B] bg-[#EAF5F4] text-[#3A3128]'
                : 'border-[#EAE2D3] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
            }`}
          >
            <Building2 className="h-5 w-5 text-[#2B6E6B]" />
            <span className="mt-2.5 text-sm font-bold text-[#3A3128]">
              学校管理者（新規設定）
            </span>
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-[#B83227]/30 bg-[#FDF1F0] p-4 text-sm font-bold text-[#B83227]">
            {error}
          </div>
        )}

        {tab === 'student_device' ? (
          <div className="mt-6 max-w-xl">
            <StudentSchoolDeviceEntryCard
              initialQrToken={initialQrToken}
              currentGoogleUser={firebaseUser}
              onEnterSchoolDevice={onEnterSchoolDevice}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_8px_28px_rgba(92,74,50,0.05)] sm:p-8">
            {tab === 'parent_invite' && (
              <form onSubmit={handleParentInviteSubmit} className="space-y-5">
                <div>
                  <h3 className="font-heading text-xl font-bold text-[#3A3128]">
                    学校から配られた招待コードで連携する
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#6E6254]">
                    案内用紙に記載された招待コード（FAM_から始まるコード）を入力してください。送信後、学校側が確認して承認するとお子さんの記録とつながります。
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#3A3128]">招待コード</label>
                  <input
                    type="text"
                    value={parentInviteCode}
                    onChange={(e) => setParentInviteCode(e.target.value)}
                    placeholder="例：FAM_XXXXXXXXXXXX"
                    className="mt-2 min-h-[50px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 font-mono text-base text-[#3A3128] focus:border-[#2F7A54]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[50px] rounded-2xl bg-[#2F7A54] px-7 py-3 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344] disabled:opacity-60"
                >
                  {busy ? '申請を送信中...' : '学校へ紐付け申請を送る'}
                </button>
              </form>
            )}

            {tab === 'parent_home_only' && (
              <form onSubmit={handleParentHomeOnlySubmit} className="space-y-5">
                <div>
                  <h3 className="font-heading text-xl font-bold text-[#3A3128]">
                    学校とつながらず、ご家庭だけで使い始める
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#6E6254]">
                    学校が未導入でも、ご家庭での様子や工夫の記録、わが子のトリセツ作成、相談先を調べる画面、医師に渡すメモ作成をすぐにご利用いただけます。あとから学校の招待コードで連携することも可能です。
                  </p>
                </div>
                <div className="rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6]/70 p-4 text-xs leading-relaxed text-[#6E6254]">
                  ※子どもの安全対応の手順を専門職と決める前の段階では、家庭単独モードでの子ども向け冒険ゲームはロックされています。また、お子さんの実名ではなくニックネームをご入力ください。
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">
                      お子さんのニックネーム（実名は入れないでください）
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={homeNickname}
                      onChange={(e) => setHomeNickname(e.target.value)}
                      placeholder="例：ひなた、はる など"
                      className="mt-2 min-h-[50px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 text-sm text-[#3A3128] focus:border-[#2F7A54]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">学年</label>
                    <select
                      value={homeGrade}
                      onChange={(e) => setHomeGrade(Number(e.target.value))}
                      className="mt-2 min-h-[50px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 text-sm text-[#3A3128] focus:border-[#2F7A54]"
                    >
                      {[1, 2, 3, 4, 5, 6].map((g) => (
                        <option key={g} value={g}>
                          小学{g}年生
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[50px] rounded-2xl bg-[#2F7A54] px-7 py-3 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344] disabled:opacity-60"
                >
                  {busy ? '登録中...' : '家庭だけで利用を始める'}
                </button>
              </form>
            )}

            {tab === 'staff_invite' && (
              <form onSubmit={handleStaffInviteSubmit} className="space-y-5">
                <div>
                  <h3 className="font-heading text-xl font-bold text-[#3A3128]">
                    先生・安全対応担当者として参加する
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#6E6254]">
                    学校管理者から発行された招待コード（STF_から始まるコード）を入力してください。担当学級のみを見る「担任」または安全連絡のみを扱う「安全対応担当者」として登録されます。
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">
                      教職員用 招待コード
                    </label>
                    <input
                      type="text"
                      value={staffCode}
                      onChange={(e) => setStaffCode(e.target.value)}
                      placeholder="例：STF_XXXXXXXXXXXX"
                      className="mt-2 min-h-[50px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 font-mono text-sm text-[#3A3128] focus:border-[#2B6E6B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">
                      校内表示用の役割名（個人名の代わりに職名・担当名を推奨）
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={staffDisplayLabel}
                      onChange={(e) => setStaffDisplayLabel(e.target.value)}
                      placeholder="例：1年1組担任、養護教諭"
                      className="mt-2 min-h-[50px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 text-sm text-[#3A3128] focus:border-[#2B6E6B]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[50px] rounded-2xl bg-[#2B6E6B] px-7 py-3 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#225957] disabled:opacity-60"
                >
                  {busy ? '登録中...' : '招待コードで参加する'}
                </button>
              </form>
            )}

            {tab === 'school_admin' && (
              <form onSubmit={handleSchoolAdminSubmit} className="space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#2B6E6B]" />
                    <h3 className="font-heading text-xl font-bold text-[#3A3128]">
                      学校管理者アカウントを作成する
                    </h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#6E6254]">
                    学級の作成、担任と安全対応担当者の招待、保護者招待用紙の印刷、保存期間とアクセス履歴の管理を行います。
                    ※学校管理者は児童一人ひとりの観察・ゲーム記録や安全連絡の中身を閲覧しない設計になっています。
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">
                      学校識別ラベル（校内管理用）
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={schoolCodeLabel}
                      onChange={(e) => setSchoolCodeLabel(e.target.value)}
                      placeholder="例：みどり市立第一小（管理用）"
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">年度</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">
                      学校側の記録保存期間（月数）
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={retentionMonths}
                      onChange={(e) => setRetentionMonths(Number(e.target.value))}
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128] tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">
                      安全対応：主担当の職名
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={primaryLabel}
                      onChange={(e) => setPrimaryLabel(e.target.value)}
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">
                      安全対応：副担当の職名
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={deputyLabel}
                      onChange={(e) => setDeputyLabel(e.target.value)}
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3A3128]">
                      安全対応：管理職の職名
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={managerLabel}
                      onChange={(e) => setManagerLabel(e.target.value)}
                      className="mt-2 min-h-[48px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[50px] rounded-2xl bg-[#2B6E6B] px-7 py-3 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#225957] disabled:opacity-60"
                >
                  {busy ? '学校環境を作成中...' : '学校管理画面を作成する'}
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export const LinkAdditionalSchoolModal: React.FC<{
  open: boolean;
  uid: string;
  existingUser: UserAccountDoc;
  onClose: () => void;
  onLinked: () => void;
}> = ({ open, uid, existingUser, onClose, onLinked }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('学校から配られた招待コードを入力してください。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await requestParentSchoolLink({
        uid,
        inviteCode: code.trim(),
        existingUser,
      });
      onLinked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '紐付け申請に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3A3128]/35 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-xl sm:p-7"
      >
        <h3 className="font-heading text-lg font-bold text-[#3A3128]">
          学校の招待コードで連携する
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#6E6254]">
          学校から配られた案内用紙の招待コード（FAM_...）を入力して申請すると、学校側の承認後に連携が始まります。
        </p>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="FAM_XXXXXXXXXXXX"
          className="mt-4 min-h-[50px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 font-mono text-sm text-[#3A3128] focus:border-[#2F7A54]"
        />
        {error && <p className="mt-2 text-xs font-bold text-[#B83227]">{error}</p>}

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-xl border border-[#DFD5C5] bg-white px-4 py-2 text-sm font-bold text-[#6E6254] transition-colors hover:bg-[#FAF5EC]"
          >
            閉じる
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[46px] rounded-xl bg-[#2F7A54] px-5 py-2 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344] disabled:opacity-60"
          >
            {busy ? '送信中...' : '申請を送る'}
          </button>
        </div>
      </form>
    </div>
  );
};
