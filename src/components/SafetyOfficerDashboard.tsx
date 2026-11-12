import React, { useCallback, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LogOut,
  Phone,
  RefreshCw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import {
  loadSafetyOfficerWorkspace,
  markSafetyReportOpened,
  recordSafetyReportResponse,
  shareSafetyStatusWithHomeroom,
  type SafetyOfficerWorkspaceBundle,
} from '../lib/firestoreService';
import type { SafetyReportDoc, UserAccountDoc } from '../types/models';

const SAFETY_ACTION_OPTIONS = [
  '本人の安全確認・安心できる場所での聞き取り',
  '管理職（校長・教頭）への報告',
  '養護教諭・スクールカウンセラー・生徒指導部との連携',
  '市町村窓口・児童相談所（189番）への相談・通告',
  '警察（110番）・救急（119番）等への緊急連絡',
];

export const SafetyOfficerDashboard: React.FC<{
  user: UserAccountDoc;
}> = ({ user }) => {
  const [workspace, setWorkspace] = useState<SafetyOfficerWorkspaceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [actionsPicked, setActionsPicked] = useState<string[]>([]);
  const [actionNote, setActionNote] = useState('');
  const [homeroomStatus, setHomeroomStatus] = useState<'checking' | 'resolved'>('checking');
  const [homeroomSafeNote, setHomeroomSafeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadSafetyOfficerWorkspace(user.uid);
      setWorkspace(data);
      if (data.reports.length > 0 && !selectedReportId) {
        setSelectedReportId(data.reports[0].reportId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '安全連絡一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [user.uid, selectedReportId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live escalation timer refresh every 15 seconds
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const selectedReport: SafetyReportDoc | undefined = workspace?.reports.find(
    (r) => r.reportId === selectedReportId
  );

  useEffect(() => {
    if (!selectedReport) return;
    setActionsPicked(selectedReport.actionsTaken || []);
    setActionNote(selectedReport.actionNote || '');
  }, [selectedReport]);

  const computeEscalationStage = (r: SafetyReportDoc) => {
    if (r.hasActed) {
      return {
        level: 'acted' as const,
        label: '対応記録済み',
        colorClass: 'border-[#BFE0C9] bg-[#EDF7F0] text-[#215C3E]',
      };
    }
    if (nowMs >= r.deputyDeadlineMs) {
      return {
        level: 'manager' as const,
        label: `第3段階（管理職：${workspace?.school.managerOfficerLabel || '管理職'} へ拡大通知中）`,
        colorClass: 'border-[#B83227] bg-[#FDF1F0] text-[#B83227]',
      };
    }
    if (nowMs >= r.primaryDeadlineMs) {
      return {
        level: 'deputy' as const,
        label: `第2段階（副担当：${workspace?.school.deputyOfficerLabel || '副担当'} へ拡大通知中）`,
        colorClass: 'border-[#F3CEAA] bg-[#FFF3E6] text-[#9A4816]',
      };
    }
    return {
      level: 'primary' as const,
      label: `第1段階（主担当：${workspace?.school.primaryOfficerLabel || '主担当'} 確認時間内）`,
      colorClass: 'border-[#E5C9A8] bg-[#FFF8EF] text-[#7A4B1E]',
    };
  };

  const handleOpenAndConfirmReport = async (report: SafetyReportDoc) => {
    setSelectedReportId(report.reportId);
    if (!report.hasOpened && workspace) {
      try {
        await markSafetyReportOpened({
          report,
          officerUid: user.uid,
          officerLabel: workspace.membership.displayLabel,
        });
        await refresh();
      } catch (err) {
        console.error('Failed to mark safety report opened:', err);
      }
    }
  };

  const handleSaveResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || !workspace) return;
    if (actionsPicked.length === 0 && !actionNote.trim()) {
      setError('実施した対応を選択または記入してください。');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await recordSafetyReportResponse({
        report: selectedReport,
        officerUid: user.uid,
        officerLabel: workspace.membership.displayLabel,
        actionsTaken: actionsPicked,
        actionNote,
      });
      await refresh();
      setNotice('対応記録（いつ・誰が・何をしたか）を保存しました。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '対応記録の保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleShareStatusToHomeroom = async () => {
    if (!selectedReport || !workspace || !selectedReport.classId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await shareSafetyStatusWithHomeroom({
        schoolId: workspace.school.schoolId,
        classId: selectedReport.classId,
        status: homeroomStatus,
        officerSharedNote: homeroomSafeNote,
      });
      setNotice('学級担任の画面へ対応状況（子どもの発言本文を除く）を共有しました。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '担任への状況共有に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const unconfirmedCount =
    workspace?.reports.filter((r) => !r.hasOpened || !r.hasActed).length || 0;

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-[#3A3128]">
      <header className="border-b border-[#EAE2D3] bg-white/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF5F4] text-[#1F5C59]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-base font-bold text-[#3A3128]">
                うちの子トリセツ — 安全対応担当者 画面
              </h1>
              <p className="text-xs text-[#6E6254]">
                担当：{workspace?.membership.displayLabel || '-'}（区分：
                {workspace?.membership.safetyTier || '-'}） ／ 通常の学習・家庭記録は非表示です
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
              最新状態を取得
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
        {/* Mandatory Statutory Duty & Emergency Banner (Chapter 12B) */}
        <div className="mb-6 rounded-3xl border border-[#DFD5C5] bg-white p-5 shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#1F5C59]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  児童虐待防止法にもとづく通告義務・緊急連絡の確認（保護者へは自動通知されません）
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#3A3128]">
                児童虐待を受けたと思われる児童を発見したときは、速やかに市町村または児童相談所へ通告する義務があります。家庭が関係している可能性を考慮し、この画面の記録が保護者画面へ表示されることは一切ありません。
              </p>
              {workspace?.school.offHoursRule && (
                <p className="text-xs text-[#6E6254]">
                  夜間・休日ルール：{workspace.school.offHoursRule}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="tel:189"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2B6E6B] px-4 py-2 text-xs font-bold text-white whitespace-nowrap tabular-nums transition-colors hover:bg-[#1F5C59]"
              >
                <Phone className="h-3.5 w-3.5" />
                児相相談ダイヤル：189
              </a>
              <a
                href="tel:119"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DFD5C5] bg-[#FAF5EC] px-4 py-2 text-xs font-bold text-[#3A3128] whitespace-nowrap tabular-nums transition-colors hover:bg-[#F2EAE0]"
              >
                救急：119 ／ 警察：110
              </a>
            </div>
          </div>
        </div>

        {unconfirmedCount > 0 && (
          <div className="mb-5 rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4] px-4 py-3 text-sm font-bold text-[#1F5C59] tabular-nums">
            確認中の安全連絡が {unconfirmedCount} 件あります（保護者画面には非表示・最上部に固定表示）。
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

        {loading || !workspace ? (
          <div className="rounded-3xl border border-[#EAE2D3] bg-white p-9 text-center text-sm text-[#6E6254]">
            安全対応一覧を読み込んでいます...
          </div>
        ) : workspace.reports.length === 0 ? (
          <div className="rounded-3xl border border-[#EAE2D3] bg-white p-12 text-center shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF7F0] text-[#2F7A54]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="mt-3 font-heading text-lg font-bold text-[#3A3128]">
              現在、届いている安全連絡はありません
            </p>
            <p className="mt-1.5 text-xs text-[#6E6254]">
              子ども画面で「こわい ことや、いたい ことが ある」が押されたとき、または安全に関わる言葉が検知されたときに最優先で表示されます。
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Queue: Unconfirmed Pinned to Top */}
            <div className="space-y-3 lg:col-span-5">
              <h2 className="text-sm font-bold text-[#3A3128]">
                安全連絡一覧（未確認・未対応を最上部に固定）
              </h2>
              {workspace.reports.map((r) => {
                const esc = computeEscalationStage(r);
                const isSelected = r.reportId === selectedReportId;
                return (
                  <button
                    key={r.reportId}
                    type="button"
                    onClick={() => handleOpenAndConfirmReport(r)}
                    className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-[#2F7A54] bg-white shadow-[0_6px_20px_rgba(47,122,84,0.08)]'
                        : !r.hasActed
                          ? 'border-[#B83227]/45 bg-white hover:border-[#B83227]'
                          : 'border-[#EAE2D3] bg-white hover:bg-[#FAF5EC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#3A3128]">
                        ニックネーム：{r.studentNickname}
                      </span>
                      <span className="text-xs text-[#6E6254] tabular-nums">
                        {new Date(r.createdAtMs).toLocaleString('ja-JP')}
                      </span>
                    </div>

                    <div className={`mt-2.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${esc.colorClass}`}>
                      <Clock className="mr-1 inline h-3.5 w-3.5" />
                      {esc.label}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs text-[#6E6254]">
                      <span>実施場所：{r.place === 'school' ? '学校' : '家庭'}</span>
                      <span>
                        {r.hasActed
                          ? `対応済（${r.confirmedByLabel}）`
                          : r.hasOpened
                            ? `開封済・対応記録待ち（${r.confirmedByLabel}）`
                            : '未開封'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Detail & Response Recorder */}
            <div className="lg:col-span-7">
              {selectedReport ? (
                <div className="space-y-6 rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <div className="border-b border-[#EAE2D3] pb-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-heading text-xl font-bold text-[#3A3128]">
                        {selectedReport.studentNickname} さんからの安全連絡
                      </h3>
                      <span className="text-xs text-[#6E6254] tabular-nums">
                        発生時刻：{new Date(selectedReport.createdAtMs).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#6E6254]">
                      経路：
                      {selectedReport.triggerSource === 'talk_button_scary'
                        ? '「こわい ことや、いたい ことが ある」ボタン'
                        : selectedReport.triggerSource === 'keyword_detected'
                          ? '安全に関わる言葉の自動検知'
                          : 'モモ会話からの安全確認フラグ'}
                    </p>

                    <div className="mt-4 rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] p-4">
                      <div className="text-xs font-bold text-[#9A4816]">
                        子どもが入力・選択した内容（安全対応担当者のみ閲覧可）
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-base font-bold text-[#3A3128]">
                        {selectedReport.childWords}
                      </p>
                    </div>
                  </div>

                  {/* Response Recording Form */}
                  <form onSubmit={handleSaveResponse} className="space-y-4">
                    <h4 className="text-sm font-bold text-[#3A3128]">
                      対応の記録（いつ・誰が・何をしたか）
                    </h4>

                    <div className="space-y-2">
                      {SAFETY_ACTION_OPTIONS.map((act) => {
                        const checked = actionsPicked.includes(act);
                        return (
                          <label
                            key={act}
                            className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                              checked
                                ? 'border-[#2F7A54] bg-[#EDF7F0] font-bold text-[#3A3128]'
                                : 'border-[#EAE2D3] bg-[#FAF5EC]/70 text-[#3A3128]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setActionsPicked((prev) =>
                                  e.target.checked
                                    ? [...prev, act]
                                    : prev.filter((x) => x !== act)
                                )
                              }
                              className="h-4 w-4 accent-[#2F7A54]"
                            />
                            <span>{act}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        具体的な対応メモ（確認日時・連携先・今後の見守り方針）
                      </label>
                      <textarea
                        rows={3}
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                        placeholder="例：10:20 保健室にて養護教諭と教頭で本人から聞き取りを実施。管理職より市町村子ども家庭相談課へ連絡済。"
                        className="mt-1.5 w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] p-3 text-sm text-[#3A3128]"
                      />
                    </div>

                    {selectedReport.hasOpened && (
                      <p className="text-xs text-[#6E6254] tabular-nums">
                        初回開封：{new Date(selectedReport.openedAtMs).toLocaleString('ja-JP')}（
                        {selectedReport.confirmedByLabel}）
                        {selectedReport.hasActed &&
                          ` ／ 対応記録更新：${new Date(selectedReport.actedAtMs).toLocaleString(
                            'ja-JP'
                          )}`}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-[48px] rounded-2xl bg-[#2F7A54] px-6 py-2.5 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-[#256344] disabled:opacity-60"
                    >
                      {busy ? '記録中...' : '対応内容を記録する'}
                    </button>
                  </form>

                  {/* Optional Safe Status Notice to Homeroom Teacher */}
                  {selectedReport.classId && (
                    <div className="border-t border-[#EAE2D3] pt-5">
                      <h4 className="text-sm font-bold text-[#3A3128]">
                        学級担任への状況連絡（必要なときのみ・子どもの発言本文は送られません）
                      </h4>
                      <p className="mt-1 text-xs text-[#6E6254]">
                        担任との関係に配慮が必要な場合は共有しないでください。共有する場合も「確認中／対応済み」と配慮事項のみを伝えます。
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <select
                          value={homeroomStatus}
                          onChange={(e) =>
                            setHomeroomStatus(e.target.value as 'checking' | 'resolved')
                          }
                          className="min-h-[46px] rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3 text-sm text-[#3A3128]"
                        >
                          <option value="checking">安全担当が確認中です</option>
                          <option value="resolved">安全担当にて対応済みです</option>
                        </select>
                        <input
                          type="text"
                          value={homeroomSafeNote}
                          onChange={(e) => setHomeroomSafeNote(e.target.value)}
                          placeholder="担任への配慮メモ（任意・発言本文は書かない）"
                          className="min-h-[46px] rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3 text-sm text-[#3A3128] sm:col-span-2"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleShareStatusToHomeroom}
                        className="mt-3 inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#BCE0DD] bg-[#EAF5F4] px-4 py-2 text-xs font-bold text-[#1F5654] whitespace-nowrap transition-colors hover:bg-[#DCECEB]"
                      >
                        <Send className="h-3.5 w-3.5" />
                        担任へ状況ステータスのみ伝える
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-9 text-center text-sm text-[#6E6254]">
                  左の一覧から確認する連絡を選択してください。
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
