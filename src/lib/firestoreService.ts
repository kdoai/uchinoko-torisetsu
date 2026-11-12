import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { formatJapaneseDateLabel } from './factFormatter';
import type {
  AccessLogDoc,
  ActiveChildModeLock,
  AdultRole,
  AuthorizedStudentBundle,
  ChildAnswerDoc,
  ChildVisibility,
  ClassroomJoinCodeDoc,
  ClassroomRosterDoc,
  ClassroomRosterEntry,
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
  SafetyTier,
  SchoolClassDoc,
  SchoolDoc,
  SchoolPseudoBindingDoc,
  ShareStatus,
  SharingRequestDoc,
  StaffInviteDoc,
  StaffMembershipDoc,
  StudentDoc,
  StudentInviteDoc,
  StudentQrCardDoc,
  StudentRecordIndexDoc,
  StudentRewardDoc,
  TeacherSafetyNoticeDoc,
  TrialDoc,
  UserAccountDoc,
} from '../types/models';
import type { GeminiAResponse, GeminiBResponse } from '../shared/safetyAndGuardrails';
import {
  buildDemoGeminiAFallback,
  buildDemoGeminiBFallback,
  demoCloseClassroomSession,
  demoConfirmAndSaveProposals,
  demoLoadAuthorizedStudentBundle,
  demoLoadParentWorkspace,
  demoLoadSafetyOfficerWorkspace,
  demoLoadStudentRewards,
  demoLoadTeacherWorkspace,
  demoMarkSafetyOpened,
  demoOpenClassroomSession,
  demoRecordSafetyResponse,
  demoReplyToConsultation,
  demoSaveChildAnswer,
  demoSaveChildTrialFeedback,
  demoSaveGameSession,
  demoSaveStudentRewards,
  demoSendParentConsultation,
  demoShareSafetyWithHomeroom,
  demoSubmitSafetyReport,
  demoSubscribeClassroomSession,
  isDemoId,
} from './demoSandboxStore';

const SAFE_ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID_ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomChars(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function generateDocId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomChars(ID_ALNUM, 8)}`;
}

export function generatePlayTicketId(): string {
  return `tkt_${Date.now().toString(36)}_${randomChars(ID_ALNUM, 14)}`;
}

export function generateClassJoinCode(): string {
  return `CLS_${randomChars(SAFE_ALNUM, 6)}`;
}

export function generateStudentQrSecret(): string {
  return `SQR_${randomChars(SAFE_ALNUM, 24)}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derives an irreversible SHA-256 pseudonymous hash for a school Google account.
 * NEVER stores or transmits raw Google UID or email address!
 */
export async function deriveSchoolPseudoHash(classId: string, googleUid: string): Promise<string> {
  return sha256Hex(`uchinoko_pseudo_v2:${classId.trim()}:${googleUid.trim()}`);
}

/**
 * Derives an irreversible SHA-256 hash for a nameless printable QR secret token.
 */
export async function deriveQrTokenHash(rawQrToken: string): Promise<string> {
  return sha256Hex(`uchinoko_qr_v2:${rawQrToken.trim().toUpperCase()}`);
}

export function generateInviteCode(prefix: 'STF' | 'FAM'): string {
  return `${prefix}_${randomChars(SAFE_ALNUM, 12)}`;
}

export function gradeToBand(grade: number): GradeBand {
  if (grade <= 2) return 'low';
  if (grade <= 4) return 'middle';
  return 'high';
}

