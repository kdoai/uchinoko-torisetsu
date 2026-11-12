import type { GeminiAResponse, GeminiBResponse } from '../shared/safetyAndGuardrails';
import type {
  ActiveChildModeLock,
  AuthorizedStudentBundle,
  ChildAnswerDoc,
  ChildVisibility,
  ClassroomSessionDoc,
  ConsultationDoc,
  GameItemRecord,
  GameSessionDoc,
  GradeBand,
  HypothesisDoc,
  ObservationCategory,
  ObservationDoc,
  ObservationSide,
  ParentFollowupDoc,
  ParentLinkRequestDoc,
  SafetyReportDoc,
  SchoolClassDoc,
  SchoolDoc,
  ShareStatus,
  SharingRequestDoc,
  StaffMembershipDoc,
  StudentDoc,
  StudentRecordIndexDoc,
  StudentRewardDoc,
  TeacherSafetyNoticeDoc,
  TrialDoc,
  UserAccountDoc,
} from '../types/models';
import { formatJapaneseDateLabel } from './factFormatter';

export const DEMO_SCHOOL_ID = 'demo_school_hidamari';
export const DEMO_CLASS_ID = 'demo_class_2_1';
export const DEMO_STUDENT_ID = 'demo_student_haru';
export const DEMO_TEACHER_UID = 'demo_teacher_uid';
export const DEMO_PARENT_UID = 'demo_parent_uid';
export const DEMO_SAFETY_UID = 'demo_safety_uid';
export const DEMO_ADMIN_UID = 'demo_admin_uid';

export type DemoRoleView = 'child' | 'parent' | 'teacher' | 'safety';

export function isDemoId(id?: string | null): boolean {
  if (!id) return false;
  return id.startsWith('demo_');
}

export function buildDemoUserAccount(role: DemoRoleView): UserAccountDoc {
  switch (role) {
    case 'teacher':
      return {
        uid: DEMO_TEACHER_UID,
        role: 'teacher',
        schoolId: DEMO_SCHOOL_ID,
        isHomeOnly: false,
        homeSafetyConfirmed: true,
      };
    case 'safety':
      return {
        uid: DEMO_SAFETY_UID,
        role: 'safety_officer',
        schoolId: DEMO_SCHOOL_ID,
        isHomeOnly: false,
        homeSafetyConfirmed: true,
      };
    default:
      return {
        uid: DEMO_PARENT_UID,
        role: 'parent',
        schoolId: DEMO_SCHOOL_ID,
        isHomeOnly: false,
        homeSafetyConfirmed: true,
      };
  }
}

export function buildDemoChildLock(): ActiveChildModeLock {
  return {
    studentId: DEMO_STUDENT_ID,
    nickname: '2年1組 はる',
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    grade: 2,
    gradeBand: 'low',
    place: 'school',
    deviceType: 'tablet',
    pinHash: '',
    isSchoolDeviceSession: true,
    playTicketId: 'demo_ticket_01',
    participationOptOut: false,
  };
}

interface DemoSandboxState {
  school: SchoolDoc;
  schoolClass: SchoolClassDoc;
  teacherMembership: StaffMembershipDoc;
  safetyMembership: StaffMembershipDoc;
  students: StudentDoc[];
  index: StudentRecordIndexDoc;
  gameSessions: GameSessionDoc[];
  childAnswers: ChildAnswerDoc[];
  observations: ObservationDoc[];
  sharingRequests: SharingRequestDoc[];
  hypotheses: HypothesisDoc[];
  trials: TrialDoc[];
  consultations: ConsultationDoc[];
  safetyReports: SafetyReportDoc[];
  safetyNotice: TeacherSafetyNoticeDoc | null;
  classroomSession: ClassroomSessionDoc;
  rewards: StudentRewardDoc;
  followups: ParentFollowupDoc[];
}

const nowMs = Date.now();

