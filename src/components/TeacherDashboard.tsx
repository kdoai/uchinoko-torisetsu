import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Compass,
  Copy,
  FileText,
  Layers,
  LogOut,
  MessageSquare,
  MonitorPlay,
  PenLine,
  Printer,
  QrCode,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Users,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { hasDifferentFormsWarning } from '../lib/factFormatter';
import {
  callGeminiOrganize,
  closeClassroomPlaySession,
  confirmAndSaveProposals,
  createSharingRequest,
  issueClassNamelessQrCards,
  loadAuthorizedStudentBundle,
  loadTeacherWorkspace,
  openClassroomPlaySession,
  replyToParentConsultation,
  respondToSharingRequest,
  setStudentParticipationOptOut,
  stopSharingObservation,
  subscribeClassroomSession,
  syncClassroomRosterOptOut,
  toggleHypothesisShareStatus,
  updateAdultTrialEvaluation,
  updateClassroomTakeHomeSetting,
  withdrawPendingSharingRequest,
  type PrintableNamelessQrCard,
} from '../lib/firestoreService';
import {
  containsAdultSafetyKeyword,
  type GeminiBResponse,
} from '../shared/safetyAndGuardrails';
import type {
  ActiveChildModeLock,
  AuthorizedStudentBundle,
  ClassroomSessionDoc,
  ObservationCategory,
  ObservationDoc,
  SchoolClassDoc,
  SchoolDoc,
  StudentDoc,
  TeacherSafetyNoticeDoc,
  TrialDoc,
  UserAccountDoc,
} from '../types/models';
import {
  AdultPinLaunchModal,
  AdultSafetyModal,
  CATEGORY_LABELS,
  PrintableExportModal,
  SideDotLabel,
} from './CommonUI';

type TeacherSection =
  | 'quick_note'
  | 'batch_memo'
  | 'child_adventure'
  | 'four_bridge'
  | 'family_collab'
  | 'trials'
  | 'meeting_letter'
  | 'term_class_tips';

const QUICK_SCHOOL_TAGS = [
  '図や見本を添えると見通しをもって取り組めた',
  '手順を1つずつ短く伝えると安心して始められた',
  '好きなテーマの活動で集中して工夫していた',
  '切り替えの前に事前予告をするとスムーズだった',
  '一斉の口頭説明だけだと手が止まりやすい場面があった',
  '周りの音や動きが気になって疲れやすい様子があった',
];

