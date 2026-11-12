import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  AlertCircle,
  BookHeart,
  Compass,
  ExternalLink,
  HeartHandshake,
  Home,
  Link2,
  LogOut,
  MapPin,
  Mic,
  MicOff,
  Printer,
  RefreshCw,
  Send,
  Settings,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import {
  buildGoogleMapsSearchUrl,
  CONSULTATION_BOTTOM_NOTES,
  CONSULTATION_FIXED_ROWS,
  EMERGENCY_TOP_BANNER_TEXT,
  REFERRAL_LETTER_EXPLANATION,
} from '../data/consultationDirectory';
import { auth } from '../lib/firebase';
import { hasDifferentFormsWarning } from '../lib/factFormatter';
import {
  callGeminiOrganize,
  confirmAndSaveProposals,
  createSharingRequest,
  deleteParentHomeRecords,
  loadAuthorizedStudentBundle,
  loadParentWorkspace,
  loadStudentRewards,
  respondToSharingRequest,
  saveParentFollowupRecord,
  sendParentConsultation,
  setStudentParticipationOptOut,
  stopSharingObservation,
  updateAdultTrialEvaluation,
  withdrawParentAccount,
} from '../lib/firestoreService';
import { GACHA_CATALOG } from '../data/gachaCatalog';
import {
  containsAdultSafetyKeyword,
  type GeminiBResponse,
} from '../shared/safetyAndGuardrails';
import type {
  ActiveChildModeLock,
  AuthorizedStudentBundle,
  ObservationCategory,
  ObservationDoc,
  ParentFollowupDoc,
  ParentLinkRequestDoc,
  SchoolDoc,
  SharingRequestDoc,
  StudentDoc,
  StudentRewardDoc,
  TrialDoc,
  UserAccountDoc,
} from '../types/models';
import { LinkAdditionalSchoolModal } from './AuthAndOnboarding';
import {
  AdultPinLaunchModal,
  AdultSafetyModal,
  CATEGORY_LABELS,
  PrintableExportModal,
  SideDotLabel,
  speakJapaneseText,
} from './CommonUI';

type ParentNavTab = 'home' | 'talk_home' | 'torisetsu' | 'directory_medical' | 'settings';
type TorisetsuSubTab =
  | 'strengths'
  | 'child_voice'
  | 'worked_well'
  | 'game_conditions'
  | 'trials_results'
  | 'differences';

const FIVE_EQUAL_REPLY_CHOICES = [
  '家でもそう',
  '家ではちがう',
  'はじめて知った',
  'もう少し知りたい',
  'あとで考える',
] as const;