const state: DemoSandboxState = {
  school: {
    schoolId: DEMO_SCHOOL_ID,
    adminUid: DEMO_ADMIN_UID,
    schoolCodeLabel: 'ひだまり小学校（架空デモ校）',
    academicYear: '2026年度',
    retentionMonths: 12,
    checkBoardApproved: true,
    checkParentConsent: true,
    checkChildExplain: true,
    checkSpecialistDocs: true,
    checkSafetyWorkflow: true,
    allPreChecksDone: true,
    directorySupervisor: '地域小児科・特別支援教育アドバイザー確認済（デモ）',
    directoryVersion: 'v1.0',
    safetySupervisor: '学校危機管理・児童福祉アドバイザー確認済（デモ）',
    safetyVersion: 'v1.0',
    primaryOfficerLabel: '養護教諭（主担当）',
    deputyOfficerLabel: '教育相談担当（副担当）',
    managerOfficerLabel: '教頭・校長（管理職）',
    escalateToDeputyMinutes: 30,
    escalateToManagerMinutes: 90,
    offHoursRule:
      '夜間・休日は24時間子供SOSダイヤル（0120-0-78310）等を案内し、翌登校日始業前に最優先で確認する。',
    invitesIssuedCount: 28,
    linkedHouseholdsCount: 26,
  },
  schoolClass: {
    classId: DEMO_CLASS_ID,
    schoolId: DEMO_SCHOOL_ID,
    adminUid: DEMO_ADMIN_UID,
    className: '2年1組',
    grade: 2,
    gradeBand: 'low',
    academicYear: '2026年度',
    teacherUid: DEMO_TEACHER_UID,
    studentIds: [DEMO_STUDENT_ID, 'demo_student_ao', 'demo_student_mio'],
  },
  teacherMembership: {
    uid: DEMO_TEACHER_UID,
    schoolId: DEMO_SCHOOL_ID,
    adminUid: DEMO_ADMIN_UID,
    staffRole: 'teacher',
    classId: DEMO_CLASS_ID,
    safetyTier: 'none',
    displayLabel: '2年1組 担任',
    redeemedInviteCode: 'STF_DEMO21',
    active: true,
  },
  safetyMembership: {
    uid: DEMO_SAFETY_UID,
    schoolId: DEMO_SCHOOL_ID,
    adminUid: DEMO_ADMIN_UID,
    staffRole: 'safety_officer',
    classId: '',
    safetyTier: 'primary',
    displayLabel: '養護教諭（安全対応主担当）',
    redeemedInviteCode: 'STF_DEMOSAF',
    active: true,
  },
  students: [
    {
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      adminUid: DEMO_ADMIN_UID,
      classId: DEMO_CLASS_ID,
      parentUid: DEMO_PARENT_UID,
      attendanceNumber: 12,
      nickname: 'はる',
      grade: 2,
      gradeBand: 'low',
      isHomeOnly: false,
      participationOptOut: false,
    },
    {
      studentId: 'demo_student_ao',
      schoolId: DEMO_SCHOOL_ID,
      adminUid: DEMO_ADMIN_UID,
      classId: DEMO_CLASS_ID,
      parentUid: 'demo_parent_other_1',
      attendanceNumber: 3,
      nickname: 'あお',
      grade: 2,
      gradeBand: 'low',
      isHomeOnly: false,
      participationOptOut: false,
    },
    {
      studentId: 'demo_student_mio',
      schoolId: DEMO_SCHOOL_ID,
      adminUid: DEMO_ADMIN_UID,
      classId: DEMO_CLASS_ID,
      parentUid: 'demo_parent_other_2',
      attendanceNumber: 19,
      nickname: 'みお（記録なし選択）',
      grade: 2,
      gradeBand: 'low',
      isHomeOnly: false,
      participationOptOut: true,
    },
  ],
  index: {
    studentId: DEMO_STUDENT_ID,
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    gameSessionIds: ['gs_demo_1', 'gs_demo_2'],
    childAnswerBothIds: ['ans_demo_1', 'ans_demo_2'],
    childAnswerTeacherIds: [],
    childAnswerParentIds: [],
    schoolObsOwnIds: ['obs_demo_3', 'obs_demo_4'],
    homeObsOwnIds: ['obs_demo_5'],
    sharedObsIds: ['obs_demo_3', 'obs_demo_5'],
    gameChildObsBothIds: ['obs_demo_1', 'obs_demo_2'],
    childObsTeacherIds: [],
    childObsParentIds: [],
    sharingRequestIds: ['shr_demo_1'],
    schoolHypIds: ['hyp_demo_1'],
    homeHypIds: [],
    sharedHypIds: ['hyp_demo_1'],
    schoolTrialIds: ['tri_demo_1'],
    homeTrialIds: [],
    sharedTrialIds: ['tri_demo_1'],
    consultationIds: ['cns_demo_1'],
    nextFormalSeq: 8,
  },
  gameSessions: [
    {
      sessionId: 'gs_demo_1',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      gameType: 'shopping',
      attemptNumber: 1,
      version: 'v1.0',
      form: 'A',
      orderPattern: 'illust_first',
      grade: 2,
      gradeBand: 'low',
      place: 'school',
      deviceType: 'tablet',
      usedTts: true,
      paused: false,
      items: [],
      factSentence:
        'おかいもの課題（第1回・形A・学校タブレット）：絵と値札がある条件では6問中6問一致（平均4.6秒）、文字だけの条件では6問中3問一致（たし算・ひき算の取り違え2回）。※独自の課題で能力の測定ではありません。',
      conditionSummary:
        'おかいもの課題（第1回・形A）：今回の課題では、品物の絵と値札が並んでいる条件（6/6問）のほうが、文字だけの条件（3/6問）よりも見通しをもって取り組みやすい様子が見られました。',
      dateLabel: '11月10日',
    },
    {
      sessionId: 'gs_demo_2',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      gameType: 'delivery',
      attemptNumber: 1,
      version: 'v1.0',
      form: 'A',
      orderPattern: 'fixed',
      grade: 2,
      gradeBand: 'low',
      place: 'school',
      deviceType: 'tablet',
      usedTts: false,
      paused: false,
      items: [],
      factSentence:
        '順番を覚えて届ける課題（第1回・形A・学校タブレット）：2〜3軒の配達では全問一致、4軒以上になると順番の入れ替わりが見られました。※独自の課題で能力の測定ではありません。',
      conditionSummary:
        '順番を覚えて届ける課題（第1回・形A）：今回の課題では、一度に伝える手順が2〜3つまでのときは迷わず進めていました。',
      dateLabel: '11月10日',
    },
  ],
  childAnswers: [
    {
      answerId: 'ans_demo_1',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      questionType: 'base',
      questionId: 'q_hard_school',
      questionText: 'がっこうで「ちょっと たいへんだな」と おもう ことは ある？',
      choices: ['こくばんの もじを かくこと', 'せんせいの おはなしを きくこと'],
      freeText: '',
      followupTranscript:
        'モモ：どんな ときが たいへんかな？ → 本人：うつしている あいだに つぎへ すすんで しまう',
      visibility: 'both',
      isDistressSignal: true,
      factSentence:
        '本人の声（11月10日）：「こくばんの もじを かくこと」がたいへんと回答し、モモとの会話で「うつしている あいだに つぎへ すすんで しまう」と伝えています（共有先：先生とおうちのひと）。',
      dateLabel: '11月10日',
      place: 'school',
    },
    {
      answerId: 'ans_demo_2',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      questionType: 'base',
      questionId: 'q_good_help',
      questionText: 'どんな ときだと「わかりやすい！」「やりやすい！」と おもう？',
      choices: ['えや ずが あるとき', 'てほんが ちかくに あるとき'],
      freeText: 'きょうりゅうの えが あると うれしい',
      followupTranscript: '',
      visibility: 'both',
      isDistressSignal: false,
      factSentence:
        '本人の声（11月10日）：「えや ずが あるとき」「てほんが ちかくに あるとき」がやりやすいと答え、「きょうりゅうの えが あると うれしい」と添えています。',
      dateLabel: '11月10日',
      place: 'school',
    },
  ],
  observations: [
    {
      observationId: 'obs_demo_1',
      formalId: 'O-001',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      side: 'child',
      category: 'child_said',
      fact: '本人がゲーム内で「こくばんの もじを かくこと」がたいへんと選び、「うつしている あいだに つぎへ すすんで しまう」と伝えた。また「えや ずが あるとき」「てほんが ちかくに あるとき」がやりやすいと答えた。',
      shareStatus: 'shared',
      visibleTo: 'both',
      pendingRequestId: '',
      correctsObservationId: '',
      dateLabel: '11月10日',
    },
    {
      observationId: 'obs_demo_2',
      formalId: 'O-002',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      side: 'game',
      category: 'other',
      fact: 'おかいもの課題（第1回・形A）：絵と値札が並ぶ条件では6問中6問一致、文字のみの条件では6問中3問一致。順番を覚えて届ける課題では2〜3軒までスムーズに進めた（※独自の課題）。',
      shareStatus: 'shared',
      visibleTo: 'both',
      pendingRequestId: '',
      correctsObservationId: '',
      dateLabel: '11月10日',
    },
    {
      observationId: 'obs_demo_3',
      formalId: 'O-003',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      side: 'school',
      category: 'worked_well',
      fact: '算数の時間、机の上に完成見本カードを1枚置いたところ、迷わず最後まで笑顔で取り組めた。',
      shareStatus: 'shared',
      visibleTo: 'both',
      pendingRequestId: 'shr_demo_1',
      correctsObservationId: '',
      dateLabel: '11月11日',
    },
    {
      observationId: 'obs_demo_4',
      formalId: 'O-004',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      side: 'school',
      category: 'hard',
      fact: '口頭で3つ以上の手順を続けて説明した場面では、ノートを書き始める前に手が止まる様子があった。',
      shareStatus: 'not_shared',
      visibleTo: 'teacher',
      pendingRequestId: '',
      correctsObservationId: '',
      dateLabel: '11月11日',
    },
    {
      observationId: 'obs_demo_5',
      formalId: 'O-005',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      side: 'home',
      category: 'strength',
      fact: '家では恐竜が大好きで、イラスト図解つきの恐竜図鑑なら30分以上集中して特徴を調べ、嬉しそうに教えてくれる。',
      shareStatus: 'shared',
      visibleTo: 'both',
      pendingRequestId: '',
      correctsObservationId: '',
      dateLabel: '11月11日',
    },
  ],
  sharingRequests: [
    {
      requestId: 'shr_demo_1',
      observationId: 'obs_demo_3',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      fromSide: 'school',
      toSide: 'home',
      category: 'worked_well',
      previewText:
        '算数の時間、机の上に完成見本カードを1枚置いたところ、迷わず最後まで笑顔で取り組めた。',
      purposeText: '学校でうまくいった関わり方をご家庭にもお伝えし、家での様子も伺いたいため',
      status: 'approved',
      replyChoice: '家でもそう',
      replySupplement: '家でも写真つきの恐竜図鑑を見ながらだとすぐに動けます！',
      dateLabel: '11月11日',
    },
  ],
  hypotheses: [
    {
      hypothesisId: 'hyp_demo_1',
      formalId: 'H-001',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      createdBySide: 'school',
      shareStatus: 'shared',
      text: '耳からの説明や黒板の視線移動を減らし、手元に「絵や図の見本」を1ステップずつ置くと安心しやすく、好きな恐竜モチーフを添えるとさらに楽しく取り組める価値がありそうです。',
      why: '本人の声（O-001）、おかいもの課題の絵つき条件での取り組みやすさ（O-002）、学校の見本カード（O-003）、家庭での恐竜図鑑への集中（O-005）の4つが重なっているため。',
      evidenceIds: ['O-001', 'O-002', 'O-003', 'O-005'],
      evidenceSides: ['child', 'game', 'school', 'home'],
    },
  ],
  trials: [
    {
      trialId: 'tri_demo_1',
      formalId: 'T-001',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      where: 'school',
      shareStatus: 'shared',
      whatToChange: '黒板を全部写さず、恐竜スタンプつきの図解・穴埋めミニカードを手元に配る',
      why: '黒板を写す負担を減らしつつ、視覚的な手がかりと大好きな恐竜を組み合わせるため（O-001, O-002, O-003, O-005）',
      basedOnIds: ['O-001', 'O-002', 'O-003', 'O-005'],
      adjustsTrialId: '',
      adultResult: 'helpful',
      childBurden: 'easier',
      continuedStatus: 'continued',
      childFeedback: 'good',
      childFeedbackNote: 'きょうりゅうの カードだと すぐ わかって たのしい！',
    },
  ],
  consultations: [
    {
      consultationId: 'cns_demo_1',
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      selectedRecordSummaries: ['O-001（本人の声）', 'O-005（家庭の記録）'],
      messageBody:
        'いつもお世話になっております。ゲームの中で本人が「黒板の文字を写している間に次へ進んでしまう」と伝えていたのを見ました。家では恐竜のイラスト図鑑を見ながらだと落ち着いて取り組めるのですが、学校での様子も教えていただけますでしょうか。一緒にできる工夫を考えられたら嬉しいです。',
      teacherReply:
        'ご相談ありがとうございます！算数で手元に見本カードを置いたところ、とても安心した表情で取り組めていました。大好きな恐竜マークを入れた穴埋めカードを明日から試してみますね。',
      status: 'replied',
      dateLabel: '11月11日',
    },
  ],
  safetyReports: [
    {
      reportId: 'saf_demo_1',
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      studentId: 'demo_student_sora',
      studentNickname: 'そら（架空デモ）',
      place: 'school',
      triggerSource: 'talk_button_scary',
      childWords:
        '「だれかに はなしたい」＞「こわい ことや、いたい ことが ある」を選択：おうちに かえるのが すこし こわい',
      createdAtMs: nowMs - 8 * 60 * 1000,
      primaryDeadlineMs: nowMs + 22 * 60 * 1000,
      deputyDeadlineMs: nowMs + 82 * 60 * 1000,
      status: 'unconfirmed',
      hasOpened: false,
      openedAtMs: 0,
      confirmedByUid: '',
      confirmedByLabel: '',
      actionsTaken: [],
      actionNote: '',
      hasActed: false,
      actedAtMs: 0,
      teacherNoticeId: DEMO_CLASS_ID,
    },
  ],
  safetyNotice: null,
  classroomSession: {
    classId: DEMO_CLASS_ID,
    schoolId: DEMO_SCHOOL_ID,
    adminUid: DEMO_ADMIN_UID,
    teacherUid: DEMO_TEACHER_UID,
    className: '2年1組',
    classJoinCode: 'CLS_HD2101',
    isOpen: true,
    allowTakeHome: true,
    connectedCount: 28,
    openedAt: { toMillis: () => nowMs - 10 * 60 * 1000 },
    expiresAt: { toMillis: () => nowMs + 35 * 60 * 1000 },
  },
  rewards: {
    studentId: DEMO_STUDENT_ID,
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    coins: 45,
    totalSpins: 3,
    unlockedItemIds: ['sprout_badge', 'apple_charm', 'bear_cookie'],
  },
  followups: [],
};