export const TeacherDashboard: React.FC<{
  user: UserAccountDoc;
  onEnterChildMode: (lock: ActiveChildModeLock) => void;
}> = ({ user, onEnterChildMode }) => {
  const [school, setSchool] = useState<SchoolDoc | null>(null);
  const [schoolClass, setSchoolClass] = useState<SchoolClassDoc | null>(null);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [safetyNotice, setSafetyNotice] = useState<TeacherSafetyNoticeDoc | null>(null);
  const [staffLabel, setStaffLabel] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentBundle, setStudentBundle] = useState<AuthorizedStudentBundle | null>(null);

  const [section, setSection] = useState<TeacherSection>('quick_note');
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Safety modal (Chapter 12A)
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);

  // Child adventure launch modal
  const [launchTargetStudent, setLaunchTargetStudent] = useState<StudentDoc | null>(null);

  // Quick note (school_note) state
  const [quickTags, setQuickTags] = useState<string[]>([]);
  const [quickText, setQuickText] = useState('');
  const [correctingObsId, setCorrectingObsId] = useState('');
  const [geminiProposal, setGeminiProposal] = useState<GeminiBResponse | null>(null);
  const [editableNewObs, setEditableNewObs] = useState<
    Array<{
      tempId: string;
      category: ObservationCategory;
      fact: string;
      suggestShare: boolean;
      include: boolean;
    }>
  >([]);

  // Batch class note (class_note) state
  const [classRawMemo, setClassRawMemo] = useState('');
  const [classProposal, setClassProposal] = useState<GeminiBResponse | null>(null);
  const [assignedBatchItems, setAssignedBatchItems] = useState<
    Array<{
      key: string;
      fact: string;
      category: ObservationCategory;
      studentId: string;
      reason?: string;
    }>
  >([]);

  // Bridge (4つを並べる) state
  const [bridgeProposal, setBridgeProposal] = useState<GeminiBResponse | null>(null);

  // Sharing & Consultation state
  const [shareTargetObs, setShareTargetObs] = useState<ObservationDoc | null>(null);
  const [sharePurpose, setSharePurpose] = useState(
    '学校で見られた様子をご家庭と共有し、ご家庭での様子も伺いたいため'
  );
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [incomingSupplements, setIncomingSupplements] = useState<Record<string, string>>({});

  // Manual Trial form
  const [newTrialText, setNewTrialText] = useState('');
  const [newTrialWhy, setNewTrialWhy] = useState('');

  // Printable memos (meeting_memo, parent_letter, term_facts, class_tips)
  const [generatedDocTitle, setGeneratedDocTitle] = useState('');
  const [generatedDocText, setGeneratedDocText] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // 1-per-Student Live Classroom Window ("授業で遊ぶ") & Nameless QR Cards
  const [classroomSession, setClassroomSession] = useState<ClassroomSessionDoc | null>(null);
  const [lessonDurationMins, setLessonDurationMins] = useState<number>(45);
  const [defaultAllowTakeHome, setDefaultAllowTakeHome] = useState<boolean>(true);
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const [namelessQrCards, setNamelessQrCards] = useState<PrintableNamelessQrCard[]>([]);
  const [qrSheetModalOpen, setQrSheetModalOpen] = useState<boolean>(false);

  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    setError('');
    try {
      const ws = await loadTeacherWorkspace(user.uid);
      setSchool(ws.school);
      setSchoolClass(ws.schoolClass);
      setStudents(ws.students);
      setSafetyNotice(ws.safetyNotice);
      setStaffLabel(ws.membership.displayLabel);
      if (ws.students.length > 0) {
        setSelectedStudentId((prev) =>
          prev && ws.students.some((s) => s.studentId === prev)
            ? prev
            : ws.students[0].studentId
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '学級情報の読み込みに失敗しました。');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [user.uid]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  // Subscribe to live classroom session (receives ONLY connectedCount & open window — zero individual results)
  useEffect(() => {
    if (!schoolClass?.classId) {
      setClassroomSession(null);
      return;
    }
    const unsub = subscribeClassroomSession(schoolClass.classId, (sess) => {
      setClassroomSession(sess);
      if (sess) {
        setDefaultAllowTakeHome(sess.allowTakeHome);
      }
    });
    return () => unsub();
  }, [schoolClass?.classId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTickMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const isLessonWindowActive = useMemo(() => {
    if (!classroomSession || !classroomSession.isOpen) return false;
    const expMs = classroomSession.expiresAt?.toMillis
      ? classroomSession.expiresAt.toMillis()
      : 0;
    return expMs > nowTickMs;
  }, [classroomSession, nowTickMs]);

  const remainingLessonMinutes = useMemo(() => {
    if (!isLessonWindowActive || !classroomSession?.expiresAt?.toMillis) return 0;
    return Math.max(1, Math.ceil((classroomSession.expiresAt.toMillis() - nowTickMs) / 60000));
  }, [classroomSession, isLessonWindowActive, nowTickMs]);

  const handleOpenLessonWindow = async () => {
    if (!school || !schoolClass) return;
    if (!school.allPreChecksDone) {
      setError('学校管理画面の「利用開始前チェック5項目」が完了してから授業を開始してください。');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await openClassroomPlaySession({
        school,
        schoolClass,
        teacherUid: user.uid,
        students,
        durationMinutes: lessonDurationMins,
        allowTakeHome: classroomSession ? classroomSession.allowTakeHome : defaultAllowTakeHome,
      });
      setNowTickMs(Date.now());
      setNotice(
        `「授業で遊ぶ」を開始しました（${lessonDurationMins}分間）。児童は自分の端末から入れます。`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '授業セッションの開始に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleCloseLessonWindow = async () => {
    if (!schoolClass) return;
    setBusy(true);
    setError('');
    try {
      await closeClassroomPlaySession({
        classId: schoolClass.classId,
        teacherUid: user.uid,
      });
      setNowTickMs(Date.now());
      setNotice('「授業で遊ぶ」を終了し、学級の入口を閉じました。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '授業セッションの終了に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAllowTakeHome = async (nextAllow: boolean) => {
    setDefaultAllowTakeHome(nextAllow);
    if (!schoolClass || !classroomSession) return;
    setBusy(true);
    setError('');
    try {
      await updateClassroomTakeHomeSetting({
        classId: schoolClass.classId,
        teacherUid: user.uid,
        allowTakeHome: nextAllow,
      });
      setNotice(
        nextAllow
          ? '持ち帰り端末での利用を許可しました（安全連絡は学校の安全担当へ届きます）。'
          : '持ち帰り端末での利用を停止しました。'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '持ち帰り設定の更新に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleIssueNamelessQrSheet = async () => {
    if (!school || !schoolClass) return;
    if (students.length === 0) {
      setError('まだ学級に児童が登録されていません。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const cards = await issueClassNamelessQrCards({
        school,
        schoolClass,
        students,
        issuerRole: 'teacher',
        issuerUid: user.uid,
        appOrigin: window.location.origin,
      });
      setNamelessQrCards(cards);
      setQrSheetModalOpen(true);
      setNotice('氏名を入れない1人1枚のQRカードを発行しました。印刷して出席番号で配付できます。');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QRカードの発行に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStudentOptOutByTeacher = async (stu: StudentDoc, nextOptOut: boolean) => {
    if (!school || !schoolClass) return;
    setBusy(true);
    setError('');
    try {
      await setStudentParticipationOptOut({
        studentId: stu.studentId,
        participationOptOut: nextOptOut,
        callerRole: 'teacher',
        callerUid: user.uid,
      });
      const updatedStudents = students.map((item) =>
        item.studentId === stu.studentId ? { ...item, participationOptOut: nextOptOut } : item
      );
      setStudents(updatedStudents);
      await syncClassroomRosterOptOut({
        classId: schoolClass.classId,
        schoolId: school.schoolId,
        teacherUid: user.uid,
        students: updatedStudents,
      });
      setNotice(
        nextOptOut
          ? `${stu.attendanceNumber}番を「参加しない（記録を取らない同じ画面）」に設定しました。`
          : `${stu.attendanceNumber}番を「参加する（通常の記録モード）」に戻しました。`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加設定の更新に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const selectedStudent = useMemo(
    () => students.find((s) => s.studentId === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const refreshStudentBundle = useCallback(
    async (logAccess = false) => {
      if (!selectedStudent) {
        setStudentBundle(null);
        return;
      }
      setLoadingBundle(true);
      try {
        const b = await loadAuthorizedStudentBundle({
          viewerRole: 'teacher',
          viewerUid: user.uid,
          student: selectedStudent,
          logAccess,
        });
        setStudentBundle(b);
      } catch (err) {
        setError(err instanceof Error ? err.message : '児童の記録を取得できませんでした。');
      } finally {
        setLoadingBundle(false);
      }
    },
    [selectedStudent, user.uid]
  );

  useEffect(() => {
    setGeminiProposal(null);
    setBridgeProposal(null);
    void refreshStudentBundle(true);
  }, [selectedStudentId, refreshStudentBundle]);

  const checkSafetyOrProceed = (text: string): boolean => {
    if (containsAdultSafetyKeyword(text)) {
      setSafetyModalOpen(true);
      return false;
    }
    return true;
  };

  // --------------------------------------------------------------------------
  // 1. Quick School Note (school_note)
  // --------------------------------------------------------------------------
  const handleOrganizeQuickNote = async () => {
    if (!studentBundle) return;
    const combined = [...quickTags, quickText.trim()].filter(Boolean).join('。');
    if (!combined) {
      setError('タグを選ぶか、一言メモを入力してください。');
      return;
    }
    if (!checkSafetyOrProceed(combined)) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const resp = await callGeminiOrganize({
        mode: 'school_note',
        viewerRole: 'teacher',
        observations: studentBundle.observations,
        trials: studentBundle.trials,
        newInput: combined,
      });
      if (!resp.ok || !resp.data) {
        setError(resp.errorMessage || 'うまく整理できませんでした。記録はそのまま残っています');
        // Allow direct manual save even when Gemini fails!
        setEditableNewObs([
          {
            tempId: 'new_O1',
            category: 'worked_well',
            fact: combined,
            suggestShare: false,
            include: true,
          },
        ]);
        return;
      }
      setGeminiProposal(resp.data);
      setEditableNewObs(
        resp.data.new_observations.map((o) => ({
          tempId: o.temp_id,
          category: o.category,
          fact: o.fact,
          suggestShare: o.suggest_share,
          include: true,
        }))
      );
    } catch {
      setError('うまく整理できませんでした。記録はそのまま残っています');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveQuickNoteProposals = async () => {
    if (!studentBundle) return;
    const chosenObs = editableNewObs.filter((o) => o.include && o.fact.trim());
    if (chosenObs.length === 0) return;

    setBusy(true);
    setError('');
    try {
      await confirmAndSaveProposals({
        actorRole: 'teacher',
        student: studentBundle.student,
        index: studentBundle.index,
        observationsToCreate: chosenObs.map((o) => ({
          tempId: o.tempId,
          category: o.category,
          fact: o.fact,
          correctsObservationId: correctingObsId || undefined,
        })),
        hypothesesToCreate:
          geminiProposal?.new_hypotheses.map((h) => ({
            text: h.text,
            why: h.why,
            evidenceExistingIds: h.evidence_existing_ids,
            evidenceNewTempIds: h.evidence_new_temp_ids,
            evidenceSides: h.evidence_sides,
          })) || [],
        trialsToCreate:
          geminiProposal?.suggested_trials
            .filter((t) => t.where === 'school')
            .map((t) => ({
              where: 'school',
              whatToChange: t.text,
              why: t.why,
              basedOnExistingIds: t.based_on_existing_ids,
              basedOnNewTempIds: t.based_on_new_temp_ids,
              adjustsTrialId: t.adjusts_trial_id || '',
            })) || [],
      });
      setQuickTags([]);
      setQuickText('');
      setCorrectingObsId('');
      setGeminiProposal(null);
      setEditableNewObs([]);
      await refreshStudentBundle(false);
      setNotice('先生の記録を確認して保存しました（初期状態は「共有しない」です）。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '記録の保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // 2. Multi-Student Class Batch Memo (class_note)
  // --------------------------------------------------------------------------
  const handleOrganizeClassMemo = async () => {
    if (!classRawMemo.trim()) {
      setError('放課後のメモを入力してください。');
      return;
    }
    if (!checkSafetyOrProceed(classRawMemo)) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const resp = await callGeminiOrganize({
        mode: 'class_note',
        viewerRole: 'teacher',
        observations: [],
        trials: [],
        students: students.map((s) => s.nickname),
        newInput: classRawMemo,
      });
      if (!resp.ok || !resp.data) {
        setError(resp.errorMessage || 'うまく整理できませんでした。記録はそのまま残っています');
        return;
      }
      setClassProposal(resp.data);

      const mappedMatched = resp.data.new_observations.map((o, i) => {
        const matchedStu = students.find((s) => s.nickname === o.candidate_student);
        return {
          key: `m_${i}`,
          fact: o.fact,
          category: o.category,
          studentId: matchedStu ? matchedStu.studentId : '',
          reason: o.candidate_student ? undefined : '対象児童の確認が必要です',
        };
      });
      const mappedUnassigned = resp.data.unassigned.map((u, i) => ({
        key: `u_${i}`,
        fact: u.text,
        category: 'other' as ObservationCategory,
        studentId: '',
        reason: u.reason,
      }));
      setAssignedBatchItems([...mappedMatched, ...mappedUnassigned]);
    } catch {
      setError('うまく整理できませんでした。記録はそのまま残っています');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAssignedBatchItems = async () => {
    const validItems = assignedBatchItems.filter((it) => it.studentId && it.fact.trim());
    if (validItems.length === 0) {
      setError('保存する児童が選ばれていません。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Group by studentId and save cleanly
      const byStu = new Map<string, typeof validItems>();
      for (const item of validItems) {
        const arr = byStu.get(item.studentId) || [];
        arr.push(item);
        byStu.set(item.studentId, arr);
      }

      for (const [stuId, items] of byStu.entries()) {
        const stu = students.find((s) => s.studentId === stuId);
        if (!stu) continue;
        const bundle = await loadAuthorizedStudentBundle({
          viewerRole: 'teacher',
          viewerUid: user.uid,
          student: stu,
          logAccess: false,
        });
        await confirmAndSaveProposals({
          actorRole: 'teacher',
          student: stu,
          index: bundle.index,
          observationsToCreate: items.map((it, idx) => ({
            tempId: `new_O${idx + 1}`,
            category: it.category,
            fact: it.fact,
          })),
          hypothesesToCreate: [],
          trialsToCreate: [],
        });
      }

      setClassRawMemo('');
      setClassProposal(null);
      setAssignedBatchItems([]);
      await refreshStudentBundle(false);
      setNotice('確認された児童ごとの記録を保存しました。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '一括メモの保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // 4. Four-Source Bridge (bridge)
  // --------------------------------------------------------------------------
  const handleRunBridge = async () => {
    if (!studentBundle) return;
    setBusy(true);
    setError('');
    try {
      const resp = await callGeminiOrganize({
        mode: 'bridge',
        viewerRole: 'teacher',
        observations: studentBundle.observations,
        trials: studentBundle.trials,
        newInput: '現在見えている4つの記録を並べて、違いと仮説・試せる工夫を整理してください。',
      });
      if (!resp.ok || !resp.data) {
        setError(resp.errorMessage || 'うまく整理できませんでした。記録はそのまま残っています');
        return;
      }
      setBridgeProposal(resp.data);
    } catch {
      setError('うまく整理できませんでした。記録はそのまま残っています');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBridgeSelections = async () => {
    if (!studentBundle || !bridgeProposal) return;
    setBusy(true);
    setError('');
    try {
      await confirmAndSaveProposals({
        actorRole: 'teacher',
        student: studentBundle.student,
        index: studentBundle.index,
        observationsToCreate: [],
        hypothesesToCreate: bridgeProposal.new_hypotheses.map((h) => ({
          text: h.text,
          why: h.why,
          evidenceExistingIds: h.evidence_existing_ids,
          evidenceNewTempIds: [],
          evidenceSides: h.evidence_sides,
        })),
        trialsToCreate: bridgeProposal.suggested_trials
          .filter((t) => t.where === 'school')
          .map((t) => ({
            where: 'school',
            whatToChange: t.text,
            why: t.why,
            basedOnExistingIds: t.based_on_existing_ids,
            basedOnNewTempIds: [],
            adjustsTrialId: t.adjusts_trial_id || '',
          })),
      });
      setBridgeProposal(null);
      await refreshStudentBundle(false);
      setNotice('仮説と学校で試す工夫を保存しました。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // 7 & 8. Document Drafts (meeting_memo, parent_letter, term_facts, class_tips)
  // --------------------------------------------------------------------------
  const handleGenerateMemoMode = async (
    mode: 'meeting_memo' | 'parent_letter' | 'term_facts' | 'class_tips',
    title: string
  ) => {
    if (!studentBundle && mode !== 'class_tips') return;
    setBusy(true);
    setError('');
    try {
      let obsForMode: ObservationDoc[] = [];
      let trialsForMode: TrialDoc[] = [];

      if (mode === 'meeting_memo' || mode === 'parent_letter') {
        // Strictly use ONLY shared records per Chapter 7 & 11!
        obsForMode = (studentBundle?.observations || []).filter(
          (o) => o.shareStatus === 'shared'
        );
        trialsForMode = (studentBundle?.trials || []).filter(
          (t) => t.shareStatus === 'shared'
        );
      } else if (mode === 'term_facts') {
        obsForMode = studentBundle?.observations || [];
        trialsForMode = studentBundle?.trials || [];
      } else if (mode === 'class_tips') {
        // Gather general worked_well school observations across class without student names
        obsForMode = (studentBundle?.observations || []).filter(
          (o) => o.side === 'school' && o.category === 'worked_well'
        );
      }

      const resp = await callGeminiOrganize({
        mode,
        viewerRole: 'teacher',
        observations: obsForMode,
        trials: trialsForMode,
        newInput: `${title}を作成してください。`,
      });

      if (!resp.ok || !resp.data) {
        setError(resp.errorMessage || 'うまく整理できませんでした。記録はそのまま残っています');
        return;
      }
      setGeneratedDocTitle(title);
      setGeneratedDocText(resp.data.memo || resp.data.message);
    } catch {
      setError('うまく整理できませんでした。記録はそのまま残っています');
    } finally {
      setBusy(false);
    }
  };

  const pendingIncomingRequests = useMemo(
    () =>
      (studentBundle?.sharingRequests || []).filter(
        (r) => r.toSide === 'school' && r.status === 'pending'
      ),
    [studentBundle]
  );

  const unansweredConsultations = useMemo(
    () => (studentBundle?.consultations || []).filter((c) => c.status === 'sent'),
    [studentBundle]
  );

  return (
    <div className="min-h-screen bg-[#FFFDF8] pb-14 text-[#3A3128]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#EAE2D3] bg-[#FFFDF8]/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF5F4] text-[#2B6E6B]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                うちの子トリセツ — 先生の画面
              </h1>
              <p className="text-xs text-[#6E6254]">
                {school?.schoolCodeLabel || ''} ／ 担当：{schoolClass?.className || '未割当'}（
                {staffLabel}）
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {schoolClass &&
              (isLessonWindowActive ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCloseLessonWindow}
                  className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#2F7A54] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                >
                  <Square className="h-3.5 w-3.5" />
                  授業で遊ぶ：受付中（終了する）
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleOpenLessonWindow}
                  className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#2F7A54] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                >
                  <MonitorPlay className="h-4 w-4" />
                  授業で遊ぶ（一斉参加をひらく）
                </button>
              ))}
            {selectedStudent && (
              <button
                type="button"
                onClick={() => setLaunchTargetStudent(selectedStudent)}
                className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#E5C9B3] bg-[#FFF3E6] px-3.5 py-2 text-xs font-bold text-[#9A4816] transition hover:bg-[#FCE6D2]"
              >
                <Compass className="h-4 w-4 text-[#C86428]" />
                個別対応：先生の端末で開く
              </button>
            )}
            <button
              type="button"
              onClick={() => refreshStudentBundle(false)}
              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-3.5 py-2 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC]"
            >
              <RefreshCw className="h-4 w-4 text-[#2B6E6B]" />
              更新
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-3.5 py-2 text-xs font-bold text-[#6E6254] transition hover:bg-[#FAF5EC] hover:text-[#3A3128]"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Status-Only Safety Officer Notice (Never shows child's raw safety words!) */}
        {safetyNotice && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] px-5 py-3.5 text-sm text-[#3A3128]">
            <ShieldAlert className="h-5 w-5 shrink-0 text-[#2B6E6B]" />
            <div>
              <span className="font-bold">
                安全対応担当からの状況連絡：
                {safetyNotice.status === 'checking'
                  ? '安全担当が確認中です'
                  : '安全担当にて対応済みです'}
              </span>
              {safetyNotice.officerSharedNote && (
                <span className="ml-2 text-xs text-[#6E6254]">
                  （{safetyNotice.officerSharedNote}）
                </span>
              )}
            </div>
          </div>
        )}

        {/* Generic Privacy-Safe Notification Banner (Chapter 14: Never puts content in notifications) */}
        {(pendingIncomingRequests.length > 0 || unansweredConsultations.length > 0) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4] px-5 py-3.5 text-sm font-bold text-[#1F5654]">
            <span>確認が必要な記録があります</span>
            <button
              type="button"
              onClick={() => setSection('family_collab')}
              className="min-h-[44px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#225957]"
            >
              家庭とのやりとりを開く
            </button>
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] px-5 py-3.5 text-sm font-bold text-[#215C3E]">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-[#B83227]/35 bg-[#FDF1F0] px-5 py-3.5 text-sm font-bold text-[#B83227]">
            {error}
          </div>
        )}

        {loadingWorkspace ? (
          <div className="rounded-3xl border border-[#EAE2D3] bg-white p-10 text-center text-sm text-[#6E6254] shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
            担当学級を読み込んでいます...
          </div>
        ) : !schoolClass ? (
          <div className="rounded-3xl border border-[#EAE2D3] bg-white p-10 text-center text-sm text-[#6E6254] shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
            まだ担当学級が割り当てられていません。学校管理者にご確認ください。
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1-per-Student School Tablet Live Lesson Control Panel ("授業で遊ぶ") */}
            <section
              className={`rounded-3xl border p-5 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-6 ${
                isLessonWindowActive
                  ? 'border-[#BFE0C9] bg-[#EDF7F0]/75'
                  : 'border-[#EAE2D3] bg-white'
              }`}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <MonitorPlay className="h-5 w-5 text-[#2F7A54]" />
                    <h2 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                      学校の1人1台端末で一斉に遊ぶ（Chromebook・iPad・Windows対応）
                    </h2>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        isLessonWindowActive ? 'text-[#215C3E]' : 'text-[#6E6254]'
                      }`}
                    >
                      {isLessonWindowActive
                        ? `・受付中（残り 約${remainingLessonMinutes}分）`
                        : '・授業時間外（現在は子どもの端末から入れません）'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#6E6254]">
                    先生が「授業で遊ぶ」を押している時間だけ学級の子どもが自分の端末から入れます。この画面には
                    <strong className="text-[#3A3128]">入っている人数だけ</strong>
                    を表示し、授業中に誰の結果も出しません。「参加しない」を選んだ家庭の子も記録を取らない同じ見た目の画面で過ごせます。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {!isLessonWindowActive ? (
                    <>
                      <select
                        value={lessonDurationMins}
                        onChange={(e) => setLessonDurationMins(Number(e.target.value))}
                        aria-label="授業の開放時間"
                        className="min-h-[46px] rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-xs font-bold tabular-nums text-[#3A3128]"
                      >
                        <option value={30}>30分間ひらく</option>
                        <option value={45}>45分間ひらく（1コマ）</option>
                        <option value={60}>60分間ひらく</option>
                      </select>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleOpenLessonWindow}
                        className="inline-flex min-h-[46px] items-center gap-2 whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                      >
                        <MonitorPlay className="h-4 w-4" />
                        授業で遊ぶ（開始）
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleCloseLessonWindow}
                      className="inline-flex min-h-[46px] items-center gap-2 whitespace-nowrap rounded-2xl bg-[#C86428] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#B0541E] disabled:opacity-60"
                    >
                      <Square className="h-4 w-4" />
                      授業を終了する（入口を閉じる）
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleIssueNamelessQrSheet}
                    className="inline-flex min-h-[46px] items-center gap-1.5 whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-4 py-2 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC] disabled:opacity-60"
                  >
                    <QrCode className="h-4 w-4 text-[#2B6E6B]" />
                    氏名なしQRカードを発行・印刷（1人1枚）
                  </button>
                </div>
              </div>

              {/* Chalkboard Join Code + Connected Student Count ONLY + Take-home Toggle */}
              <div className="mt-4 grid gap-3.5 border-t border-[#DFD5C5]/70 pt-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#EAE2D3] bg-white px-4 py-3">
                  <div className="text-[11px] font-bold text-[#6E6254]">
                    黒板に書く「じゅぎょうコード」（学校Googleアカウント用）
                  </div>
                  {classroomSession?.classJoinCode ? (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-xl font-bold tracking-wider text-[#3A3128]">
                        {classroomSession.classJoinCode}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(classroomSession.classJoinCode);
                            setNotice('じゅぎょうコードをコピーしました。');
                          } catch {
                            setNotice(classroomSession.classJoinCode);
                          }
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-2.5 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        コピー
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1.5 text-xs text-[#6E6254]">
                      初回「授業で遊ぶ」を押すと自動発行されます
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#EAE2D3] bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#6E6254]">
                    <Users className="h-3.5 w-3.5 text-[#2F7A54]" />
                    <span>現在入っている人数（個人名は表示しません）</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-['Zen_Maru_Gothic'] text-2xl font-bold tabular-nums text-[#215C3E]">
                      {isLessonWindowActive ? classroomSession?.connectedCount || 0 : 0}
                    </span>
                    <span className="text-xs font-bold text-[#6E6254]">
                      人 ／ 登録 {students.length} 名
                    </span>
                  </div>
                </div>

                <div className="flex items-center rounded-2xl border border-[#EAE2D3] bg-white px-4 py-3">
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[#3A3128]">
                    <input
                      type="checkbox"
                      checked={
                        classroomSession ? classroomSession.allowTakeHome : defaultAllowTakeHome
                      }
                      onChange={(e) => void handleToggleAllowTakeHome(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#2F7A54]"
                    />
                    <span>
                      <strong className="font-bold">持ち帰り端末での利用も許可する</strong>
                      <span className="mt-0.5 block text-[11px] text-[#6E6254]">
                        家で学校端末を使った場合も、安全に関わる訴えは学校の安全担当者に届きます
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Sidebar: Student Picker + Grouped 8 Sections */}
              <aside className="space-y-4 lg:col-span-3">
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-5 shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
                  <label className="block text-xs font-bold leading-relaxed text-[#6E6254]">
                    担当学級の児童を選択
                    <span className="mt-0.5 block text-[11px] font-normal">
                      ※一覧比較や点数表はありません
                    </span>
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="mt-2.5 min-h-[48px] w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm font-bold tabular-nums text-[#3A3128]"
                  >
                    {students.map((s) => (
                      <option key={s.studentId} value={s.studentId}>
                        {s.attendanceNumber}番：{s.nickname}（{s.grade}年）
                        {s.participationOptOut ? '［記録オフ］' : ''}
                      </option>
                    ))}
                  </select>

                  {selectedStudent && (
                    <div className="mt-3.5 border-t border-[#EAE2D3] pt-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#6E6254]">授業参加の記録設定：</span>
                        <span
                          className={`font-bold ${
                            selectedStudent.participationOptOut
                              ? 'text-[#9A4816]'
                              : 'text-[#215C3E]'
                          }`}
                        >
                          {selectedStudent.participationOptOut
                            ? '参加しない（記録オフ）'
                            : '参加する（通常記録）'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleToggleStudentOptOutByTeacher(
                            selectedStudent,
                            !selectedStudent.participationOptOut
                          )
                        }
                        className="mt-2 min-h-[40px] w-full rounded-xl border border-[#DFD5C5] bg-[#FAF5EC] px-3 py-1.5 text-[11px] font-bold text-[#3A3128] transition hover:bg-[#F2E9DA] disabled:opacity-60"
                      >
                        {selectedStudent.participationOptOut
                          ? '保護者の希望により「参加する」へ戻す'
                          : '紙の同意書にもとづき「参加しない」にする'}
                      </button>
                    </div>
                  )}
                </div>

              <nav className="space-y-3 rounded-3xl border border-[#EAE2D3] bg-white p-3.5 shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
                {(
                  [
                    {
                      groupLabel: '日々の記録と子どもの声',
                      items: [
                        { key: 'quick_note', label: '1. 今日の一言（30秒記録）', icon: PenLine },
                        { key: 'batch_memo', label: '2. 放課後まとめてメモ', icon: ClipboardList },
                        { key: 'child_adventure', label: '3. 冒険の事実と子どもの声', icon: Compass },
                      ],
                    },
                    {
                      groupLabel: '見立てと家庭連携',
                      items: [
                        { key: 'four_bridge', label: '4. 4つの記録を並べる', icon: Layers },
                        {
                          key: 'family_collab',
                          label: '5. 家庭との共有・相談返信',
                          icon: MessageSquare,
                        },
                      ],
                    },
                    {
                      groupLabel: '工夫と振り返り・資料',
                      items: [
                        { key: 'trials', label: '6. 試す工夫と結果の評価', icon: CheckCircle2 },
                        { key: 'meeting_letter', label: '7. 面談メモ・家庭連絡文', icon: FileText },
                        {
                          key: 'term_class_tips',
                          label: '8. 学期の事実整理・学級の工夫',
                          icon: Sparkles,
                        },
                      ],
                    },
                  ] as const
                ).map((group) => (
                  <div key={group.groupLabel} className="space-y-1">
                    <div className="px-3 pt-1 text-[11px] font-bold text-[#6E6254]">
                      {group.groupLabel}
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = section === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setSection(item.key)}
                          className={`flex min-h-[46px] w-full items-center gap-2.5 rounded-2xl px-3.5 py-2 text-left text-sm font-bold transition ${
                            active
                              ? 'bg-[#EAF5F4] text-[#1F5654]'
                              : 'text-[#3A3128] hover:bg-[#FAF5EC]'
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              active ? 'text-[#2B6E6B]' : 'text-[#6E6254]'
                            }`}
                          />
                          <span className="leading-snug">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Main Content Area */}
            <section className="lg:col-span-9">
              {loadingBundle ? (
                <div className="rounded-3xl border border-[#EAE2D3] bg-white p-10 text-center text-sm text-[#6E6254] shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
                  児童の記録を読み込んでいます...
                </div>
              ) : (
                <>
                  {/* SECTION 1: Quick 30s Note (school_note) */}
                  {section === 'quick_note' && studentBundle && (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                          <span className="tabular-nums">
                            {studentBundle.student.attendanceNumber}番
                          </span>
                          「{studentBundle.student.nickname}」さんの今日の一言記録
                        </h2>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#6E6254]">
                          得意なことが見えた場面や、うまくいった関わり方を30秒で残せます。保存時点では保護者には共有されません。
                        </p>

                        {correctingObsId && (
                          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] px-4 py-2.5 text-xs font-bold text-[#9A4816]">
                            <span>
                              既存の記録（ID: {correctingObsId}）への追記・訂正として記録します
                            </span>
                            <button
                              type="button"
                              onClick={() => setCorrectingObsId('')}
                              className="underline hover:opacity-80"
                            >
                              解除
                            </button>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {QUICK_SCHOOL_TAGS.map((tag) => {
                            const active = quickTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() =>
                                  setQuickTags((prev) =>
                                    prev.includes(tag)
                                      ? prev.filter((t) => t !== tag)
                                      : [...prev, tag]
                                  )
                                }
                                className={`min-h-[44px] rounded-2xl border px-3.5 py-2 text-left text-xs font-bold transition ${
                                  active
                                    ? 'border-[#2B6E6B] bg-[#EAF5F4] text-[#1F5654]'
                                    : 'border-[#EAE2D3] bg-[#FAF5EC] text-[#3A3128] hover:bg-[#F3ECE0]'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>

                        <textarea
                          rows={3}
                          value={quickText}
                          onChange={(e) => setQuickText(e.target.value)}
                          placeholder="具体的な場面の一言メモ（実名は書かず、起きた事実とうまくいった条件を記入）"
                          className="mt-4 w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] p-3.5 text-sm leading-relaxed text-[#3A3128] placeholder:text-[#6E6254]/70"
                        />

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={handleOrganizeQuickNote}
                            className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#225957] disabled:opacity-60"
                          >
                            {busy ? '整理しています...' : '記録案を整理する'}
                          </button>
                        </div>

                        {editableNewObs.length > 0 && (
                          <div className="mt-6 space-y-4 rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4]/50 p-5">
                            {geminiProposal?.message && (
                              <p className="text-sm font-bold text-[#1F5654]">
                                {geminiProposal.message}
                              </p>
                            )}
                            <div className="space-y-3">
                              {editableNewObs.map((item, idx) => (
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
                                          setEditableNewObs((prev) =>
                                            prev.map((x, i) =>
                                              i === idx ? { ...x, include: e.target.checked } : x
                                            )
                                          )
                                        }
                                        className="h-4 w-4 accent-[#2F7A54]"
                                      />
                                      この観察を保存する
                                    </label>
                                    <select
                                      value={item.category}
                                      onChange={(e) =>
                                        setEditableNewObs((prev) =>
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
                                      setEditableNewObs((prev) =>
                                        prev.map((x, i) =>
                                          i === idx ? { ...x, fact: e.target.value } : x
                                        )
                                      )
                                    }
                                    className="mt-2.5 w-full rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] p-3 text-sm leading-relaxed text-[#3A3128]"
                                  />
                                  {item.suggestShare && (
                                    <p className="mt-2 text-xs font-bold text-[#215C3E]">
                                      家庭への共有に向いている場面です（保存後に「家庭との共有」から提案できます）
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={handleSaveQuickNoteProposals}
                                className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                              >
                                内容を確認して保存する
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Existing School Observations List with Append-Only Correction */}
                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                          これまでの学校の記録
                        </h3>
                        <p className="mt-1 text-xs text-[#6E6254]">
                          過去の記録を書き換えることはせず、訂正が必要な場合は「追記」として履歴を残します。
                        </p>
                        {studentBundle.observations.filter((o) => o.side === 'school').length ===
                        0 ? (
                          <div className="mt-4 rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                            まだ学校の観察記録はありません。上のタグやメモから最初の一言を残してみましょう。
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {studentBundle.observations
                              .filter((o) => o.side === 'school')
                              .map((obs) => (
                                <div
                                  key={obs.observationId}
                                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] p-4"
                                >
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-[#6E6254]">
                                      <span className="font-mono font-bold text-[#2B6E6B]">
                                        [{obs.formalId}]
                                      </span>
                                      <span>{obs.dateLabel}</span>
                                      <span>・{CATEGORY_LABELS[obs.category]}</span>
                                      <span className="font-bold text-[#3A3128]">
                                        ・
                                        {obs.shareStatus === 'shared'
                                          ? '家庭と共有中'
                                          : obs.shareStatus === 'stopped'
                                            ? '共有停止済'
                                            : '校内のみ（未共有）'}
                                      </span>
                                    </div>
                                    {obs.correctsObservationId && (
                                      <div className="text-xs font-bold text-[#9A4816]">
                                        ※記録訂正の追記（元ID: {obs.correctsObservationId}）
                                      </div>
                                    )}
                                    <p className="text-sm leading-relaxed text-[#3A3128]">
                                      {obs.fact}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setCorrectingObsId(obs.formalId)}
                                      className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-3.5 text-xs font-bold text-[#6E6254] transition hover:bg-[#FAF5EC] hover:text-[#3A3128]"
                                    >
                                      訂正を追記
                                    </button>
                                    {obs.shareStatus !== 'shared' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShareTargetObs(obs);
                                          setSection('family_collab');
                                        }}
                                        className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0] px-3.5 text-xs font-bold text-[#215C3E] transition hover:bg-[#E1F2E6]"
                                      >
                                        家庭へ共有を提案
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: Multi-Student Batch Memo (class_note) */}
                  {section === 'batch_memo' && (
                    <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                      <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                        放課後まとめてメモ（複数児童のメモ仕分け）
                      </h2>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#6E6254]">
                        学級のニックネームと完全一致した記録だけを候補にし、あいまいなものや名前がないものは勝手に推測せず先生に確認を求めます。
                      </p>

                      <textarea
                        rows={5}
                        value={classRawMemo}
                        onChange={(e) => setClassRawMemo(e.target.value)}
                        placeholder={`例：\n・ひなたさんは図工で見本を横に置くと最後まで集中して作れていた。\n・算数で文章題になると手が止まっていた子がいた（あとで誰か選ぶ）。\n・クラス全体として朝の予定を黒板に番号で書くと落ち着いて準備できた。`}
                        className="mt-4 w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] p-4 text-sm leading-relaxed text-[#3A3128] placeholder:text-[#6E6254]/70"
                      />

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleOrganizeClassMemo}
                          className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#225957] disabled:opacity-60"
                        >
                          {busy ? '仕分け中...' : '出来事ごとに分ける'}
                        </button>
                      </div>

                      {classProposal && (
                        <div className="mt-6 space-y-5 border-t border-[#EAE2D3] pt-5">
                          <p className="text-sm font-bold text-[#1F5654]">
                            {classProposal.message}
                          </p>

                          <div className="space-y-3">
                            <h3 className="text-sm font-bold text-[#3A3128]">
                              児童ごとの記録候補（未確定のものは先生ご自身で対象児童を選んでください）
                            </h3>
                            {assignedBatchItems.map((it, idx) => (
                              <div
                                key={it.key}
                                className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4"
                              >
                                {it.reason && (
                                  <p className="mb-2 text-xs font-bold text-[#9A4816]">
                                    確認が必要：{it.reason}
                                  </p>
                                )}
                                <p className="text-sm leading-relaxed text-[#3A3128]">{it.fact}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                  <select
                                    value={it.studentId}
                                    onChange={(e) =>
                                      setAssignedBatchItems((prev) =>
                                        prev.map((x, i) =>
                                          i === idx ? { ...x, studentId: e.target.value } : x
                                        )
                                      )
                                    }
                                    className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-white px-3 text-xs font-bold tabular-nums text-[#3A3128]"
                                  >
                                    <option value="">保存しない（対象児童を未選択）</option>
                                    {students.map((s) => (
                                      <option key={s.studentId} value={s.studentId}>
                                        {s.attendanceNumber}番：{s.nickname}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={it.category}
                                    onChange={(e) =>
                                      setAssignedBatchItems((prev) =>
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
                                    className="min-h-[44px] rounded-xl border border-[#DFD5C5] bg-white px-3 text-xs font-bold text-[#3A3128]"
                                  >
                                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                      <option key={k} value={k}>
                                        {v}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>

                          {classProposal.class_level.length > 0 && (
                            <div className="rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] p-4">
                              <div className="text-xs font-bold text-[#6E6254]">
                                学級全体の様子（個人記録には結びつけません）
                              </div>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[#3A3128]">
                                {classProposal.class_level.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={handleSaveAssignedBatchItems}
                              className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                            >
                              選択した児童の記録として保存する
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 3: Child's Adventure & Voice (Individual Only) */}
                  {section === 'child_adventure' && studentBundle && (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                              「がっこう たんけん」で見えた条件の違い（事実の記録）
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                              独自の課題で、標準化された検査ではありません。他の子との比較ではなく、同じ子の中の条件の違いだけを見ます。
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLaunchTargetStudent(studentBundle.student)}
                            className="min-h-[44px] whitespace-nowrap rounded-2xl bg-[#C86428] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#B0541E]"
                          >
                            冒険画面を起動する
                          </button>
                        </div>

                        {(hasDifferentFormsWarning(studentBundle.gameSessions, 'shopping') ||
                          hasDifferentFormsWarning(studentBundle.gameSessions, 'delivery')) && (
                          <div className="mt-4 rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] px-4 py-3 text-xs font-bold leading-relaxed text-[#9A4816]">
                            ※複数回の実施に「形A」と「形B」が含まれています。問題のセットが異なるため、回ごとの正答数の差を単純に伸びや変化として比べないようご注意ください。
                          </div>
                        )}

                        {studentBundle.gameSessions.length === 0 ? (
                          <div className="mt-4 rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                            まだ冒険ゲームの記録はありません。右上の「冒険画面を起動する」からお子さんと一緒に始められます。
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {studentBundle.gameSessions.map((gs) => (
                              <div
                                key={gs.sessionId}
                                className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4"
                              >
                                <div className="text-xs font-bold tabular-nums text-[#2B6E6B]">
                                  {gs.dateLabel} ／{' '}
                                  {gs.gameType === 'shopping' ? 'おかいもの' : 'どうぶつの はいたつ'}（
                                  {gs.attemptNumber}回目・形{gs.form}）
                                </div>
                                <p className="mt-1.5 text-sm font-bold leading-relaxed text-[#3A3128]">
                                  {gs.conditionSummary}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                                  {gs.factSentence}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                          本人が先生に伝えることを選んだ声
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                          子どもが「せんせいだけ」または「せんせいと おうちの ひと」を選んだ回答のみが表示されます。
                        </p>

                        {studentBundle.childAnswers.length === 0 ? (
                          <div className="mt-4 rounded-2xl bg-[#FAF5EC] p-5 text-sm text-[#6E6254]">
                            まだ記録はありません。
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {studentBundle.childAnswers.map((ans) => (
                              <div
                                key={ans.answerId}
                                className={`rounded-2xl border p-4 ${
                                  ans.isDistressSignal
                                    ? 'border-[#F3CEAA] bg-[#FFF3E6]'
                                    : 'border-[#EAE2D3] bg-[#FFFDF8]'
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums text-[#9A4816]">
                                  <span className="font-bold">
                                    {ans.dateLabel} ／ 子どもの声（公開先：
                                    {ans.visibility === 'both' ? '先生と家庭' : '先生のみ'}）
                                  </span>
                                  {ans.isDistressSignal && (
                                    <span className="font-bold">困りごとのサインあり</span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-sm font-bold leading-relaxed text-[#3A3128]">
                                  {ans.factSentence}
                                </p>
                                {ans.followupTranscript && (
                                  <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[#6E6254]">
                                    {ans.followupTranscript}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SECTION 4: Four-Source Bridge (4つを並べる) */}
                  {section === 'four_bridge' && studentBundle && (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                              4つの情報を並べて整理する（混ぜずに並置）
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-[#6E6254]">
                              子どもの声・ゲームの事実・学校の記録・共有された家庭の記録を別々のまま並べ、場面ごとの違いと試す工夫を考えます。
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={handleRunBridge}
                            className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#225957] disabled:opacity-60"
                          >
                            {busy ? '整理しています...' : '4つを並べて仮説を提案'}
                          </button>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          {(
                            [
                              { side: 'child', title: '子どもの声' },
                              { side: 'game', title: 'ゲームで見えた事実' },
                              { side: 'school', title: '学校の記録' },
                              { side: 'home', title: '共有された家庭の記録' },
                            ] as const
                          ).map((col) => {
                            const items = studentBundle.observations.filter(
                              (o) => o.side === col.side
                            );
                            return (
                              <div
                                key={col.side}
                                className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4"
                              >
                                <SideDotLabel side={col.side} />
                                {items.length === 0 ? (
                                  <p className="mt-2.5 text-xs text-[#6E6254]">
                                    まだ記録がありません
                                  </p>
                                ) : (
                                  <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-[#3A3128]">
                                    {items.map((o) => (
                                      <li
                                        key={o.observationId}
                                        className="rounded-xl border border-[#EAE2D3] bg-white p-3"
                                      >
                                        <span className="mr-1.5 font-mono font-bold tabular-nums text-[#6E6254]">
                                          [{o.formalId}]
                                        </span>
                                        {o.fact}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {bridgeProposal && (
                          <div className="mt-6 space-y-4 rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4]/50 p-5">
                            <p className="text-sm font-bold text-[#1F5654]">
                              {bridgeProposal.message}
                            </p>

                            {bridgeProposal.differences.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-[#6E6254]">
                                  場面による見え方の違い（どれが正しいかは決めません）
                                </h4>
                                {bridgeProposal.differences.map((d, i) => (
                                  <div
                                    key={i}
                                    className="rounded-2xl border border-[#EAE2D3] bg-white p-4 text-sm"
                                  >
                                    <p className="font-bold text-[#3A3128]">{d.note}</p>
                                    <p className="mt-1 text-xs tabular-nums text-[#6E6254]">
                                      根拠ID：{d.evidence_existing_ids.join(', ')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {bridgeProposal.new_hypotheses.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-[#6E6254]">
                                  関わり方の仮説の提案
                                </h4>
                                {bridgeProposal.new_hypotheses.map((h) => (
                                  <div
                                    key={h.temp_id}
                                    className="rounded-2xl border border-[#EAE2D3] bg-white p-4 text-sm"
                                  >
                                    <p className="font-bold text-[#3A3128]">{h.text}</p>
                                    <p className="mt-1 text-xs text-[#6E6254]">理由：{h.why}</p>
                                    <p className="mt-1 text-xs font-bold tabular-nums text-[#2B6E6B]">
                                      根拠：{h.evidence_existing_ids.join(', ')}（情報源：
                                      {h.evidence_sides.join(', ')}）
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {bridgeProposal.suggested_trials.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-[#6E6254]">
                                  試してみる価値がありそうな工夫
                                </h4>
                                {bridgeProposal.suggested_trials.map((t, i) => (
                                  <div
                                    key={i}
                                    className="rounded-2xl border border-[#EAE2D3] bg-white p-4 text-sm"
                                  >
                                    <span className="text-xs font-bold text-[#215C3E]">
                                      [{t.where === 'school' ? '学校で試す' : '家庭向けアイデア'}]
                                    </span>
                                    <p className="mt-1 font-bold text-[#3A3128]">{t.text}</p>
                                    <p className="mt-0.5 text-xs text-[#6E6254]">{t.why}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={handleSaveBridgeSelections}
                                className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#256344] disabled:opacity-60"
                              >
                                提案された仮説・学校の工夫を保存する
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Saved Hypotheses List */}
                      {studentBundle.hypotheses.length > 0 && (
                        <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                          <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                            保存済みの仮説
                          </h3>
                          <div className="mt-3.5 space-y-3">
                            {studentBundle.hypotheses.map((h) => (
                              <div
                                key={h.hypothesisId}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] p-4 text-sm"
                              >
                                <div>
                                  <span className="font-mono text-xs font-bold tabular-nums text-[#2B6E6B]">
                                    [{h.formalId}]
                                  </span>{' '}
                                  <span className="font-bold text-[#3A3128]">{h.text}</span>
                                  <div className="mt-1 text-xs tabular-nums text-[#6E6254]">
                                    根拠：{h.evidenceIds.join(', ')}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await toggleHypothesisShareStatus({
                                      hypothesis: h,
                                      nextStatus:
                                        h.shareStatus === 'shared' ? 'stopped' : 'shared',
                                    });
                                    await refreshStudentBundle(false);
                                  }}
                                  className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-4 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC]"
                                >
                                  {h.shareStatus === 'shared'
                                    ? '家庭との共有をやめる'
                                    : '家庭と共有する'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 5: Family Collaboration (Sharing & Consultations) */}
                  {section === 'family_collab' && studentBundle && (
                    <div className="space-y-6">
                      {/* Pre-Send Confirmation Box: What / Who / Why */}
                      {shareTargetObs && (
                        <div className="rounded-3xl border-2 border-[#2F7A54] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
                          <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                            家庭へ共有を提案する前の確認（何の情報を・誰に・何のために）
                          </h3>
                          <div className="mt-3.5 space-y-2.5 rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#3A3128]">
                            <p>
                              <strong>・何の情報を：</strong>[{shareTargetObs.formalId}]{' '}
                              {shareTargetObs.fact}
                            </p>
                            <p>
                              <strong>・誰に：</strong>
                              {studentBundle.student.nickname} さんの保護者の方のみ
                            </p>
                            <div>
                              <label className="block text-xs font-bold text-[#3A3128]">
                                ・何のために（目的）：
                              </label>
                              <input
                                type="text"
                                value={sharePurpose}
                                onChange={(e) => setSharePurpose(e.target.value)}
                                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#DFD5C5] bg-white px-3.5 text-sm text-[#3A3128]"
                              />
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end gap-2.5">
                            <button
                              type="button"
                              onClick={() => setShareTargetObs(null)}
                              className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-4 text-xs font-bold text-[#6E6254] transition hover:bg-[#FAF5EC]"
                            >
                              キャンセル
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                if (!checkSafetyOrProceed(sharePurpose)) return;
                                await createSharingRequest({
                                  fromSide: 'school',
                                  observation: shareTargetObs,
                                  index: studentBundle.index,
                                  previewText: shareTargetObs.fact,
                                  purposeText: sharePurpose,
                                });
                                setShareTargetObs(null);
                                await refreshStudentBundle(false);
                                setNotice(
                                  '家庭へ共有の提案を送りました。保護者が承認すると共有状態になります。'
                                );
                              }}
                              className="min-h-[44px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                            >
                              確認して提案を送る
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Incoming Sharing Requests from Home */}
                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                          保護者から届いた共有の提案
                        </h3>
                        {pendingIncomingRequests.length === 0 ? (
                          <div className="mt-3 rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#6E6254]">
                            現在、確認待ちの共有提案はありません。
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {pendingIncomingRequests.map((req) => (
                              <div
                                key={req.requestId}
                                className="rounded-2xl border border-[#BFE0C9] bg-[#EDF7F0]/60 p-4"
                              >
                                <div className="text-xs font-bold tabular-nums text-[#215C3E]">
                                  {req.dateLabel} ／ 目的：{req.purposeText}
                                </div>
                                <p className="mt-1.5 text-sm font-bold leading-relaxed text-[#3A3128]">
                                  {req.previewText}
                                </p>
                                <input
                                  type="text"
                                  value={incomingSupplements[req.requestId] || ''}
                                  onChange={(e) =>
                                    setIncomingSupplements((prev) => ({
                                      ...prev,
                                      [req.requestId]: e.target.value,
                                    }))
                                  }
                                  placeholder="保護者へ返すひとこと（任意）"
                                  className="mt-3 min-h-[44px] w-full rounded-xl border border-[#DFD5C5] bg-white px-3.5 text-sm text-[#3A3128]"
                                />
                                <div className="mt-3 flex justify-end gap-2.5">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await respondToSharingRequest({
                                        request: req,
                                        approve: false,
                                        replyChoice: '今回は受け取らない',
                                        replySupplement:
                                          incomingSupplements[req.requestId] || '',
                                      });
                                      await refreshStudentBundle(false);
                                    }}
                                    className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-4 text-xs font-bold text-[#6E6254] transition hover:bg-[#FAF5EC]"
                                  >
                                    見送る
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await respondToSharingRequest({
                                        request: req,
                                        approve: true,
                                        replyChoice: '受け取って共有する',
                                        replySupplement:
                                          incomingSupplements[req.requestId] || '',
                                      });
                                      await refreshStudentBundle(false);
                                      setNotice('家庭からの記録を共有として受け取りました。');
                                    }}
                                    className="min-h-[44px] whitespace-nowrap rounded-2xl bg-[#2F7A54] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                                  >
                                    承認して受け取る
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Outgoing Sharing Requests & Currently Shared Observations */}
                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                          学校から送った共有提案・現在共有中の記録（いつでも停止可能）
                        </h3>
                        <div className="mt-3.5 space-y-2.5">
                          {studentBundle.sharingRequests.filter((r) => r.fromSide === 'school')
                            .length === 0 &&
                            studentBundle.observations.filter(
                              (o) => o.shareStatus === 'shared' && o.side === 'school'
                            ).length === 0 && (
                              <div className="rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#6E6254]">
                                まだ学校から共有提案した記録はありません。「1. 今日の一言」の記録一覧から提案できます。
                              </div>
                            )}

                          {studentBundle.sharingRequests
                            .filter((r) => r.fromSide === 'school')
                            .map((r) => (
                              <div
                                key={r.requestId}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] p-4 text-sm"
                              >
                                <div>
                                  <p className="font-bold text-[#3A3128]">{r.previewText}</p>
                                  <p className="mt-1 text-xs text-[#6E6254]">
                                    状態：
                                    {r.status === 'pending'
                                      ? '保護者の確認待ち'
                                      : r.status === 'approved'
                                        ? '共有承認済み'
                                        : r.status === 'withdrawn'
                                          ? '取り消し済み'
                                          : '見送り'}
                                    {r.replyChoice && ` ／ 保護者の返答：「${r.replyChoice}」`}
                                    {r.replySupplement && `（${r.replySupplement}）`}
                                  </p>
                                </div>
                                {r.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await withdrawPendingSharingRequest(r.requestId);
                                      await refreshStudentBundle(false);
                                    }}
                                    className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#DFD5C5] bg-white px-3.5 text-xs font-bold text-[#6E6254] transition hover:bg-[#FAF5EC]"
                                  >
                                    提案を取り消す
                                  </button>
                                )}
                              </div>
                            ))}

                          {studentBundle.observations
                            .filter((o) => o.shareStatus === 'shared' && o.side === 'school')
                            .map((o) => (
                              <div
                                key={o.observationId}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#3A3128]"
                              >
                                <span>
                                  <span className="font-mono font-bold tabular-nums text-[#2B6E6B]">
                                    [{o.formalId}]
                                  </span>{' '}
                                  {o.fact}
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await stopSharingObservation({
                                      observationId: o.observationId,
                                      studentId: o.studentId,
                                    });
                                    await refreshStudentBundle(false);
                                  }}
                                  className="min-h-[44px] whitespace-nowrap rounded-2xl border border-[#B83227]/35 bg-white px-3.5 text-xs font-bold text-[#B83227] transition hover:bg-[#FDF1F0]"
                                >
                                  共有をやめる
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Parent Consultations */}
                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <h3 className="font-['Zen_Maru_Gothic'] text-base font-bold text-[#3A3128] sm:text-lg">
                          保護者からの相談メッセージ
                        </h3>
                        {studentBundle.consultations.length === 0 ? (
                          <div className="mt-3 rounded-2xl bg-[#FAF5EC] p-4 text-sm text-[#6E6254]">
                            まだ相談は届いていません。
                          </div>
                        ) : (
                          <div className="mt-4 space-y-4">
                            {studentBundle.consultations.map((c) => (
                              <div
                                key={c.consultationId}
                                className="rounded-2xl border border-[#EAE2D3] bg-[#FFFDF8] p-4"
                              >
                                <div className="text-xs font-bold tabular-nums text-[#215C3E]">
                                  {c.dateLabel} ／ 保護者からの相談
                                </div>
                                {c.selectedRecordSummaries.length > 0 && (
                                  <ul className="mt-2.5 list-disc space-y-1 rounded-xl bg-[#FAF5EC] p-3.5 pl-7 text-xs text-[#6E6254]">
                                    {c.selectedRecordSummaries.map((s, idx) => (
                                      <li key={idx}>{s}</li>
                                    ))}
                                  </ul>
                                )}
                                <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-[#3A3128]">
                                  {c.messageBody}
                                </p>

                                {c.status === 'replied' ? (
                                  <div className="mt-3 rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4]/60 p-3.5 text-sm text-[#3A3128]">
                                    <span className="text-xs font-bold text-[#1F5654]">
                                      返信済み：
                                    </span>
                                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                                      {c.teacherReply}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="mt-3 space-y-2.5">
                                    <textarea
                                      rows={3}
                                      value={replyTexts[c.consultationId] || ''}
                                      onChange={(e) =>
                                        setReplyTexts((prev) => ({
                                          ...prev,
                                          [c.consultationId]: e.target.value,
                                        }))
                                      }
                                      placeholder="学校での様子や一緒に試したい関わり方を返信..."
                                      className="w-full rounded-2xl border border-[#DFD5C5] bg-white p-3.5 text-sm leading-relaxed text-[#3A3128]"
                                    />
                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const txt = replyTexts[c.consultationId] || '';
                                          if (!txt.trim()) return;
                                          if (!checkSafetyOrProceed(txt)) return;
                                          await replyToParentConsultation({
                                            consultationId: c.consultationId,
                                            teacherReply: txt,
                                          });
                                          await refreshStudentBundle(false);
                                          setNotice('保護者への返信を送信しました。');
                                        }}
                                        className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#225957]"
                                      >
                                        <Send className="h-3.5 w-3.5" />
                                        返信を送る
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SECTION 6: Trials & Side-by-Side Adult + Child Evaluation */}
                  {section === 'trials' && studentBundle && (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                        <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                          学校で試す工夫を追加する
                        </h2>
                        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                          <input
                            type="text"
                            value={newTrialText}
                            onChange={(e) => setNewTrialText(e.target.value)}
                            placeholder="何を変えるか（例：板書の前にプリントで要点を渡す）"
                            className="min-h-[46px] rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                          />
                          <input
                            type="text"
                            value={newTrialWhy}
                            onChange={(e) => setNewTrialWhy(e.target.value)}
                            placeholder="なぜ試すか（例：図や手元資料があると見通しを持てるため）"
                            className="min-h-[46px] rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-sm text-[#3A3128]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!newTrialText.trim()) return;
                            if (!checkSafetyOrProceed(`${newTrialText} ${newTrialWhy}`)) return;
                            await confirmAndSaveProposals({
                              actorRole: 'teacher',
                              student: studentBundle.student,
                              index: studentBundle.index,
                              observationsToCreate: [],
                              hypothesesToCreate: [],
                              trialsToCreate: [
                                {
                                  where: 'school',
                                  whatToChange: newTrialText,
                                  why: newTrialWhy || '学校での小さな工夫',
                                  basedOnExistingIds: [],
                                  basedOnNewTempIds: [],
                                },
                              ],
                            });
                            setNewTrialText('');
                            setNewTrialWhy('');
                            await refreshStudentBundle(false);
                          }}
                          className="mt-3.5 min-h-[46px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#225957]"
                        >
                          工夫を登録する
                        </button>
                      </div>

                      {studentBundle.trials.length === 0 ? (
                        <div className="rounded-3xl border border-[#EAE2D3] bg-white p-8 text-center text-sm text-[#6E6254] shadow-[0_6px_24px_rgba(92,74,50,0.04)]">
                          まだ登録された工夫はありません。小さな環境の工夫を1つ登録して試してみましょう。
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {studentBundle.trials.map((tr) => (
                            <div
                              key={tr.trialId}
                              className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold tabular-nums text-[#2B6E6B]">
                                  [{tr.formalId}] {tr.where === 'school' ? '学校の工夫' : '家庭の工夫'}
                                </span>
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
                                    await refreshStudentBundle(false);
                                  }}
                                  className="min-h-[40px] whitespace-nowrap rounded-xl border border-[#DFD5C5] bg-[#FFFDF8] px-3.5 text-xs font-bold text-[#3A3128] transition hover:bg-[#FAF5EC]"
                                >
                                  {tr.shareStatus === 'shared'
                                    ? '共有中（停止する）'
                                    : '家庭と共有する'}
                                </button>
                              </div>

                              <p className="mt-2 text-base font-bold text-[#3A3128]">
                                {tr.whatToChange}
                              </p>
                              <p className="mt-0.5 text-xs text-[#6E6254]">理由：{tr.why}</p>

                              {/* Side-by-side Adult & Child Voices */}
                              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4">
                                  <div className="text-xs font-bold text-[#3A3128]">
                                    大人の振り返り（効果・本人の負担・継続）
                                  </div>
                                  <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
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
                                        await refreshStudentBundle(false);
                                      }}
                                      className="min-h-[40px] rounded-xl border border-[#DFD5C5] bg-white px-2 text-xs font-bold text-[#3A3128]"
                                    >
                                      <option value="unrecorded">効果：未記録</option>
                                      <option value="helpful">うまくいった</option>
                                      <option value="depends">場面による</option>
                                      <option value="not_fit">合わなかった</option>
                                    </select>

                                    <select
                                      value={tr.childBurden}
                                      onChange={async (e) => {
                                        await updateAdultTrialEvaluation({
                                          trial: tr,
                                          adultResult: tr.adultResult,
                                          childBurden: e.target.value as TrialDoc['childBurden'],
                                          continuedStatus: tr.continuedStatus,
                                          shareStatus: tr.shareStatus,
                                        });
                                        await refreshStudentBundle(false);
                                      }}
                                      className="min-h-[40px] rounded-xl border border-[#DFD5C5] bg-white px-2 text-xs font-bold text-[#3A3128]"
                                    >
                                      <option value="unrecorded">負担：未記録</option>
                                      <option value="easier">楽そう</option>
                                      <option value="same">変わらない</option>
                                      <option value="harder">負担そう</option>
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
                                        await refreshStudentBundle(false);
                                      }}
                                      className="min-h-[40px] rounded-xl border border-[#DFD5C5] bg-white px-2 text-xs font-bold text-[#3A3128]"
                                    >
                                      <option value="unrecorded">継続：未記録</option>
                                      <option value="continued">続けた</option>
                                      <option value="sometimes">ときどき使う</option>
                                      <option value="stopped">やめた</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-[#F3CEAA] bg-[#FFF3E6] p-4">
                                  <div className="text-xs font-bold text-[#9A4816]">
                                    子ども本人の感想（大人の評価と並べて確認）
                                  </div>
                                  <p className="mt-2 text-sm font-bold text-[#3A3128]">
                                    {tr.childFeedback === 'good'
                                      ? '「よかった」'
                                      : tr.childFeedback === 'normal'
                                        ? '「ふつう」'
                                        : tr.childFeedback === 'disliked'
                                          ? '「いやだった」（選べる形への調整を検討してください）'
                                          : 'まだ聞いていません（次回の冒険で尋ねます）'}
                                  </p>
                                  {tr.childFeedbackNote && (
                                    <p className="mt-1 text-xs text-[#9A4816]">
                                      ひとこと：{tr.childFeedbackNote}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 7 & 8: Meeting Memo / Parent Letter / Term Facts / Class Tips */}
                  {(section === 'meeting_letter' || section === 'term_class_tips') && (
                    <div className="rounded-3xl border border-[#EAE2D3] bg-white p-6 shadow-[0_6px_24px_rgba(92,74,50,0.04)] sm:p-7">
                      <h2 className="font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128] sm:text-xl">
                        {section === 'meeting_letter'
                          ? '面談メモ・保護者連絡の下書き（共有済みの記録のみを使用）'
                          : '学期の事実整理・学級の工夫の整理'}
                      </h2>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#6E6254]">
                        AIは記録された事実の整理だけを行います。生成後は先生ご自身で内容を確認・修正してからお使いください。
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2.5">
                        {section === 'meeting_letter' ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleGenerateMemoMode('meeting_memo', '個人面談メモ（共有記録のみ）')
                              }
                              className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#225957] disabled:opacity-60"
                            >
                              面談メモの下書きを作る
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleGenerateMemoMode(
                                  'parent_letter',
                                  '保護者への連絡文の下書き'
                                )
                              }
                              className="min-h-[48px] whitespace-nowrap rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4] px-5 py-2.5 text-sm font-bold text-[#1F5654] transition hover:bg-[#DDF0EE] disabled:opacity-60"
                            >
                              良い場面からの家庭連絡文を作る
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleGenerateMemoMode(
                                  'term_facts',
                                  '学期の事実の整理（評価・所見文は含みません）'
                                )
                              }
                              className="min-h-[48px] whitespace-nowrap rounded-2xl bg-[#2B6E6B] px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#225957] disabled:opacity-60"
                            >
                              時期・場面ごとの事実を整理する
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleGenerateMemoMode(
                                  'class_tips',
                                  '学級の工夫メモ（個人名・特定児童なし）'
                                )
                              }
                              className="min-h-[48px] whitespace-nowrap rounded-2xl border border-[#BCE0DD] bg-[#EAF5F4] px-5 py-2.5 text-sm font-bold text-[#1F5654] transition hover:bg-[#DDF0EE] disabled:opacity-60"
                            >
                              家庭でも試せる学級の工夫をまとめる
                            </button>
                          </>
                        )}
                      </div>

                      {generatedDocText && (
                        <div className="mt-6 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-[#3A3128]">
                              {generatedDocTitle}（確認・修正欄）
                            </h3>
                            <button
                              type="button"
                              onClick={() => setPrintModalOpen(true)}
                              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#2F7A54] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#256344]"
                            >
                              <Printer className="h-4 w-4" />
                              PDF保存・印刷プレビュー
                            </button>
                          </div>
                          <textarea
                            rows={12}
                            value={generatedDocText}
                            onChange={(e) => setGeneratedDocText(e.target.value)}
                            className="w-full rounded-2xl border border-[#DFD5C5] bg-[#FFFDF8] p-4 text-sm leading-relaxed text-[#3A3128]"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AdultSafetyModal
        open={safetyModalOpen}
        onClose={() => setSafetyModalOpen(false)}
        supervisorName={school?.safetySupervisor}
        versionLabel={school?.safetyVersion}
      />

      <AdultPinLaunchModal
        open={Boolean(launchTargetStudent)}
        childNickname={launchTargetStudent?.nickname || ''}
        placeLabel="学校"
        onCancel={() => setLaunchTargetStudent(null)}
        onConfirmLaunch={(pinHash, deviceType) => {
          if (!launchTargetStudent) return;
          const stu = launchTargetStudent;
          setLaunchTargetStudent(null);
          onEnterChildMode({
            studentId: stu.studentId,
            nickname: stu.nickname,
            schoolId: stu.schoolId,
            classId: stu.classId,
            grade: stu.grade,
            gradeBand: stu.gradeBand,
            place: 'school',
            deviceType,
            pinHash,
            participationOptOut: Boolean(stu.participationOptOut),
          });
        }}
      />

      {/* Printable 1-per-Student NAMELESS QR Cards Sheet */}
      <PrintableExportModal
        open={qrSheetModalOpen}
        title="児童配付用・氏名なしQRカード（1人1枚）"
        subtitle="学校のアカウントが使えない場合でも、ブラウザでQRを読み取るかコード入力で参加できます"
        filename={`うちの子トリセツ_氏名なしQRカード_${schoolClass?.className || '学級'}`}
        onClose={() => setQrSheetModalOpen(false)}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#EAE2D3] bg-[#FAF5EC] p-4 text-xs leading-relaxed text-[#3A3128]">
            <p className="font-bold text-[#215C3E]">
              配付と取り扱いのご注意（氏名・ニックネームは印字していません）
            </p>
            <p className="mt-1 text-[#6E6254]">
              ・カードには「学級名」「出席番号」「推測しにくい専用文字列（SQR_...）」のみを記載しています。児童の氏名やニックネームは記載していません。
            </p>
            <p className="text-[#6E6254]">
              ・再発行すると古いQRカードは自動的に無効になります。先生が「授業で遊ぶ」を押している時間（または持ち帰り許可中）のみ入室できます。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {namelessQrCards.map((card) => (
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

      <PrintableExportModal
        open={printModalOpen}
        title={generatedDocTitle || '資料プレビュー'}
        filename={`うちの子トリセツ_${generatedDocTitle || 'メモ'}`}
        onClose={() => setPrintModalOpen(false)}
      >
        <div className="space-y-4">
          <h2 className="border-b border-[#EAE2D3] pb-2 font-['Zen_Maru_Gothic'] text-lg font-bold text-[#3A3128]">
            {generatedDocTitle}
          </h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#3A3128]">
            {generatedDocText}
          </div>
        </div>
      </PrintableExportModal>
    </div>
  );
};