export const ParentDashboard: React.FC<{
  user: UserAccountDoc;
  onEnterChildMode: (lock: ActiveChildModeLock) => void;
  onAccountWithdrawn: () => void;
}> = ({ user, onEnterChildMode, onAccountWithdrawn }) => {
  const [navTab, setNavTab] = useState<ParentNavTab>('home');
  const [torisetsuTab, setTorisetsuTab] = useState<TorisetsuSubTab>('strengths');

  const [school, setSchool] = useState<SchoolDoc | null>(null);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [pendingLinks, setPendingLinks] = useState<ParentLinkRequestDoc[]>([]);
  const [followups, setFollowups] = useState<ParentFollowupDoc[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [bundle, setBundle] = useState<AuthorizedStudentBundle | null>(null);
  const [rewardDoc, setRewardDoc] = useState<StudentRewardDoc | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Modals
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [linkSchoolModalOpen, setLinkSchoolModalOpen] = useState(false);
  const [launchChildTarget, setLaunchChildTarget] = useState<StudentDoc | null>(null);
  const [printModalState, setPrintModalState] = useState<{
    open: boolean;
    title: string;
    body: string;
  }>({ open: false, title: '', body: '' });

  // School Discovery 5-choice reply confirmation state
  const [replyDraft, setReplyDraft] = useState<{
    request: SharingRequestDoc;
    choice: string;
    supplement: string;
  } | null>(null);

  // Consult Teacher (先生に相談する) state
  const [consultOpen, setConsultOpen] = useState(false);
  const [selectedConsultObsIds, setSelectedConsultObsIds] = useState<string[]>([]);
  const [consultBody, setConsultBody] = useState('');
  const [consultConfirmStep, setConsultConfirmStep] = useState(false);

  // Bridge (4つを並べる) state
  const [bridgeProposal, setBridgeProposal] = useState<GeminiBResponse | null>(null);

  // Home Trials form
  const [newHomeTrialText, setNewHomeTrialText] = useState('');
  const [newHomeTrialWhy, setNewHomeTrialWhy] = useState('');

  // Home Note + Gemini Live Voice state (Audio ONLY, Zero Video!)
  const [homeInputText, setHomeInputText] = useState('');
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveAiReply, setLiveAiReply] = useState('');
  const [homeProposal, setHomeProposal] = useState<GeminiBResponse | null>(null);
  const [editableHomeObs, setEditableHomeObs] = useState<
    Array<{
      tempId: string;
      category: ObservationCategory;
      fact: string;
      include: boolean;
    }>
  >([]);
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Outgoing share to school confirmation
  const [shareToSchoolObs, setShareToSchoolObs] = useState<ObservationDoc | null>(null);
  const [shareToSchoolPurpose, setShareToSchoolPurpose] = useState(
    '家での様子やうまくいった関わり方を担任の先生にお伝えしたいため'
  );

  // Chapter 9 Consultation Directory & Medical Memo state
  const [selectedConcernIds, setSelectedConcernIds] = useState<string[]>(['c_focus']);
  const [mapAreaQuery, setMapAreaQuery] = useState('');
  const [medicalRawConsult, setMedicalRawConsult] = useState('');
  const [medicalMemoDraft, setMedicalMemoDraft] = useState('');

  // Chapter 9 Follow-up (その後のこと) state
  const [followupSituation, setFollowupSituation] =
    useState<ParentFollowupDoc['currentSituation']>('thinking');
  const [followupHelpful, setFollowupHelpful] =
    useState<ParentFollowupDoc['memoHelpful']>('none');
  const [followupConsent, setFollowupConsent] = useState(false);

  // Settings / Delete confirmation state
  const [confirmDeleteHome, setConfirmDeleteHome] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ws = await loadParentWorkspace(user.uid, user);
      setSchool(ws.school);
      setStudents(ws.students);
      setPendingLinks(ws.pendingLinkRequests);
      setFollowups(ws.followups);
      if (ws.students.length > 0) {
        setSelectedStudentId((prev) =>
          prev && ws.students.some((s) => s.studentId === prev)
            ? prev
            : ws.students[0].studentId
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '家庭データの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeStudent = useMemo(
    () => students.find((s) => s.studentId === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const refreshBundle = useCallback(
    async (logAccess = false) => {
      if (!activeStudent) {
        setBundle(null);
        return;
      }
      try {
        const [b, rw] = await Promise.all([
          loadAuthorizedStudentBundle({
            viewerRole: 'parent',
            viewerUid: user.uid,
            student: activeStudent,
            logAccess,
          }),
          loadStudentRewards({
            studentId: activeStudent.studentId,
            participationOptOut: Boolean(activeStudent.participationOptOut),
          }),
        ]);
        setBundle(b);
        setRewardDoc(rw);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'お子さんの記録を取得できませんでした。');
      }
    },
    [activeStudent, user.uid]
  );

  useEffect(() => {
    void refreshBundle(true);
  }, [activeStudent, refreshBundle]);

  const handleSetSchoolParticipationOptOut = async (nextOptOut: boolean) => {
    if (!activeStudent) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await setStudentParticipationOptOut({
        studentId: activeStudent.studentId,
        participationOptOut: nextOptOut,
        callerRole: 'parent',
        callerUid: user.uid,
      });
      await loadAll();
      setNotice(
        nextOptOut
          ? '学校の端末での参加設定を「参加しない（記録を取らない学習モード）」に変更しました。授業中も周りと同じ見た目の画面で過ごせます。'
          : '学校の端末での参加設定を「参加する（通常の記録モード）」に変更しました。'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加設定の更新に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const existingFollowup = useMemo(
    () => followups.find((f) => f.studentId === selectedStudentId) || null,
    [followups, selectedStudentId]
  );

  useEffect(() => {
    if (existingFollowup) {
      setFollowupSituation(existingFollowup.currentSituation);
      setFollowupHelpful(existingFollowup.memoHelpful);
      setFollowupConsent(existingFollowup.consentForImprovement);
    }
  }, [existingFollowup]);

  const checkSafety = useCallback((txt: string): boolean => {
    if (containsAdultSafetyKeyword(txt)) {
      setSafetyModalOpen(true);
      return false;
    }
    return true;
  }, []);

  // --------------------------------------------------------------------------
  // Gemini Live Voice Session (Audio Only — Strictly No Video!)
  // --------------------------------------------------------------------------
  const stopLiveVoice = useCallback(() => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ stop: true }));
      }
      wsRef.current?.close();
    } catch {
      // Ignore
    }
    wsRef.current = null;

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;

    void captureCtxRef.current?.close();
    captureCtxRef.current = null;
    void playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
    setLiveConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      stopLiveVoice();
    };
  }, [stopLiveVoice]);

  const playPcm24kChunk = (base64Pcm: string) => {
    try {
      if (!playbackCtxRef.current) {
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = playbackCtxRef.current.currentTime;
      }
      const ctx = playbackCtxRef.current;
      const binary = atob(base64Pcm);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }
      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + audioBuffer.duration;
    } catch {
      // Ignore playback decode issue
    }
  };

  const startLiveVoice = async () => {
    setError('');
    setLiveAiReply('');

    // Mandatory spoken + visual AI notice before recording starts (Chapter 8)
    speakJapaneseText(
      'AIとの音声会話です。録音は残らず、話した内容から文字のメモを作ります。実名や住所は話さないでください。'
    );

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      micStreamRef.current = stream;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/api/live-home-note`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as {
            type: string;
            text?: string;
            audio?: string;
            message?: string;
          };
          if (msg.type === 'ready') {
            setLiveConnected(true);
          } else if (msg.type === 'input_transcript' && msg.text) {
            setHomeInputText((prev) => {
              const combined = `${prev}${msg.text}`;
              if (containsAdultSafetyKeyword(combined)) {
                stopLiveVoice();
                setSafetyModalOpen(true);
              }
              return combined;
            });
          } else if (msg.type === 'output_transcript' && msg.text) {
            setLiveAiReply((prev) => `${prev}${msg.text}`);
          } else if (msg.type === 'audio' && msg.audio) {
            playPcm24kChunk(msg.audio);
          } else if (msg.type === 'error' && msg.message) {
            setError(msg.message);
            stopLiveVoice();
          }
        } catch {
          // Ignore malformed event
        }
      };

      ws.onclose = () => {
        setLiveConnected(false);
      };

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      captureCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        wsRef.current.send(JSON.stringify({ audio: btoa(binary) }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('マイクの使用が許可されていないか利用できません。下の文字入力をご利用ください。');
      stopLiveVoice();
    }
  };

  // --------------------------------------------------------------------------
  // Organize & Save Home Note (home_note)
  // --------------------------------------------------------------------------
  const handleOrganizeHomeNote = async () => {
    if (!bundle) return;
    if (!homeInputText.trim()) {
      setError('家での様子を入力するか、音声で話してください。');
      return;
    }
    if (!checkSafety(homeInputText)) return;

    setBusy(true);
    setError('');
    try {
      const resp = await callGeminiOrganize({
        mode: 'home_note',
        viewerRole: 'parent',
        observations: bundle.observations,
        trials: bundle.trials,
        newInput: homeInputText,
      });
      if (!resp.ok || !resp.data) {
        setError(resp.errorMessage || 'うまく整理できませんでした。記録はそのまま残っています');
        setEditableHomeObs([
          {
            tempId: 'new_O1',
            category: 'other',
            fact: homeInputText.trim(),
            include: true,
          },
        ]);
        return;
      }
      setHomeProposal(resp.data);
      setEditableHomeObs(
        resp.data.new_observations.map((o) => ({
          tempId: o.temp_id,
          category: o.category,
          fact: o.fact,
          include: true,
        }))
      );
    } catch {
      setError('うまく整理できませんでした。記録はそのまま残っています');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveHomeNoteProposals = async () => {
    if (!bundle) return;
    const toSave = editableHomeObs.filter((o) => o.include && o.fact.trim());
    if (toSave.length === 0) return;

    setBusy(true);
    setError('');
    try {
      await confirmAndSaveProposals({
        actorRole: 'parent',
        student: bundle.student,
        index: bundle.index,
        observationsToCreate: toSave.map((o) => ({
          tempId: o.tempId,
          category: o.category,
          fact: o.fact,
        })),
        hypothesesToCreate:
          homeProposal?.new_hypotheses.map((h) => ({
            text: h.text,
            why: h.why,
            evidenceExistingIds: h.evidence_existing_ids,
            evidenceNewTempIds: h.evidence_new_temp_ids,
            evidenceSides: h.evidence_sides,
          })) || [],
        trialsToCreate:
          homeProposal?.suggested_trials
            .filter((t) => t.where === 'home')
            .map((t) => ({
              where: 'home',
              whatToChange: t.text,
              why: t.why,
              basedOnExistingIds: t.based_on_existing_ids,
              basedOnNewTempIds: t.based_on_new_temp_ids,
              adjustsTrialId: t.adjusts_trial_id || '',
            })) || [],
      });
      setHomeInputText('');
      setLiveAiReply('');
      setHomeProposal(null);
      setEditableHomeObs([]);
      await refreshBundle(false);
      setNotice('家庭の記録を保存しました（初期状態では先生には共有されません）。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // Consult Teacher Draft (consult_teacher)
  // --------------------------------------------------------------------------
  const handleDraftConsultTeacher = async () => {
    if (!bundle) return;
    const chosen = bundle.observations.filter((o) =>
      selectedConsultObsIds.includes(o.observationId)
    );
    if (chosen.length === 0 && !consultBody.trim()) {
      setError('相談に使いたい記録を選ぶか、伝えたいことを入力してください。');
      return;
    }
    if (!checkSafety(consultBody)) return;

    setBusy(true);
    setError('');
    try {
      const resp = await callGeminiOrganize({
        mode: 'consult_teacher',
        viewerRole: 'parent',
        observations: chosen,
        trials: bundle.trials,
        newInput: consultBody || '選んだ記録をもとに担任の先生へ相談する短い文を作ってください。',
      });
      if (!resp.ok || !resp.data) {
        setError(resp.errorMessage || 'うまく整理できませんでした。記録はそのまま残っています');
        return;
      }
      setConsultBody(resp.data.memo || resp.data.message);
    } catch {
      setError('うまく整理できませんでした。記録はそのまま残っています');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // Torisetsu Full Printable Text Builder
  // --------------------------------------------------------------------------
  const buildFullTorisetsuText = (): string => {
    if (!bundle) return '';
    const strengths = bundle.observations.filter((o) => o.category === 'strength');
    const voices = bundle.observations.filter((o) => o.side === 'child');
    const worked = bundle.observations.filter((o) => o.category === 'worked_well');
    const games = bundle.observations.filter((o) => o.side === 'game');

    const lines: string[] = [
      `【${bundle.student.nickname} さんのトリセツ】`,
      '※日々の場面とうまくいった関わり方の記録です（診断・検査ではありません）。',
      '',
      '■ 1. 好きなこと・得意なこと',
      ...(strengths.length > 0
        ? strengths.map((o) => `・[${o.formalId}] ${o.fact}`)
        : ['・これから記録していきます']),
      '',
      '■ 2. 本人が伝えていること',
      ...(voices.length > 0
        ? voices.map((o) => `・[${o.formalId}] ${o.fact}`)
        : ['・まだ記録がありません']),
      '',
      '■ 3. うまくいく関わり方',
      ...(worked.length > 0
        ? worked.map((o) => `・[${o.formalId}] ${o.fact}`)
        : ['・まだ記録がありません']),
      '',
      '■ 4. ゲームで見えた条件（独自の課題で、標準化された検査ではありません）',
      ...(games.length > 0
        ? games.map((o) => `・[${o.formalId}] ${o.fact}`)
        : ['・まだ記録がありません']),
      '',
      '■ 5. 試したことと結果（本人の感想つき）',
      ...(bundle.trials.length > 0
        ? bundle.trials.map(
            (t) =>
              `・[${t.formalId}] ${t.whatToChange}（大人の記録: ${t.adultResult} ／ 本人の感想: ${t.childFeedback}）`
          )
        : ['・まだ記録がありません']),
    ];
    return lines.join('\n');
  };

  // --------------------------------------------------------------------------
  // Medical Memo Builder (medical_memo — Only runs on explicit button click!)
  // --------------------------------------------------------------------------
  const handleCreateMedicalMemo = async () => {
    if (!bundle) return;
    if (!checkSafety(medicalRawConsult)) return;
    setBusy(true);
    setError('');
    try {
      const resp = await callGeminiOrganize({
        mode: 'medical_memo',
        viewerRole: 'parent',
        observations: bundle.observations,
        trials: bundle.trials,
        newInput: medicalRawConsult || '気になっている場面の整理',
        parentRawConsult: medicalRawConsult,
      });
      if (!resp.ok || !resp.data) {
        setError(resp.errorMessage || 'うまく整理できませんでした。記録はそのまま残っています');
        return;
      }
      const baseMemo = resp.data.memo || '';
      const withDoctorBlank = baseMemo.includes('医師の記入欄')
        ? baseMemo
        : `${baseMemo}\n\n------------------------------\n【医師の記入欄】\n\n\n\n`;
      setMedicalMemoDraft(withDoctorBlank);
    } catch {
      setError('うまく整理できませんでした。記録はそのまま残っています');
    } finally {
      setBusy(false);
    }
  };

  const pendingSchoolDiscoveries = useMemo(
    () =>
      (bundle?.sharingRequests || []).filter(
        (r) => r.fromSide === 'school' && r.status === 'pending'
      ),
    [bundle]
  );

  const selectedDirectoryRows = useMemo(
    () => CONSULTATION_FIXED_ROWS.filter((r) => selectedConcernIds.includes(r.id)),
    [selectedConcernIds]
  );

  const uniqueSearchableDepts = useMemo(() => {
    const s = new Set<string>();
    for (const row of selectedDirectoryRows) {
      for (const d of row.searchableDepartments) s.add(d);
    }
    return Array.from(s);
  }, [selectedDirectoryRows]);

  return (
    <div className="min-h-screen bg-[#FFFDF8] pb-16 text-[#3A3128]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#EAE2D3] bg-[#FFFDF8]/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EDF7F0] text-[#2F7A54]">
              <BookHeart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                うちの子トリセツ
              </h1>
              <p className="text-xs text-[#6E6254]">
                {activeStudent
                  ? `${activeStudent.nickname}さん（小学${activeStudent.grade}年）`
                  : '学校との紐付け確認中'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadAll()}
              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-3.5 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC]"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#2F7A54]" />
              更新
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-3.5 text-xs font-bold text-[#6E6254] transition hover:bg-[#FAF5EC] hover:text-[#3A3128]"
            >
              <LogOut className="h-3.5 w-3.5" />
              ログアウト
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto border-t border-[#EAE2D3]/70 px-3 pt-1 sm:px-6">
          {(
            [
              { key: 'home', label: 'ホーム', icon: Home },
              { key: 'talk_home', label: '家での様子を話す', icon: Mic },
              { key: 'torisetsu', label: 'わが子のトリセツ', icon: BookHeart },
              { key: 'directory_medical', label: '相談先・医師メモ', icon: Stethoscope },
              { key: 'settings', label: '共有・設定', icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = navTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setNavTab(item.key)}
                className={`flex min-h-[48px] shrink-0 items-center gap-2 whitespace-nowrap rounded-t-2xl border-b-2 px-4 py-2 text-xs font-bold transition sm:text-sm ${
                  active
                    ? 'border-[#2F7A54] bg-[#EDF7F0]/60 text-[#215C3E]'
                    : 'border-transparent text-[#6E6254] hover:bg-[#FAF5EC]/70 hover:text-[#3A3128]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Generic Privacy-Safe Notification Banner */}
        {pendingSchoolDiscoveries.length > 0 && (
          <div className="mb-5 rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4] px-5 py-3.5 text-sm font-bold text-[#1F5654]">
            新しいお知らせがあります（学校からの発見が{' '}
            <span className="tabular-nums">{pendingSchoolDiscoveries.length}</span> 件届いています）
          </div>
        )}

        {notice && (
          <div className="mb-5 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] px-5 py-3.5 text-sm font-bold text-[#215C3E]">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-2xl border border-[#B83227]/35 bg-[#FDF1F0] px-5 py-3.5 text-sm font-bold text-[#B83227]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-[#EAE2D3] bg-white p-10 text-center text-sm text-[#6E6254] shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
            お子さんのページを読み込んでいます...
          </div>
        ) : !activeStudent || !bundle ? (
          <div className="rounded-3xl border border-[#EAE2D3] bg-white p-7 shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
            <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
              学校側の承認をお待ちください
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6E6254]">
              招待コードによる紐付け申請を送信済みです（申請数：
              <span className="tabular-nums">{pendingLinks.length}</span>
              件）。学校の管理者が確認して承認すると、ここにお子さんの記録画面が表示されます。
            </p>
            <button
              type="button"
              onClick={() => setLinkSchoolModalOpen(true)}
              className="mt-5 min-h-[46px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-5 py-2 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC]"
            >
              別の招待コードを入力する
            </button>
          </div>
        ) : (
          <>
            {/* ==============================================================
                TAB 1: HOME — Exact 5-Section Order Specified in Chapter 8
               ============================================================== */}
            {navTab === 'home' && (
              <div className="space-y-6">
                {/* CARD 1: 子どもの声と、ゲームのようす */}
                <section className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold tabular-nums text-[#C86428]">1 / 5</span>
                      <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                        子どもの声と、ゲームのようす
                      </h2>
                    </div>

                    {!bundle.student.isHomeOnly ? (
                      <button
                        type="button"
                        onClick={() => setLaunchChildTarget(bundle.student)}
                        className="inline-flex min-h-[46px] items-center gap-2 whitespace-nowrap rounded-2xl bg-[#C86428] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#B0541E]"
                      >
                        <Compass className="h-4 w-4" />
                        子ども画面「がっこう たんけん」を開く
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLinkSchoolModalOpen(true)}
                        className="inline-flex min-h-[46px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] px-4 py-2 text-xs font-bold text-[#215C3E] transition hover:bg-[#E1F2E6]"
                      >
                        <Link2 className="h-4 w-4" />
                        学校の招待コードで連携する
                      </button>
                    )}
                  </div>

                  {bundle.student.isHomeOnly && !user.homeSafetyConfirmed && (
                    <div className="mt-4 rounded-2xl bg-[#FAF5EC] p-4 text-xs leading-relaxed text-[#6E6254]">
                      現在は「家庭だけで使うモード」です。安全対応の専門手順が連携されるまでの間、子ども画面の冒険ゲームはロックされています。家での記録・トリセツ・相談先案内・医師メモはすべてお使いいただけます。
                    </div>
                  )}

                  {!bundle.student.isHomeOnly && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] px-4 py-3 text-xs text-[#3A3128]">
                      <div className="space-y-0.5">
                        <div className="font-bold">
                          学校の1人1台端末での参加設定：
                          <span
                            className={
                              bundle.student.participationOptOut
                                ? 'ml-1 text-[#9A4816]'
                                : 'ml-1 text-[#215C3E]'
                            }
                          >
                            {bundle.student.participationOptOut
                              ? '参加しない（記録を取らない同じ見た目の画面で過ごします）'
                              : '参加する（通常の記録モード）'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6E6254]">
                          {bundle.student.participationOptOut
                            ? '授業中もクラスメイトと同じ見た目の学習ゲーム・ガチャ画面で過ごすため、周りからは分かりません。'
                            : `ご家庭の端末から遊ぶことも任意で選べます（たんけんずかん収集：${rewardDoc?.unlockedItemIds.length || 0} / ${GACHA_CATALOG.length}）。`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNavTab('settings')}
                        className="min-h-[38px] whitespace-nowrap rounded-xl border border-[#DFD5C5] bg-white px-3.5 text-xs font-bold text-[#3A3128] transition hover:bg-[#FFFDF8]"
                      >
                        参加設定を変更
                      </button>
                    </div>
                  )}

                  {/* Child Voices */}
                  <div className="mt-5 space-y-2.5">
                    <h3 className="text-xs font-bold text-[#6E6254]">
                      お子さんが伝えたこと（家庭へ公開を選んだ声）
                    </h3>
                    {bundle.childAnswers.length === 0 ? (
                      <div className="rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#6E6254]">
                        まだ記録はありません。
                      </div>
                    ) : (
                      bundle.childAnswers.map((ans) => (
                        <div
                          key={ans.answerId}
                          className={`rounded-2xl border p-4 ${
                            ans.isDistressSignal
                              ? 'border-[#F3CEAA] bg-[#FFF3E6]'
                              : 'border-[#EAE2D3] bg-[#FAF5EC]'
                          }`}
                        >
                          <div className="text-xs font-bold tabular-nums text-[#9A4816]">
                            {ans.dateLabel}{' '}
                            {ans.isDistressSignal && '・お子さんが「たいへん・困っている」と伝えています'}
                          </div>
                          <p className="mt-1.5 text-sm font-bold leading-relaxed text-[#3A3128]">
                            {ans.factSentence}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Game Condition Differences */}
                  <div className="mt-5 space-y-2.5 border-t border-[#EAE2D3] pt-5">
                    <h3 className="text-xs font-bold text-[#6E6254]">
                      冒険ゲームで見えた条件の違い（独自の課題で、標準化された検査ではありません）
                    </h3>
                    {(hasDifferentFormsWarning(bundle.gameSessions, 'shopping') ||
                      hasDifferentFormsWarning(bundle.gameSessions, 'delivery')) && (
                      <p className="rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] px-4 py-2.5 text-xs font-bold leading-relaxed text-[#9A4816]">
                        ※問題セット（形A・形B）が異なる回が含まれるため、回ごとの正答数の差を単純に比較しないでください。
                      </p>
                    )}
                    {bundle.gameSessions.length === 0 ? (
                      <div className="rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#6E6254]">
                        まだゲームの記録はありません。
                      </div>
                    ) : (
                      bundle.gameSessions.map((gs) => (
                        <div
                          key={gs.sessionId}
                          className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4 text-sm"
                        >
                          <div className="text-xs font-bold tabular-nums text-[#2B6E6B]">
                            {gs.dateLabel} ／{' '}
                            {gs.gameType === 'shopping' ? 'おかいもの' : 'どうぶつの はいたつ'}（
                            {gs.attemptNumber}回目）
                          </div>
                          <p className="mt-1 leading-relaxed text-[#3A3128]">
                            {gs.conditionSummary}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Consult Teacher Action */}
                  {!bundle.student.isHomeOnly && (
                    <div className="mt-5 border-t border-[#EAE2D3] pt-5">
                      <button
                        type="button"
                        onClick={() => setConsultOpen((v) => !v)}
                        className="inline-flex min-h-[48px] items-center gap-2 whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#256344]"
                      >
                        <HeartHandshake className="h-4 w-4" />
                        先生に相談する（下書きを作って確認してから送信）
                      </button>

                      {consultOpen && (
                        <div className="mt-4 space-y-4 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0]/50 p-5">
                          <p className="text-xs font-bold text-[#3A3128]">
                            1. 相談に添える記録を選んでください（選んだものだけが使われます）
                          </p>
                          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                            {bundle.observations.map((o) => (
                              <label
                                key={o.observationId}
                                className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#EAE2D3] bg-white p-3 text-xs leading-relaxed text-[#3A3128]"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedConsultObsIds.includes(o.observationId)}
                                  onChange={(e) =>
                                    setSelectedConsultObsIds((prev) =>
                                      e.target.checked
                                        ? [...prev, o.observationId]
                                        : prev.filter((id) => id !== o.observationId)
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 accent-[#2F7A54]"
                                />
                                <span>
                                  <span className="font-mono font-bold tabular-nums text-[#6E6254]">
                                    [{o.formalId}]
                                  </span>{' '}
                                  {o.fact}
                                </span>
                              </label>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#3A3128]">
                              2. 先生へ送るメッセージ（AI下書き後に自由に書き換えられます）
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={handleDraftConsultTeacher}
                              className="min-h-[42px] whitespace-nowrap rounded-xl border border-[#2F7A54] bg-white px-3.5 text-xs font-bold text-[#215C3E] transition hover:bg-[#EDF7F0]"
                            >
                              選んだ記録から下書きを作る
                            </button>
                          </div>

                          <textarea
                            rows={4}
                            value={consultBody}
                            onChange={(e) => setConsultBody(e.target.value)}
                            placeholder="家での様子や、学校での様子も教えていただきたいことを記入..."
                            className="w-full rounded-2xl border border-[#DFD5C5] bg-white p-3.5 text-sm leading-relaxed text-[#3A3128]"
                          />

                          {!consultConfirmStep ? (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={!consultBody.trim()}
                                onClick={() => {
                                  if (!checkSafety(consultBody)) return;
                                  setConsultConfirmStep(true);
                                }}
                                className="min-h-[46px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-50"
                              >
                                送信内容の確認へ進む
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-2xl border-2 border-[#2F7A54] bg-white p-4 text-xs leading-relaxed text-[#3A3128]">
                              <p className="font-bold text-[#215C3E]">送信前の確認</p>
                              <p className="mt-1.5">
                                ・<strong>何の情報を：</strong>選択した記録{' '}
                                <span className="tabular-nums">{selectedConsultObsIds.length}</span>
                                件と上記メッセージ
                              </p>
                              <p>
                                ・<strong>誰に：</strong>お子さんの学級担任の先生のみ
                              </p>
                              <p>
                                ・<strong>何のために：</strong>
                                家庭と学校で様子を共有し、合う関わり方を一緒に考えるため
                              </p>
                              <div className="mt-3.5 flex justify-end gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => setConsultConfirmStep(false)}
                                  className="min-h-[44px] whitespace-nowrap rounded-xl border border-[#DFD5C5] bg-white px-4 font-bold text-[#6E6254] transition hover:bg-[#FAF5EC]"
                                >
                                  戻って修正
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={async () => {
                                    const chosenFacts = bundle.observations
                                      .filter((o) =>
                                        selectedConsultObsIds.includes(o.observationId)
                                      )
                                      .map((o) => `[${o.formalId}] ${o.fact}`);
                                    await sendParentConsultation({
                                      student: bundle.student,
                                      index: bundle.index,
                                      selectedRecordSummaries: chosenFacts,
                                      messageBody: consultBody,
                                    });
                                    setConsultOpen(false);
                                    setConsultConfirmStep(false);
                                    setConsultBody('');
                                    setSelectedConsultObsIds([]);
                                    await refreshBundle(false);
                                    setNotice('担任の先生へ相談メッセージを送りました。');
                                  }}
                                  className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#2F7A54] px-4 font-bold text-white shadow-xs transition hover:bg-[#256344]"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  先生へ送信する
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Past Consultations & Teacher Replies */}
                      {bundle.consultations.length > 0 && (
                        <div className="mt-4 space-y-2.5">
                          {bundle.consultations.map((c) => (
                            <div
                              key={c.consultationId}
                              className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4 text-xs"
                            >
                              <div className="font-bold tabular-nums text-[#6E6254]">
                                {c.dateLabel} 送信した相談
                              </div>
                              <p className="mt-1.5 text-sm leading-relaxed text-[#3A3128]">
                                {c.messageBody}
                              </p>
                              {c.teacherReply && (
                                <div className="mt-2.5 rounded-xl border border-[#BCE0DD] bg-white p-3 text-[#3A3128]">
                                  <span className="font-bold text-[#1F5654]">先生からの返信：</span>
                                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                                    {c.teacherReply}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* CARD 2: 学校からの発見（5つの同じ大きさ・同じ目立ち方のボタン＋送信前確認） */}
                <section className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <span className="text-xs font-bold tabular-nums text-[#2B6E6B]">2 / 5</span>
                  <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                    学校からの発見
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                    先生から共有の提案が届いた場面です。どのボタンを選んでも構いません。押したあと確認画面が出てから送信されます。
                  </p>

                  {pendingSchoolDiscoveries.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#6E6254]">
                      現在、新しく届いている学校からの提案はありません。
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {pendingSchoolDiscoveries.map((req) => (
                        <div
                          key={req.requestId}
                          className="rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4]/60 p-5"
                        >
                          <div className="text-xs font-bold tabular-nums text-[#1F5654]">
                            {req.dateLabel} ／ 目的：{req.purposeText}
                          </div>
                          <p className="mt-2 text-base font-bold leading-relaxed text-[#3A3128]">
                            {req.previewText}
                          </p>

                          {/* 5 Equal-Size, Equal-Weight Buttons (Chapter 8 Strict Rule) */}
                          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                            {FIVE_EQUAL_REPLY_CHOICES.map((choice) => (
                              <button
                                key={choice}
                                type="button"
                                onClick={() =>
                                  setReplyDraft({
                                    request: req,
                                    choice,
                                    supplement: '',
                                  })
                                }
                                className="flex min-h-[50px] w-full items-center justify-center rounded-2xl border border-[#DFD5C5] bg-white px-3 py-2.5 text-center text-xs font-bold text-[#3A3128] transition hover:border-[#2B6E6B] hover:bg-[#EAF5F4]"
                              >
                                {choice}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pre-Send Confirmation Box for 5 Choices */}
                  {replyDraft && (
                    <div className="mt-4 rounded-2xl border-2 border-[#2B6E6B] bg-[#FAF5EC]/70 p-5">
                      <p className="text-sm font-bold text-[#3A3128]">
                        選択中：「{replyDraft.choice}」
                      </p>
                      {replyDraft.choice === 'あとで考える' ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-[#6E6254]">
                          いまは返答を送らず、そのまま残しておきます。いつでも気が向いたときに選べます。
                        </p>
                      ) : (
                        <>
                          <label className="mt-3 block text-xs font-bold text-[#3A3128]">
                            先生へ添える一言メモ（任意・書かなくても送れます）
                          </label>
                          <input
                            type="text"
                            value={replyDraft.supplement}
                            onChange={(e) =>
                              setReplyDraft({ ...replyDraft, supplement: e.target.value })
                            }
                            placeholder="例：家では絵本のときによく集中しています"
                            className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#DFD5C5] bg-white px-3.5 text-sm text-[#3A3128]"
                          />
                        </>
                      )}

                      <div className="mt-4 flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setReplyDraft(null)}
                          className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-4 text-xs font-bold text-[#6E6254] transition hover:bg-[#FAF5EC]"
                        >
                          戻る
                        </button>
                        {replyDraft.choice === 'あとで考える' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyDraft(null);
                              setNotice('「あとで考える」にしました。送信はされていません。');
                            }}
                            className="min-h-[44px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                          >
                            このまま閉じて保留にする
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              if (!checkSafety(replyDraft.supplement)) return;
                              await respondToSharingRequest({
                                request: replyDraft.request,
                                approve: true,
                                replyChoice: replyDraft.choice,
                                replySupplement: replyDraft.supplement,
                              });
                              setReplyDraft(null);
                              await refreshBundle(false);
                              setNotice('先生の発見を受け取り、お返事を送信しました。');
                            }}
                            className="min-h-[44px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#225957]"
                          >
                            確認して先生に送る
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                {/* CARD 3: 4つの記録から見えたこと */}
                <section className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold tabular-nums text-[#2F7A54]">3 / 5</span>
                      <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                        4つの記録から見えたこと
                      </h2>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          const resp = await callGeminiOrganize({
                            mode: 'bridge',
                            viewerRole: 'parent',
                            observations: bundle.observations,
                            trials: bundle.trials,
                            newInput:
                              '見えている4つの記録を並べて、違いと家庭で試せる工夫を提案してください。',
                          });
                          if (!resp.ok || !resp.data) {
                            setError(
                              resp.errorMessage ||
                                'うまく整理できませんでした。記録はそのまま残っています'
                            );
                          } else {
                            setBridgeProposal(resp.data);
                          }
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="min-h-[46px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                    >
                      {busy ? '整理中...' : '4つを並べて整理する'}
                    </button>
                  </div>

                  {bridgeProposal ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0]/50 p-5 text-sm">
                      <p className="font-bold text-[#215C3E]">{bridgeProposal.message}</p>
                      {bridgeProposal.new_hypotheses.map((h) => (
                        <div
                          key={h.temp_id}
                          className="rounded-2xl border border-[#EAE2D3] bg-white p-4"
                        >
                          <p className="font-bold text-[#3A3128]">{h.text}</p>
                          <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">{h.why}</p>
                        </div>
                      ))}
                      {bridgeProposal.suggested_trials.map((t, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-[#EAE2D3] bg-white p-4"
                        >
                          <span className="text-xs font-bold text-[#215C3E]">
                            [{t.where === 'home' ? '家で試せる工夫' : '学校向けアイデア'}]
                          </span>
                          <p className="mt-1 font-bold text-[#3A3128]">{t.text}</p>
                        </div>
                      ))}
                      {bridgeProposal.concerns.length > 0 && (
                        <div className="rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] p-4 text-xs leading-relaxed text-[#9A4816]">
                          気になる出来事の整理があります。先生に相談することや、「相談先・医師メモ」画面で相談先を調べることもできます。相談するのに診断名は必要ありません。
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={async () => {
                            await confirmAndSaveProposals({
                              actorRole: 'parent',
                              student: bundle.student,
                              index: bundle.index,
                              observationsToCreate: [],
                              hypothesesToCreate: bridgeProposal.new_hypotheses.map((h) => ({
                                text: h.text,
                                why: h.why,
                                evidenceExistingIds: h.evidence_existing_ids,
                                evidenceNewTempIds: [],
                                evidenceSides: h.evidence_sides,
                              })),
                              trialsToCreate: bridgeProposal.suggested_trials
                                .filter((t) => t.where === 'home')
                                .map((t) => ({
                                  where: 'home',
                                  whatToChange: t.text,
                                  why: t.why,
                                  basedOnExistingIds: t.based_on_existing_ids,
                                  basedOnNewTempIds: [],
                                  adjustsTrialId: t.adjusts_trial_id || '',
                                })),
                            });
                            setBridgeProposal(null);
                            await refreshBundle(false);
                            setNotice('整理した仮説と家で試す工夫を保存しました。');
                          }}
                          className="min-h-[46px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                        >
                          提案を保存する
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-2xl bg-[#FAF5EC] p-4 text-xs leading-relaxed text-[#6E6254]">
                      現在、見えている記録は{' '}
                      <span className="font-bold tabular-nums text-[#3A3128]">
                        {bundle.observations.length}
                      </span>{' '}
                      件、仮説は{' '}
                      <span className="font-bold tabular-nums text-[#3A3128]">
                        {bundle.hypotheses.length}
                      </span>{' '}
                      件あります。ボタンを押すと4つの視点から整理します。
                    </p>
                  )}
                </section>

                {/* CARD 4: 今週試すこと（大人の評価と子どもの感想を並べて表示） */}
                <section className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <span className="text-xs font-bold tabular-nums text-[#2F7A54]">4 / 5</span>
                  <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                    今週試すこと
                  </h2>

                  <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row">
                    <input
                      type="text"
                      value={newHomeTrialText}
                      onChange={(e) => setNewHomeTrialText(e.target.value)}
                      placeholder="家で試す小さな工夫（例：宿題の前に5分タイマーで見通しをつくる）"
                      className="min-h-[46px] flex-1 rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 text-sm text-[#3A3128]"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newHomeTrialText.trim()) return;
                        if (!checkSafety(`${newHomeTrialText} ${newHomeTrialWhy}`)) return;
                        await confirmAndSaveProposals({
                          actorRole: 'parent',
                          student: bundle.student,
                          index: bundle.index,
                          observationsToCreate: [],
                          hypothesesToCreate: [],
                          trialsToCreate: [
                            {
                              where: 'home',
                              whatToChange: newHomeTrialText,
                              why: newHomeTrialWhy || '家庭で試す工夫',
                              basedOnExistingIds: [],
                              basedOnNewTempIds: [],
                            },
                          ],
                        });
                        setNewHomeTrialText('');
                        setNewHomeTrialWhy('');
                        await refreshBundle(false);
                      }}
                      className="min-h-[46px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                    >
                      追加する
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {bundle.trials.length === 0 ? (
                      <div className="rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#6E6254]">
                        まだ登録された工夫はありません。家で気軽に試せる小さな工夫を1つ書いてみましょう。
                      </div>
                    ) : (
                      bundle.trials.map((tr) => (
                        <div
                          key={tr.trialId}
                          className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold tabular-nums text-[#215C3E]">
                              [{tr.formalId}] {tr.where === 'home' ? '家庭の工夫' : '学校の工夫'}
                            </span>
                            {tr.where === 'home' && !bundle.student.isHomeOnly && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateAdultTrialEvaluation({
                                    trial: tr,
                                    adultResult: tr.adultResult,
                                    childBurden: tr.childBurden,
                                    continuedStatus: tr.continuedStatus,
                                    shareStatus:
                                      tr.shareStatus === 'shared' ? 'stopped' : 'shared',
                                  });
                                  await refreshBundle(false);
                                }}
                                className="font-bold text-[#2B6E6B] underline hover:opacity-80"
                              >
                                {tr.shareStatus === 'shared'
                                  ? '先生と共有中（停止する）'
                                  : '先生にも共有する'}
                              </button>
                            )}
                          </div>
                          <p className="mt-1.5 text-sm font-bold leading-relaxed text-[#3A3128]">
                            {tr.whatToChange}
                          </p>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-[#EAE2D3] bg-white p-3.5 text-xs">
                              <div className="font-bold text-[#3A3128]">大人の振り返り</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <select
                                  value={tr.adultResult}
                                  onChange={async (e) => {
                                    await updateAdultTrialEvaluation({
                                      trial: tr,
                                      adultResult: e.target.value as TrialDoc['adultResult'],
                                      childBurden: tr.childBurden,
                                      continuedStatus: tr.continuedStatus,
                                      shareStatus: tr.shareStatus,
                                    });
                                    await refreshBundle(false);
                                  }}
                                  className="min-h-[40px] rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-2.5 font-bold text-[#3A3128]"
                                >
                                  <option value="unrecorded">効果：未記録</option>
                                  <option value="helpful">うまくいった</option>
                                  <option value="depends">場面による</option>
                                  <option value="not_fit">合わなかった</option>
                                </select>
                                <select
                                  value={tr.continuedStatus}
                                  onChange={async (e) => {
                                    await updateAdultTrialEvaluation({
                                      trial: tr,
                                      adultResult: tr.adultResult,
                                      childBurden: tr.childBurden,
                                      continuedStatus:
                                        e.target.value as TrialDoc['continuedStatus'],
                                      shareStatus: tr.shareStatus,
                                    });
                                    await refreshBundle(false);
                                  }}
                                  className="min-h-[40px] rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-2.5 font-bold text-[#3A3128]"
                                >
                                  <option value="unrecorded">継続：未記録</option>
                                  <option value="continued">続けた</option>
                                  <option value="sometimes">ときどき使う</option>
                                  <option value="stopped">やめた</option>
                                </select>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] p-3.5 text-xs">
                              <div className="font-bold text-[#9A4816]">お子さん本人の感想</div>
                              <p className="mt-2 font-bold leading-relaxed text-[#3A3128]">
                                {tr.childFeedback === 'good'
                                  ? '「よかった」'
                                  : tr.childFeedback === 'normal'
                                    ? '「ふつう」'
                                    : tr.childFeedback === 'disliked'
                                      ? '「いやだった」（無理に続けず調整しましょう）'
                                      : 'まだ聞いていません'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* CARD 5: わが子のトリセツ & 面談メモ */}
                <section className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <span className="text-xs font-bold tabular-nums text-[#2F7A54]">5 / 5</span>
                  <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                    わが子のトリセツ
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                    得意なこと、本人の声、うまくいく関わり方を6つのタブにまとめています。PDF保存や面談メモ作成もできます。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setNavTab('torisetsu')}
                      className="min-h-[46px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                    >
                      6つのタブで開く
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPrintModalState({
                          open: true,
                          title: `${bundle.student.nickname}さんのトリセツ`,
                          body: buildFullTorisetsuText(),
                        })
                      }
                      className="inline-flex min-h-[46px] items-center gap-2 whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 py-2 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC]"
                    >
                      <Printer className="h-4 w-4 text-[#2F7A54]" />
                      トリセツをPDF保存・印刷
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* ==============================================================
                TAB 2: 家での様子を話す (Text + Gemini Live Audio, Zero Video)
               ============================================================== */}
            {navTab === 'talk_home' && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                    家での様子を話す・メモする
                  </h2>
                  <div className="mt-3.5 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] p-4 text-xs leading-relaxed text-[#215C3E]">
                    <strong>音声会話についてのお知らせ：</strong>
                    AIとの音声会話です。録音は残らず、話した内容から文字のメモを作ります。お子さんやご家族の実名・住所は話さないでください。映像（カメラ）は一切使用しません。
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!liveConnected ? (
                      <button
                        type="button"
                        onClick={startLiveVoice}
                        className="inline-flex min-h-[50px] items-center gap-2 whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#256344]"
                      >
                        <Mic className="h-4 w-4" />
                        AIと声で話してメモを作る
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopLiveVoice}
                        className="inline-flex min-h-[50px] items-center gap-2 whitespace-nowrap rounded-2xl bg-[#B83227] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#9C281E]"
                      >
                        <MicOff className="h-4 w-4" />
                        音声会話を終える
                      </button>
                    )}
                    {liveConnected && (
                      <span className="text-xs font-bold text-[#215C3E]">
                        マイク接続中：お話しください...
                      </span>
                    )}
                  </div>

                  {liveAiReply && (
                    <div className="mt-3.5 rounded-2xl bg-[#FAF5EC] p-4 text-xs leading-relaxed text-[#6E6254]">
                      AIの返答：{liveAiReply}
                    </div>
                  )}

                  <textarea
                    rows={4}
                    value={homeInputText}
                    onChange={(e) => setHomeInputText(e.target.value)}
                    placeholder="文字で直接入力・編集することもできます（例：ブロック遊びだと1時間くらい集中して組み立てている。お風呂への切り替えは時計の針で伝えるとスムーズだった。）"
                    className="mt-4 w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] p-4 text-sm leading-relaxed text-[#3A3128] placeholder:text-[#6E6254]/70"
                  />

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleOrganizeHomeNote}
                      className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                    >
                      {busy ? '整理しています...' : 'メモを整理する'}
                    </button>
                  </div>

                  {editableHomeObs.length > 0 && (
                    <div className="mt-5 space-y-3.5 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0]/50 p-5">
                      {homeProposal?.message && (
                        <p className="text-sm font-bold text-[#215C3E]">
                          {homeProposal.message}
                        </p>
                      )}
                      {editableHomeObs.map((item, idx) => (
                        <div
                          key={item.tempId}
                          className="rounded-2xl border border-[#EAE2D3] bg-white p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#3A3128]">
                              <input
                                type="checkbox"
                                checked={item.include}
                                onChange={(e) =>
                                  setEditableHomeObs((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, include: e.target.checked } : x
                                    )
                                  )
                                }
                                className="h-4 w-4 accent-[#2F7A54]"
                              />
                              保存する
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) =>
                                setEditableHomeObs((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          category: e.target.value as ObservationCategory,
                                        }
                                      : x
                                  )
                                )
                              }
                              className="min-h-[40px] rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3 text-xs font-bold text-[#3A3128]"
                            >
                              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            rows={2}
                            value={item.fact}
                            onChange={(e) =>
                              setEditableHomeObs((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, fact: e.target.value } : x
                                )
                              )
                            }
                            className="mt-2.5 w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] p-3 text-sm leading-relaxed text-[#3A3128]"
                          />
                        </div>
                      ))}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleSaveHomeNoteProposals}
                          className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                        >
                          家庭の記録として保存する
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Saved Home Observations + Propose Sharing to Teacher */}
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                    保存済みの家庭の記録（先生へ共有したいものだけ選べます）
                  </h3>

                  {shareToSchoolObs && (
                    <div className="mt-4 rounded-2xl border-2 border-[#2F7A54] bg-[#EDF7F0]/50 p-5 text-xs leading-relaxed text-[#3A3128]">
                      <p className="font-bold text-[#215C3E]">先生へ共有する前の確認</p>
                      <p className="mt-1.5">
                        ・<strong>何の情報を：</strong>[{shareToSchoolObs.formalId}]{' '}
                        {shareToSchoolObs.fact}
                      </p>
                      <p>
                        ・<strong>誰に：</strong>学級担任の先生のみ
                      </p>
                      <input
                        type="text"
                        value={shareToSchoolPurpose}
                        onChange={(e) => setShareToSchoolPurpose(e.target.value)}
                        className="mt-2.5 min-h-[44px] w-full rounded-xl border border-[#DFD5C5] bg-white px-3.5 text-sm text-[#3A3128]"
                      />
                      <div className="mt-3.5 flex justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShareToSchoolObs(null)}
                          className="min-h-[44px] whitespace-nowrap rounded-xl border border-[#DFD5C5] bg-white px-4 font-bold text-[#6E6254] transition hover:bg-[#FAF5EC]"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!checkSafety(shareToSchoolPurpose)) return;
                            await createSharingRequest({
                              fromSide: 'home',
                              observation: shareToSchoolObs,
                              index: bundle.index,
                              previewText: shareToSchoolObs.fact,
                              purposeText: shareToSchoolPurpose,
                            });
                            setShareToSchoolObs(null);
                            await refreshBundle(false);
                            setNotice('担任の先生へ共有を提案しました。');
                          }}
                          className="min-h-[44px] whitespace-nowrap rounded-xl bg-[#2F7A54] px-5 font-bold text-white shadow-xs transition hover:bg-[#256344]"
                        >
                          先生へ提案を送る
                        </button>
                      </div>
                    </div>
                  )}

                  {bundle.observations.filter((o) => o.side === 'home').length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                      まだ家庭の記録はありません。家でのちょっとした様子や好きな遊びを気軽にメモしてみましょう。
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {bundle.observations
                        .filter((o) => o.side === 'home')
                        .map((o) => (
                          <div
                            key={o.observationId}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] p-4 text-sm"
                          >
                            <div>
                              <div className="text-xs tabular-nums text-[#6E6254]">
                                <span className="font-mono font-bold text-[#2F7A54]">
                                  [{o.formalId}]
                                </span>{' '}
                                {o.dateLabel} ・ {CATEGORY_LABELS[o.category]} ・{' '}
                                <span className="font-bold text-[#3A3128]">
                                  {o.shareStatus === 'shared' ? '先生と共有中' : '家庭のみ'}
                                </span>
                              </div>
                              <p className="mt-1.5 leading-relaxed text-[#3A3128]">{o.fact}</p>
                            </div>

                            {!bundle.student.isHomeOnly && (
                              <div>
                                {o.shareStatus === 'shared' ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await stopSharingObservation({
                                        observationId: o.observationId,
                                        studentId: o.studentId,
                                      });
                                      await refreshBundle(false);
                                    }}
                                    className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#B83227]/35 bg-white px-3.5 text-xs font-bold text-[#B83227] transition hover:bg-[#FDF1F0]"
                                  >
                                    共有をやめる
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setShareToSchoolObs(o)}
                                    className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] px-3.5 text-xs font-bold text-[#215C3E] transition hover:bg-[#E1F2E6]"
                                  >
                                    先生に共有を提案
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 3: わが子のトリセツ (Exact 6 Tabs + PDF/Print + Meeting Memo)
               ============================================================== */}
            {navTab === 'torisetsu' && (
              <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                    {bundle.student.nickname}さんのトリセツ（6つの視点）
                  </h2>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={async () => {
                        setBusy(true);
                        const sharedObs = bundle.observations.filter(
                          (o) => o.shareStatus === 'shared'
                        );
                        const sharedTrials = bundle.trials.filter(
                          (t) => t.shareStatus === 'shared'
                        );
                        const resp = await callGeminiOrganize({
                          mode: 'meeting_memo',
                          viewerRole: 'parent',
                          observations: sharedObs,
                          trials: sharedTrials,
                          newInput: '個人面談用のメモを作成してください。',
                        });
                        setBusy(false);
                        if (resp.ok && resp.data) {
                          setPrintModalState({
                            open: true,
                            title: '面談メモ（共有済みの記録のみ）',
                            body: resp.data.memo || resp.data.message,
                          });
                        } else {
                          setError(
                            resp.errorMessage ||
                              'うまく整理できませんでした。記録はそのまま残っています'
                          );
                        }
                      }}
                      className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4] px-4 text-xs font-bold text-[#1F5654] transition hover:bg-[#DDF0EE]"
                    >
                      面談メモを作る
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPrintModalState({
                          open: true,
                          title: `${bundle.student.nickname}さんのトリセツ`,
                          body: buildFullTorisetsuText(),
                        })
                      }
                      className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#2F7A54] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                    >
                      <Printer className="h-4 w-4" />
                      PDF保存・印刷
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-b border-[#EAE2D3] pb-4">
                  {(
                    [
                      { key: 'strengths', label: '1. 好き・得意' },
                      { key: 'child_voice', label: '2. 本人の声' },
                      { key: 'worked_well', label: '3. うまくいく関わり方' },
                      { key: 'game_conditions', label: '4. ゲームの条件' },
                      { key: 'trials_results', label: '5. 試した結果と感想' },
                      { key: 'differences', label: '6. 学校と家庭の違い' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setTorisetsuTab(st.key)}
                      className={`min-h-[44px] whitespace-nowrap rounded-2xl px-3.5 py-2 text-xs font-bold transition ${
                        torisetsuTab === st.key
                          ? 'bg-[#2F7A54] text-white shadow-xs'
                          : 'bg-[#FAF5EC] text-[#6E6254] hover:bg-[#F3ECE0] hover:text-[#3A3128]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 space-y-3">
                  {torisetsuTab === 'strengths' &&
                    (bundle.observations.filter((o) => o.category === 'strength').length === 0 ? (
                      <div className="rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                        まだ「好き・得意」の記録はありません。「家での様子を話す」から夢中になっていることを残してみましょう。
                      </div>
                    ) : (
                      bundle.observations
                        .filter((o) => o.category === 'strength')
                        .map((o) => (
                          <div
                            key={o.observationId}
                            className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4"
                          >
                            <SideDotLabel side={o.side} />
                            <p className="mt-1.5 text-sm leading-relaxed text-[#3A3128]">
                              <span className="font-mono font-bold tabular-nums text-[#6E6254]">
                                [{o.formalId}]
                              </span>{' '}
                              {o.fact}
                            </p>
                          </div>
                        ))
                    ))}

                  {torisetsuTab === 'child_voice' &&
                    (bundle.observations.filter((o) => o.side === 'child').length === 0 ? (
                      <div className="rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                        まだお子さん本人の声の記録はありません。
                      </div>
                    ) : (
                      bundle.observations
                        .filter((o) => o.side === 'child')
                        .map((o) => (
                          <div
                            key={o.observationId}
                            className="rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] p-4"
                          >
                            <SideDotLabel side="child" />
                            <p className="mt-1.5 text-sm font-bold leading-relaxed text-[#3A3128]">
                              <span className="font-mono tabular-nums text-[#9A4816]">
                                [{o.formalId}]
                              </span>{' '}
                              {o.fact}
                            </p>
                          </div>
                        ))
                    ))}

                  {torisetsuTab === 'worked_well' &&
                    (bundle.observations.filter((o) => o.category === 'worked_well').length ===
                    0 ? (
                      <div className="rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                        まだ「うまくいった関わり方」の記録はありません。
                      </div>
                    ) : (
                      bundle.observations
                        .filter((o) => o.category === 'worked_well')
                        .map((o) => (
                          <div
                            key={o.observationId}
                            className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4"
                          >
                            <SideDotLabel side={o.side} />
                            <p className="mt-1.5 text-sm leading-relaxed text-[#3A3128]">
                              <span className="font-mono font-bold tabular-nums text-[#6E6254]">
                                [{o.formalId}]
                              </span>{' '}
                              {o.fact}
                            </p>
                          </div>
                        ))
                    ))}

                  {torisetsuTab === 'game_conditions' &&
                    (bundle.observations.filter((o) => o.side === 'game').length === 0 ? (
                      <div className="rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                        まだ冒険ゲームの記録はありません。
                      </div>
                    ) : (
                      bundle.observations
                        .filter((o) => o.side === 'game')
                        .map((o) => (
                          <div
                            key={o.observationId}
                            className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4"
                          >
                            <SideDotLabel side="game" />
                            <p className="mt-1.5 text-sm leading-relaxed text-[#3A3128]">
                              <span className="font-mono font-bold tabular-nums text-[#6E6254]">
                                [{o.formalId}]
                              </span>{' '}
                              {o.fact}
                            </p>
                          </div>
                        ))
                    ))}

                  {torisetsuTab === 'trials_results' &&
                    (bundle.trials.length === 0 ? (
                      <div className="rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                        まだ試した工夫の記録はありません。
                      </div>
                    ) : (
                      bundle.trials.map((t) => (
                        <div
                          key={t.trialId}
                          className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4 text-sm"
                        >
                          <p className="font-bold text-[#3A3128]">
                            <span className="font-mono tabular-nums text-[#215C3E]">
                              [{t.formalId}]
                            </span>{' '}
                            {t.whatToChange}
                          </p>
                          <p className="mt-1.5 text-xs text-[#6E6254]">
                            大人の記録：
                            {t.adultResult === 'helpful'
                              ? 'うまくいった'
                              : t.adultResult === 'depends'
                                ? '場面による'
                                : t.adultResult === 'not_fit'
                                  ? '合わなかった'
                                  : '未記録'}{' '}
                            ／ お子さんの感想：
                            {t.childFeedback === 'good'
                              ? '「よかった」'
                              : t.childFeedback === 'normal'
                                ? '「ふつう」'
                                : t.childFeedback === 'disliked'
                                  ? '「いやだった」'
                                  : 'まだ聞いていません'}
                          </p>
                        </div>
                      ))
                    ))}

                  {torisetsuTab === 'differences' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4]/50 p-4">
                        <SideDotLabel side="school" />
                        {bundle.observations.filter((o) => o.side === 'school').length === 0 ? (
                          <p className="mt-2.5 text-xs text-[#6E6254]">
                            共有された学校の記録はまだありません。
                          </p>
                        ) : (
                          <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-[#3A3128]">
                            {bundle.observations
                              .filter((o) => o.side === 'school')
                              .map((o) => (
                                <li key={o.observationId}>・{o.fact}</li>
                              ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0]/60 p-4">
                        <SideDotLabel side="home" />
                        {bundle.observations.filter((o) => o.side === 'home').length === 0 ? (
                          <p className="mt-2.5 text-xs text-[#6E6254]">
                            家庭の記録はまだありません。
                          </p>
                        ) : (
                          <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-[#3A3128]">
                            {bundle.observations
                              .filter((o) => o.side === 'home')
                              .map((o) => (
                                <li key={o.observationId}>・{o.fact}</li>
                              ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 4: Chapter 9 Fixed Consultation Directory, Maps & Medical Memo
               ============================================================== */}
            {navTab === 'directory_medical' && (
              <div className="space-y-6">
                {/* 1. Mandatory Emergency Banner at Very Top */}
                <div className="rounded-2xl border border-[#B83227]/35 bg-[#FDF1F0] p-4 text-sm font-bold leading-relaxed text-[#B83227]">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{EMERGENCY_TOP_BANNER_TEXT}</span>
                  </div>
                </div>

                {/* 2. Fixed Lookup Table (Deterministic Code Only — Never AI Ranked!) */}
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                    相談先を調べる（固定の対応表）
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                    気になることを選ぶと、あらかじめ定められた対応表をそのまま表示します（複数選択可・AIによる順位付けや判断は一切行いません）。
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {CONSULTATION_FIXED_ROWS.map((row) => {
                      const checked = selectedConcernIds.includes(row.id);
                      return (
                        <label
                          key={row.id}
                          className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                            checked
                              ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#215C3E]'
                              : 'border-[#EAE2D3] bg-[#FFFDF8] text-[#3A3128] hover:bg-[#FAF5EC]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedConcernIds((prev) =>
                                e.target.checked
                                  ? [...prev, row.id]
                                  : prev.filter((x) => x !== row.id)
                              )
                            }
                            className="h-4 w-4 accent-[#2F7A54]"
                          />
                          <span>{row.concern}</span>
                        </label>
                      );
                    })}
                  </div>

                  {selectedDirectoryRows.length > 0 && (
                    <div className="mt-5 overflow-x-auto rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] p-4">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#EAE2D3] text-xs font-bold text-[#6E6254]">
                            <th className="py-2.5 pr-3">気になること</th>
                            <th className="py-2.5 pr-3">まず話せる相手（学校・地域）</th>
                            <th className="py-2.5">医療に相談するときの診療科</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAE2D3]">
                          {selectedDirectoryRows.map((row) => (
                            <tr key={row.id}>
                              <td className="py-3.5 pr-3 font-bold text-[#3A3128]">
                                {row.concern}
                              </td>
                              <td className="py-3.5 pr-3 leading-relaxed text-[#3A3128]">
                                {row.firstTalkTo}
                              </td>
                              <td className="py-3.5 font-bold text-[#2B6E6B]">
                                {row.medicalDepartments}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Mandatory Bottom Disclaimers & Referral Fee Notice */}
                  <div className="mt-5 space-y-1.5 rounded-2xl bg-[#FAF5EC] p-4 text-xs leading-relaxed text-[#3A3128]">
                    {CONSULTATION_BOTTOM_NOTES.map((note) => (
                      <p key={note}>・{note}</p>
                    ))}
                    <p className="mt-2.5 border-t border-[#EAE2D3] pt-2.5 text-[#6E6254]">
                      <strong>紹介状と初診について：</strong>
                      {REFERRAL_LETTER_EXPLANATION}
                    </p>
                    <p className="pt-1 text-[11px] text-[#6E6254]">
                      対応表の確認者：
                      {school?.directorySupervisor ||
                        '小児科医・公認心理師・特別支援教育有識者 監修'}{' '}
                      ／ 版：{school?.directoryVersion || 'v1.0'}
                    </p>
                  </div>

                  {/* Nearby Google Maps Search Links */}
                  <div className="mt-6 border-t border-[#EAE2D3] pt-5">
                    <h3 className="text-sm font-bold text-[#3A3128]">
                      近くの窓口・医療機関を地図で探す（Google マップを開きます）
                    </h3>
                    <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={mapAreaQuery}
                        onChange={(e) => setMapAreaQuery(e.target.value)}
                        placeholder="市区町村名や駅名（例：〇〇市、〇〇駅）"
                        className="min-h-[46px] flex-1 rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 text-sm text-[#3A3128]"
                      />
                    </div>
                    {uniqueSearchableDepts.length === 0 ? (
                      <p className="mt-2.5 text-xs text-[#6E6254]">
                        上のチェック項目を選ぶと、該当する診療科・相談窓口の地図検索ボタンが表示されます。
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        {uniqueSearchableDepts.map((dept) => (
                          <a
                            key={dept}
                            href={buildGoogleMapsSearchUrl(dept, mapAreaQuery)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4] px-4 py-2 text-xs font-bold text-[#1F5654] transition hover:bg-[#DDF0EE]"
                          >
                            <MapPin className="h-3.5 w-3.5 text-[#2B6E6B]" />
                            「{dept} {mapAreaQuery}」を地図で開く
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Medical Memo Generator (Only when button is pressed!) */}
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                    医師に渡すメモを作る（ボタンを押したときだけ整理します）
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                    これまでの記録に新しい解釈を加えずそのまま並べ替え、末尾に空欄の「医師の記入欄」を設けます。
                  </p>

                  <label className="mt-4 block text-xs font-bold text-[#3A3128]">
                    相談したいこと（入力した文がそのまま冒頭に入ります）
                  </label>
                  <textarea
                    rows={2}
                    value={medicalRawConsult}
                    onChange={(e) => setMedicalRawConsult(e.target.value)}
                    placeholder="例：家と学校での集中のしやすさの違いや、関わり方の工夫について相談したいです。"
                    className="mt-1.5 w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] p-3.5 text-sm leading-relaxed text-[#3A3128]"
                  />

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreateMedicalMemo}
                    className="mt-3.5 min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#225957] disabled:opacity-60"
                  >
                    {busy ? '作成中...' : '医師に渡すメモを作る'}
                  </button>

                  {medicalMemoDraft && (
                    <div className="mt-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#3A3128]">
                          内容を確認・修正してから印刷またはPDF保存してお持ちください
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPrintModalState({
                              open: true,
                              title: '医師・専門窓口に渡すメモ',
                              body: medicalMemoDraft,
                            })
                          }
                          className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#2F7A54] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                        >
                          <Printer className="h-4 w-4" />
                          PDF保存・印刷
                        </button>
                      </div>
                      <textarea
                        rows={12}
                        value={medicalMemoDraft}
                        onChange={(e) => setMedicalMemoDraft(e.target.value)}
                        className="w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] p-4 text-sm leading-relaxed text-[#3A3128]"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Optional Follow-up (その後のこと — Private to Parent) */}
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                    その後のこと（任意の記録・先生には共有されません）
                  </h3>
                  <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">いまの状況</label>
                      <select
                        value={followupSituation}
                        onChange={(e) =>
                          setFollowupSituation(
                            e.target.value as ParentFollowupDoc['currentSituation']
                          )
                        }
                        className="mt-1.5 min-h-[46px] w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm font-bold text-[#3A3128]"
                      >
                        <option value="consulted_teacher">先生に相談した</option>
                        <option value="consulted_specialist">専門の窓口・医療機関に相談した</option>
                        <option value="planning_to_consult">これから相談する予定</option>
                        <option value="trying_at_school">学校や家で工夫を試している</option>
                        <option value="thinking">いまは考え中</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#3A3128]">
                        医師に渡すメモは役に立ちましたか
                      </label>
                      <select
                        value={followupHelpful}
                        onChange={(e) =>
                          setFollowupHelpful(e.target.value as ParentFollowupDoc['memoHelpful'])
                        }
                        className="mt-1.5 min-h-[46px] w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm font-bold text-[#3A3128]"
                      >
                        <option value="none">未回答</option>
                        <option value="helpful">役に立った</option>
                        <option value="somewhat">少し役に立った</option>
                        <option value="not_used">使わなかった</option>
                      </select>
                    </div>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-xs text-[#6E6254]">
                    <input
                      type="checkbox"
                      checked={followupConsent}
                      onChange={(e) => setFollowupConsent(e.target.checked)}
                      className="h-4 w-4 accent-[#2F7A54]"
                    />
                    個人を特定しない統計としてアプリ改善に活用することに同意する（任意）
                  </label>

                  <button
                    type="button"
                    onClick={async () => {
                      await saveParentFollowupRecord({
                        existing: existingFollowup,
                        parentUid: user.uid,
                        studentId: bundle.student.studentId,
                        currentSituation: followupSituation,
                        memoHelpful: followupHelpful,
                        consentForImprovement: followupConsent,
                      });
                      await loadAll();
                      setNotice('その後の記録を保存しました。');
                    }}
                    className="mt-4 min-h-[46px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-5 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC]"
                  >
                    その後の記録を保存
                  </button>
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 5: Settings, School Link, Home Data Deletion & Withdrawal
               ============================================================== */}
            {navTab === 'settings' && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                    学校との連携状態
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#6E6254]">
                    {bundle.student.isHomeOnly
                      ? '現在、学校とは連携せず家庭単独で利用しています。学校から招待コードを受け取ったらいつでも連携できます。'
                      : `学校（${school?.schoolCodeLabel || '連携校'}）と連携中です。学校側の記録保存期間は ${school?.retentionMonths || 12} か月です。`}
                  </p>
                  {bundle.student.isHomeOnly && (
                    <button
                      type="button"
                      onClick={() => setLinkSchoolModalOpen(true)}
                      className="mt-4 min-h-[46px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                    >
                      学校の招待コードを入力して連携する
                    </button>
                  )}
                </div>

                {!bundle.student.isHomeOnly && (
                  <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                    <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                      学校の1人1台端末（授業・持ち帰り）での参加設定
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#6E6254]">
                      学校では1人1台端末を使って学級で一斉に活動しますが、参加しない選択も保護者がいつでも自由に選べます。
                      「参加しない」を選んだ場合でも、お子さんは授業中に
                      <strong className="text-[#3A3128]">
                        記録を取らない同じ見た目の学習コンテンツ
                      </strong>
                      で同じ時間を過ごすため、誰が参加していないかが周りの子どもに分かることはありません。
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSetSchoolParticipationOptOut(false)}
                        className={`flex min-h-[64px] flex-col items-start justify-center rounded-2xl border-2 px-4 py-3 text-left transition ${
                          !bundle.student.participationOptOut
                            ? 'border-[#2F7A54] bg-[#EDF7F0] text-[#215C3E]'
                            : 'border-[#EAE2D3] bg-[#FFFDF8] text-[#3A3128] hover:bg-[#FAF5EC]'
                        }`}
                      >
                        <span className="text-sm font-bold">
                          参加する（通常の記録モード）
                        </span>
                        <span className="mt-1 text-xs text-[#6E6254]">
                          ゲームで見えた条件の違いや本人が伝えた声を記録します
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSetSchoolParticipationOptOut(true)}
                        className={`flex min-h-[64px] flex-col items-start justify-center rounded-2xl border-2 px-4 py-3 text-left transition ${
                          bundle.student.participationOptOut
                            ? 'border-[#C86428] bg-[#FFF3E6] text-[#9A4816]'
                            : 'border-[#EAE2D3] bg-[#FFFDF8] text-[#3A3128] hover:bg-[#FAF5EC]'
                        }`}
                      >
                        <span className="text-sm font-bold">
                          参加しない（記録を取らない学習モード）
                        </span>
                        <span className="mt-1 text-xs text-[#6E6254]">
                          周りと同じ画面で遊びますが、回答や行動データは一切保存しません
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                  <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                    家庭の記録の削除・退会（いつでも実行できます）
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#6E6254]">
                    家庭で作成した記録はいつでも削除できます。学校と連携している場合、学校の記録は学校が定めた保存期間にしたがって管理されます。
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {!confirmDeleteHome ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteHome(true)}
                        className="inline-flex min-h-[46px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#B83227]/35 bg-white px-4 text-xs font-bold text-[#B83227] transition hover:bg-[#FDF1F0]"
                      >
                        <Trash2 className="h-4 w-4" />
                        家庭で書いた記録をすべて削除する
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#B83227]/35 bg-[#FDF1F0] p-3.5 text-xs">
                        <span className="font-bold text-[#B83227]">
                          本当に家庭の記録を削除しますか？
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteParentHomeRecords({ bundle });
                            setConfirmDeleteHome(false);
                            await refreshBundle(false);
                            setNotice('家庭の記録をすべて削除しました。');
                          }}
                          className="min-h-[40px] whitespace-nowrap rounded-xl bg-[#B83227] px-3.5 font-bold text-white transition hover:bg-[#9C281E]"
                        >
                          削除を実行
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteHome(false)}
                          className="min-h-[40px] whitespace-nowrap rounded-xl border border-[#DFD5C5] bg-white px-3.5 font-bold text-[#6E6254]"
                        >
                          やめる
                        </button>
                      </div>
                    )}

                    {!confirmWithdraw ? (
                      <button
                        type="button"
                        onClick={() => setConfirmWithdraw(true)}
                        className="min-h-[46px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-4 text-xs font-bold text-[#6E6254] transition hover:bg-[#FAF5EC]"
                      >
                        退会して保護者アカウントを削除する
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#B83227]/35 bg-[#FDF1F0] p-3.5 text-xs">
                        <span className="font-bold text-[#B83227]">
                          家庭の記録を削除し、学校との連携も解除して退会しますか？
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await withdrawParentAccount({
                              parentUid: user.uid,
                              bundles: [bundle],
                              followups,
                            });
                            await signOut(auth);
                            onAccountWithdrawn();
                          }}
                          className="min-h-[40px] whitespace-nowrap rounded-xl bg-[#B83227] px-3.5 font-bold text-white transition hover:bg-[#9C281E]"
                        >
                          退会する
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmWithdraw(false)}
                          className="min-h-[40px] whitespace-nowrap rounded-xl border border-[#DFD5C5] bg-white px-3.5 font-bold text-[#6E6254]"
                        >
                          やめる
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <AdultSafetyModal
        open={safetyModalOpen}
        onClose={() => setSafetyModalOpen(false)}
        supervisorName={school?.safetySupervisor}
        versionLabel={school?.safetyVersion}
      />

      <LinkAdditionalSchoolModal
        open={linkSchoolModalOpen}
        uid={user.uid}
        existingUser={user}
        onClose={() => setLinkSchoolModalOpen(false)}
        onLinked={() => void loadAll()}
      />

      <AdultPinLaunchModal
        open={Boolean(launchChildTarget)}
        childNickname={launchChildTarget?.nickname || ''}
        placeLabel="家庭"
        onCancel={() => setLaunchChildTarget(null)}
        onConfirmLaunch={(pinHash, deviceType) => {
          if (!launchChildTarget) return;
          const s = launchChildTarget;
          setLaunchChildTarget(null);
          onEnterChildMode({
            studentId: s.studentId,
            nickname: s.nickname,
            schoolId: s.schoolId,
            classId: s.classId,
            grade: s.grade,
            gradeBand: s.gradeBand,
            place: 'home',
            deviceType,
            pinHash,
            participationOptOut: Boolean(s.participationOptOut),
          });
        }}
      />

      <PrintableExportModal
        open={printModalState.open}
        title={printModalState.title}
        filename={`うちの子トリセツ_${printModalState.title}`}
        onClose={() => setPrintModalState({ open: false, title: '', body: '' })}
      >
        <div className="space-y-4">
          <h2 className="border-b border-[#EAE2D3] pb-2 font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128]">
            {printModalState.title}
          </h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#3A3128]">
            {printModalState.body}
          </div>
        </div>
      </PrintableExportModal>
    </div>
  );
};