const sessionListeners = new Set<(s: ClassroomSessionDoc | null) => void>();
function notifySessionListeners() {
  for (const cb of sessionListeners) {
    cb({ ...state.classroomSession });
  }
}

export function demoLoadTeacherWorkspace() {
  return {
    membership: { ...state.teacherMembership },
    school: { ...state.school },
    schoolClass: { ...state.schoolClass },
    students: state.students.map((s) => ({ ...s })),
    safetyNotice: state.safetyNotice ? { ...state.safetyNotice } : null,
  };
}

export function demoLoadParentWorkspace() {
  return {
    school: { ...state.school },
    students: state.students.filter((s) => s.studentId === DEMO_STUDENT_ID).map((s) => ({ ...s })),
    pendingLinkRequests: [] as ParentLinkRequestDoc[],
    followups: state.followups.map((f) => ({ ...f })),
  };
}

export function demoLoadSafetyOfficerWorkspace() {
  return {
    membership: { ...state.safetyMembership },
    school: { ...state.school },
    reports: state.safetyReports.map((r) => ({ ...r })),
  };
}

export function demoLoadAuthorizedStudentBundle(params: {
  viewerRole: 'teacher' | 'parent';
  student: StudentDoc;
}): AuthorizedStudentBundle {
  const { viewerRole, student } = params;
  if (student.studentId !== DEMO_STUDENT_ID) {
    return {
      student,
      index: {
        ...state.index,
        studentId: student.studentId,
        gameSessionIds: [],
        childAnswerBothIds: [],
        schoolObsOwnIds: [],
        homeObsOwnIds: [],
        sharedObsIds: [],
        gameChildObsBothIds: [],
        sharingRequestIds: [],
        schoolHypIds: [],
        sharedHypIds: [],
        schoolTrialIds: [],
        sharedTrialIds: [],
        consultationIds: [],
      },
      gameSessions: [],
      childAnswers: [],
      observations: [],
      sharingRequests: [],
      hypotheses: [],
      trials: [],
      consultations: [],
    };
  }

  const visibleObs = state.observations.filter((o) => {
    if (o.visibleTo === 'both' || o.shareStatus === 'shared') return true;
    return viewerRole === 'teacher' ? o.visibleTo === 'teacher' : o.visibleTo === 'parent';
  });

  return {
    student: { ...student },
    index: { ...state.index },
    gameSessions: state.gameSessions.map((g) => ({ ...g })),
    childAnswers: state.childAnswers.map((a) => ({ ...a })),
    observations: visibleObs.map((o) => ({ ...o })),
    sharingRequests: state.sharingRequests.map((r) => ({ ...r })),
    hypotheses: state.hypotheses.map((h) => ({ ...h })),
    trials: state.trials.map((t) => ({ ...t })),
    consultations: state.consultations.map((c) => ({ ...c })),
  };
}