export function formatFormalId(prefix: 'O' | 'H' | 'T', seq: number): string {
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function emptyIndexPayload(studentId: string, schoolId: string, classId: string) {
  return {
    studentId,
    schoolId,
    classId,
    gameSessionIds: [] as string[],
    childAnswerBothIds: [] as string[],
    childAnswerTeacherIds: [] as string[],
    childAnswerParentIds: [] as string[],
    schoolObsOwnIds: [] as string[],
    homeObsOwnIds: [] as string[],
    sharedObsIds: [] as string[],
    gameChildObsBothIds: [] as string[],
    childObsTeacherIds: [] as string[],
    childObsParentIds: [] as string[],
    sharingRequestIds: [] as string[],
    schoolHypIds: [] as string[],
    homeHypIds: [] as string[],
    sharedHypIds: [] as string[],
    schoolTrialIds: [] as string[],
    homeTrialIds: [] as string[],
    sharedTrialIds: [] as string[],
    consultationIds: [] as string[],
    nextFormalSeq: 1,
  };
}

// ============================================================================
// Audit Access Logging (Content-Free: Who, When, Which Action)
// ============================================================================
export async function writeAccessLog(params: {
  schoolId: string;
  adminUid: string;
  actorUid: string;
  actorRole: AdultRole;
  actionLabel: string;
  studentIdRef?: string;
}): Promise<void> {
  if (!params.actorUid) return;
  const logId = generateDocId('log');
  try {
    await setDoc(doc(db, 'access_logs', logId), {
      logId,
      schoolId: params.schoolId || '',
      adminUid: params.adminUid || '',
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      actionLabel: params.actionLabel.slice(0, 120),
      studentIdRef: params.studentIdRef || '',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Do not block primary user workflow on non-critical audit log write
    console.warn('Access log write warning:', err);
  }
}

// ============================================================================
// User Profile & Initial Role Onboarding
// ============================================================================
export async function loadUserProfile(uid: string): Promise<UserAccountDoc | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserAccountDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function registerSchoolAdminAccount(params: {
  uid: string;
  schoolCodeLabel: string;
  academicYear: string;
  retentionMonths: number;
  primaryOfficerLabel: string;
  deputyOfficerLabel: string;
  managerOfficerLabel: string;
}): Promise<{ user: UserAccountDoc; school: SchoolDoc }> {
  const schoolId = generateDocId('sch');
  const batch = writeBatch(db);

  const userDoc = {
    uid: params.uid,
    role: 'school_admin' as const,
    schoolId,
    isHomeOnly: false,
    homeSafetyConfirmed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const schoolDoc = {
    schoolId,
    adminUid: params.uid,
    schoolCodeLabel: params.schoolCodeLabel.trim().slice(0, 100) || '導入校',
    academicYear: params.academicYear.trim().slice(0, 16) || `${new Date().getFullYear()}年度`,
    retentionMonths: Math.min(120, Math.max(1, Math.round(params.retentionMonths || 12))),
    checkBoardApproved: false,
    checkParentConsent: false,
    checkChildExplain: false,
    checkSpecialistDocs: false,
    checkSafetyWorkflow: false,
    allPreChecksDone: false,
    directorySupervisor: '小児科医・公認心理師・特別支援教育有識者 確認欄（利用開始前に記入）',
    directoryVersion: 'v1.0',
    safetySupervisor: '児童福祉・学校危機管理・教育相談専門職 確認欄（利用開始前に記入）',
    safetyVersion: 'v1.0',
    primaryOfficerLabel: params.primaryOfficerLabel.trim().slice(0, 80) || '養護教諭（主担当）',
    deputyOfficerLabel: params.deputyOfficerLabel.trim().slice(0, 80) || '生徒指導担当・教育相談担当（副担当）',
    managerOfficerLabel: params.managerOfficerLabel.trim().slice(0, 80) || '教頭・校長（管理職）',
    escalateToDeputyMinutes: 30,
    escalateToManagerMinutes: 90,
    offHoursRule:
      '夜間・休日は緊急連絡先（119・110・189・24時間子供SOSダイヤル 0120-0-78310）を画面に案内し、翌登校日の始業前に管理職と安全担当が最優先で確認する。',
    invitesIssuedCount: 0,
    linkedHouseholdsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(doc(db, 'users', params.uid), userDoc);
  batch.set(doc(db, 'schools', schoolId), schoolDoc);
  batch.set(doc(db, 'school_safety_queues', schoolId), {
    schoolId,
    reportIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return {
      user: userDoc as unknown as UserAccountDoc,
      school: schoolDoc as unknown as SchoolDoc,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `schools/${schoolId}`);
  }
}

export async function redeemStaffInviteCode(params: {
  uid: string;
  inviteCode: string;
  displayLabel: string;
}): Promise<UserAccountDoc> {
  const cleanCode = params.inviteCode.trim();
  const invRef = doc(db, 'staff_invites', cleanCode);
  let invSnap;
  try {
    invSnap = await getDoc(invRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `staff_invites/${cleanCode}`);
  }

  if (!invSnap.exists()) {
    throw new Error('招待コードが見つかりません。学校管理者に確認してください。');
  }
  const invite = invSnap.data() as StaffInviteDoc;
  if (invite.status !== 'active') {
    throw new Error('この招待コードはすでに使用済み、または無効化されています。');
  }
  const expMs = invite.expiresAt?.toMillis ? invite.expiresAt.toMillis() : 0;
  if (expMs > 0 && expMs <= Date.now()) {
    throw new Error('この招待コードの有効期限が切れています。再発行を依頼してください。');
  }

  const batch = writeBatch(db);
  const userDoc = {
    uid: params.uid,
    role: invite.targetRole,
    schoolId: invite.schoolId,
    isHomeOnly: false,
    homeSafetyConfirmed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const membershipDoc = {
    uid: params.uid,
    schoolId: invite.schoolId,
    adminUid: invite.adminUid,
    staffRole: invite.targetRole,
    classId: invite.classId || '',
    safetyTier: invite.safetyTier,
    displayLabel: (params.displayLabel.trim() || invite.roleTitleLabel).slice(0, 60),
    redeemedInviteCode: cleanCode,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(doc(db, 'users', params.uid), userDoc);
  batch.set(doc(db, 'staff_memberships', params.uid), membershipDoc);
  batch.update(invRef, {
    status: 'used',
    usedByUid: params.uid,
    updatedAt: serverTimestamp(),
  });

  if (invite.targetRole === 'teacher' && invite.classId) {
    batch.update(doc(db, 'classes', invite.classId), {
      teacherUid: params.uid,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    await writeAccessLog({
      schoolId: invite.schoolId,
      adminUid: invite.adminUid,
      actorUid: params.uid,
      actorRole: invite.targetRole,
      actionLabel:
        invite.targetRole === 'teacher'
          ? '担任アカウントの招待コード登録'
          : '安全対応担当者アカウントの招待コード登録',
    });
    return userDoc as unknown as UserAccountDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `staff_memberships/${params.uid}`);
  }
}

export async function requestParentSchoolLink(params: {
  uid: string;
  inviteCode: string;
  existingUser: UserAccountDoc | null;
}): Promise<{ user: UserAccountDoc; request: ParentLinkRequestDoc }> {
  const cleanCode = params.inviteCode.trim();
  const invRef = doc(db, 'student_invites', cleanCode);
  let invSnap;
  try {
    invSnap = await getDoc(invRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `student_invites/${cleanCode}`);
  }

  if (!invSnap.exists()) {
    throw new Error('招待コードが見つかりません。学校から配られた案内用紙のコードをご確認ください。');
  }
  const invite = invSnap.data() as StudentInviteDoc;
  if (invite.status !== 'active') {
    throw new Error('この招待コードはすでに申請中または使用済みです。学校へお問い合わせください。');
  }
  const expMs = invite.expiresAt?.toMillis ? invite.expiresAt.toMillis() : 0;
  if (expMs > 0 && expMs <= Date.now()) {
    throw new Error('この招待コードは有効期限が切れています。学校で再発行を依頼してください。');
  }

  const requestId = generateDocId('plr');
  const batch = writeBatch(db);

  let nextUser: UserAccountDoc;
  if (!params.existingUser) {
    const userPayload = {
      uid: params.uid,
      role: 'parent' as const,
      schoolId: invite.schoolId,
      isHomeOnly: false,
      homeSafetyConfirmed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(doc(db, 'users', params.uid), userPayload);
    nextUser = userPayload as unknown as UserAccountDoc;
  } else {
    batch.update(doc(db, 'users', params.uid), {
      schoolId: invite.schoolId,
      isHomeOnly: false,
      updatedAt: serverTimestamp(),
    });
    nextUser = {
      ...params.existingUser,
      schoolId: invite.schoolId,
      isHomeOnly: false,
    };
  }

  const reqPayload = {
    requestId,
    inviteCode: cleanCode,
    studentId: invite.studentId,
    schoolId: invite.schoolId,
    classId: invite.classId,
    adminUid: invite.adminUid,
    parentUid: params.uid,
    status: 'pending' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(doc(db, 'parent_link_requests', requestId), reqPayload);
  batch.update(invRef, {
    status: 'pending_approval',
    requestedByParentUid: params.uid,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    await writeAccessLog({
      schoolId: invite.schoolId,
      adminUid: invite.adminUid,
      actorUid: params.uid,
      actorRole: 'parent',
      actionLabel: '保護者アカウントの紐付け申請',
      studentIdRef: invite.studentId,
    });
    return {
      user: nextUser,
      request: reqPayload as unknown as ParentLinkRequestDoc,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `parent_link_requests/${requestId}`);
  }
}

export async function registerHomeOnlyParentAccount(params: {
  uid: string;
  nickname: string;
  grade: number;
}): Promise<{ user: UserAccountDoc; student: StudentDoc }> {
  const studentId = generateDocId('stu');
  const cleanGrade = Math.min(6, Math.max(1, Math.round(params.grade)));
  const band = gradeToBand(cleanGrade);
  const batch = writeBatch(db);

  const userPayload = {
    uid: params.uid,
    role: 'parent' as const,
    schoolId: '',
    isHomeOnly: true,
    homeSafetyConfirmed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const studentPayload = {
    studentId,
    schoolId: '',
    adminUid: '',
    classId: '',
    parentUid: params.uid,
    attendanceNumber: 1,
    nickname: params.nickname.trim().slice(0, 40) || 'お子さん',
    grade: cleanGrade,
    gradeBand: band,
    isHomeOnly: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(doc(db, 'users', params.uid), userPayload);
  batch.set(doc(db, 'students', studentId), studentPayload);
  batch.set(doc(db, 'student_record_indexes', studentId), {
    ...emptyIndexPayload(studentId, '', ''),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return {
      user: userPayload as unknown as UserAccountDoc,
      student: studentPayload as unknown as StudentDoc,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${studentId}`);
  }
}

// ============================================================================
// School Admin Operations (Chapter 14 — Strictly Metadata & Counts Only)
// ============================================================================
export interface SchoolAdminBundle {
  school: SchoolDoc;
  classes: SchoolClassDoc[];
  staffInvites: StaffInviteDoc[];
  staffMemberships: StaffMembershipDoc[];
  students: StudentDoc[];
  studentInvites: StudentInviteDoc[];
  parentLinkRequests: ParentLinkRequestDoc[];
  accessLogs: AccessLogDoc[];
}

export async function loadSchoolAdminBundle(
  adminUid: string,
  schoolId: string
): Promise<SchoolAdminBundle> {
  try {
    const [
      schoolSnap,
      classesSnap,
      staffInvSnap,
      staffMemSnap,
      studentsSnap,
      stuInvSnap,
      linkReqSnap,
      logsSnap,
    ] = await Promise.all([
      getDoc(doc(db, 'schools', schoolId)),
      getDocs(query(collection(db, 'classes'), where('adminUid', '==', adminUid))),
      getDocs(query(collection(db, 'staff_invites'), where('adminUid', '==', adminUid))),
      getDocs(query(collection(db, 'staff_memberships'), where('adminUid', '==', adminUid))),
      getDocs(query(collection(db, 'students'), where('adminUid', '==', adminUid))),
      getDocs(query(collection(db, 'student_invites'), where('adminUid', '==', adminUid))),
      getDocs(query(collection(db, 'parent_link_requests'), where('adminUid', '==', adminUid))),
      getDocs(query(collection(db, 'access_logs'), where('adminUid', '==', adminUid))),
    ]);

    if (!schoolSnap.exists()) {
      throw new Error('学校設定が見つかりませんでした。');
    }

    const logs = logsSnap.docs
      .map((d) => d.data() as AccessLogDoc)
      .sort((a, b) => {
        const ta = a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? 0;
        return tb - ta;
      });

    return {
      school: schoolSnap.data() as SchoolDoc,
      classes: classesSnap.docs.map((d) => d.data() as SchoolClassDoc),
      staffInvites: staffInvSnap.docs.map((d) => d.data() as StaffInviteDoc),
      staffMemberships: staffMemSnap.docs.map((d) => d.data() as StaffMembershipDoc),
      students: studentsSnap.docs
        .map((d) => d.data() as StudentDoc)
        .sort((a, b) => a.attendanceNumber - b.attendanceNumber),
      studentInvites: stuInvSnap.docs.map((d) => d.data() as StudentInviteDoc),
      parentLinkRequests: linkReqSnap.docs.map((d) => d.data() as ParentLinkRequestDoc),
      accessLogs: logs,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `schools/${schoolId}`);
  }
}

export async function updateSchoolSettings(
  current: SchoolDoc,
  patch: Partial<
    Pick<
      SchoolDoc,
      | 'schoolCodeLabel'
      | 'academicYear'
      | 'retentionMonths'
      | 'checkBoardApproved'
      | 'checkParentConsent'
      | 'checkChildExplain'
      | 'checkSpecialistDocs'
      | 'checkSafetyWorkflow'
      | 'directorySupervisor'
      | 'directoryVersion'
      | 'safetySupervisor'
      | 'safetyVersion'
      | 'primaryOfficerLabel'
      | 'deputyOfficerLabel'
      | 'managerOfficerLabel'
      | 'escalateToDeputyMinutes'
      | 'escalateToManagerMinutes'
      | 'offHoursRule'
    >
  >
): Promise<void> {
  const merged = { ...current, ...patch };
  const allPreChecksDone = Boolean(
    merged.checkBoardApproved &&
      merged.checkParentConsent &&
      merged.checkChildExplain &&
      merged.checkSpecialistDocs &&
      merged.checkSafetyWorkflow
  );

  try {
    await updateDoc(doc(db, 'schools', current.schoolId), {
      schoolCodeLabel: merged.schoolCodeLabel.trim().slice(0, 100),
      academicYear: merged.academicYear.trim().slice(0, 16),
      retentionMonths: Math.min(120, Math.max(1, Math.round(merged.retentionMonths))),
      checkBoardApproved: merged.checkBoardApproved,
      checkParentConsent: merged.checkParentConsent,
      checkChildExplain: merged.checkChildExplain,
      checkSpecialistDocs: merged.checkSpecialistDocs,
      checkSafetyWorkflow: merged.checkSafetyWorkflow,
      allPreChecksDone,
      directorySupervisor: merged.directorySupervisor.slice(0, 120),
      directoryVersion: merged.directoryVersion.slice(0, 32),
      safetySupervisor: merged.safetySupervisor.slice(0, 120),
      safetyVersion: merged.safetyVersion.slice(0, 32),
      primaryOfficerLabel: merged.primaryOfficerLabel.slice(0, 80),
      deputyOfficerLabel: merged.deputyOfficerLabel.slice(0, 80),
      managerOfficerLabel: merged.managerOfficerLabel.slice(0, 80),
      escalateToDeputyMinutes: Math.min(1440, Math.max(1, Math.round(merged.escalateToDeputyMinutes))),
      escalateToManagerMinutes: Math.min(
        2880,
        Math.max(
          Math.round(merged.escalateToDeputyMinutes) + 1,
          Math.round(merged.escalateToManagerMinutes)
        )
      ),
      offHoursRule: merged.offHoursRule.slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `schools/${current.schoolId}`);
  }
}

export async function createSchoolClass(params: {
  schoolId: string;
  adminUid: string;
  className: string;
  grade: number;
  academicYear: string;
}): Promise<SchoolClassDoc> {
  const classId = generateDocId('cls');
  const grade = Math.min(6, Math.max(1, Math.round(params.grade)));
  const payload = {
    classId,
    schoolId: params.schoolId,
    adminUid: params.adminUid,
    className: params.className.trim().slice(0, 60),
    grade,
    gradeBand: gradeToBand(grade),
    academicYear: params.academicYear.trim().slice(0, 16),
    teacherUid: '',
    studentIds: [] as string[],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'classes', classId), payload);
    return payload as unknown as SchoolClassDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `classes/${classId}`);
  }
}

export async function issueStaffInvite(params: {
  schoolId: string;
  adminUid: string;
  targetRole: 'teacher' | 'safety_officer';
  classId: string;
  safetyTier: SafetyTier;
  roleTitleLabel: string;
  validDays?: number;
}): Promise<StaffInviteDoc> {
  const inviteCode = generateInviteCode('STF');
  const expiresAt = Timestamp.fromMillis(
    Date.now() + (params.validDays || 14) * 24 * 60 * 60 * 1000
  );
  const payload = {
    inviteCode,
    schoolId: params.schoolId,
    adminUid: params.adminUid,
    targetRole: params.targetRole,
    classId: params.targetRole === 'teacher' ? params.classId : '',
    safetyTier: params.targetRole === 'safety_officer' ? params.safetyTier : 'none',
    roleTitleLabel: params.roleTitleLabel.trim().slice(0, 60) || '担当教職員',
    status: 'active' as const,
    usedByUid: '',
    expiresAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'staff_invites', inviteCode), payload);
    return payload as unknown as StaffInviteDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `staff_invites/${inviteCode}`);
  }
}

export async function revokeStaffInvite(inviteCode: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'staff_invites', inviteCode), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `staff_invites/${inviteCode}`);
  }
}

export async function updateStaffMembershipByAdmin(params: {
  member: StaffMembershipDoc;
  classId: string;
  safetyTier: SafetyTier;
  displayLabel: string;
  active: boolean;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'staff_memberships', params.member.uid), {
    classId: params.classId,
    safetyTier: params.safetyTier,
    displayLabel: params.displayLabel.trim().slice(0, 60),
    active: params.active,
    updatedAt: serverTimestamp(),
  });

  if (params.member.staffRole === 'teacher') {
    if (params.member.classId && params.member.classId !== params.classId) {
      batch.update(doc(db, 'classes', params.member.classId), {
        teacherUid: '',
        updatedAt: serverTimestamp(),
      });
    }
    if (params.classId && params.active) {
      batch.update(doc(db, 'classes', params.classId), {
        teacherUid: params.member.uid,
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `staff_memberships/${params.member.uid}`);
  }
}

export async function registerSchoolStudentsBatch(params: {
  school: SchoolDoc;
  targetClass: SchoolClassDoc;
  entries: Array<{ attendanceNumber: number; nickname: string }>;
}): Promise<void> {
  if (!params.school.allPreChecksDone) {
    throw new Error('利用開始前の確認5項目がすべて完了してから児童登録を行ってください。');
  }
  if (params.entries.length === 0) return;

  const batch = writeBatch(db);
  const newIds: string[] = [];

  for (const entry of params.entries) {
    const studentId = generateDocId('stu');
    newIds.push(studentId);
    const num = Math.min(99, Math.max(1, Math.round(entry.attendanceNumber)));
    batch.set(doc(db, 'students', studentId), {
      studentId,
      schoolId: params.school.schoolId,
      adminUid: params.school.adminUid,
      classId: params.targetClass.classId,
      parentUid: '',
      attendanceNumber: num,
      nickname: entry.nickname.trim().slice(0, 40),
      grade: params.targetClass.grade,
      gradeBand: params.targetClass.gradeBand,
      isHomeOnly: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'student_record_indexes', studentId), {
      ...emptyIndexPayload(studentId, params.school.schoolId, params.targetClass.classId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  batch.update(doc(db, 'classes', params.targetClass.classId), {
    studentIds: uniqueStrings([...params.targetClass.studentIds, ...newIds]).slice(0, 60),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `classes/${params.targetClass.classId}`);
  }
}

export async function moveStudentClassByAdmin(params: {
  student: StudentDoc;
  oldClass?: SchoolClassDoc;
  newClass: SchoolClassDoc;
  newAttendanceNumber: number;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'students', params.student.studentId), {
    classId: params.newClass.classId,
    attendanceNumber: Math.min(99, Math.max(1, Math.round(params.newAttendanceNumber))),
    grade: params.newClass.grade,
    gradeBand: params.newClass.gradeBand,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'student_record_indexes', params.student.studentId), {
    classId: params.newClass.classId,
    updatedAt: serverTimestamp(),
  });
  if (params.oldClass && params.oldClass.classId !== params.newClass.classId) {
    batch.update(doc(db, 'classes', params.oldClass.classId), {
      studentIds: params.oldClass.studentIds.filter((id) => id !== params.student.studentId),
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, 'classes', params.newClass.classId), {
    studentIds: uniqueStrings([...params.newClass.studentIds, params.student.studentId]).slice(0, 60),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${params.student.studentId}`);
  }
}

export async function issueStudentParentInvite(params: {
  school: SchoolDoc;
  student: StudentDoc;
  validDays?: number;
}): Promise<StudentInviteDoc> {
  const inviteCode = generateInviteCode('FAM');
  const expiresAt = Timestamp.fromMillis(
    Date.now() + (params.validDays || 30) * 24 * 60 * 60 * 1000
  );
  const payload = {
    inviteCode,
    studentId: params.student.studentId,
    schoolId: params.school.schoolId,
    classId: params.student.classId,
    adminUid: params.school.adminUid,
    grade: params.student.grade,
    status: 'active' as const,
    requestedByParentUid: '',
    expiresAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'student_invites', inviteCode), payload);
  batch.update(doc(db, 'schools', params.school.schoolId), {
    invitesIssuedCount: params.school.invitesIssuedCount + 1,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return payload as unknown as StudentInviteDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `student_invites/${inviteCode}`);
  }
}

export async function respondToParentLinkRequestByAdmin(params: {
  school: SchoolDoc;
  request: ParentLinkRequestDoc;
  approve: boolean;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'parent_link_requests', params.request.requestId), {
    status: params.approve ? 'approved' : 'declined',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'student_invites', params.request.inviteCode), {
    status: params.approve ? 'approved' : 'revoked',
    updatedAt: serverTimestamp(),
  });

  if (params.approve) {
    batch.update(doc(db, 'students', params.request.studentId), {
      parentUid: params.request.parentUid,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'schools', params.school.schoolId), {
      linkedHouseholdsCount: params.school.linkedHouseholdsCount + 1,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    await writeAccessLog({
      schoolId: params.school.schoolId,
      adminUid: params.school.adminUid,
      actorUid: params.school.adminUid,
      actorRole: 'school_admin',
      actionLabel: params.approve ? '保護者紐付け申請の承認' : '保護者紐付け申請の却下',
      studentIdRef: params.request.studentId,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `parent_link_requests/${params.request.requestId}`);
  }
}

export async function deleteStudentRegistrationByAdmin(params: {
  student: StudentDoc;
  cls?: SchoolClassDoc;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'students', params.student.studentId));
  batch.delete(doc(db, 'student_record_indexes', params.student.studentId));
  if (params.cls) {
    batch.update(doc(db, 'classes', params.cls.classId), {
      studentIds: params.cls.studentIds.filter((id) => id !== params.student.studentId),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `students/${params.student.studentId}`);
  }
}

// ============================================================================
// Safety Officer Workspace (Chapter 12B — Strictly Isolated to safety_reports)
// ============================================================================
export interface SafetyOfficerWorkspaceBundle {
  membership: StaffMembershipDoc;
  school: SchoolDoc;
  reports: SafetyReportDoc[];
}

export async function loadSafetyOfficerWorkspace(
  officerUid: string
): Promise<SafetyOfficerWorkspaceBundle> {
  if (isDemoId(officerUid)) {
    return demoLoadSafetyOfficerWorkspace();
  }
  const memPath = `staff_memberships/${officerUid}`;
  try {
    const memSnap = await getDoc(doc(db, 'staff_memberships', officerUid));
    if (!memSnap.exists()) {
      throw new Error('安全対応担当者の登録情報が見つかりません。');
    }
    const membership = memSnap.data() as StaffMembershipDoc;
    const [schoolSnap, queueSnap] = await Promise.all([
      getDoc(doc(db, 'schools', membership.schoolId)),
      getDoc(doc(db, 'school_safety_queues', membership.schoolId)),
    ]);

    if (!schoolSnap.exists()) {
      throw new Error('学校情報が見つかりません。');
    }
    const school = schoolSnap.data() as SchoolDoc;
    const reportIds: string[] = queueSnap.exists()
      ? (queueSnap.data().reportIds as string[]) || []
      : [];

    const reportSnaps = await Promise.all(
      reportIds.map((rid) => getDoc(doc(db, 'safety_reports', rid)))
    );
    const reports = reportSnaps
      .filter((s) => s.exists())
      .map((s) => s.data() as SafetyReportDoc)
      .sort((a, b) => {
        // Pin unconfirmed/unacted reports at the very top, then newest first
        const aUnconfirmed = a.status === 'unconfirmed' ? 0 : a.status === 'opened' ? 1 : 2;
        const bUnconfirmed = b.status === 'unconfirmed' ? 0 : b.status === 'opened' ? 1 : 2;
        if (aUnconfirmed !== bUnconfirmed) return aUnconfirmed - bUnconfirmed;
        return b.createdAtMs - a.createdAtMs;
      });

    await writeAccessLog({
      schoolId: school.schoolId,
      adminUid: school.adminUid,
      actorUid: officerUid,
      actorRole: 'safety_officer',
      actionLabel: '安全対応一覧の確認',
    });

    return { membership, school, reports };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, memPath);
  }
}

export async function markSafetyReportOpened(params: {
  report: SafetyReportDoc;
  officerUid: string;
  officerLabel: string;
}): Promise<void> {
  if (isDemoId(params.officerUid) || isDemoId(params.report.schoolId)) {
    demoMarkSafetyOpened(params.report.reportId, params.officerUid, params.officerLabel);
    return;
  }
  if (params.report.hasOpened) return;
  try {
    await updateDoc(doc(db, 'safety_reports', params.report.reportId), {
      status: 'opened',
      hasOpened: true,
      openedAtMs: Date.now(),
      confirmedByUid: params.officerUid,
      confirmedByLabel: params.officerLabel.slice(0, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `safety_reports/${params.report.reportId}`);
  }
}

export async function recordSafetyReportResponse(params: {
  report: SafetyReportDoc;
  officerUid: string;
  officerLabel: string;
  actionsTaken: string[];
  actionNote: string;
}): Promise<void> {
  if (isDemoId(params.officerUid) || isDemoId(params.report.schoolId)) {
    demoRecordSafetyResponse({
      reportId: params.report.reportId,
      officerUid: params.officerUid,
      officerLabel: params.officerLabel,
      actionsTaken: params.actionsTaken,
      actionNote: params.actionNote,
    });
    return;
  }
  const now = Date.now();
  try {
    await updateDoc(doc(db, 'safety_reports', params.report.reportId), {
      status: 'responded',
      hasOpened: true,
      openedAtMs: params.report.hasOpened ? params.report.openedAtMs : now,
      confirmedByUid: params.officerUid,
      confirmedByLabel: params.officerLabel.slice(0, 80),
      actionsTaken: params.actionsTaken.slice(0, 15),
      actionNote: params.actionNote.slice(0, 2000),
      hasActed: true,
      actedAtMs: now,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `safety_reports/${params.report.reportId}`);
  }
}

export async function shareSafetyStatusWithHomeroom(params: {
  schoolId: string;
  classId: string;
  status: 'checking' | 'resolved';
  officerSharedNote: string;
}): Promise<void> {
  if (isDemoId(params.schoolId) || isDemoId(params.classId)) {
    demoShareSafetyWithHomeroom(params.status, params.officerSharedNote);
    return;
  }
  if (!params.classId) return;
  const noticeRef = doc(db, 'teacher_safety_notices', params.classId);
  const cleanNote = params.officerSharedNote.trim().slice(0, 1000);

  // Try updating existing notice first; if not yet created, create with initial checking state then update if needed
  try {
    await updateDoc(noticeRef, {
      status: params.status,
      officerSharedNote: cleanNote,
      updatedAt: serverTimestamp(),
    });
    return;
  } catch {
    // Document does not exist yet — create with initial required defaults then update
  }

  try {
    await setDoc(noticeRef, {
      noticeId: params.classId,
      schoolId: params.schoolId,
      classId: params.classId,
      status: 'checking',
      officerSharedNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (params.status !== 'checking' || cleanNote !== '') {
      await updateDoc(noticeRef, {
        status: params.status,
        officerSharedNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `teacher_safety_notices/${params.classId}`);
  }
}

// ============================================================================
// Teacher & Parent Student Data Loading (Zero-List Master-Gate Pattern)
// ============================================================================
async function fetchDocsSafely<T extends object>(
  collectionName: string,
  ids: string[]
): Promise<T[]> {
  const unique = uniqueStrings(ids);
  if (unique.length === 0) return [];
  const snaps: Array<T | null> = await Promise.all(
    unique.map(async (id): Promise<T | null> => {
      try {
        const s = await getDoc(doc(db, collectionName, id));
        return s.exists() ? (s.data() as T) : null;
      } catch {
        return null;
      }
    })
  );
  const results: T[] = [];
  for (const item of snaps) {
    if (item !== null) results.push(item);
  }
  return results;
}

export async function loadAuthorizedStudentBundle(params: {
  viewerRole: 'teacher' | 'parent';
  viewerUid: string;
  student: StudentDoc;
  logAccess?: boolean;
}): Promise<AuthorizedStudentBundle> {
  if (isDemoId(params.student.studentId) || isDemoId(params.student.schoolId)) {
    return demoLoadAuthorizedStudentBundle({
      viewerRole: params.viewerRole,
      student: params.student,
    });
  }
  const { viewerRole, student } = params;
  const idxPath = `student_record_indexes/${student.studentId}`;
  let idxSnap;
  try {
    idxSnap = await getDoc(doc(db, 'student_record_indexes', student.studentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, idxPath);
  }

  if (!idxSnap.exists()) {
    throw new Error('お子さんの記録インデックスが見つかりません。');
  }
  const index = idxSnap.data() as StudentRecordIndexDoc;

  const allowedAnswerIds =
    viewerRole === 'teacher'
      ? [...index.childAnswerBothIds, ...index.childAnswerTeacherIds]
      : [...index.childAnswerBothIds, ...index.childAnswerParentIds];

  const allowedObsIds =
    viewerRole === 'teacher'
      ? [
          ...index.schoolObsOwnIds,
          ...index.sharedObsIds,
          ...index.gameChildObsBothIds,
          ...index.childObsTeacherIds,
        ]
      : [
          ...index.homeObsOwnIds,
          ...index.sharedObsIds,
          ...index.gameChildObsBothIds,
          ...index.childObsParentIds,
        ];

  const allowedHypIds =
    viewerRole === 'teacher'
      ? [...index.schoolHypIds, ...index.sharedHypIds]
      : [...index.homeHypIds, ...index.sharedHypIds];

  const allowedTrialIds =
    viewerRole === 'teacher'
      ? [...index.schoolTrialIds, ...index.sharedTrialIds]
      : [...index.homeTrialIds, ...index.sharedTrialIds];

  const [
    gameSessions,
    childAnswers,
    observations,
    sharingRequests,
    hypotheses,
    trials,
    consultations,
  ] = await Promise.all([
    fetchDocsSafely<GameSessionDoc>('game_sessions', index.gameSessionIds),
    fetchDocsSafely<ChildAnswerDoc>('child_answers', allowedAnswerIds),
    fetchDocsSafely<ObservationDoc>('observations', allowedObsIds),
    fetchDocsSafely<SharingRequestDoc>('sharing_requests', index.sharingRequestIds),
    fetchDocsSafely<HypothesisDoc>('hypotheses', allowedHypIds),
    fetchDocsSafely<TrialDoc>('trials', allowedTrialIds),
    student.schoolId
      ? fetchDocsSafely<ConsultationDoc>('consultations', index.consultationIds)
      : Promise.resolve([] as ConsultationDoc[]),
  ]);

  if (params.logAccess && student.schoolId) {
    await writeAccessLog({
      schoolId: student.schoolId,
      adminUid: student.adminUid,
      actorUid: params.viewerUid,
      actorRole: viewerRole,
      actionLabel: viewerRole === 'teacher' ? '担当学級の児童記録閲覧' : '保護者の家庭・共有記録閲覧',
      studentIdRef: student.studentId,
    });
  }

  return {
    student,
    index,
    gameSessions,
    childAnswers,
    observations,
    sharingRequests,
    hypotheses,
    trials,
    consultations,
  };
}

export async function loadTeacherWorkspace(teacherUid: string): Promise<{
  membership: StaffMembershipDoc;
  school: SchoolDoc;
  schoolClass: SchoolClassDoc | null;
  students: StudentDoc[];
  safetyNotice: TeacherSafetyNoticeDoc | null;
}> {
  if (isDemoId(teacherUid)) {
    return demoLoadTeacherWorkspace();
  }
  const memPath = `staff_memberships/${teacherUid}`;
  try {
    const memSnap = await getDoc(doc(db, 'staff_memberships', teacherUid));
    if (!memSnap.exists()) {
      throw new Error('教員メンバーシップが見つかりません。');
    }
    const membership = memSnap.data() as StaffMembershipDoc;
    const schoolSnap = await getDoc(doc(db, 'schools', membership.schoolId));
    if (!schoolSnap.exists()) {
      throw new Error('学校設定が見つかりません。');
    }
    const school = schoolSnap.data() as SchoolDoc;

    if (!membership.classId) {
      return { membership, school, schoolClass: null, students: [], safetyNotice: null };
    }

    const [classSnap, noticeSnap] = await Promise.all([
      getDoc(doc(db, 'classes', membership.classId)),
      getDoc(doc(db, 'teacher_safety_notices', membership.classId)),
    ]);

    if (!classSnap.exists()) {
      return { membership, school, schoolClass: null, students: [], safetyNotice: null };
    }
    const schoolClass = classSnap.data() as SchoolClassDoc;
    const studentDocs = await fetchDocsSafely<StudentDoc>('students', schoolClass.studentIds);
    studentDocs.sort((a, b) => a.attendanceNumber - b.attendanceNumber);

    return {
      membership,
      school,
      schoolClass,
      students: studentDocs,
      safetyNotice: noticeSnap.exists() ? (noticeSnap.data() as TeacherSafetyNoticeDoc) : null,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, memPath);
  }
}

export async function loadParentWorkspace(parentUid: string, user: UserAccountDoc): Promise<{
  school: SchoolDoc | null;
  students: StudentDoc[];
  pendingLinkRequests: ParentLinkRequestDoc[];
  followups: ParentFollowupDoc[];
}> {
  if (isDemoId(parentUid) || isDemoId(user.schoolId)) {
    return demoLoadParentWorkspace();
  }
  try {
    const [studentsSnap, reqsSnap, followSnap, schoolSnap] = await Promise.all([
      getDocs(query(collection(db, 'students'), where('parentUid', '==', parentUid))),
      getDocs(query(collection(db, 'parent_link_requests'), where('parentUid', '==', parentUid))),
      getDocs(query(collection(db, 'parent_followups'), where('parentUid', '==', parentUid))),
      user.schoolId ? getDoc(doc(db, 'schools', user.schoolId)) : Promise.resolve(null),
    ]);

    return {
      school: schoolSnap && schoolSnap.exists() ? (schoolSnap.data() as SchoolDoc) : null,
      students: studentsSnap.docs.map((d) => d.data() as StudentDoc),
      pendingLinkRequests: reqsSnap.docs.map((d) => d.data() as ParentLinkRequestDoc),
      followups: followSnap.docs.map((d) => d.data() as ParentFollowupDoc),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'students');
  }
}

// ============================================================================
// Child Adventure Game Operations (Chapters 5, 6, 10, 12B)
// ============================================================================
export async function saveGameSessionAndObservation(params: {
  index?: StudentRecordIndexDoc | null;
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
  playTicketId?: string;
  participationOptOut?: boolean;
}): Promise<{ nextIndex: StudentRecordIndexDoc | null }> {
  // CRITICAL GUARD: Non-recording mode when parent chose "参加しない"
  if (params.participationOptOut) {
    return { nextIndex: params.index ?? null };
  }
  if (isDemoId(params.studentId) || isDemoId(params.schoolId)) {
    return demoSaveGameSession(params);
  }
  const sessionId = generateDocId('gs');
  const observationId = generateDocId('obs');
  const formalId = params.index
    ? formatFormalId('O', params.index.nextFormalSeq)
    : `O-S${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const dateLabel = formatJapaneseDateLabel();

  const batch = writeBatch(db);
  const gameSessionPayload: Record<string, unknown> = {
    sessionId,
    studentId: params.studentId,
    schoolId: params.schoolId,
    classId: params.classId,
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
    factSentence: params.factSentence.slice(0, 1000),
    conditionSummary: params.conditionSummary.slice(0, 1000),
    dateLabel,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.playTicketId) {
    gameSessionPayload.playTicketId = params.playTicketId;
  }
  batch.set(doc(db, 'game_sessions', sessionId), gameSessionPayload);

  const obsPayload: Record<string, unknown> = {
    observationId,
    formalId,
    studentId: params.studentId,
    schoolId: params.schoolId,
    classId: params.classId,
    side: 'game',
    category: 'other',
    fact: params.conditionSummary.slice(0, 2000),
    shareStatus: 'shared',
    visibleTo: 'both',
    pendingRequestId: '',
    correctsObservationId: '',
    dateLabel,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.playTicketId) {
    obsPayload.playTicketId = params.playTicketId;
  }
  batch.set(doc(db, 'observations', observationId), obsPayload);

  if (params.index && !params.playTicketId) {
    const nextGameSessionIds = uniqueStrings([...params.index.gameSessionIds, sessionId]).slice(-200);
    const nextGameChildObsBothIds = uniqueStrings([
      ...params.index.gameChildObsBothIds,
      observationId,
    ]).slice(-300);
    const nextFormalSeq = params.index.nextFormalSeq + 1;

    batch.update(doc(db, 'student_record_indexes', params.studentId), {
      gameSessionIds: nextGameSessionIds,
      gameChildObsBothIds: nextGameChildObsBothIds,
      nextFormalSeq,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      return {
        nextIndex: {
          ...params.index,
          gameSessionIds: nextGameSessionIds,
          gameChildObsBothIds: nextGameChildObsBothIds,
          nextFormalSeq,
        },
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `game_sessions/${sessionId}`);
    }
  } else {
    // 1-per-student tablet mode: append-only arrayUnion with zero prior index reads
    const indexUpdate: Record<string, unknown> = {
      gameSessionIds: arrayUnion(sessionId),
      gameChildObsBothIds: arrayUnion(observationId),
      updatedAt: serverTimestamp(),
    };
    if (params.playTicketId) {
      indexUpdate.lastPlayTicketId = params.playTicketId;
    }
    batch.update(doc(db, 'student_record_indexes', params.studentId), indexUpdate);

    try {
      await batch.commit();
      return { nextIndex: params.index ?? null };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `game_sessions/${sessionId}`);
    }
  }
}

export async function saveChildAnswerAndObservation(params: {
  index?: StudentRecordIndexDoc | null;
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
  place: 'school' | 'home';
  playTicketId?: string;
  participationOptOut?: boolean;
}): Promise<{ nextIndex: StudentRecordIndexDoc | null }> {
  // CRITICAL GUARD: Non-recording mode when parent chose "参加しない"
  if (params.participationOptOut) {
    return { nextIndex: params.index ?? null };
  }

  const answerId = generateDocId('ans');
  if (isDemoId(params.studentId) || isDemoId(params.schoolId)) {
    return demoSaveChildAnswer(params);
  }
  const dateLabel = formatJapaneseDateLabel();
  const batch = writeBatch(db);

  const answerPayload: Record<string, unknown> = {
    answerId,
    studentId: params.studentId,
    schoolId: params.schoolId,
    classId: params.classId,
    questionType: params.questionType,
    questionId: params.questionId.slice(0, 64),
    questionText: params.questionText.slice(0, 500),
    choices: params.choices.slice(0, 20),
    freeText: params.freeText.slice(0, 1000),
    followupTranscript: params.followupTranscript.slice(0, 2500),
    visibility: params.visibility,
    isDistressSignal: params.isDistressSignal,
    factSentence: params.factSentence.slice(0, 1000),
    dateLabel,
    place: params.place,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.playTicketId) {
    answerPayload.playTicketId = params.playTicketId;
  }
  batch.set(doc(db, 'child_answers', answerId), answerPayload);

  if (params.index && !params.playTicketId) {
    let nextChildAnswerBothIds = params.index.childAnswerBothIds;
    let nextChildAnswerTeacherIds = params.index.childAnswerTeacherIds;
    let nextChildAnswerParentIds = params.index.childAnswerParentIds;
    let nextGameChildObsBothIds = params.index.gameChildObsBothIds;
    let nextChildObsTeacherIds = params.index.childObsTeacherIds;
    let nextChildObsParentIds = params.index.childObsParentIds;
    let nextFormalSeq = params.index.nextFormalSeq;

    if (params.visibility !== 'none') {
      const observationId = generateDocId('obs');
      const formalId = formatFormalId('O', nextFormalSeq);
      nextFormalSeq += 1;

      batch.set(doc(db, 'observations', observationId), {
        observationId,
        formalId,
        studentId: params.studentId,
        schoolId: params.schoolId,
        classId: params.classId,
        side: 'child',
        category: 'child_said',
        fact: params.factSentence.slice(0, 2000),
        shareStatus: params.visibility === 'both' ? 'shared' : 'not_shared',
        visibleTo: params.visibility,
        pendingRequestId: '',
        correctsObservationId: '',
        dateLabel,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (params.visibility === 'both') {
        nextChildAnswerBothIds = uniqueStrings([...nextChildAnswerBothIds, answerId]).slice(-200);
        nextGameChildObsBothIds = uniqueStrings([...nextGameChildObsBothIds, observationId]).slice(-300);
      } else if (params.visibility === 'teacher') {
        nextChildAnswerTeacherIds = uniqueStrings([...nextChildAnswerTeacherIds, answerId]).slice(-200);
        nextChildObsTeacherIds = uniqueStrings([...nextChildObsTeacherIds, observationId]).slice(-200);
      } else if (params.visibility === 'parent') {
        nextChildAnswerParentIds = uniqueStrings([...nextChildAnswerParentIds, answerId]).slice(-200);
        nextChildObsParentIds = uniqueStrings([...nextChildObsParentIds, observationId]).slice(-200);
      }
    }

    batch.update(doc(db, 'student_record_indexes', params.studentId), {
      childAnswerBothIds: nextChildAnswerBothIds,
      childAnswerTeacherIds: nextChildAnswerTeacherIds,
      childAnswerParentIds: nextChildAnswerParentIds,
      gameChildObsBothIds: nextGameChildObsBothIds,
      childObsTeacherIds: nextChildObsTeacherIds,
      childObsParentIds: nextChildObsParentIds,
      nextFormalSeq,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      return {
        nextIndex: {
          ...params.index,
          childAnswerBothIds: nextChildAnswerBothIds,
          childAnswerTeacherIds: nextChildAnswerTeacherIds,
          childAnswerParentIds: nextChildAnswerParentIds,
          gameChildObsBothIds: nextGameChildObsBothIds,
          childObsTeacherIds: nextChildObsTeacherIds,
          childObsParentIds: nextChildObsParentIds,
          nextFormalSeq,
        },
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `child_answers/${answerId}`);
    }
  } else {
    // 1-per-student tablet mode: append-only arrayUnion with playTicketId
    const indexUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (params.playTicketId) {
      indexUpdate.lastPlayTicketId = params.playTicketId;
    }

    if (params.visibility !== 'none') {
      const observationId = generateDocId('obs');
      const formalId = `O-C${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const obsPayload: Record<string, unknown> = {
        observationId,
        formalId,
        studentId: params.studentId,
        schoolId: params.schoolId,
        classId: params.classId,
        side: 'child',
        category: 'child_said',
        fact: params.factSentence.slice(0, 2000),
        shareStatus: params.visibility === 'both' ? 'shared' : 'not_shared',
        visibleTo: params.visibility,
        pendingRequestId: '',
        correctsObservationId: '',
        dateLabel,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (params.playTicketId) {
        obsPayload.playTicketId = params.playTicketId;
      }
      batch.set(doc(db, 'observations', observationId), obsPayload);

      if (params.visibility === 'both') {
        indexUpdate.childAnswerBothIds = arrayUnion(answerId);
        indexUpdate.gameChildObsBothIds = arrayUnion(observationId);
      } else if (params.visibility === 'teacher') {
        indexUpdate.childAnswerTeacherIds = arrayUnion(answerId);
        indexUpdate.childObsTeacherIds = arrayUnion(observationId);
      } else if (params.visibility === 'parent') {
        indexUpdate.childAnswerParentIds = arrayUnion(answerId);
        indexUpdate.childObsParentIds = arrayUnion(observationId);
      }
    }

    batch.update(doc(db, 'student_record_indexes', params.studentId), indexUpdate);

    try {
      await batch.commit();
      return { nextIndex: params.index ?? null };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `child_answers/${answerId}`);
    }
  }
}

/**
 * Chapter 12B: Isolated Child Safety Report.
 * Writes EXCLUSIVELY to safety_reports + school_safety_queues.
 * Works in classroom AND take-home school device mode so appeals always reach the school Safety Officer.
 * NEVER writes to child_answers, observations, or student_record_indexes!
 */
export async function submitChildSafetyReport(params: {
  schoolId: string;
  classId: string;
  studentId: string;
  studentNickname: string;
  place: 'school' | 'home';
  triggerSource: 'talk_button_scary' | 'keyword_detected' | 'gemini_safety_review';
  childWords: string;
  playTicketId?: string;
}): Promise<void> {
  if (!params.schoolId) return;
  if (isDemoId(params.schoolId) || isDemoId(params.studentId)) {
    demoSubmitSafetyReport(params);
    return;
  }
  const reportId = generateDocId('saf');
  const now = Date.now();

  let deputyMinutes = 30;
  let managerMinutes = 90;
  try {
    const schoolSnap = await getDoc(doc(db, 'schools', params.schoolId));
    if (schoolSnap.exists()) {
      const s = schoolSnap.data() as SchoolDoc;
      deputyMinutes = s.escalateToDeputyMinutes || 30;
      managerMinutes = s.escalateToManagerMinutes || 90;
    }
  } catch {
    // Fallback to 30m / 90m on student devices without school settings read access
  }

  const batch = writeBatch(db);
  const reportPayload: Record<string, unknown> = {
    reportId,
    schoolId: params.schoolId,
    classId: params.classId || '',
    studentId: params.studentId,
    studentNickname: params.studentNickname.slice(0, 40) || '児童',
    place: params.place,
    triggerSource: params.triggerSource,
    childWords: (params.childWords.trim() || '「こわい ことや、いたい ことが ある」を選択').slice(
      0,
      2000
    ),
    createdAtMs: now,
    primaryDeadlineMs: now + deputyMinutes * 60 * 1000,
    deputyDeadlineMs: now + managerMinutes * 60 * 1000,
    status: 'unconfirmed',
    hasOpened: false,
    openedAtMs: 0,
    confirmedByUid: '',
    confirmedByLabel: '',
    actionsTaken: [],
    actionNote: '',
    hasActed: false,
    actedAtMs: 0,
    teacherNoticeId: params.classId ? params.classId : '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.playTicketId) {
    reportPayload.playTicketId = params.playTicketId;
  }

  batch.set(doc(db, 'safety_reports', reportId), reportPayload);

  batch.update(doc(db, 'school_safety_queues', params.schoolId), {
    reportIds: arrayUnion(reportId),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `safety_reports/${reportId}`);
  }
}

export async function saveChildTrialFeedback(params: {
  trialId: string;
  childFeedback: 'good' | 'normal' | 'disliked';
  childFeedbackNote: string;
  participationOptOut?: boolean;
}): Promise<void> {
  if (params.participationOptOut) return;
  if (params.trialId.startsWith('tri_demo_')) {
    demoSaveChildTrialFeedback(params);
    return;
  }
  try {
    await updateDoc(doc(db, 'trials', params.trialId), {
      childFeedback: params.childFeedback,
      childFeedbackNote: params.childFeedbackNote.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `trials/${params.trialId}`);
  }
}

// ============================================================================
// Server-Side Gemini API Clients (Gemini A & Gemini B)
// ============================================================================
export async function callGeminiChildFollowup(params: {
  gradeBand: GradeBand;
  questionText: string;
  choices: string[];
  freeText: string;
  followupsUsed: number;
}): Promise<{ ok: boolean; safetyTriggered?: boolean; data?: GeminiAResponse; errorMessage?: string }> {
  const res = await fetch('/api/gemini/child-followup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grade_band: params.gradeBand,
      base_question: {
        question: params.questionText,
        choices: params.choices,
        free_text: params.freeText,
      },
      followups_used: params.followupsUsed,
    }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    safetyTriggered?: boolean;
    data?: GeminiAResponse;
    errorMessage?: string;
  };
  if (
    typeof window !== 'undefined' &&
    window.location.search.includes('demo=') &&
    (!json.ok ||
      (params.followupsUsed < 2 &&
        json.data?.end_topic &&
        (json.data.choices?.length ?? 0) === 0 &&
        !json.safetyTriggered))
  ) {
    await new Promise((r) => setTimeout(r, 550));
    return {
      ok: true,
      safetyTriggered: false,
      data: buildDemoGeminiAFallback(params.choices, params.followupsUsed),
    };
  }
  return json;
}

export type GeminiOrganizeMode =
  | 'school_note'
  | 'class_note'
  | 'home_note'
  | 'bridge'
  | 'consult_teacher'
  | 'meeting_memo'
  | 'parent_letter'
  | 'term_facts'
  | 'class_tips'
  | 'medical_memo';

export async function callGeminiOrganize(params: {
  mode: GeminiOrganizeMode;
  viewerRole: 'teacher' | 'parent';
  observations: ObservationDoc[];
  trials: TrialDoc[];
  students?: string[];
  newInput: string;
  parentRawConsult?: string;
}): Promise<{ ok: boolean; data?: GeminiBResponse; errorMessage?: string }> {
  const res = await fetch('/api/gemini/organize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: params.mode,
      viewer_role: params.viewerRole,
      current_state: {
        observations: params.observations,
        trials: params.trials,
      },
      students: params.students || [],
      new_input: params.newInput,
      parent_raw_consult: params.parentRawConsult || '',
    }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: GeminiBResponse;
    errorMessage?: string;
  };
  if (
    !json.ok &&
    (params.observations.some((o) => isDemoId(o.schoolId)) ||
      (typeof window !== 'undefined' && window.location.search.includes('demo=')))
  ) {
    await new Promise((r) => setTimeout(r, 750));
    return {
      ok: true,
      data: buildDemoGeminiBFallback(
        params.mode,
        params.viewerRole,
        params.newInput,
        params.parentRawConsult
      ),
    };
  }
  return json;
}

// ============================================================================
// Adult Confirmation & Saving of Observations, Hypotheses, Trials, Sharing
// ============================================================================
export async function confirmAndSaveProposals(params: {
  actorRole: 'teacher' | 'parent';
  student: StudentDoc;
  index: StudentRecordIndexDoc;
  observationsToCreate: Array<{
    tempId: string;
    category: ObservationCategory;
    fact: string;
    correctsObservationId?: string;
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
}): Promise<{ createdObservationIds: Record<string, string> }> {
  if (isDemoId(params.student.studentId) || isDemoId(params.student.schoolId)) {
    return demoConfirmAndSaveProposals(params);
  }
  const side: 'school' | 'home' = params.actorRole === 'teacher' ? 'school' : 'home';
  const visibleTo: 'teacher' | 'parent' = params.actorRole === 'teacher' ? 'teacher' : 'parent';
  const dateLabel = formatJapaneseDateLabel();
  const batch = writeBatch(db);

  let seq = params.index.nextFormalSeq;
  const tempToFormalMap: Record<string, string> = {};
  const createdObservationIds: Record<string, string> = {};

  let nextSchoolObsOwnIds = [...params.index.schoolObsOwnIds];
  let nextHomeObsOwnIds = [...params.index.homeObsOwnIds];
  let nextSchoolHypIds = [...params.index.schoolHypIds];
  let nextHomeHypIds = [...params.index.homeHypIds];
  let nextSharedHypIds = [...params.index.sharedHypIds];
  let nextSchoolTrialIds = [...params.index.schoolTrialIds];
  let nextHomeTrialIds = [...params.index.homeTrialIds];
  let nextSharedTrialIds = [...params.index.sharedTrialIds];

  for (const item of params.observationsToCreate) {
    if (!item.fact.trim()) continue;
    const observationId = generateDocId('obs');
    const formalId = formatFormalId('O', seq++);
    tempToFormalMap[item.tempId] = formalId;
    createdObservationIds[item.tempId] = observationId;

    batch.set(doc(db, 'observations', observationId), {
      observationId,
      formalId,
      studentId: params.student.studentId,
      schoolId: params.student.schoolId,
      classId: params.student.classId,
      side,
      category: item.category,
      fact: item.fact.trim().slice(0, 2000),
      shareStatus: 'not_shared',
      visibleTo,
      pendingRequestId: '',
      correctsObservationId: item.correctsObservationId || '',
      dateLabel,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (side === 'school') {
      nextSchoolObsOwnIds = uniqueStrings([...nextSchoolObsOwnIds, observationId]).slice(-300);
    } else {
      nextHomeObsOwnIds = uniqueStrings([...nextHomeObsOwnIds, observationId]).slice(-300);
    }
  }

  for (const hyp of params.hypothesesToCreate) {
    if (!hyp.text.trim()) continue;
    const resolvedNewIds = hyp.evidenceNewTempIds
      .map((t) => tempToFormalMap[t])
      .filter((v): v is string => Boolean(v));
    const evidenceIds = uniqueStrings([...hyp.evidenceExistingIds, ...resolvedNewIds]).slice(0, 25);
    if (evidenceIds.length === 0) continue;

    const evidenceSides = uniqueStrings(
      hyp.evidenceSides.length > 0 ? hyp.evidenceSides : [side]
    ) as ObservationSide[];
    const hypothesisId = generateDocId('hyp');
    const formalId = formatFormalId('H', seq++);
    const shareStatus: ShareStatus = hyp.shareImmediately ? 'shared' : 'not_shared';

    batch.set(doc(db, 'hypotheses', hypothesisId), {
      hypothesisId,
      formalId,
      studentId: params.student.studentId,
      schoolId: params.student.schoolId,
      classId: params.student.classId,
      createdBySide: side,
      shareStatus,
      text: hyp.text.trim().slice(0, 1500),
      why: (hyp.why.trim() || '記録された出来事から整理').slice(0, 1500),
      evidenceIds,
      evidenceSides: evidenceSides.slice(0, 4),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (side === 'school') {
      nextSchoolHypIds = uniqueStrings([...nextSchoolHypIds, hypothesisId]).slice(-100);
    } else {
      nextHomeHypIds = uniqueStrings([...nextHomeHypIds, hypothesisId]).slice(-100);
    }
    if (shareStatus === 'shared') {
      nextSharedHypIds = uniqueStrings([...nextSharedHypIds, hypothesisId]).slice(-100);
    }
  }

  for (const tr of params.trialsToCreate) {
    if (!tr.whatToChange.trim()) continue;
    // Security rules require teacher to create where='school' and parent to create where='home'
    const allowedWhere: 'school' | 'home' = side;
    if (tr.where !== allowedWhere) continue;

    const resolvedNewIds = tr.basedOnNewTempIds
      .map((t) => tempToFormalMap[t])
      .filter((v): v is string => Boolean(v));
    const basedOnIds = uniqueStrings([...tr.basedOnExistingIds, ...resolvedNewIds]).slice(0, 25);
    const trialId = generateDocId('tri');
    const formalId = formatFormalId('T', seq++);
    const shareStatus: ShareStatus = tr.shareImmediately ? 'shared' : 'not_shared';

    batch.set(doc(db, 'trials', trialId), {
      trialId,
      formalId,
      studentId: params.student.studentId,
      schoolId: params.student.schoolId,
      classId: params.student.classId,
      where: allowedWhere,
      shareStatus,
      whatToChange: tr.whatToChange.trim().slice(0, 500),
      why: (tr.why.trim() || '記録にもとづく小さな工夫').slice(0, 1000),
      basedOnIds,
      adjustsTrialId: tr.adjustsTrialId || '',
      adultResult: 'unrecorded',
      childBurden: 'unrecorded',
      continuedStatus: 'unrecorded',
      childFeedback: 'unrecorded',
      childFeedbackNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (allowedWhere === 'school') {
      nextSchoolTrialIds = uniqueStrings([...nextSchoolTrialIds, trialId]).slice(-100);
    } else {
      nextHomeTrialIds = uniqueStrings([...nextHomeTrialIds, trialId]).slice(-100);
    }
    if (shareStatus === 'shared') {
      nextSharedTrialIds = uniqueStrings([...nextSharedTrialIds, trialId]).slice(-100);
    }
  }

  const indexUpdates: Record<string, unknown> = {
    nextFormalSeq: seq,
    sharedHypIds: nextSharedHypIds,
    sharedTrialIds: nextSharedTrialIds,
    updatedAt: serverTimestamp(),
  };

  if (side === 'school') {
    indexUpdates.schoolObsOwnIds = nextSchoolObsOwnIds;
    indexUpdates.schoolHypIds = nextSchoolHypIds;
    indexUpdates.schoolTrialIds = nextSchoolTrialIds;
  } else {
    indexUpdates.homeObsOwnIds = nextHomeObsOwnIds;
    indexUpdates.homeHypIds = nextHomeHypIds;
    indexUpdates.homeTrialIds = nextHomeTrialIds;
  }

  batch.update(doc(db, 'student_record_indexes', params.student.studentId), indexUpdates);

  try {
    await batch.commit();
    return { createdObservationIds };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `student_record_indexes/${params.student.studentId}`);
  }
}

export async function createSharingRequest(params: {
  fromSide: 'school' | 'home';
  observation: ObservationDoc;
  index: StudentRecordIndexDoc;
  previewText: string;
  purposeText: string;
}): Promise<void> {
  const requestId = generateDocId('shr');
  const toSide: 'school' | 'home' = params.fromSide === 'school' ? 'home' : 'school';
  const batch = writeBatch(db);

  batch.set(doc(db, 'sharing_requests', requestId), {
    requestId,
    observationId: params.observation.observationId,
    studentId: params.observation.studentId,
    schoolId: params.observation.schoolId,
    classId: params.observation.classId,
    fromSide: params.fromSide,
    toSide,
    category: params.observation.category,
    previewText: params.previewText.trim().slice(0, 2000),
    purposeText: params.purposeText.trim().slice(0, 500),
    status: 'pending',
    replyChoice: '',
    replySupplement: '',
    dateLabel: formatJapaneseDateLabel(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'observations', params.observation.observationId), {
    pendingRequestId: requestId,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'student_record_indexes', params.observation.studentId), {
    sharingRequestIds: uniqueStrings([...params.index.sharingRequestIds, requestId]).slice(-200),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sharing_requests/${requestId}`);
  }
}

export async function respondToSharingRequest(params: {
  request: SharingRequestDoc;
  approve: boolean;
  replyChoice: string;
  replySupplement: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'sharing_requests', params.request.requestId), {
    status: params.approve ? 'approved' : 'declined',
    replyChoice: params.replyChoice.slice(0, 80),
    replySupplement: params.replySupplement.trim().slice(0, 1500),
    updatedAt: serverTimestamp(),
  });

  if (params.approve) {
    batch.update(doc(db, 'observations', params.request.observationId), {
      shareStatus: 'shared',
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'student_record_indexes', params.request.studentId), {
      sharedObsIds: arrayUnion(params.request.observationId),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sharing_requests/${params.request.requestId}`);
  }
}

export async function withdrawPendingSharingRequest(requestId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'sharing_requests', requestId), {
      status: 'withdrawn',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `sharing_requests/${requestId}`);
  }
}

export async function stopSharingObservation(params: {
  observationId: string;
  studentId: string;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'observations', params.observationId), {
    shareStatus: 'stopped',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'student_record_indexes', params.studentId), {
    sharedObsIds: arrayRemove(params.observationId),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `observations/${params.observationId}`);
  }
}

export async function toggleHypothesisShareStatus(params: {
  hypothesis: HypothesisDoc;
  nextStatus: ShareStatus;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'hypotheses', params.hypothesis.hypothesisId), {
    shareStatus: params.nextStatus,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'student_record_indexes', params.hypothesis.studentId), {
    sharedHypIds:
      params.nextStatus === 'shared'
        ? arrayUnion(params.hypothesis.hypothesisId)
        : arrayRemove(params.hypothesis.hypothesisId),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `hypotheses/${params.hypothesis.hypothesisId}`
    );
  }
}

export async function updateAdultTrialEvaluation(params: {
  trial: TrialDoc;
  adultResult: TrialDoc['adultResult'];
  childBurden: TrialDoc['childBurden'];
  continuedStatus: TrialDoc['continuedStatus'];
  shareStatus: ShareStatus;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'trials', params.trial.trialId), {
    adultResult: params.adultResult,
    childBurden: params.childBurden,
    continuedStatus: params.continuedStatus,
    shareStatus: params.shareStatus,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'student_record_indexes', params.trial.studentId), {
    sharedTrialIds:
      params.shareStatus === 'shared'
        ? arrayUnion(params.trial.trialId)
        : arrayRemove(params.trial.trialId),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `trials/${params.trial.trialId}`);
  }
}

export async function sendParentConsultation(params: {
  student: StudentDoc;
  index: StudentRecordIndexDoc;
  selectedRecordSummaries: string[];
  messageBody: string;
}): Promise<void> {
  if (!params.student.schoolId || !params.student.classId) {
    throw new Error('学校と紐付けられていないため送信できません。');
  }
  if (isDemoId(params.student.studentId) || isDemoId(params.student.schoolId)) {
    demoSendParentConsultation(params);
    return;
  }
  const consultationId = generateDocId('cns');
  const batch = writeBatch(db);

  batch.set(doc(db, 'consultations', consultationId), {
    consultationId,
    studentId: params.student.studentId,
    schoolId: params.student.schoolId,
    classId: params.student.classId,
    selectedRecordSummaries: params.selectedRecordSummaries.slice(0, 30),
    messageBody: params.messageBody.trim().slice(0, 3000),
    teacherReply: '',
    status: 'sent',
    dateLabel: formatJapaneseDateLabel(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'student_record_indexes', params.student.studentId), {
    consultationIds: uniqueStrings([...params.index.consultationIds, consultationId]).slice(-100),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `consultations/${consultationId}`);
  }
}

export async function replyToParentConsultation(params: {
  consultationId: string;
  teacherReply: string;
}): Promise<void> {
  if (params.consultationId.startsWith('cns_demo_')) {
    demoReplyToConsultation(params.consultationId, params.teacherReply);
    return;
  }
  try {
    await updateDoc(doc(db, 'consultations', params.consultationId), {
      teacherReply: params.teacherReply.trim().slice(0, 3000),
      status: 'replied',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `consultations/${params.consultationId}`);
  }
}

export async function saveParentFollowupRecord(params: {
  existing?: ParentFollowupDoc | null;
  parentUid: string;
  studentId: string;
  currentSituation: ParentFollowupDoc['currentSituation'];
  memoHelpful: ParentFollowupDoc['memoHelpful'];
  consentForImprovement: boolean;
}): Promise<void> {
  if (params.existing) {
    try {
      await updateDoc(doc(db, 'parent_followups', params.existing.followupId), {
        currentSituation: params.currentSituation,
        memoHelpful: params.memoHelpful,
        consentForImprovement: params.consentForImprovement,
        updatedAt: serverTimestamp(),
      });
      return;
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `parent_followups/${params.existing.followupId}`
      );
    }
  }

  const followupId = generateDocId('flw');
  try {
    await setDoc(doc(db, 'parent_followups', followupId), {
      followupId,
      parentUid: params.parentUid,
      studentId: params.studentId,
      currentSituation: params.currentSituation,
      memoHelpful: params.memoHelpful,
      consentForImprovement: params.consentForImprovement,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `parent_followups/${followupId}`);
  }
}

// ============================================================================
// Parent Data Deletion & Account Withdrawal (Chapter 14)
// ============================================================================
export async function deleteParentHomeRecords(params: {
  bundle: AuthorizedStudentBundle;
}): Promise<void> {
  const { bundle } = params;
  const batch = writeBatch(db);

  const homeObs = bundle.observations.filter((o) => o.side === 'home');
  const homeHyps = bundle.hypotheses.filter((h) => h.createdBySide === 'home');
  const homeTrials = bundle.trials.filter((t) => t.where === 'home');
  const homeSessions = bundle.gameSessions.filter((g) => g.place === 'home');
  const homeAnswers = bundle.childAnswers.filter((a) => a.place === 'home');

  for (const o of homeObs) batch.delete(doc(db, 'observations', o.observationId));
  for (const h of homeHyps) batch.delete(doc(db, 'hypotheses', h.hypothesisId));
  for (const t of homeTrials) batch.delete(doc(db, 'trials', t.trialId));
  for (const g of homeSessions) batch.delete(doc(db, 'game_sessions', g.sessionId));
  for (const a of homeAnswers) batch.delete(doc(db, 'child_answers', a.answerId));

  const deletedObsSet = new Set(homeObs.map((o) => o.observationId));
  const deletedHypSet = new Set(homeHyps.map((h) => h.hypothesisId));
  const deletedTrialSet = new Set(homeTrials.map((t) => t.trialId));
  const deletedSessSet = new Set(homeSessions.map((g) => g.sessionId));
  const deletedAnsSet = new Set(homeAnswers.map((a) => a.answerId));

  batch.update(doc(db, 'student_record_indexes', bundle.student.studentId), {
    homeObsOwnIds: [],
    sharedObsIds: bundle.index.sharedObsIds.filter((id) => !deletedObsSet.has(id)),
    homeHypIds: [],
    sharedHypIds: bundle.index.sharedHypIds.filter((id) => !deletedHypSet.has(id)),
    homeTrialIds: [],
    sharedTrialIds: bundle.index.sharedTrialIds.filter((id) => !deletedTrialSet.has(id)),
    gameSessionIds: bundle.index.gameSessionIds.filter((id) => !deletedSessSet.has(id)),
    childAnswerBothIds: bundle.index.childAnswerBothIds.filter((id) => !deletedAnsSet.has(id)),
    childAnswerParentIds: bundle.index.childAnswerParentIds.filter((id) => !deletedAnsSet.has(id)),
    childObsParentIds: [],
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.DELETE,
      `student_record_indexes/${bundle.student.studentId}`
    );
  }
}

export async function withdrawParentAccount(params: {
  parentUid: string;
  bundles: AuthorizedStudentBundle[];
  followups: ParentFollowupDoc[];
}): Promise<void> {
  for (const bundle of params.bundles) {
    await deleteParentHomeRecords({ bundle });
    const batch = writeBatch(db);
    if (bundle.student.isHomeOnly) {
      batch.delete(doc(db, 'student_record_indexes', bundle.student.studentId));
      batch.delete(doc(db, 'students', bundle.student.studentId));
    } else {
      // Unlink parent from school student; school-side records remain under school retention policy
      batch.update(doc(db, 'students', bundle.student.studentId), {
        parentUid: '',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const finalBatch = writeBatch(db);
  for (const f of params.followups) {
    finalBatch.delete(doc(db, 'parent_followups', f.followupId));
  }
  finalBatch.delete(doc(db, 'users', params.parentUid));

  try {
    await finalBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${params.parentUid}`);
  }
}

// ============================================================================
// 1-per-Student School Tablet Classroom Window, Pseudonymous & QR Card Flows
// ============================================================================

export async function loadClassroomSession(classId: string): Promise<ClassroomSessionDoc | null> {
  if (!classId) return null;
  const path = `classroom_sessions/${classId}`;
  try {
    const snap = await getDoc(doc(db, 'classroom_sessions', classId));
    return snap.exists() ? (snap.data() as ClassroomSessionDoc) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Real-time listener for Teacher's "授業で遊ぶ" control panel.
 * Displays ONLY the live connected student count (入っている人数だけ) — zero individual live results!
 */
export function subscribeClassroomSession(
  classId: string,
  onChange: (session: ClassroomSessionDoc | null) => void
): () => void {
  if (isDemoId(classId)) {
    return demoSubscribeClassroomSession(onChange);
  }
  const path = `classroom_sessions/${classId}`;
  return onSnapshot(
    doc(db, 'classroom_sessions', classId),
    (snap) => {
      onChange(snap.exists() ? (snap.data() as ClassroomSessionDoc) : null);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

/**
 * Opens the classroom play window ("授業で遊ぶ") for `durationMinutes` (default 45m).
 * Syncs nameless roster entries so 1-per-student tablets can bind by attendance number.
 */
export async function openClassroomPlaySession(params: {
  school: SchoolDoc;
  schoolClass: SchoolClassDoc;
  teacherUid: string;
  students: StudentDoc[];
  durationMinutes?: number;
  allowTakeHome?: boolean;
}): Promise<ClassroomSessionDoc> {
  if (isDemoId(params.school.schoolId) || isDemoId(params.schoolClass.classId)) {
    return demoOpenClassroomSession(params.durationMinutes, params.allowTakeHome);
  }
  const { school, schoolClass, teacherUid, students } = params;
  const durationMinutes = Math.min(180, Math.max(10, Math.round(params.durationMinutes ?? 45)));
  const nowMs = Date.now();
  const openedAt = Timestamp.fromMillis(nowMs);
  const expiresAt = Timestamp.fromMillis(nowMs + durationMinutes * 60 * 1000);

  const sessionRef = doc(db, 'classroom_sessions', schoolClass.classId);
  let existing: ClassroomSessionDoc | null = null;
  try {
    const snap = await getDoc(sessionRef);
    if (snap.exists()) existing = snap.data() as ClassroomSessionDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `classroom_sessions/${schoolClass.classId}`);
  }

  const classJoinCode = existing?.classJoinCode || generateClassJoinCode();
  const allowTakeHome = params.allowTakeHome ?? existing?.allowTakeHome ?? true;

  const rosterEntries: ClassroomRosterEntry[] = students.slice(0, 60).map((st) => ({
    attendanceNumber: st.attendanceNumber,
    studentId: st.studentId,
    grade: st.grade,
    gradeBand: st.gradeBand,
    participationOptOut: Boolean(st.participationOptOut),
  }));

  const batch = writeBatch(db);

  if (existing) {
    batch.update(sessionRef, {
      teacherUid,
      className: schoolClass.className.slice(0, 60) || '学級',
      classJoinCode,
      isOpen: true,
      allowTakeHome,
      connectedCount: 0,
      openedAt,
      expiresAt,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(sessionRef, {
      classId: schoolClass.classId,
      schoolId: school.schoolId,
      adminUid: school.adminUid,
      teacherUid,
      className: schoolClass.className.slice(0, 60) || '学級',
      classJoinCode,
      isOpen: true,
      allowTakeHome,
      connectedCount: 0,
      openedAt,
      expiresAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const joinRef = doc(db, 'classroom_join_codes', classJoinCode);
  let joinExists = false;
  try {
    const jSnap = await getDoc(joinRef);
    joinExists = jSnap.exists();
  } catch {
    joinExists = false;
  }
  if (joinExists) {
    batch.update(joinRef, {
      teacherUid,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(joinRef, {
      classJoinCode,
      classId: schoolClass.classId,
      schoolId: school.schoolId,
      teacherUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const rosterRef = doc(db, 'classroom_rosters', schoolClass.classId);
  let rosterExists = false;
  try {
    const rSnap = await getDoc(rosterRef);
    rosterExists = rSnap.exists();
  } catch {
    rosterExists = false;
  }
  if (rosterExists) {
    batch.update(rosterRef, {
      teacherUid,
      entries: rosterEntries,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(rosterRef, {
      classId: schoolClass.classId,
      schoolId: school.schoolId,
      teacherUid,
      entries: rosterEntries,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return {
      classId: schoolClass.classId,
      schoolId: school.schoolId,
      adminUid: school.adminUid,
      teacherUid,
      className: schoolClass.className.slice(0, 60) || '学級',
      classJoinCode,
      isOpen: true,
      allowTakeHome,
      connectedCount: 0,
      openedAt,
      expiresAt,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `classroom_sessions/${schoolClass.classId}`);
  }
}

export async function closeClassroomPlaySession(params: {
  classId: string;
  teacherUid: string;
}): Promise<void> {
  if (isDemoId(params.classId) || isDemoId(params.teacherUid)) {
    demoCloseClassroomSession();
    return;
  }
  const path = `classroom_sessions/${params.classId}`;
  try {
    await updateDoc(doc(db, 'classroom_sessions', params.classId), {
      teacherUid: params.teacherUid,
      isOpen: false,
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateClassroomTakeHomeSetting(params: {
  classId: string;
  teacherUid: string;
  allowTakeHome: boolean;
}): Promise<void> {
  const path = `classroom_sessions/${params.classId}`;
  try {
    await updateDoc(doc(db, 'classroom_sessions', params.classId), {
      teacherUid: params.teacherUid,
      allowTakeHome: params.allowTakeHome,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Syncs nameless classroom_rosters/{classId} when opt-out status changes so student devices
 * immediately honor parental "参加しない" without waiting for next session start.
 */
export async function syncClassroomRosterOptOut(params: {
  classId: string;
  schoolId: string;
  teacherUid: string;
  students: StudentDoc[];
}): Promise<void> {
  const rosterRef = doc(db, 'classroom_rosters', params.classId);
  try {
    const snap = await getDoc(rosterRef);
    const entries: ClassroomRosterEntry[] = params.students.slice(0, 60).map((st) => ({
      attendanceNumber: st.attendanceNumber,
      studentId: st.studentId,
      grade: st.grade,
      gradeBand: st.gradeBand,
      participationOptOut: Boolean(st.participationOptOut),
    }));
    if (snap.exists()) {
      await updateDoc(rosterRef, {
        teacherUid: params.teacherUid,
        entries,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(rosterRef, {
        classId: params.classId,
        schoolId: params.schoolId,
        teacherUid: params.teacherUid,
        entries,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Roster may not exist yet if teacher hasn't opened classroom session
  }
}

/**
 * Sets or clears parental "参加しない（記録を取らない）" preference on students/{studentId}
 * and updates any active nameless QR cards owned by the caller.
 */
export async function setStudentParticipationOptOut(params: {
  studentId: string;
  participationOptOut: boolean;
  callerRole: 'parent' | 'teacher' | 'school_admin';
  callerUid: string;
}): Promise<void> {
  if (isDemoId(params.studentId)) {
    return;
  }
  const path = `students/${params.studentId}`;
  try {
    await updateDoc(doc(db, 'students', params.studentId), {
      participationOptOut: params.participationOptOut,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  // If teacher or school_admin updated opt-out, also sync any issued QR cards they manage
  if (params.callerRole === 'teacher' || params.callerRole === 'school_admin') {
    try {
      const field = params.callerRole === 'teacher' ? 'teacherUid' : 'adminUid';
      const qrSnap = await getDocs(
        query(collection(db, 'student_qr_cards'), where(field, '==', params.callerUid))
      );
      const matching = qrSnap.docs.filter(
        (d) => (d.data() as StudentQrCardDoc).studentId === params.studentId
      );
      if (matching.length > 0) {
        const b = writeBatch(db);
        for (const qDoc of matching) {
          b.update(qDoc.ref, {
            participationOptOut: params.participationOptOut,
            updatedAt: serverTimestamp(),
          });
        }
        await b.commit();
      }
    } catch {
      // Non-blocking sync
    }
  }
}

export interface PrintableNamelessQrCard {
  attendanceNumber: number;
  className: string;
  grade: number;
  rawQrToken: string;
  qrUrl: string;
}

/**
 * Issues 1-per-student NAMELESS QR cards (`氏名を入れず、推測しにくい文字列`).
 * Stores ONLY SHA-256 hash (`student_qr_cards/{qrTokenHash}`) in Firestore.
 */
export async function issueClassNamelessQrCards(params: {
  school: SchoolDoc;
  schoolClass: SchoolClassDoc;
  students: StudentDoc[];
  issuerRole: 'teacher' | 'school_admin';
  issuerUid: string;
  appOrigin: string;
}): Promise<PrintableNamelessQrCard[]> {
  const { school, schoolClass, students, issuerRole, issuerUid, appOrigin } = params;
  if (students.length === 0) return [];
  if (isDemoId(school.schoolId)) {
    const cleanOrigin = appOrigin.replace(/\/$/, '');
    return [...students]
      .sort((a, b) => a.attendanceNumber - b.attendanceNumber)
      .map((st) => {
        const rawQrToken = generateStudentQrSecret();
        return {
          attendanceNumber: st.attendanceNumber,
          className: schoolClass.className,
          grade: st.grade,
          rawQrToken,
          qrUrl: `${cleanOrigin}/?qr=${encodeURIComponent(rawQrToken)}`,
        };
      });
  }

  // Revoke previous active QR cards issued by this user for this class so lost cards cannot be reused
  try {
    const ownerField = issuerRole === 'teacher' ? 'teacherUid' : 'adminUid';
    const prevSnap = await getDocs(
      query(collection(db, 'student_qr_cards'), where(ownerField, '==', issuerUid))
    );
    const prevForClass = prevSnap.docs.filter(
      (d) =>
        (d.data() as StudentQrCardDoc).classId === schoolClass.classId &&
        (d.data() as StudentQrCardDoc).status === 'active'
    );
    if (prevForClass.length > 0) {
      const revokeBatch = writeBatch(db);
      for (const oldDoc of prevForClass) {
        revokeBatch.update(oldDoc.ref, {
          status: 'revoked',
          updatedAt: serverTimestamp(),
        });
      }
      await revokeBatch.commit();
    }
  } catch {
    // Proceed with issuing fresh cards
  }

  const batch = writeBatch(db);
  const printable: PrintableNamelessQrCard[] = [];
  const sortedStudents = [...students].sort((a, b) => a.attendanceNumber - b.attendanceNumber);

  for (const st of sortedStudents) {
    const rawQrToken = generateStudentQrSecret();
    const qrTokenHash = await deriveQrTokenHash(rawQrToken);
    const cardCodeHint = rawQrToken.slice(-6);

    batch.set(doc(db, 'student_qr_cards', qrTokenHash), {
      qrTokenHash,
      cardCodeHint,
      schoolId: school.schoolId,
      adminUid: school.adminUid,
      teacherUid: issuerRole === 'teacher' ? issuerUid : schoolClass.teacherUid || '',
      classId: schoolClass.classId,
      className: schoolClass.className.slice(0, 60) || '学級',
      studentId: st.studentId,
      attendanceNumber: st.attendanceNumber,
      grade: st.grade,
      gradeBand: st.gradeBand,
      participationOptOut: Boolean(st.participationOptOut),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const cleanOrigin = appOrigin.replace(/\/$/, '');
    printable.push({
      attendanceNumber: st.attendanceNumber,
      className: schoolClass.className,
      grade: st.grade,
      rawQrToken,
      qrUrl: `${cleanOrigin}/?qr=${encodeURIComponent(rawQrToken)}`,
    });
  }

  try {
    await batch.commit();
    return printable;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'student_qr_cards');
  }
}

function detectBrowserDeviceType(): 'tablet' | 'smartphone' | 'pc' {
  if (typeof window === 'undefined') return 'tablet';
  const w = window.innerWidth;
  if (w < 640) return 'smartphone';
  if (w <= 1180) return 'tablet';
  return 'pc';
}

function assertLessonOrTakeHomeWindow(
  session: ClassroomSessionDoc | null,
  mode: 'classroom' | 'take_home'
): ClassroomSessionDoc {
  if (!session) {
    throw new Error(
      'いまは じゅぎょうの じかんでは ありません。せんせいが「授業で遊ぶ」をおしてから はいってね。'
    );
  }
  if (mode === 'classroom') {
    const expMs = session.expiresAt?.toMillis ? session.expiresAt.toMillis() : 0;
    if (!session.isOpen || expMs <= Date.now()) {
      throw new Error(
        'いまは じゅぎょうの じかんでは ありません。せんせいが「授業で遊ぶ」をおしている あいだだけ はいれます。'
      );
    }
  } else {
    if (!session.allowTakeHome) {
      throw new Error('この がっきゅうでは、いま もちかえりでの りようが とまっています。');
    }
  }
  return session;
}

export type SchoolGoogleEntryResult =
  | { status: 'needs_attendance_number'; className: string; classId: string }
  | { status: 'entered'; lock: ActiveChildModeLock };

/**
 * Method A: 1-per-student entry using School Google Account (Google Workspace for Education etc.).
 * Computes irreversible SHA-256 `pseudoHash` — NEVER writes raw Google UID or email to Firestore!
 */
export async function enterWithSchoolGoogleAccount(params: {
  googleUid: string;
  classJoinCode: string;
  attendanceNumber?: number;
  mode: 'classroom' | 'take_home';
}): Promise<SchoolGoogleEntryResult> {
  const cleanCode = params.classJoinCode.trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('せんせいから おしえてもらった「じゅぎょうコード」を いれてね。');
  }

  let joinSnap;
  try {
    joinSnap = await getDoc(doc(db, 'classroom_join_codes', cleanCode));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `classroom_join_codes/${cleanCode}`);
  }
  if (!joinSnap.exists()) {
    throw new Error('じゅぎょうコードが みつかりません。もじを たしかめてね。');
  }
  const joinDoc = joinSnap.data() as ClassroomJoinCodeDoc;

  const session = await loadClassroomSession(joinDoc.classId);
  assertLessonOrTakeHomeWindow(session, params.mode);

  const pseudoHash = await deriveSchoolPseudoHash(joinDoc.classId, params.googleUid);

  let bindSnap;
  try {
    bindSnap = await getDoc(doc(db, 'school_pseudo_bindings', pseudoHash));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `school_pseudo_bindings/${pseudoHash}`);
  }

  let rosterDoc: ClassroomRosterDoc | null = null;
  try {
    const rSnap = await getDoc(doc(db, 'classroom_rosters', joinDoc.classId));
    if (rSnap.exists()) rosterDoc = rSnap.data() as ClassroomRosterDoc;
  } catch {
    rosterDoc = null;
  }

  let studentId = '';
  let attendanceNumber = 0;
  let grade = 3;
  let gradeBand: GradeBand = 'middle';
  let participationOptOut = false;

  if (!bindSnap.exists()) {
    if (!params.attendanceNumber || params.attendanceNumber < 1) {
      return {
        status: 'needs_attendance_number',
        className: session!.className,
        classId: joinDoc.classId,
      };
    }
    if (!rosterDoc) {
      throw new Error('がっきゅうの じゅんびが まだ できていません。せんせいに こえをかけてね。');
    }
    const found = rosterDoc.entries.find((e) => e.attendanceNumber === params.attendanceNumber);
    if (!found) {
      throw new Error(
        `しゅっせきばんごう「${params.attendanceNumber}ばん」が みつかりません。ばんごうを たしかめてね。`
      );
    }

    studentId = found.studentId;
    attendanceNumber = found.attendanceNumber;
    grade = found.grade;
    gradeBand = found.gradeBand;
    participationOptOut = Boolean(found.participationOptOut);

    try {
      await setDoc(doc(db, 'school_pseudo_bindings', pseudoHash), {
        pseudoHash,
        schoolId: joinDoc.schoolId,
        classId: joinDoc.classId,
        studentId,
        attendanceNumber,
        grade,
        gradeBand,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `school_pseudo_bindings/${pseudoHash}`);
    }
  } else {
    const binding = bindSnap.data() as SchoolPseudoBindingDoc;
    studentId = binding.studentId;
    attendanceNumber = binding.attendanceNumber;
    grade = binding.grade;
    gradeBand = binding.gradeBand;
    const latestEntry = rosterDoc?.entries.find((e) => e.studentId === studentId);
    if (latestEntry) {
      participationOptOut = Boolean(latestEntry.participationOptOut);
    }
  }

  const ticketId = generatePlayTicketId();
  const ticketExpMs =
    params.mode === 'classroom' && session!.expiresAt?.toMillis
      ? session!.expiresAt.toMillis()
      : Date.now() + 3 * 60 * 60 * 1000;

  const batch = writeBatch(db);
  batch.set(doc(db, 'student_play_tickets', ticketId), {
    ticketId,
    studentId,
    schoolId: joinDoc.schoolId,
    classId: joinDoc.classId,
    mode: params.mode,
    authProofHash: pseudoHash,
    authMethod: 'pseudo',
    expiresAt: Timestamp.fromMillis(ticketExpMs),
    createdAt: serverTimestamp(),
  });

  if (params.mode === 'classroom') {
    batch.update(doc(db, 'classroom_sessions', joinDoc.classId), {
      connectedCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `student_play_tickets/${ticketId}`);
  }

  return {
    status: 'entered',
    lock: {
      studentId,
      nickname: `${session!.className} ${attendanceNumber}ばん`,
      schoolId: joinDoc.schoolId,
      classId: joinDoc.classId,
      grade,
      gradeBand,
      place: params.mode === 'classroom' ? 'school' : 'home',
      deviceType: detectBrowserDeviceType(),
      pinHash: '',
      isSchoolDeviceSession: true,
      playTicketId: ticketId,
      participationOptOut,
    },
  };
}

/**
 * Method B: 1-per-student entry using a Nameless Printable QR Card (`SQR_...`).
 * Works on any browser (Chromebook / iPad / Windows) with ZERO Google login required!
 */
export async function enterWithStudentQrCard(params: {
  rawQrInput: string;
  mode: 'classroom' | 'take_home';
}): Promise<ActiveChildModeLock> {
  let rawToken = params.rawQrInput.trim();
  // Allow pasting full QR URL or ?qr=... parameter
  if (rawToken.includes('qr=')) {
    try {
      const url = new URL(rawToken, window.location.origin);
      rawToken = url.searchParams.get('qr') || rawToken;
    } catch {
      const m = rawToken.match(/qr=([A-Za-z0-9_-]+)/);
      if (m) rawToken = m[1];
    }
  }
  rawToken = rawToken.trim().toUpperCase();
  if (!rawToken.startsWith('SQR_') || rawToken.length < 12) {
    throw new Error('QRカードの コード（SQR_から はじまる もじ）を いれてね。');
  }

  const qrTokenHash = await deriveQrTokenHash(rawToken);
  let cardSnap;
  try {
    cardSnap = await getDoc(doc(db, 'student_qr_cards', qrTokenHash));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `student_qr_cards/${qrTokenHash}`);
  }

  if (!cardSnap.exists()) {
    throw new Error('この QRカードは みつかりません。せんせいに たしかめてね。');
  }
  const card = cardSnap.data() as StudentQrCardDoc;
  if (card.status !== 'active') {
    throw new Error('この QRカードは あたらしい ものに かわっています。せんせいに たしかめてね。');
  }

  const session = await loadClassroomSession(card.classId);
  assertLessonOrTakeHomeWindow(session, params.mode);

  // Also check live roster if available for most up-to-date parental opt-out status
  let participationOptOut = Boolean(card.participationOptOut);
  try {
    const rSnap = await getDoc(doc(db, 'classroom_rosters', card.classId));
    if (rSnap.exists()) {
      const rDoc = rSnap.data() as ClassroomRosterDoc;
      const entry = rDoc.entries.find((e) => e.studentId === card.studentId);
      if (entry) participationOptOut = Boolean(entry.participationOptOut);
    }
  } catch {
    // Use card.participationOptOut
  }

  const ticketId = generatePlayTicketId();
  const ticketExpMs =
    params.mode === 'classroom' && session!.expiresAt?.toMillis
      ? session!.expiresAt.toMillis()
      : Date.now() + 3 * 60 * 60 * 1000;

  const batch = writeBatch(db);
  batch.set(doc(db, 'student_play_tickets', ticketId), {
    ticketId,
    studentId: card.studentId,
    schoolId: card.schoolId,
    classId: card.classId,
    mode: params.mode,
    authProofHash: qrTokenHash,
    authMethod: 'qr',
    expiresAt: Timestamp.fromMillis(ticketExpMs),
    createdAt: serverTimestamp(),
  });

  if (params.mode === 'classroom') {
    batch.update(doc(db, 'classroom_sessions', card.classId), {
      connectedCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `student_play_tickets/${ticketId}`);
  }

  return {
    studentId: card.studentId,
    nickname: `${card.className} ${card.attendanceNumber}ばん`,
    schoolId: card.schoolId,
    classId: card.classId,
    grade: card.grade,
    gradeBand: card.gradeBand,
    place: params.mode === 'classroom' ? 'school' : 'home',
    deviceType: detectBrowserDeviceType(),
    pinHash: '',
    isSchoolDeviceSession: true,
    playTicketId: ticketId,
    participationOptOut,
  };
}

// ============================================================================
// 3D Gachapon & Town Coin Collection Persistence (`student_rewards`)
// ============================================================================

export async function loadStudentRewards(params: {
  studentId: string;
  participationOptOut?: boolean;
}): Promise<StudentRewardDoc | null> {
  if (params.participationOptOut || !params.studentId) return null;
  if (isDemoId(params.studentId)) {
    return demoLoadStudentRewards();
  }
  try {
    const snap = await getDoc(doc(db, 'student_rewards', params.studentId));
    return snap.exists() ? (snap.data() as StudentRewardDoc) : null;
  } catch {
    return null;
  }
}

export async function saveStudentRewards(params: {
  studentId: string;
  schoolId: string;
  classId: string;
  coins: number;
  totalSpins: number;
  unlockedItemIds: string[];
  playTicketId?: string;
  participationOptOut?: boolean;
}): Promise<void> {
  // CRITICAL GUARD: Zero Firestore writes when opted out!
  if (params.participationOptOut || !params.studentId) return;
  if (isDemoId(params.studentId) || isDemoId(params.schoolId)) {
    demoSaveStudentRewards(params);
    return;
  }

  const ref = doc(db, 'student_rewards', params.studentId);
  const clampedCoins = Math.min(99999, Math.max(0, Math.round(params.coins)));
  const clampedSpins = Math.min(9999, Math.max(0, Math.round(params.totalSpins)));
  const cleanUnlocked = uniqueStrings(params.unlockedItemIds).slice(0, 64);

  let existsAlready = false;
  try {
    const snap = await getDoc(ref);
    existsAlready = snap.exists();
  } catch {
    existsAlready = false;
  }

  const payload: Record<string, unknown> = {
    studentId: params.studentId,
    schoolId: params.schoolId || '',
    classId: params.classId || '',
    coins: clampedCoins,
    totalSpins: clampedSpins,
    unlockedItemIds: cleanUnlocked,
    updatedAt: serverTimestamp(),
  };
  if (params.playTicketId) {
    payload.lastPlayTicketId = params.playTicketId;
  }

  try {
    if (existsAlready) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `student_rewards/${params.studentId}`);
  }
}

