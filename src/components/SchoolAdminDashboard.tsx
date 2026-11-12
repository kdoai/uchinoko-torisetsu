import React, { useCallback, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileText,
  KeyRound,
  LogOut,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import {
  createSchoolClass,
  deleteStudentRegistrationByAdmin,
  issueClassNamelessQrCards,
  issueStaffInvite,
  issueStudentParentInvite,
  loadSchoolAdminBundle,
  moveStudentClassByAdmin,
  registerSchoolStudentsBatch,
  respondToParentLinkRequestByAdmin,
  revokeStaffInvite,
  setStudentParticipationOptOut,
  updateSchoolSettings,
  updateStaffMembershipByAdmin,
  type PrintableNamelessQrCard,
  type SchoolAdminBundle,
} from '../lib/firestoreService';
import type {
  SafetyTier,
  SchoolClassDoc,
  StudentDoc,
  StudentInviteDoc,
  UserAccountDoc,
} from '../types/models';
import { PrintableExportModal } from './CommonUI';

type AdminTab = 'precheck' | 'classes_staff' | 'students_invites' | 'audit_stats';

export const SchoolAdminDashboard: React.FC<{
  user: UserAccountDoc;
}> = ({ user }) => {
  const [bundle, setBundle] = useState<SchoolAdminBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AdminTab>('precheck');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // School settings form state
  const [schoolCodeLabel, setSchoolCodeLabel] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [retentionMonths, setRetentionMonths] = useState(12);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);
  const [check4, setCheck4] = useState(false);
  const [check5, setCheck5] = useState(false);
  const [dirSup, setDirSup] = useState('');
  const [dirVer, setDirVer] = useState('');
  const [safSup, setSafSup] = useState('');
  const [safVer, setSafVer] = useState('');
  const [primaryLabel, setPrimaryLabel] = useState('');
  const [deputyLabel, setDeputyLabel] = useState('');
  const [managerLabel, setManagerLabel] = useState('');
  const [deputyMins, setDeputyMins] = useState(30);
  const [managerMins, setManagerMins] = useState(90);
  const [offHoursRule, setOffHoursRule] = useState('');

  // Class creation
  const [newClassName, setNewClassName] = useState('1年1組');
  const [newClassGrade, setNewClassGrade] = useState(1);

  // Staff invite creation
  const [staffTargetRole, setStaffTargetRole] = useState<'teacher' | 'safety_officer'>('teacher');
  const [staffClassId, setStaffClassId] = useState('');
  const [staffSafetyTier, setStaffSafetyTier] = useState<SafetyTier>('primary');
  const [staffTitleLabel, setStaffTitleLabel] = useState('');

  // Student batch registration
  const [selectedClassIdForStu, setSelectedClassIdForStu] = useState('');
  const [batchLines, setBatchLines] = useState('1, ひなた\n2, あおい\n3, そら');

  // Class reassignment state
  const [movingStudentId, setMovingStudentId] = useState('');
  const [targetMoveClassId, setTargetMoveClassId] = useState('');
  const [targetMoveNum, setTargetMoveNum] = useState(1);

  // Printable family guide modal
  const [guideInvite, setGuideInvite] = useState<{
    student: StudentDoc;
    cls?: SchoolClassDoc;
    invite: StudentInviteDoc;
  } | null>(null);

  // Printable 1-per-student nameless QR cards modal
  const [qrClassId, setQrClassId] = useState('');
  const [adminQrCards, setAdminQrCards] = useState<PrintableNamelessQrCard[]>([]);
  const [adminQrModalOpen, setAdminQrModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadSchoolAdminBundle(user.uid, user.schoolId);
      setBundle(data);
      const s = data.school;
      setSchoolCodeLabel(s.schoolCodeLabel);
      setAcademicYear(s.academicYear);
      setRetentionMonths(s.retentionMonths);
      setCheck1(s.checkBoardApproved);
      setCheck2(s.checkParentConsent);
      setCheck3(s.checkChildExplain);
      setCheck4(s.checkSpecialistDocs);
      setCheck5(s.checkSafetyWorkflow);
      setDirSup(s.directorySupervisor);
      setDirVer(s.directoryVersion);
      setSafSup(s.safetySupervisor);
      setSafVer(s.safetyVersion);
      setPrimaryLabel(s.primaryOfficerLabel);
      setDeputyLabel(s.deputyOfficerLabel);
      setManagerLabel(s.managerOfficerLabel);
      setDeputyMins(s.escalateToDeputyMinutes);
      setManagerMins(s.escalateToManagerMinutes);
      setOffHoursRule(s.offHoursRule);
      if (data.classes.length > 0) {
        setStaffClassId((prev) => prev || data.classes[0].classId);
        setSelectedClassIdForStu((prev) => prev || data.classes[0].classId);
        setTargetMoveClassId((prev) => prev || data.classes[0].classId);
        setQrClassId((prev) => prev || data.classes[0].classId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '学校管理データの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [user.uid, user.schoolId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyText = async (txt: string, label: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setNotice(`${label}をコピーしました。`);
    } catch {
      setNotice(txt);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundle) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await updateSchoolSettings(bundle.school, {
        schoolCodeLabel,
        academicYear,
        retentionMonths,
        checkBoardApproved: check1,
        checkParentConsent: check2,
        checkChildExplain: check3,
        checkSpecialistDocs: check4,
        checkSafetyWorkflow: check5,
        directorySupervisor: dirSup,
        directoryVersion: dirVer,
        safetySupervisor: safSup,
        safetyVersion: safVer,
        primaryOfficerLabel: primaryLabel,
        deputyOfficerLabel: deputyLabel,
        managerOfficerLabel: managerLabel,
        escalateToDeputyMinutes: deputyMins,
        escalateToManagerMinutes: managerMins,
        offHoursRule,
      });
      await refresh();
      setNotice('学校設定と利用開始前チェックを保存しました。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundle || !newClassName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await createSchoolClass({
        schoolId: bundle.school.schoolId,
        adminUid: user.uid,
        className: newClassName.trim(),
        grade: newClassGrade,
        academicYear: bundle.school.academicYear,
      });
      await refresh();
      setNotice(`学級「${newClassName.trim()}」を作成しました。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '学級の作成に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleIssueStaffCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundle) return;
    if (staffTargetRole === 'teacher' && !staffClassId) {
      setError('担任を招待する場合は担当学級を選択してください。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const inv = await issueStaffInvite({
        schoolId: bundle.school.schoolId,
        adminUid: user.uid,
        targetRole: staffTargetRole,
        classId: staffTargetRole === 'teacher' ? staffClassId : '',
        safetyTier: staffTargetRole === 'safety_officer' ? staffSafetyTier : 'none',
        roleTitleLabel:
          staffTitleLabel.trim() ||
          (staffTargetRole === 'teacher' ? '学級担任' : '安全対応担当者'),
      });
      await refresh();
      setNotice(`教職員招待コード（${inv.inviteCode}）を発行しました。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待コードの発行に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundle) return;
    const targetClass = bundle.classes.find((c) => c.classId === selectedClassIdForStu);
    if (!targetClass) {
      setError('登録先の学級を選択してください。');
      return;
    }
    const parsed = batchLines
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,、\t]/).map((p) => p.trim());
        const num = Number(parts[0]);
        const nick = parts[1] || '';
        return { attendanceNumber: num, nickname: nick };
      })
      .filter((item) => Number.isFinite(item.attendanceNumber) && item.nickname.length > 0);

    if (parsed.length === 0) {
      setError('「出席番号, ニックネーム」の形式で1行ずつ入力してください。');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await registerSchoolStudentsBatch({
        school: bundle.school,
        targetClass,
        entries: parsed,
      });
      await refresh();
      setNotice(`${parsed.length}名の児童（出席番号・ニックネーム）を登録しました。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '児童登録に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const pendingParentReqs =
    bundle?.parentLinkRequests.filter((r) => r.status === 'pending') || [];

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#3A3128]">
      <header className="border-b border-[#EAE2D3] bg-white/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF5F4] text-[#2B6E6B]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-base font-bold text-[#3A3128]">
                うちの子トリセツ — 学校管理画面
              </h1>
              <p className="text-xs text-[#6E6254]">
                {bundle?.school.schoolCodeLabel || '読み込み中'}（{bundle?.school.academicYear}）
                ／ 個別の児童記録・安全連絡本文は表示されません
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DFD5C5] bg-white px-4 py-2 text-xs font-bold text-[#3A3128] whitespace-nowrap transition-colors hover:bg-[#FAF5EC]"
            >
              <RefreshCw className="h-4 w-4" />
              更新
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DFD5C5] bg-white px-4 py-2 text-xs font-bold text-[#6E6254] whitespace-nowrap transition-colors hover:bg-[#FAF5EC]"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        {pendingParentReqs.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] px-5 py-3.5 text-sm font-bold text-[#3A3128] tabular-nums">
            <span>確認が必要な保護者紐付け申請が {pendingParentReqs.length} 件あります。</span>
            <button
              type="button"
              onClick={() => setTab('students_invites')}
              className="min-h-[44px] rounded-xl bg-[#2F7A54] px-4 py-2 text-xs font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344]"
            >
              申請を確認する
            </button>
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] px-4 py-3 text-sm font-bold text-[#215C3E]">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-[#B83227]/30 bg-[#FDF1F0] px-4 py-3 text-sm font-bold text-[#B83227]">
            {error}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-7 flex flex-wrap gap-2 border-b border-[#EAE2D3] pb-3.5">
          {(
            [
              {
                key: 'precheck',
                label: '1. 利用開始前チェック・安全体制',
                icon: ClipboardCheck,
              },
              {
                key: 'classes_staff',
                label: '2. 学級・担任・安全担当の招待',
                icon: Users,
              },
              {
                key: 'students_invites',
                label: '3. 児童登録・家庭招待・承認',
                icon: KeyRound,
              },
              {
                key: 'audit_stats',
                label: '4. 利用件数・アクセス履歴',
                icon: FileText,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`inline-flex min-h-[46px] items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                  tab === item.key
                    ? 'bg-[#2B6E6B] text-white shadow-[0_3px_10px_rgba(43,110,107,0.2)]'
                    : 'border border-[#EAE2D3] bg-white text-[#6E6254] hover:bg-[#FAF5EC]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {loading || !bundle ? (
          <div className="rounded-3xl border border-[#EAE2D3] bg-white p-9 text-center text-sm text-[#6E6254]">
            学校設定を読み込んでいます...
          </div>
        ) : (
          <>
            {/* TAB 1: Pre-Use 5-Item Checklist & School Governance */}
            {tab === 'precheck' && (
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-heading text-lg font-bold text-[#3A3128]">
                        利用開始前に決めておく5つの確認（必須ゲート）
                      </h2>
                      <p className="mt-1 text-sm text-[#6E6254]">
                        5項目すべてにチェックを入れて保存するまで、児童登録と保護者招待は開始できません。
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold whitespace-nowrap ${
                        bundle.school.allPreChecksDone ? 'text-[#215C3E]' : 'text-[#9A4816]'
                      }`}
                    >
                      {bundle.school.allPreChecksDone ? '確認完了（運用可能）' : '未完了の項目あり'}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {[
                      {
                        checked: check1,
                        set: setCheck1,
                        title: '1. 教育委員会の承認を得た（個人情報・外部AIサービス利用の手続き完了）',
                      },
                      {
                        checked: check2,
                        set: setCheck2,
                        title: '2. 保護者への事前説明と同意取得の手順を整えた（使わない選択の尊重を含む）',
                      },
                      {
                        checked: check3,
                        set: setCheck3,
                        title: '3. 子ども本人への事前説明の手順を整えた（テストではないこと・休めること）',
                      },
                      {
                        checked: check4,
                        set: setCheck4,
                        title: '4. 相談先対応表および緊急安全文言の専門職（医師・心理職等）確認を完了した',
                      },
                      {
                        checked: check5,
                        set: setCheck5,
                        title: '5. 校内の安全対応体制（主担当・副担当・管理職・段階通知時間・夜間休日ルール）を定めた',
                      },
                    ].map((row) => (
                      <label
                        key={row.title}
                        className={`flex min-h-[50px] cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors ${
                          row.checked
                            ? 'border-[#BFE0C9] bg-[#EDF7F0] text-[#3A3128]'
                            : 'border-[#EAE2D3] bg-[#FAF5EC]/70 text-[#3A3128]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={row.checked}
                          onChange={(e) => row.set(e.target.checked)}
                          className="h-5 w-5 accent-[#2F7A54]"
                        />
                        <span>{row.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h3 className="font-heading text-base font-bold text-[#3A3128]">
                    学校基本情報・記録保存期間・監修情報の記録
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        学校識別ラベル
                      </label>
                      <input
                        type="text"
                        value={schoolCodeLabel}
                        onChange={(e) => setSchoolCodeLabel(e.target.value)}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">年度</label>
                      <input
                        type="text"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        学校側の保存期間（月数）
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={retentionMonths}
                        onChange={(e) => setRetentionMonths(Number(e.target.value))}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128] tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        相談先対応表（第9章）の監修・確認者名と版番号
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          type="text"
                          value={dirSup}
                          onChange={(e) => setDirSup(e.target.value)}
                          placeholder="監修者名"
                          className="min-h-[46px] flex-1 rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                        />
                        <input
                          type="text"
                          value={dirVer}
                          onChange={(e) => setDirVer(e.target.value)}
                          placeholder="v1.0"
                          className="min-h-[46px] w-24 rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3 text-sm text-[#3A3128]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        安全対応手順（第12章）の監修・確認者名と版番号
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          type="text"
                          value={safSup}
                          onChange={(e) => setSafSup(e.target.value)}
                          placeholder="監修者名"
                          className="min-h-[46px] flex-1 rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                        />
                        <input
                          type="text"
                          value={safVer}
                          onChange={(e) => setSafVer(e.target.value)}
                          placeholder="v1.0"
                          className="min-h-[46px] w-24 rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3 text-sm text-[#3A3128]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-[#C86428]" />
                    <h3 className="font-heading text-base font-bold text-[#3A3128]">
                      子どもの安全連絡（第12章B）段階的通知体制
                    </h3>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">主担当の職名</label>
                      <input
                        type="text"
                        value={primaryLabel}
                        onChange={(e) => setPrimaryLabel(e.target.value)}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        副担当の職名（未確認時に拡大）
                      </label>
                      <input
                        type="text"
                        value={deputyLabel}
                        onChange={(e) => setDeputyLabel(e.target.value)}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        管理職の職名（さらに未確認時に拡大）
                      </label>
                      <input
                        type="text"
                        value={managerLabel}
                        onChange={(e) => setManagerLabel(e.target.value)}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        副担当へ自動拡大するまでの時間（分）
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={deputyMins}
                        onChange={(e) => setDeputyMins(Number(e.target.value))}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        管理職へ自動拡大するまでの時間（分）
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={2880}
                        value={managerMins}
                        onChange={(e) => setManagerMins(Number(e.target.value))}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128] tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-bold text-[#3A3128]">
                      夜間・休日の対応ルール
                    </label>
                    <textarea
                      rows={2}
                      value={offHoursRule}
                      onChange={(e) => setOffHoursRule(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] p-3 text-sm text-[#3A3128]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[50px] rounded-2xl bg-[#2F7A54] px-7 py-3 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344] disabled:opacity-60"
                  >
                    {busy ? '保存中...' : '設定とチェック状態を保存する'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: Classes & Staff Invitations / Reassignment */}
            {tab === 'classes_staff' && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Create Class */}
                  <form
                    onSubmit={handleCreateClass}
                    className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7"
                  >
                    <h2 className="font-heading text-base font-bold text-[#3A3128]">
                      学級を作成する
                    </h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-[#3A3128]">学級名</label>
                        <input
                          type="text"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          placeholder="例：1年1組"
                          className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#3A3128]">学年</label>
                        <select
                          value={newClassGrade}
                          onChange={(e) => setNewClassGrade(Number(e.target.value))}
                          className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                        >
                          {[1, 2, 3, 4, 5, 6].map((g) => (
                            <option key={g} value={g}>
                              {g}年生
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="mt-4 inline-flex min-h-[46px] items-center gap-1.5 rounded-xl bg-[#2B6E6B] px-5 py-2 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#225957]"
                    >
                      <Plus className="h-4 w-4" />
                      学級を追加
                    </button>

                    <div className="mt-5 space-y-2 border-t border-[#EAE2D3] pt-4">
                      <div className="text-xs font-bold text-[#6E6254]">登録済みの学級</div>
                      {bundle.classes.length === 0 ? (
                        <p className="text-xs text-[#6E6254]">まだ学級がありません。</p>
                      ) : (
                        bundle.classes.map((cls) => (
                          <div
                            key={cls.classId}
                            className="flex items-center justify-between rounded-xl bg-[#FAF5EC] px-4 py-2.5 text-sm"
                          >
                            <span className="font-bold text-[#3A3128]">
                              {cls.className}（{cls.grade}年）
                            </span>
                            <span className="text-xs text-[#6E6254] tabular-nums">
                              児童 {cls.studentIds.length}名 ／{' '}
                              {cls.teacherUid ? '担任割当済' : '担任未割当'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </form>

                  {/* Issue Staff Invite */}
                  <form
                    onSubmit={handleIssueStaffCode}
                    className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7"
                  >
                    <h2 className="font-heading text-base font-bold text-[#3A3128]">
                      担任・安全対応担当者の招待コードを発行
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                      1回限り・有効期限14日の招待コードを発行します。担任は自分の担当学級のみ、安全対応担当者は安全連絡のみにアクセスできます。
                    </p>

                    <div className="mt-4 space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-[#3A3128]">招待する役割</label>
                        <select
                          value={staffTargetRole}
                          onChange={(e) =>
                            setStaffTargetRole(e.target.value as 'teacher' | 'safety_officer')
                          }
                          className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                        >
                          <option value="teacher">学級担任（担当1クラスのみ閲覧）</option>
                          <option value="safety_officer">
                            安全対応担当者（安全連絡のみ閲覧・通常記録は非表示）
                          </option>
                        </select>
                      </div>

                      {staffTargetRole === 'teacher' ? (
                        <div>
                          <label className="block text-xs font-bold text-[#3A3128]">担当学級</label>
                          <select
                            value={staffClassId}
                            onChange={(e) => setStaffClassId(e.target.value)}
                            className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                          >
                            <option value="">学級を選択してください</option>
                            {bundle.classes.map((c) => (
                              <option key={c.classId} value={c.classId}>
                                {c.className}（{c.grade}年）
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-bold text-[#3A3128]">
                            安全対応の段階区分
                          </label>
                          <select
                            value={staffSafetyTier}
                            onChange={(e) => setStaffSafetyTier(e.target.value as SafetyTier)}
                            className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                          >
                            <option value="primary">主担当（養護教諭など）</option>
                            <option value="deputy">副担当（生徒指導・教育相談など）</option>
                            <option value="manager">管理職（教頭・校長）</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-[#3A3128]">
                          役割ラベル（例：1年1組担任、養護教諭）
                        </label>
                        <input
                          type="text"
                          value={staffTitleLabel}
                          onChange={(e) => setStaffTitleLabel(e.target.value)}
                          placeholder="職名・担当名"
                          className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className="min-h-[46px] rounded-xl bg-[#2B6E6B] px-5 py-2 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#225957]"
                      >
                        教職員招待コードを発行する
                      </button>
                    </div>
                  </form>
                </div>

                {/* Issued Staff Codes & Active Staff Memberships (Handover / Reassign) */}
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h3 className="font-heading text-base font-bold text-[#3A3128]">
                    発行済みの教職員招待コード・所属担当の引き継ぎ管理
                  </h3>

                  <div className="mt-4 space-y-2.5">
                    {bundle.staffInvites.map((inv) => {
                      const clsName =
                        bundle.classes.find((c) => c.classId === inv.classId)?.className || '-';
                      return (
                        <div
                          key={inv.inviteCode}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] px-4 py-3 text-sm"
                        >
                          <div>
                            <span className="font-mono font-bold text-[#3A3128]">
                              {inv.inviteCode}
                            </span>
                            <span className="ml-3 text-xs text-[#6E6254]">
                              {inv.targetRole === 'teacher'
                                ? `担任（${clsName}）`
                                : `安全対応担当（${inv.safetyTier}）`}{' '}
                              ／ {inv.roleTitleLabel} ／ 状態：{inv.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => copyText(inv.inviteCode, '招待コード')}
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-[#DFD5C5] bg-white px-3.5 text-xs font-bold text-[#3A3128] whitespace-nowrap transition-colors hover:bg-[#FAF5EC]"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              コピー
                            </button>
                            {inv.status === 'active' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await revokeStaffInvite(inv.inviteCode);
                                  await refresh();
                                }}
                                className="min-h-[44px] rounded-xl border border-[#B83227]/30 bg-white px-3.5 text-xs font-bold text-[#B83227] whitespace-nowrap transition-colors hover:bg-[#FDF1F0]"
                              >
                                無効化
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {bundle.staffMemberships.length > 0 && (
                    <div className="mt-6 border-t border-[#EAE2D3] pt-5">
                      <h4 className="text-sm font-bold text-[#3A3128]">
                        登録済み教職員の担当変更・引き継ぎ
                      </h4>
                      <div className="mt-3 space-y-2.5">
                        {bundle.staffMemberships.map((mem) => (
                          <div
                            key={mem.uid}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FAF5EC] px-4 py-3 text-sm"
                          >
                            <div>
                              <span className="font-bold text-[#3A3128]">{mem.displayLabel}</span>
                              <span className="ml-2 text-xs text-[#6E6254]">
                                （{mem.staffRole === 'teacher' ? '担任' : `安全担当:${mem.safetyTier}`} ／{' '}
                                {mem.active ? '有効' : '停止中'}）
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {mem.staffRole === 'teacher' && (
                                <select
                                  value={mem.classId}
                                  onChange={async (e) => {
                                    await updateStaffMembershipByAdmin({
                                      member: mem,
                                      classId: e.target.value,
                                      safetyTier: mem.safetyTier,
                                      displayLabel: mem.displayLabel,
                                      active: mem.active,
                                    });
                                    await refresh();
                                  }}
                                  className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-white px-3 text-xs text-[#3A3128]"
                                >
                                  <option value="">担当なし</option>
                                  {bundle.classes.map((c) => (
                                    <option key={c.classId} value={c.classId}>
                                      {c.className}
                                    </option>
                                  ))}
                                </select>
                              )}

                              <button
                                type="button"
                                onClick={async () => {
                                  await updateStaffMembershipByAdmin({
                                    member: mem,
                                    classId: mem.classId,
                                    safetyTier: mem.safetyTier,
                                    displayLabel: mem.displayLabel,
                                    active: !mem.active,
                                  });
                                  await refresh();
                                }}
                                className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-white px-3.5 text-xs font-bold text-[#3A3128] whitespace-nowrap transition-colors hover:bg-[#FFFDF8]"
                              >
                                {mem.active ? '権限を一時停止' : '権限を再開'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Students, Printable Family Invites & Parent Link Approvals */}
            {tab === 'students_invites' && (
              <div className="space-y-6">
                {!bundle.school.allPreChecksDone && (
                  <div className="rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] p-4 text-sm font-bold text-[#9A4816]">
                    「1. 利用開始前チェック・安全体制」の5項目がすべて完了すると、児童登録と招待用紙の発行ができるようになります。
                  </div>
                )}

                {/* Pending Parent Link Requests Approval */}
                {pendingParentReqs.length > 0 && (
                  <div className="rounded-3xl border border-[#BFE0C9] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-[#2F7A54]" />
                      <h2 className="font-heading text-base font-bold text-[#3A3128]">
                        保護者からの紐付け申請の確認・承認
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-[#6E6254]">
                      招待コードを入力した保護者からの申請です。対象の児童を確認して承認すると連携が有効になります。
                    </p>
                    <div className="mt-4 space-y-3">
                      {pendingParentReqs.map((req) => {
                        const stu = bundle.students.find((s) => s.studentId === req.studentId);
                        const cls = bundle.classes.find((c) => c.classId === req.classId);
                        return (
                          <div
                            key={req.requestId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4"
                          >
                            <div>
                              <div className="text-sm font-bold text-[#3A3128] tabular-nums">
                                {cls?.className || ''} 出席番号{stu?.attendanceNumber}番「
                                {stu?.nickname}」の保護者申請
                              </div>
                              <div className="text-xs font-mono text-[#6E6254]">
                                招待コード：{req.inviteCode}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await respondToParentLinkRequestByAdmin({
                                    school: bundle.school,
                                    request: req,
                                    approve: false,
                                  });
                                  await refresh();
                                }}
                                className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-white px-4 text-xs font-bold text-[#6E6254] whitespace-nowrap transition-colors hover:bg-[#FFFDF8]"
                              >
                                却下する
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await respondToParentLinkRequestByAdmin({
                                    school: bundle.school,
                                    request: req,
                                    approve: true,
                                  });
                                  await refresh();
                                  setNotice('保護者アカウントとの紐付けを承認しました。');
                                }}
                                className="min-h-[44px] rounded-xl bg-[#2F7A54] px-5 text-xs font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344]"
                              >
                                承認して連携する
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Register Students (Attendance Number + Nickname ONLY) */}
                <form
                  onSubmit={handleRegisterStudents}
                  className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7"
                >
                  <h2 className="font-heading text-base font-bold text-[#3A3128]">
                    児童の登録（出席番号とニックネームのみ・実名不可）
                  </h2>
                  <p className="mt-1 text-xs text-[#6E6254]">
                    実名・住所・生年月日は入力しないでください。1行に1名ずつ「出席番号, ニックネーム」の形式でまとめて登録できます。
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">登録先の学級</label>
                      <select
                        value={selectedClassIdForStu}
                        onChange={(e) => setSelectedClassIdForStu(e.target.value)}
                        className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                      >
                        <option value="">選択してください</option>
                        {bundle.classes.map((c) => (
                          <option key={c.classId} value={c.classId}>
                            {c.className}（{c.grade}年）
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#3A3128]">
                        出席番号, ニックネーム（改行で複数登録）
                      </label>
                      <textarea
                        rows={3}
                        value={batchLines}
                        onChange={(e) => setBatchLines(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] p-3 font-mono text-sm text-[#3A3128]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !bundle.school.allPreChecksDone}
                    className="mt-4 min-h-[46px] rounded-xl bg-[#2B6E6B] px-6 py-2 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#225957] disabled:opacity-50"
                  >
                    児童を登録する
                  </button>
                </form>

                {/* Nameless 1-per-Student QR Cards for Schools without Student Google Accounts */}
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-base font-bold text-[#3A3128]">
                        児童1人1枚の「氏名なしQRカード」一括発行（学校Googleアカウントがない場合用）
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                        学校のGoogleアカウント等でログインできる場合は不要です。アカウントが使えない学級向けに、氏名やニックネームを一切印字せず「出席番号＋推測しにくい文字列（SQR_...）」のみのQRカードを印刷できます。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={qrClassId}
                        onChange={(e) => setQrClassId(e.target.value)}
                        className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-xs font-bold text-[#3A3128]"
                      >
                        <option value="">学級を選択</option>
                        {bundle.classes.map((c) => (
                          <option key={c.classId} value={c.classId}>
                            {c.className}（{c.grade}年）
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || !qrClassId || !bundle.school.allPreChecksDone}
                        onClick={async () => {
                          const targetCls = bundle.classes.find((c) => c.classId === qrClassId);
                          if (!targetCls) return;
                          const classStudents = bundle.students.filter(
                            (s) => s.classId === targetCls.classId
                          );
                          if (classStudents.length === 0) {
                            setError('選択した学級にまだ児童が登録されていません。');
                            return;
                          }
                          setBusy(true);
                          setError('');
                          try {
                            const cards = await issueClassNamelessQrCards({
                              school: bundle.school,
                              schoolClass: targetCls,
                              students: classStudents,
                              issuerRole: 'school_admin',
                              issuerUid: user.uid,
                              appOrigin: window.location.origin,
                            });
                            setAdminQrCards(cards);
                            setAdminQrModalOpen(true);
                            setNotice(
                              `${targetCls.className}（${cards.length}名分）の氏名なしQRカードを発行しました。`
                            );
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : 'QRカードの発行に失敗しました。'
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2B6E6B] px-4 py-2 text-xs font-bold text-white whitespace-nowrap transition-colors hover:bg-[#225957] disabled:opacity-50"
                      >
                        <QrCode className="h-4 w-4" />
                        氏名なしQRカードを発行・印刷
                      </button>
                    </div>
                  </div>
                </div>

                {/* Registered Students List + Family Guide Issuance + Class Change */}
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h3 className="font-heading text-base font-bold text-[#3A3128]">
                    登録児童一覧・家庭向け案内用紙の発行・不参加（記録オフ）設定
                  </h3>

                  {bundle.students.length === 0 ? (
                    <p className="mt-3 text-sm text-[#6E6254]">登録されている児童はまだいません。</p>
                  ) : (
                    <div className="mt-4 space-y-2.5">
                      {bundle.students.map((stu) => {
                        const cls = bundle.classes.find((c) => c.classId === stu.classId);
                        const activeInv = bundle.studentInvites.find(
                          (i) => i.studentId === stu.studentId && i.status === 'active'
                        );
                        return (
                          <div
                            key={stu.studentId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] px-4 py-3.5 text-sm"
                          >
                            <div>
                              <span className="font-bold text-[#3A3128] tabular-nums">
                                {cls?.className || '未所属'} ／ {stu.attendanceNumber}番「
                                {stu.nickname}」
                              </span>
                              <span className="ml-3 text-xs text-[#6E6254]">
                                {stu.parentUid
                                  ? '家庭連携：承認済み'
                                  : activeInv
                                    ? `招待発行済（${activeInv.inviteCode}）`
                                    : '家庭未連携'}
                                {' ／ '}
                                <span
                                  className={
                                    stu.participationOptOut
                                      ? 'font-bold text-[#9A4816]'
                                      : 'font-bold text-[#215C3E]'
                                  }
                                >
                                  {stu.participationOptOut
                                    ? '授業：参加しない（記録オフ）'
                                    : '授業：参加（通常記録）'}
                                </span>
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {!stu.parentUid && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const inv =
                                      activeInv ||
                                      (await issueStudentParentInvite({
                                        school: bundle.school,
                                        student: stu,
                                      }));
                                    if (!activeInv) await refresh();
                                    setGuideInvite({ student: stu, cls, invite: inv });
                                  }}
                                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2F7A54] px-4 py-2 text-xs font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344]"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  家庭向け案内用紙・QRを発行
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  const nextOptOut = !stu.participationOptOut;
                                  await setStudentParticipationOptOut({
                                    studentId: stu.studentId,
                                    participationOptOut: nextOptOut,
                                    callerRole: 'school_admin',
                                    callerUid: user.uid,
                                  });
                                  await refresh();
                                  setNotice(
                                    nextOptOut
                                      ? `${stu.attendanceNumber}番を「参加しない（記録を取らない同じ画面）」に設定しました。`
                                      : `${stu.attendanceNumber}番を「参加する（通常の記録モード）」に設定しました。`
                                  );
                                }}
                                className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-white px-3.5 py-2 text-xs font-bold text-[#3A3128] whitespace-nowrap transition-colors hover:bg-[#FAF5EC]"
                              >
                                {stu.participationOptOut ? '参加するへ戻す' : '参加しない（記録オフ）'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setMovingStudentId(
                                    movingStudentId === stu.studentId ? '' : stu.studentId
                                  );
                                  setTargetMoveClassId(stu.classId);
                                  setTargetMoveNum(stu.attendanceNumber);
                                }}
                                className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-white px-3.5 py-2 text-xs font-bold text-[#3A3128] whitespace-nowrap transition-colors hover:bg-[#FAF5EC]"
                              >
                                進級・クラス変更
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteStudentRegistrationByAdmin({ student: stu, cls });
                                  await refresh();
                                  setNotice(`「${stu.nickname}」の学校側登録を削除しました。`);
                                }}
                                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-[#B83227]/30 bg-white px-3.5 py-2 text-xs font-bold text-[#B83227] whitespace-nowrap transition-colors hover:bg-[#FDF1F0]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                期間満了削除
                              </button>
                            </div>

                            {movingStudentId === stu.studentId && (
                              <div className="mt-2 flex w-full flex-wrap items-center gap-2 border-t border-[#EAE2D3] pt-3">
                                <select
                                  value={targetMoveClassId}
                                  onChange={(e) => setTargetMoveClassId(e.target.value)}
                                  className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-white px-3 text-xs text-[#3A3128]"
                                >
                                  {bundle.classes.map((c) => (
                                    <option key={c.classId} value={c.classId}>
                                      {c.className}（{c.grade}年）
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={targetMoveNum}
                                  onChange={(e) => setTargetMoveNum(Number(e.target.value))}
                                  className="min-h-[44px] w-24 rounded-xl border border-[#DFD5C5] bg-white px-3 text-xs text-[#3A3128] tabular-nums"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const newCls = bundle.classes.find(
                                      (c) => c.classId === targetMoveClassId
                                    );
                                    if (!newCls) return;
                                    await moveStudentClassByAdmin({
                                      student: stu,
                                      oldClass: cls,
                                      newClass: newCls,
                                      newAttendanceNumber: targetMoveNum,
                                    });
                                    setMovingStudentId('');
                                    await refresh();
                                    setNotice('所属学級・出席番号を更新しました。');
                                  }}
                                  className="min-h-[44px] rounded-xl bg-[#2B6E6B] px-4 text-xs font-bold text-white whitespace-nowrap transition-colors hover:bg-[#225957]"
                                >
                                  付け替えを保存
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: Counts Only & Content-Free Access Logs */}
            {tab === 'audit_stats' && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-3xl border border-[#EAE2D3] bg-white p-5">
                    <div className="text-xs font-bold text-[#6E6254]">登録学級数</div>
                    <div className="mt-2 font-heading text-2xl font-bold text-[#3A3128] tabular-nums">
                      {bundle.classes.length} 学級
                    </div>
                  </div>
                  <div className="rounded-3xl border border-[#EAE2D3] bg-white p-5">
                    <div className="text-xs font-bold text-[#6E6254]">登録児童数</div>
                    <div className="mt-2 font-heading text-2xl font-bold text-[#3A3128] tabular-nums">
                      {bundle.students.length} 名
                    </div>
                  </div>
                  <div className="rounded-3xl border border-[#EAE2D3] bg-white p-5">
                    <div className="text-xs font-bold text-[#6E6254]">保護者招待の発行数</div>
                    <div className="mt-2 font-heading text-2xl font-bold text-[#2B6E6B] tabular-nums">
                      {bundle.school.invitesIssuedCount} 件
                    </div>
                  </div>
                  <div className="rounded-3xl border border-[#EAE2D3] bg-white p-5">
                    <div className="text-xs font-bold text-[#6E6254]">連携済み世帯数</div>
                    <div className="mt-2 font-heading text-2xl font-bold text-[#2F7A54] tabular-nums">
                      {bundle.school.linkedHouseholdsCount} 世帯
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h3 className="font-heading text-base font-bold text-[#3A3128]">
                    アクセス履歴（誰が・いつ・どの操作を行ったか／記録内容は非表示）
                  </h3>
                  {bundle.accessLogs.length === 0 ? (
                    <p className="mt-3 text-sm text-[#6E6254]">まだ履歴はありません。</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#EAE2D3] text-[#6E6254]">
                            <th className="py-2.5 pr-4">日時</th>
                            <th className="py-2.5 pr-4">立場</th>
                            <th className="py-2.5 pr-4">操作種別</th>
                            <th className="py-2.5">対象ID（内部参照）</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0EAE0]">
                          {bundle.accessLogs.slice(0, 60).map((log) => {
                            const dt = log.createdAt?.seconds
                              ? new Date(log.createdAt.seconds * 1000).toLocaleString('ja-JP')
                              : '-';
                            return (
                              <tr key={log.logId} className="hover:bg-[#FAF5EC]/50">
                                <td className="py-2.5 pr-4 text-[#6E6254] tabular-nums">{dt}</td>
                                <td className="py-2.5 pr-4 font-bold text-[#3A3128]">
                                  {log.actorRole}
                                </td>
                                <td className="py-2.5 pr-4 text-[#3A3128]">{log.actionLabel}</td>
                                <td className="py-2.5 font-mono text-[#6E6254]">
                                  {log.studentIdRef || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Printable A4 Family Guide Modal with Invite Code + QR Code */}
      <PrintableExportModal
        open={Boolean(guideInvite)}
        title="家庭向け案内用紙（印刷・PDF保存）"
        subtitle="1人ずつ異なる1回限りの招待コードとQRコードが記載されています"
        filename={`うちの子トリセツ_家庭案内_${guideInvite?.student.attendanceNumber || ''}番`}
        onClose={() => setGuideInvite(null)}
      >
        {guideInvite && (
          <div className="space-y-5">
            <div className="border-b-2 border-[#2F7A54] pb-3.5">
              <p className="text-xs font-bold text-[#215C3E]">
                保護者のみなさまへ（家庭連携のご案内）
              </p>
              <h2 className="mt-1 font-heading text-xl font-bold text-[#3A3128]">
                「うちの子トリセツ」ご利用と招待コードのご案内
              </h2>
              <p className="mt-1 text-sm font-bold text-[#3A3128] tabular-nums">
                対象：{guideInvite.cls?.className || ''} 出席番号{' '}
                {guideInvite.student.attendanceNumber}番（ニックネーム：
                {guideInvite.student.nickname}）
              </p>
            </div>

            <div className="space-y-2.5 text-sm leading-relaxed text-[#3A3128]">
              <p>
                <strong>1. アプリの目的と1人1台端末での参加：</strong>
                「うちの子トリセツ」は、お子さまの得意なことや、うまくいった関わり方を学校と家庭で一緒に見つけるための記録帳です。
                <strong>病気の診断や能力の検査を行うものではありません。</strong>
                学校では1人1台端末のブラウザを使って一斉に行いますが、
                <strong>「参加しない」選択も保護者が自由に選べます。</strong>
                参加しない場合も、お子さまは授業中に記録を取らない同じ見た目の学習コンテンツで過ごすため、周りから分かることはなく、成績や評価にも一切影響しません。
              </p>
              <p>
                <strong>2. 記録の共有ルール：</strong>
                ご家庭で書いたメモがそのまま先生に見えることはありません。共有したい記録だけを選び、相手が確認して初めて共有されます。共有はいつでもやめられます。
              </p>
              <p>
                <strong>3. 個人情報の保護と削除：</strong>
                学校のGoogleアカウントのIDやメールアドレスはそのまま保存せず仮のIDに変えて扱います。実名・住所・生年月日も入力しません。ご家庭の記録はいつでも削除・退会できます（学校側の記録は学校の定めた保存期間{' '}
                {bundle?.school.retentionMonths || 12} か月にもとづき管理されます）。
              </p>
            </div>

            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border-2 border-[#2F7A54] bg-[#EDF7F0]/60 p-5 sm:flex-row">
              <div>
                <div className="text-xs font-bold text-[#215C3E]">
                  1回限り有効の専用招待コード
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tracking-wider text-[#3A3128]">
                  {guideInvite.invite.inviteCode}
                </div>
                <p className="mt-2 text-xs text-[#6E6254]">
                  右のQRコードを読み取るか、ログイン後に上記コードを入力して申請してください。連携後、保護者画面から「参加する／参加しない」をいつでも切り替えられます。
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-xs">
                <QRCodeSVG
                  value={`${window.location.origin}/?invite=${encodeURIComponent(
                    guideInvite.invite.inviteCode
                  )}`}
                  size={116}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#6E6254]">
              <CheckCircle2 className="h-4 w-4 text-[#2F7A54]" />
              <span>
                発行元：{bundle?.school.schoolCodeLabel}（{bundle?.school.academicYear}）
              </span>
            </div>
          </div>
        )}
      </PrintableExportModal>

      {/* Printable 1-per-Student NAMELESS QR Cards Sheet */}
      <PrintableExportModal
        open={adminQrModalOpen}
        title="児童配付用・氏名なしQRカード（1人1枚）"
        subtitle="氏名やニックネームを印字せず、出席番号と推測しにくい文字列のみを記載しています"
        filename={`うちの子トリセツ_氏名なしQRカード_${adminQrCards[0]?.className || '学級'}`}
        onClose={() => setAdminQrModalOpen(false)}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4 text-xs leading-relaxed text-[#3A3128]">
            <p className="font-bold text-[#215C3E]">
              配付と取り扱いのご注意（氏名・ニックネームは印字していません）
            </p>
            <p className="mt-1 text-[#6E6254]">
              ・学校のGoogleアカウントが使えない場合でも、Chromebook・iPad・WindowsのブラウザからQR読み取りまたはコード入力で参加できます。
            </p>
            <p className="text-[#6E6254]">
              ・担任が「授業で遊ぶ」を押している時間（または持ち帰り許可中）のみ入室できます。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {adminQrCards.map((card) => (
              <div
                key={card.rawQrToken}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#DFD5C5] bg-white p-4 break-inside-avoid"
              >
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#2B6E6B]">
                    がっこう たんけん カード
                  </div>
                  <div className="font-['Zen_Maru_Gothic'] text-lg font-bold tabular-nums text-[#3A3128]">
                    {card.className}　{card.attendanceNumber}ばん
                  </div>
                  <div className="rounded-xl bg-[#FAF5EC] px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-wider text-[#3A3128]">
                    {card.rawQrToken}
                  </div>
                  <div className="text-[10px] text-[#6E6254]">
                    ※なまえは かかないで つかってね
                  </div>
                </div>
                <div className="shrink-0 rounded-xl border border-[#EAE2D3] bg-white p-2">
                  <QRCodeSVG value={card.qrUrl} size={96} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PrintableExportModal>
    </div>
  );
};