export function demoLoadStudentRewards(): StudentRewardDoc {
  return {
    ...state.rewards,
    unlockedItemIds: [...state.rewards.unlockedItemIds],
  };
}

export function demoSaveStudentRewards(params: {
  coins: number;
  totalSpins: number;
  unlockedItemIds: string[];
  participationOptOut?: boolean;
}) {
  if (params.participationOptOut) return;
  state.rewards = {
    ...state.rewards,
    coins: params.coins,
    totalSpins: params.totalSpins,
    unlockedItemIds: [...params.unlockedItemIds],
  };
}

export function demoSaveGameSession(params: {
  gameType: 'shopping' | 'delivery';
  attemptNumber: number;
  version: string;
  form: 'A' | 'B';
  orderPattern: 'illust_first' | 'text_first' | 'fixed';
  grade: number;
  gradeBand: GradeBand;
  place: 'school' | 'home';
  deviceType: 'tablet' | 'smartphone' | 'pc';
  usedTts: boolean;
  paused: boolean;
  items: GameItemRecord[];
  factSentence: string;
  conditionSummary: string;
  participationOptOut?: boolean;
}) {
  if (params.participationOptOut) return { nextIndex: state.index };
  const seq = state.index.nextFormalSeq++;
  const formalId = `O-00${seq}`;
  const obsId = `obs_demo_${seq}`;
  const gsId = `gs_demo_${Date.now()}`;
  const dateLabel = formatJapaneseDateLabel();

  state.gameSessions.push({
    sessionId: gsId,
    studentId: DEMO_STUDENT_ID,
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    gameType: params.gameType,
    attemptNumber: params.attemptNumber,
    version: params.version,
    form: params.form,
    orderPattern: params.orderPattern,
    grade: params.grade,
    gradeBand: params.gradeBand,
    place: params.place,
    deviceType: params.deviceType,
    usedTts: params.usedTts,
    paused: params.paused,
    items: params.items,
    factSentence: params.factSentence,
    conditionSummary: params.conditionSummary,
    dateLabel,
  });

  state.observations.push({
    observationId: obsId,
    formalId,
    studentId: DEMO_STUDENT_ID,
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    side: 'game',
    category: 'other',
    fact: params.conditionSummary,
    shareStatus: 'shared',
    visibleTo: 'both',
    pendingRequestId: '',
    correctsObservationId: '',
    dateLabel,
  });

  state.index.gameSessionIds.push(gsId);
  state.index.gameChildObsBothIds.push(obsId);
  return { nextIndex: { ...state.index } };
}

