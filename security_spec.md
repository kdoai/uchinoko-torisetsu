# Security Specification — うちの子トリセツ (Uchi no Ko Torisetsu)

## 1. Data Invariants

1. **Role Immutability & Self-Escalation Prevention**: A user's `role` in `/users/{userId}` is immutable after creation. Staff permissions (`teacher`, `safety_officer`) require an active `/staff_memberships/{userId}` record redeemed from an unexpired `/staff_invites/{inviteCode}` issued by the school's `adminUid`.
2. **Pre-Use Checklist Gate**: No school student (`/students/{studentId}` with `isHomeOnly == false`) can be created unless `/schools/{schoolId}.allPreChecksDone == true` (all 5 pre-checks verified).
3. **Home-Only Child Game Lock**: Home-only accounts (`isHomeOnly == true`) must have `homeSafetyConfirmed == false` on creation, blocking `/game_sessions` creation until specialist safety procedures are established.
4. **School Administrator Blindness**: `school_admin` can manage school settings, classes, staff invites, minimal student profiles, parent link approvals, and access logs, but is **strictly denied** read/write access to `/game_sessions`, `/child_answers`, `/observations`, `/sharing_requests`, `/hypotheses`, `/trials`, `/consultations`, and `/safety_reports`.
5. **Safety Officer Strict Compartmentalization**: `safety_officer` can read and update **only** `/school_safety_queues/{schoolId}`, `/safety_reports/{reportId}`, and `/teacher_safety_notices/{noticeId}` for their school. They are **strictly denied** access to all normal student records.
6. **Safety Report Exclusivity**: `parent`, `teacher`, and `school_admin` are **strictly denied** `get`, `list`, `update`, and `delete` access to `/safety_reports/{reportId}`.
7. **Class-Scoped Teacher Access**: A `teacher` can access student records **only** when `/staff_memberships/{uid}` is `active == true`, `staffRole == 'teacher'`, and `classId == resource.data.classId`. Reassignment immediately revokes access.
8. **Approved Household-Scoped Parent Access**: A `parent` can access student records **only** when `/students/{studentId}.parentUid == request.auth.uid` (set only after school approval or for own home-only student).
9. **Consent-Gated Cross-Side Sharing**: Non-shared `home` observations are unreadable by teachers; non-shared `school` observations are unreadable by parents. Transitioning `shareStatus` to `'shared'` by a recipient requires an approved `/sharing_requests/{requestId}` verified via `getAfter()`.
10. **Child Choice Visibility**: `/child_answers/{answerId}` with `visibility == 'none'` (`まだ だれにも`) is unreadable by both teachers and parents. `visibility == 'teacher'` denies parents; `visibility == 'parent'` denies teachers.
11. **Minimal PII & Append-Only Observations**: `/students` forbids real names, photos, videos, audio, addresses, and diagnostic tags (`hasOnly` enforced). `/game_sessions` forbids `nickname`. `/observations` `fact`, `side`, and `category` are immutable after creation.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Shadow Field Injection on Student)**: Injecting `realName: "山田太郎"` or `diagnosisFlag: true` into `/students/stu_1`. -> `PERMISSION_DENIED` (`hasOnly` violation).
2. **Payload 2 (Unverified Pre-Check Bypass)**: School admin creating `/students/stu_1` while `/schools/sch_1.allPreChecksDone == false`. -> `PERMISSION_DENIED`.
3. **Payload 3 (School Admin Reading Observations)**: `school_admin` attempting `get(/observations/obs_1)` or `get(/game_sessions/gs_1)`. -> `PERMISSION_DENIED`.
4. **Payload 4 (School Admin Reading Safety Reports)**: `school_admin` attempting `get(/safety_reports/sr_1)`. -> `PERMISSION_DENIED`.
5. **Payload 5 (Safety Officer Reading Normal Observations)**: `safety_officer` attempting `get(/observations/obs_1)`. -> `PERMISSION_DENIED`.
6. **Payload 6 (Parent Reading Safety Reports)**: Linked `parent` attempting `get(/safety_reports/sr_1)` for their own child. -> `PERMISSION_DENIED`.
7. **Payload 7 (Cross-Class Teacher Scraping)**: Teacher assigned to `class_A` attempting `get(/observations/obs_in_class_B)`. -> `PERMISSION_DENIED`.
8. **Payload 8 (Cross-Household Parent Scraping)**: Parent A attempting `get(/students/child_of_parent_B)` or `get(/observations/obs_of_parent_B)`. -> `PERMISSION_DENIED`.
9. **Payload 9 (Non-Shared Observation Peek)**: Teacher attempting `get(/observations/home_private_obs)` where `side == 'home'` and `shareStatus == 'not_shared'`. -> `PERMISSION_DENIED`.
10. **Payload 10 (Child Private Answer Peek)**: Parent or Teacher attempting `get(/child_answers/ans_private)` where `visibility == 'none'`. -> `PERMISSION_DENIED`.
11. **Payload 11 (Home-Only Child Game Bypass)**: Home-only parent attempting `create(/users/p_1)` with `homeSafetyConfirmed: true` or `create(/game_sessions/gs_home)` without school link. -> `PERMISSION_DENIED`.
12. **Payload 12 (Spoofed Unverified Email / Forged Timestamp / 1MB ID Poisoning)**: Writing with `email_verified: false`, forged `createdAt` != `request.time`, or 200-char poisoned document ID. -> `PERMISSION_DENIED`.
