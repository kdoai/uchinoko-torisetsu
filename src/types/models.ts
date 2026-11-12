export type AdultRole = 'school_admin' | 'safety_officer' | 'teacher' | 'parent';
export type GradeBand = 'low' | 'middle' | 'high';
export type ObservationSide = 'game' | 'child' | 'school' | 'home';
export type ObservationCategory = 'strength' | 'worked_well' | 'hard' | 'child_said' | 'other';
export type ShareStatus = 'not_shared' | 'shared' | 'stopped';
export type ChildVisibility = 'teacher' | 'parent' | 'both' | 'none';
export type SafetyTier = 'none' | 'primary' | 'deputy' | 'manager';

export interface UserAccountDoc {
  uid: string;
  role: AdultRole;
  schoolId: string;
  isHomeOnly: boolean;
  homeSafetyConfirmed: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SchoolDoc {
  schoolId: string;
  adminUid: string;
  schoolCodeLabel: string;
  academicYear: string;
  retentionMonths: number;
  checkBoardApproved: boolean;
  checkParentConsent: boolean;
  checkChildExplain: boolean;
  checkSpecialistDocs: boolean;
  checkSafetyWorkflow: boolean;
  allPreChecksDone: boolean;
  directorySupervisor: string;
  directoryVersion: string;
  safetySupervisor: string;
  safetyVersion: string;
  primaryOfficerLabel: string;
  deputyOfficerLabel: string;
  managerOfficerLabel: string;
  escalateToDeputyMinutes: number;
  escalateToManagerMinutes: number;
  offHoursRule: string;
  invitesIssuedCount: number;
  linkedHouseholdsCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SchoolClassDoc {
  classId: string;
  schoolId: string;
  adminUid: string;
  className: string;
  grade: number;
  gradeBand: GradeBand;
  academicYear: string;
  teacherUid: string;
  studentIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffMembershipDoc {
  uid: string;
  schoolId: string;
  adminUid: string;
  staffRole: 'teacher' | 'safety_officer';
  classId: string;
  safetyTier: SafetyTier;
  displayLabel: string;
  redeemedInviteCode: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffInviteDoc {
  inviteCode: string;
  schoolId: string;
  adminUid: string;
  targetRole: 'teacher' | 'safety_officer';
  classId: string;
  safetyTier: SafetyTier;
  roleTitleLabel: string;
  status: 'active' | 'used' | 'revoked';
  usedByUid: string;
  expiresAt: { toMillis?: () => number; seconds?: number };
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentDoc {
  studentId: string;
  schoolId: string;
  adminUid: string;
  classId: string;
  parentUid: string;
  attendanceNumber: number;
  nickname: string;
  grade: number;
  gradeBand: GradeBand;
  isHomeOnly: boolean;
  participationOptOut?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentRecordIndexDoc {
  studentId: string;
  schoolId: string;
  classId: string;
  gameSessionIds: string[];
  childAnswerBothIds: string[];
  childAnswerTeacherIds: string[];
  childAnswerParentIds: string[];
  schoolObsOwnIds: string[];
  homeObsOwnIds: string[];
  sharedObsIds: string[];
  gameChildObsBothIds: string[];
  childObsTeacherIds: string[];
  childObsParentIds: string[];
  sharingRequestIds: string[];
  schoolHypIds: string[];
  homeHypIds: string[];
  sharedHypIds: string[];
  schoolTrialIds: string[];
  homeTrialIds: string[];
  sharedTrialIds: string[];
  consultationIds: string[];
  nextFormalSeq: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentInviteDoc {
  inviteCode: string;
  studentId: string;
  schoolId: string;
  classId: string;
  adminUid: string;
  grade: number;
  status: 'active' | 'pending_approval' | 'approved' | 'revoked';
  requestedByParentUid: string;
  expiresAt: { toMillis?: () => number; seconds?: number };
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ParentLinkRequestDoc {
  requestId: string;
  inviteCode: string;
  studentId: string;
  schoolId: string;
  classId: string;
  adminUid: string;
  parentUid: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GameItemRecord {
  questionId: string;
  condition: 'illust' | 'text' | 'seq_2' | 'seq_3' | 'seq_4' | 'seq_5';
  correct: boolean;
  errorType: string;
  seconds: number;
  usedHint: boolean;
  retried: boolean;
}

export interface GameSessionDoc {
  sessionId: string;
  studentId: string;
  schoolId: string;
  classId: string;
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
  dateLabel: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChildAnswerDoc {
  answerId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  questionType: 'base' | 'interlude' | 'talk_trouble';
  questionId: string;
  questionText: string;
  choices: string[];
  freeText: string;
  followupTranscript: string;
  visibility: ChildVisibility;
  isDistressSignal: boolean;
  factSentence: string;
  dateLabel: string;
  place: 'school' | 'home';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ObservationDoc {
  observationId: string;
  formalId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  side: ObservationSide;
  category: ObservationCategory;
  fact: string;
  shareStatus: ShareStatus;
  visibleTo: 'both' | 'teacher' | 'parent' | 'none';
  pendingRequestId: string;
  correctsObservationId: string;
  dateLabel: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SharingRequestDoc {
  requestId: string;
  observationId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  fromSide: 'school' | 'home';
  toSide: 'school' | 'home';
  category: ObservationCategory;
  previewText: string;
  purposeText: string;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  replyChoice: string;
  replySupplement: string;
  dateLabel: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HypothesisDoc {
  hypothesisId: string;
  formalId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  createdBySide: 'school' | 'home';
  shareStatus: ShareStatus;
  text: string;
  why: string;
  evidenceIds: string[];
  evidenceSides: ObservationSide[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrialDoc {
  trialId: string;
  formalId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  where: 'school' | 'home';
  shareStatus: ShareStatus;
  whatToChange: string;
  why: string;
  basedOnIds: string[];
  adjustsTrialId: string;
  adultResult: 'unrecorded' | 'helpful' | 'depends' | 'not_fit';
  childBurden: 'unrecorded' | 'easier' | 'same' | 'harder';
  continuedStatus: 'unrecorded' | 'continued' | 'stopped' | 'sometimes';
  childFeedback: 'unrecorded' | 'good' | 'normal' | 'disliked';
  childFeedbackNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ConsultationDoc {
  consultationId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  selectedRecordSummaries: string[];
  messageBody: string;
  teacherReply: string;
  status: 'sent' | 'replied';
  dateLabel: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SafetyReportDoc {
  reportId: string;
  schoolId: string;
  classId: string;
  studentId: string;
  studentNickname: string;
  place: 'school' | 'home';
  triggerSource: 'talk_button_scary' | 'keyword_detected' | 'gemini_safety_review';
  childWords: string;
  createdAtMs: number;
  primaryDeadlineMs: number;
  deputyDeadlineMs: number;
  status: 'unconfirmed' | 'opened' | 'responded';
  hasOpened: boolean;
  openedAtMs: number;
  confirmedByUid: string;
  confirmedByLabel: string;
  actionsTaken: string[];
  actionNote: string;
  hasActed: boolean;
  actedAtMs: number;
  teacherNoticeId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeacherSafetyNoticeDoc {
  noticeId: string;
  schoolId: string;
  classId: string;
  status: 'checking' | 'resolved';
  officerSharedNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ParentFollowupDoc {
  followupId: string;
  parentUid: string;
  studentId: string;
  currentSituation:
    | 'consulted_teacher'
    | 'consulted_specialist'
    | 'planning_to_consult'
    | 'trying_at_school'
    | 'thinking';
  memoHelpful: 'none' | 'helpful' | 'somewhat' | 'not_used';
  consentForImprovement: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AccessLogDoc {
  logId: string;
  schoolId: string;
  adminUid: string;
  actorUid: string;
  actorRole: AdultRole;
  actionLabel: string;
  studentIdRef: string;
  createdAt?: { toMillis?: () => number; seconds?: number };
}

export interface AuthorizedStudentBundle {
  student: StudentDoc;
  index: StudentRecordIndexDoc;
  gameSessions: GameSessionDoc[];
  childAnswers: ChildAnswerDoc[];
  observations: ObservationDoc[];
  sharingRequests: SharingRequestDoc[];
  hypotheses: HypothesisDoc[];
  trials: TrialDoc[];
  consultations: ConsultationDoc[];
}

export interface ActiveChildModeLock {
  studentId: string;
  nickname: string;
  schoolId: string;
  classId: string;
  grade: number;
  gradeBand: GradeBand;
  place: 'school' | 'home';
  deviceType: 'tablet' | 'smartphone' | 'pc';
  pinHash: string;
  /** True when launched directly by the student on a 1-per-student school tablet/PC */
  isSchoolDeviceSession?: boolean;
  /** Ephemeral capability ticket ID for 1-per-student device writes (zero raw Google UID) */
  playTicketId?: string;
  /** True when parent chose "参加しない" — plays identical content, records zero data */
  participationOptOut?: boolean;
}

export interface ClassroomSessionDoc {
  classId: string;
  schoolId: string;
  adminUid: string;
  teacherUid: string;
  className: string;
  classJoinCode: string;
  isOpen: boolean;
  allowTakeHome: boolean;
  connectedCount: number;
  openedAt: { toMillis?: () => number; seconds?: number };
  expiresAt: { toMillis?: () => number; seconds?: number };
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClassroomJoinCodeDoc {
  classJoinCode: string;
  classId: string;
  schoolId: string;
  teacherUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClassroomRosterEntry {
  attendanceNumber: number;
  studentId: string;
  grade: number;
  gradeBand: GradeBand;
  participationOptOut: boolean;
}

export interface ClassroomRosterDoc {
  classId: string;
  schoolId: string;
  teacherUid: string;
  entries: ClassroomRosterEntry[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Irreversible SHA-256 pseudonymous binding for school Google accounts.
 * NEVER stores raw Google UID or email address!
 */
export interface SchoolPseudoBindingDoc {
  pseudoHash: string;
  schoolId: string;
  classId: string;
  studentId: string;
  attendanceNumber: number;
  grade: number;
  gradeBand: GradeBand;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Nameless printable QR card record (hashed secret token, zero real name).
 */
export interface StudentQrCardDoc {
  qrTokenHash: string;
  cardCodeHint: string;
  schoolId: string;
  adminUid: string;
  teacherUid: string;
  classId: string;
  className: string;
  studentId: string;
  attendanceNumber: number;
  grade: number;
  gradeBand: GradeBand;
  participationOptOut: boolean;
  status: 'active' | 'revoked';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentPlayTicketDoc {
  ticketId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  mode: 'classroom' | 'take_home';
  authProofHash: string;
  authMethod: 'pseudo' | 'qr';
  expiresAt: { toMillis?: () => number; seconds?: number };
  createdAt?: unknown;
}

export interface StudentRewardDoc {
  studentId: string;
  schoolId: string;
  classId: string;
  coins: number;
  totalSpins: number;
  unlockedItemIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