export function demoSaveChildAnswer(params: {
  questionType: 'base' | 'interlude' | 'talk_trouble';
  questionId: string;
  questionText: string;
  choices: string[];
  freeText: string;
  followupTranscript: string;
  visibility: ChildVisibility;
  isDistressSignal: boolean;
  factSentence: string;
  place: 'school' | 'home';
  participationOptOut?: boolean;
}) {
  if (params.participationOptOut) return { nextIndex: state.index };
  const ansId = `ans_demo_${Date.now()}`;
  const dateLabel = formatJapaneseDateLabel();
  state.childAnswers.push({
    answerId: ansId,
    studentId: DEMO_STUDENT_ID,
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    questionType: params.questionType,
    questionId: params.questionId,
    questionText: params.questionText,
    choices: params.choices,
    freeText: params.freeText,
    followupTranscript: params.followupTranscript,
    visibility: params.visibility,
    isDistressSignal: params.isDistressSignal,
    factSentence: params.factSentence,
    dateLabel,
    place: params.place,
  });
  if (params.visibility !== 'none') {
    const seq = state.index.nextFormalSeq++;
    const obsId = `obs_demo_${seq}`;
    state.observations.push({
      observationId: obsId,
      formalId: `O-00${seq}`,
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      side: 'child',
      category: 'child_said',
      fact: params.factSentence,
      shareStatus: params.visibility === 'both' ? 'shared' : 'not_shared',
      visibleTo: params.visibility,
      pendingRequestId: '',
      correctsObservationId: '',
      dateLabel,
    });
  }
  return { nextIndex: { ...state.index } };
}

