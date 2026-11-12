/**
 * Phase 0 Security TDD Specification — Dirty Dozen Verification Suite
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

export async function runDirtyDozenSuite() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'torisetsu-security-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  const adminCtx = testEnv.authenticatedContext('admin_1', { email: 'admin@example.com', email_verified: true });
  const officerCtx = testEnv.authenticatedContext('officer_1', { email: 'officer@example.com', email_verified: true });
  const teacherACtx = testEnv.authenticatedContext('teacher_A', { email: 'ta@example.com', email_verified: true });
  const parentACtx = testEnv.authenticatedContext('parent_A', { email: 'pa@example.com', email_verified: true });
  const parentBCtx = testEnv.authenticatedContext('parent_B', { email: 'pb@example.com', email_verified: true });
  const unverifiedCtx = testEnv.authenticatedContext('spoof_1', { email: 'admin@example.com', email_verified: false });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'schools', 'sch_unchecked'), {
      schoolId: 'sch_unchecked',
      adminUid: 'admin_1',
      schoolCodeLabel: 'テスト小学校',
      academicYear: '2026年度',
      retentionMonths: 12,
      checkBoardApproved: true,
      checkParentConsent: false,
      checkChildExplain: false,
      checkSpecialistDocs: false,
      checkSafetyWorkflow: false,
      allPreChecksDone: false,
      directorySupervisor: '',
      directoryVersion: 'v1.0',
      safetySupervisor: '',
      safetyVersion: 'v1.0',
      primaryOfficerLabel: '養護教諭',
      deputyOfficerLabel: 'SC',
      managerOfficerLabel: '教頭',
      escalateToDeputyMinutes: 30,
      escalateToManagerMinutes: 60,
      offHoursRule: 'SOSダイヤル案内',
      invitesIssuedCount: 0,
      linkedHouseholdsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'schools', 'sch_1'), {
      schoolId: 'sch_1',
      adminUid: 'admin_1',
      schoolCodeLabel: '第一小学校',
      academicYear: '2026年度',
      retentionMonths: 12,
      checkBoardApproved: true,
      checkParentConsent: true,
      checkChildExplain: true,
      checkSpecialistDocs: true,
      checkSafetyWorkflow: true,
      allPreChecksDone: true,
      directorySupervisor: '',
      directoryVersion: 'v1.0',
      safetySupervisor: '',
      safetyVersion: 'v1.0',
      primaryOfficerLabel: '養護教諭',
      deputyOfficerLabel: 'SC',
      managerOfficerLabel: '教頭',
      escalateToDeputyMinutes: 30,
      escalateToManagerMinutes: 60,
      offHoursRule: 'SOSダイヤル案内',
      invitesIssuedCount: 1,
      linkedHouseholdsCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'staff_memberships', 'teacher_A'), {
      uid: 'teacher_A',
      schoolId: 'sch_1',
      adminUid: 'admin_1',
      staffRole: 'teacher',
      classId: 'class_A',
      safetyTier: 'none',
      displayLabel: '1年1組担任',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'staff_memberships', 'officer_1'), {
      uid: 'officer_1',
      schoolId: 'sch_1',
      adminUid: 'admin_1',
      staffRole: 'safety_officer',
      classId: '',
      safetyTier: 'primary',
      displayLabel: '養護教諭',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'students', 'stu_A'), {
      studentId: 'stu_A',
      schoolId: 'sch_1',
      adminUid: 'admin_1',
      classId: 'class_A',
      parentUid: 'parent_A',
      attendanceNumber: 1,
      nickname: 'ひなた',
      grade: 1,
      gradeBand: 'low',
      isHomeOnly: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'observations', 'obs_home_private'), {
      observationId: 'obs_home_private',
      formalId: 'O-001',
      studentId: 'stu_A',
      schoolId: 'sch_1',
      classId: 'class_A',
      side: 'home',
      category: 'worked_well',
      fact: '家では図を描くと取り組みやすかった',
      shareStatus: 'not_shared',
      visibleTo: 'parent',
      pendingRequestId: '',
      correctsObservationId: '',
      dateLabel: '11月11日',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'observations', 'obs_class_B'), {
      observationId: 'obs_class_B',
      formalId: 'O-002',
      studentId: 'stu_B',
      schoolId: 'sch_1',
      classId: 'class_B',
      side: 'school',
      category: 'strength',
      fact: '別の学級の記録',
      shareStatus: 'not_shared',
      visibleTo: 'teacher',
      pendingRequestId: '',
      correctsObservationId: '',
      dateLabel: '11月11日',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'child_answers', 'ans_private'), {
      answerId: 'ans_private',
      studentId: 'stu_A',
      schoolId: 'sch_1',
      classId: 'class_A',
      questionType: 'base',
      questionId: 'q1',
      questionText: 'たいへんなこと',
      choices: ['ぶんしょうの もんだい'],
      freeText: '',
      followupTranscript: '',
      visibility: 'none',
      isDistressSignal: true,
      factSentence: '非公開の回答',
      dateLabel: '11月11日',
      place: 'school',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, 'safety_reports', 'sr_1'), {
      reportId: 'sr_1',
      schoolId: 'sch_1',
      classId: 'class_A',
      studentId: 'stu_A',
      studentNickname: 'ひなた',
      place: 'school',
      triggerSource: 'talk_button_scary',
      childWords: 'たたかれる',
      createdAtMs: Date.now(),
      primaryDeadlineMs: Date.now() + 1800000,
      deputyDeadlineMs: Date.now() + 3600000,
      status: 'unconfirmed',
      hasOpened: false,
      openedAtMs: 0,
      confirmedByUid: '',
      confirmedByLabel: '',
      actionsTaken: [],
      actionNote: '',
      hasActed: false,
      actedAtMs: 0,
      teacherNoticeId: 'class_A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // 1. Shadow field realName on Student
  await assertFails(
    setDoc(doc(adminCtx.firestore(), 'students', 'stu_shadow'), {
      studentId: 'stu_shadow',
      schoolId: 'sch_1',
      adminUid: 'admin_1',
      classId: 'class_A',
      parentUid: '',
      attendanceNumber: 2,
      nickname: 'そら',
      realName: '山田太郎',
      grade: 1,
      gradeBand: 'low',
      isHomeOnly: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // 2. Pre-check incomplete school student creation
  await assertFails(
    setDoc(doc(adminCtx.firestore(), 'students', 'stu_blocked'), {
      studentId: 'stu_blocked',
      schoolId: 'sch_unchecked',
      adminUid: 'admin_1',
      classId: 'class_A',
      parentUid: '',
      attendanceNumber: 1,
      nickname: 'あおい',
      grade: 1,
      gradeBand: 'low',
      isHomeOnly: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // 3. School Admin reading normal observation
  await assertFails(getDoc(doc(adminCtx.firestore(), 'observations', 'obs_home_private')));

  // 4. School Admin reading safety report
  await assertFails(getDoc(doc(adminCtx.firestore(), 'safety_reports', 'sr_1')));

  // 5. Safety Officer reading normal observation
  await assertFails(getDoc(doc(officerCtx.firestore(), 'observations', 'obs_home_private')));

  // 6. Parent reading safety report
  await assertFails(getDoc(doc(parentACtx.firestore(), 'safety_reports', 'sr_1')));

  // 7. Teacher A reading Class B observation
  await assertFails(getDoc(doc(teacherACtx.firestore(), 'observations', 'obs_class_B')));

  // 8. Parent B reading Student A
  await assertFails(getDoc(doc(parentBCtx.firestore(), 'students', 'stu_A')));

  // 9. Teacher A reading non-shared Home observation
  await assertFails(getDoc(doc(teacherACtx.firestore(), 'observations', 'obs_home_private')));

  // 10. Parent A & Teacher A reading child answer with visibility == 'none'
  await assertFails(getDoc(doc(parentACtx.firestore(), 'child_answers', 'ans_private')));
  await assertFails(getDoc(doc(teacherACtx.firestore(), 'child_answers', 'ans_private')));

  // 11. Home-only parent self-enabling homeSafetyConfirmed
  await assertFails(
    setDoc(doc(parentBCtx.firestore(), 'users', 'parent_B'), {
      uid: 'parent_B',
      role: 'parent',
      schoolId: '',
      isHomeOnly: true,
      homeSafetyConfirmed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // 12. Unverified email write attempt
  await assertFails(
    setDoc(doc(unverifiedCtx.firestore(), 'users', 'spoof_1'), {
      uid: 'spoof_1',
      role: 'school_admin',
      schoolId: '',
      isHomeOnly: false,
      homeSafetyConfirmed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await testEnv.cleanup();
}
