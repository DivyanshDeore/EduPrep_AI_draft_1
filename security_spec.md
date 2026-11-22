# EduPrep AI — Security Rules Specification

## Data Invariants
1. Every document in `subjects`, `topics`, `syllabi`, `timetableEntries`, `notifications`, `precaps`, `notes`, `summaries`, `resources`, and `chatSessions` must belong to a verified `studentId == request.auth.uid`.
2. `students/{studentId}` and `notificationPreferences/{studentId}` contain PII/private preferences and are strictly readable and writable only by the owner (`request.auth.uid == studentId`) with `email_verified == true`.
3. Relational creates (`topics`, `syllabi`, `timetableEntries`, `precaps`) verify parent `subjectId` exists and is owned by `request.auth.uid`.
4. All string lengths, array sizes, enum values, model allowlists, time formats (`HH:MM`), and URL schemes (`https://` or `http://`) are bounded and enforced.
5. `createdAt` and `studentId` are immutable after creation; `updatedAt` and `createdAt` must equal `request.time`.

## Adversarial Test Payloads ("Dirty Dozen")
1. **Identity Spoofing on Subject Create**: Authenticated user A submits `studentId: "user_B"` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Token with `email_verified: false` attempts to create a `students/{uid}` document -> `PERMISSION_DENIED`.
3. **Blanket Student List Enumeration**: Authenticated user attempts `list` on `/students` -> `PERMISSION_DENIED`.
4. **Cross-Tenant Query Scraping**: User A runs `list` on `/notes` without `where('studentId', '==', uid)` -> `PERMISSION_DENIED`.
5. **Orphaned Topic Creation**: User A creates a `topics` doc pointing to a `subjectId` owned by User B -> `PERMISSION_DENIED`.
6. **Shadow Field Injection**: User A creates a `subjects` doc containing an extra undeclared field `isAdmin: true` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: User A creates a `notes` doc with a backdated `createdAt` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
8. **Immutable Ownership Mutation**: User A updates a `timetableEntries` doc attempting to change `studentId` or `createdAt` -> `PERMISSION_DENIED`.
9. **Path ID Poisoning**: User A attempts to create a document with an ID containing slashes/invalid characters or exceeding 128 chars -> `PERMISSION_DENIED`.
10. **Array Exhaustion ("Denial of Wallet")**: User A creates a `notes` doc with 500 items in `importantConcepts` -> `PERMISSION_DENIED`.
11. **JavaScript URL Injection in Resource**: User A saves a `resources` doc with `url: "javascript:alert(1)"` -> `PERMISSION_DENIED`.
12. **Invalid Time Range Format in Timetable**: User A submits `startTime: "99:99"` in `timetableEntries` -> `PERMISSION_DENIED`.