export function demoSubmitSafetyReport(params: {
  studentId: string;
  studentNickname: string;
  place: 'school' | 'home';
  triggerSource: 'talk_button_scary' | 'keyword_detected' | 'gemini_safety_review';
  childWords: string;
}) {
  const now = Date.now();
  state.safetyReports.unshift({
    reportId: `saf_demo_${now}`,
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    studentId: params.studentId,
    studentNickname: params.studentNickname,
    place: params.place,
    triggerSource: params.triggerSource,
    childWords: params.childWords || '「こわい ことや、いたい ことが ある」を選択',
    createdAtMs: now,
    primaryDeadlineMs: now + 30 * 60 * 1000,
    deputyDeadlineMs: now + 90 * 60 * 1000,
    status: 'unconfirmed',
    hasOpened: false,
    openedAtMs: 0,
    confirmedByUid: '',
    confirmedByLabel: '',
    actionsTaken: [],
    actionNote: '',
    hasActed: false,
    actedAtMs: 0,
    teacherNoticeId: DEMO_CLASS_ID,
  });
}

export function demoSaveChildTrialFeedback(params: {
  trialId: string;
  childFeedback: 'good' | 'normal' | 'disliked';
  childFeedbackNote: string;
}) {
  const t = state.trials.find((item) => item.trialId === params.trialId);
  if (t) {
    t.childFeedback = params.childFeedback;
    t.childFeedbackNote = params.childFeedbackNote;
  }
}

export function demoMarkSafetyOpened(reportId: string, officerUid: string, officerLabel: string) {
  const r = state.safetyReports.find((x) => x.reportId === reportId);
  if (r && !r.hasOpened) {
    r.hasOpened = true;
    r.status = 'opened';
    r.openedAtMs = Date.now();
    r.confirmedByUid = officerUid;
    r.confirmedByLabel = officerLabel;
  }
}

export function demoRecordSafetyResponse(params: {
  reportId: string;
  officerUid: string;
  officerLabel: string;
  actionsTaken: string[];
  actionNote: string;
}) {
  const r = state.safetyReports.find((x) => x.reportId === params.reportId);
  if (r) {
    const now = Date.now();
    r.status = 'responded';
    r.hasOpened = true;
    if (!r.openedAtMs) r.openedAtMs = now;
    r.confirmedByUid = params.officerUid;
    r.confirmedByLabel = params.officerLabel;
    r.actionsTaken = [...params.actionsTaken];
    r.actionNote = params.actionNote;
    r.hasActed = true;
    r.actedAtMs = now;
  }
}

export function demoShareSafetyWithHomeroom(status: 'checking' | 'resolved', note: string) {
  state.safetyNotice = {
    noticeId: DEMO_CLASS_ID,
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    status,
    officerSharedNote: note,
  };
}

export function demoConfirmAndSaveProposals(params: {
  actorRole: 'teacher' | 'parent';
  observationsToCreate: Array<{
    tempId: string;
    category: ObservationCategory;
    fact: string;
  }>;
  hypothesesToCreate: Array<{
    text: string;
    why: string;
    evidenceExistingIds: string[];
    evidenceNewTempIds: string[];
    evidenceSides: ObservationSide[];
    shareImmediately?: boolean;
  }>;
  trialsToCreate: Array<{
    where: 'school' | 'home';
    whatToChange: string;
    why: string;
    basedOnExistingIds: string[];
    basedOnNewTempIds: string[];
    adjustsTrialId?: string;
    shareImmediately?: boolean;
  }>;
}) {
  const side: 'school' | 'home' = params.actorRole === 'teacher' ? 'school' : 'home';
  const createdObservationIds: Record<string, string> = {};
  const tempMap: Record<string, string> = {};
  const dateLabel = formatJapaneseDateLabel();

  for (const item of params.observationsToCreate) {
    if (!item.fact.trim()) continue;
    const seq = state.index.nextFormalSeq++;
    const formalId = `O-00${seq}`;
    const obsId = `obs_demo_${seq}`;
    createdObservationIds[item.tempId] = obsId;
    tempMap[item.tempId] = formalId;
    state.observations.push({
      observationId: obsId,
      formalId,
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      side,
      category: item.category,
      fact: item.fact.trim(),
      shareStatus: 'not_shared',
      visibleTo: params.actorRole,
      pendingRequestId: '',
      correctsObservationId: '',
      dateLabel,
    });
  }

  for (const h of params.hypothesesToCreate) {
    if (!h.text.trim()) continue;
    const seq = state.index.nextFormalSeq++;
    const formalId = `H-00${seq}`;
    const hypId = `hyp_demo_${seq}`;
    const shareStatus: ShareStatus = h.shareImmediately ? 'shared' : 'not_shared';
    state.hypotheses.push({
      hypothesisId: hypId,
      formalId,
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      createdBySide: side,
      shareStatus,
      text: h.text.trim(),
      why: h.why.trim(),
      evidenceIds: [
        ...h.evidenceExistingIds,
        ...h.evidenceNewTempIds.map((t) => tempMap[t]).filter(Boolean),
      ],
      evidenceSides: h.evidenceSides,
    });
  }

  for (const tr of params.trialsToCreate) {
    if (!tr.whatToChange.trim()) continue;
    const seq = state.index.nextFormalSeq++;
    const formalId = `T-00${seq}`;
    const triId = `tri_demo_${seq}`;
    const shareStatus: ShareStatus = tr.shareImmediately ? 'shared' : 'not_shared';
    state.trials.push({
      trialId: triId,
      formalId,
      studentId: DEMO_STUDENT_ID,
      schoolId: DEMO_SCHOOL_ID,
      classId: DEMO_CLASS_ID,
      where: side,
      shareStatus,
      whatToChange: tr.whatToChange.trim(),
      why: tr.why.trim(),
      basedOnIds: [
        ...tr.basedOnExistingIds,
        ...tr.basedOnNewTempIds.map((t) => tempMap[t]).filter(Boolean),
      ],
      adjustsTrialId: tr.adjustsTrialId || '',
      adultResult: 'unrecorded',
      childBurden: 'unrecorded',
      continuedStatus: 'unrecorded',
      childFeedback: 'unrecorded',
      childFeedbackNote: '',
    });
  }

  return { createdObservationIds };
}

export function demoSendParentConsultation(params: {
  selectedRecordSummaries: string[];
  messageBody: string;
}) {
  state.consultations.unshift({
    consultationId: `cns_demo_${Date.now()}`,
    studentId: DEMO_STUDENT_ID,
    schoolId: DEMO_SCHOOL_ID,
    classId: DEMO_CLASS_ID,
    selectedRecordSummaries: params.selectedRecordSummaries,
    messageBody: params.messageBody.trim(),
    teacherReply: '',
    status: 'sent',
    dateLabel: formatJapaneseDateLabel(),
  });
}

export function demoReplyToConsultation(consultationId: string, teacherReply: string) {
  const found = state.consultations.find((c) => c.consultationId === consultationId);
  if (found) {
    found.teacherReply = teacherReply;
    found.status = 'replied';
  }
}

export function demoSubscribeClassroomSession(cb: (s: ClassroomSessionDoc | null) => void) {
  sessionListeners.add(cb);
  cb({ ...state.classroomSession });
  return () => {
    sessionListeners.delete(cb);
  };
}

export function demoOpenClassroomSession(durationMinutes = 45, allowTakeHome = true) {
  const now = Date.now();
  state.classroomSession = {
    ...state.classroomSession,
    isOpen: true,
    allowTakeHome,
    connectedCount: 28,
    openedAt: { toMillis: () => now },
    expiresAt: { toMillis: () => now + durationMinutes * 60 * 1000 },
  };
  notifySessionListeners();
  return { ...state.classroomSession };
}

export function demoCloseClassroomSession() {
  state.classroomSession = {
    ...state.classroomSession,
    isOpen: false,
    expiresAt: { toMillis: () => Date.now() - 1000 },
  };
  notifySessionListeners();
}

export function buildDemoGeminiAFallback(choices: string[], followupsUsed: number): GeminiAResponse {
  if (followupsUsed >= 1) {
    return {
      line: 'おしえてくれて ありがとう！ つぎの まちへ すすもうね。',
      choices: [],
      allow_free_text: false,
      end_topic: true,
      safety_review: false,
    };
  }
  const joined = choices.join(' ');
  if (joined.includes('こくばん') || joined.includes('かく')) {
    return {
      line: 'おしえてくれて ありがとう。どんな ときが たいへんかな？',
      choices: [
        'うつしている あいだに つぎへ すすむ',
        'もじが ちいさくて みえにくい',
        'どこを かけば いいか まよう',
        'わからない',
        'こたえたくない',
      ],
      allow_free_text: true,
      end_topic: false,
      safety_review: false,
    };
  }
  return {
    line: 'おしえてくれて ありがとう。もうすこし おしえて くれるかな？',
    choices: [
      'えや みほんが あると わかりやすい',
      'ひとつずつ おしえて ほしい',
      'しずかな ばしょだと やりやすい',
      'わからない',
      'こたえたくない',
    ],
    allow_free_text: true,
    end_topic: false,
    safety_review: false,
  };
}

export function buildDemoGeminiBFallback(
  mode: string,
  viewerRole: 'teacher' | 'parent',
  newInput: string,
  parentRawConsult = ''
): GeminiBResponse {
  if (mode === 'consult_teacher') {
    return {
      message:
        'お子さんの声とご家庭での様子をもとに、担任の先生へ一緒に工夫を考える相談文の下書きを作成しました。内容を確認・修正してからお送りいただけます。',
      new_observations: [],
      unassigned: [],
      class_level: [],
      new_hypotheses: [],
      differences: [],
      suggested_trials: [],
      concerns: [],
      memo: 'いつもお世話になっております。ゲームの中で本人が「こくばんの もじを かくこと」が大変で「写している間に次へ進んでしまう」と伝えていました。家ではイラストつきの恐竜図鑑を見ながらだと落ち着いて取り組めるのですが、学校での様子も教えていただけますでしょうか。一緒に合いそうな工夫を考えられたら嬉しいです。',
    };
  }

  if (mode === 'medical_memo') {
    return {
      message:
        'これまでの記録を変更せず、相談時にそのままお渡しできる順序に並べ替えました。最後に医師の記入欄を設けています。',
      new_observations: [],
      unassigned: [],
      class_level: [],
      new_hypotheses: [],
      differences: [],
      suggested_trials: [],
      concerns: [],
      memo: `【医師に渡すメモ（うちの子トリセツ 記録整理）】\n\n■ 相談したいこと\n${parentRawConsult || '黒板の板書に時間がかかり疲れやすいことについて相談したいです。'}\n\n■ 本人が伝えていること\n・11月10日：「こくばんの もじを かくこと」がたいへん。「うつしている あいだに つぎへ すすんで しまう」\n・11月10日：「えや ずが あるとき」「てほんが ちかくに あるとき」がやりやすい\n\n■ 困っている場面（家・学校）\n・11月11日（学校）：口頭で3つ以上の手順を続けて説明した場面で手が止まる様子があった\n\n■ 得意なこと・うまくいった関わり方\n・11月11日（家庭）：イラスト図解つきの恐竜図鑑なら30分以上集中して特徴を調べている\n・11月11日（学校）：机の上に完成見本カードを1枚置くと迷わず最後まで取り組めた\n\n■ 試した工夫と本人の感想\n・学校：「恐竜スタンプつきの図解・穴埋めミニカードを手元に配る」→ 結果：うまくいった／本人の感想：「よかった（きょうりゅうの カードだと すぐ わかって たのしい！）」\n\n■ ゲームで測った事実（※独自の課題で、標準化された検査ではありません）\n・おかいもの課題（第1回・形A・v1.0・11月10日・学校タブレット）：絵と値札がある条件 6/6問一致、文字のみの条件 3/6問一致\n・順番を覚えて届ける課題（第1回・形A・v1.0・11月10日・学校タブレット）：2〜3軒まで全問一致\n\n────────────────────────\n【医師の記入欄】\n\n\n\n`,
    };
  }

  if (mode === 'bridge') {
    return {
      message:
        '本人の声・ゲームの条件差・学校と家庭の記録の4つを並べました。視覚的な見本と好きな恐竜を組み合わせる小さな工夫が試せそうです。',
      new_observations: [],
      unassigned: [],
      class_level: [],
      new_hypotheses: [
        {
          temp_id: 'new_H1',
          text: '黒板からの視線移動や口頭のみの手順を減らし、手元に「絵つき見本」を1ステップずつ置くと見通しをもって取り組みやすい場面があるようです。',
          evidence_existing_ids: ['O-001', 'O-002', 'O-003', 'O-005'],
          evidence_new_temp_ids: [],
          evidence_sides: ['child', 'game', 'school', 'home'],
          why: '本人の「黒板を写す間に進む」という声（O-001）と、ゲームでの絵つき条件の取り組みやすさ（O-002）、学校の見本カード（O-003）、家庭の恐竜図鑑（O-005）が一致しているため。',
        },
      ],
      differences: [
        {
          items: [
            {
              side: 'school',
              fact: '口頭の一斉説明では書き始める前に手が止まりやすい（O-004）',
            },
            {
              side: 'home',
              fact: 'イラスト図解つきの恐竜図鑑では30分以上集中して調べる（O-005）',
            },
          ],
          evidence_existing_ids: ['O-004', 'O-005'],
          evidence_new_temp_ids: [],
          note: '耳からの情報だけか、手元に好きなテーマの視覚図解があるかの条件の違いが見られます。',
        },
      ],
      suggested_trials: [
        {
          where: viewerRole === 'teacher' ? 'school' : 'home',
          text:
            viewerRole === 'teacher'
              ? '板書をすべて写す代わりに、恐竜イラスト入りの図解・穴埋めミニカードを手元に置く'
              : '宿題の手順を「1・2」の恐竜イラストつきミニふせんで机に並べる',
          based_on_existing_ids: ['O-001', 'O-002', 'O-003', 'O-005'],
          based_on_new_temp_ids: [],
          why: '絵の手がかり（O-002, O-003）と家庭で見つかった大好きな恐竜（O-005）を組み合わせ、板書の負担（O-001）を減らすため。',
          adjusts_trial_id: null,
        },
      ],
      concerns: [
        {
          fact: '本人が「こくばんの もじを かくこと」について大変さを伝えています。先生に相談することや、相談先を調べることもできます。相談するのに診断名は必要ありません。',
          evidence_existing_ids: ['O-001'],
          evidence_new_temp_ids: [],
        },
      ],
      memo: null,
    };
  }

  return {
    message:
      '日々の丁寧な記録をありがとうございます。場面とうまくいった条件を事実として整理しました。',
    new_observations: newInput.trim()
      ? [
          {
            temp_id: 'new_O1',
            side: viewerRole === 'teacher' ? 'school' : 'home',
            category: 'worked_well',
            fact: newInput.trim().slice(0, 200),
            suggest_share: true,
            candidate_student: null,
          },
        ]
      : [],
    unassigned: [],
    class_level: [],
    new_hypotheses: [
      {
        temp_id: 'new_H1',
        text: '手元に視覚的な見本カードがあると、安心して最初の一歩を踏み出しやすい場面があるようです。',
        evidence_existing_ids: ['O-001', 'O-002'],
        evidence_new_temp_ids: newInput.trim() ? ['new_O1'] : [],
        evidence_sides: ['child', 'game', viewerRole === 'teacher' ? 'school' : 'home'],
        why: '本人の声とゲームの絵つき条件の結果と重なるため。',
      },
    ],
    differences: [],
    suggested_trials: [
      {
        where: viewerRole === 'teacher' ? 'school' : 'home',
        text: '1ステップずつの見本カードを手元に置いて取り組む',
        based_on_existing_ids: ['O-001', 'O-002'],
        based_on_new_temp_ids: newInput.trim() ? ['new_O1'] : [],
        why: '見通しを助け、負担を減らすため。',
        adjusts_trial_id: null,
      },
    ],
    concerns: [],
    memo: null,
  };
}
