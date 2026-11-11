# LEVEL UP — Product Requirements Document (PRD)

**Document version:** 1.0  
**Date:** 11 November 2026  
**Product type:** Personal productivity and study management Progressive Web App  
**Target devices:** Windows laptop and Android smartphone  
**Document status:** Development baseline

---

## 1. Executive Summary

LEVEL UP is a personal productivity and study management application that helps one user organise academic subjects, syllabus, study plans, tasks, examinations and study sessions. It combines practical planning and tracking tools with restrained RPG-inspired progression.

The product follows the cycle:

**Plan → Execute → Track → Improve → Level Up**

LEVEL UP must be a genuinely usable application rather than a static prototype. Its core workflows must work on both Windows and Android, retain data across restarts, support offline use and provide reliable cross-device synchronisation.

### 1.1 Primary product outcome

A user can create or update information on either their laptop or phone and see that change reflected on the other device automatically when both are connected. If a device is offline, the user can continue using core features; its changes are queued and synchronised after reconnection.

### 1.2 Product principles

1. **Reliable before flashy:** correct data handling and predictable behaviour take priority over visual effects.
2. **Local-first experience:** the app remains useful when offline and reads/writes to local storage first.
3. **Cross-device continuity:** phone and laptop share one logical account and dataset.
4. **Privacy by design:** no advertising, analytics trackers or unnecessary third-party data sharing.
5. **Simple to operate:** minimise setup, avoid unnecessary technical complexity and provide clear empty states.
6. **Meaningful motivation:** XP and achievements reward completed work, not app opens or timer starts.

---

## 2. Goals, Non-Goals and Success Measures

### 2.1 Goals

- Manage subjects, chapters, topics, notes and syllabus progress.
- Plan daily and weekly study goals.
- Manage tasks, deadlines and examinations.
- Run configurable focus/Pomodoro sessions.
- Record actual study activity and history.
- Track XP, levels, streaks and achievements.
- Review accurate progress analytics and export reports.
- Install and use the application as a PWA on Windows and Android.
- Continue core work offline and synchronise changes across devices.
- Back up and restore the complete dataset.

### 2.2 Non-goals for the initial release

- Multi-user collaboration, social feeds or public profiles.
- Commercial subscriptions, payments or advertising.
- AI-generated study plans or automatic syllabus generation.
- Integrations with university portals, LMS platforms or external calendars.
- Native Windows or Android applications.
- Cloud-hosted third-party analytics.
- Complex project management features unrelated to personal study.

These may be considered later only if there is a clear user need.

### 2.3 Success measures

| Measure | Acceptance target |
|---|---|
| Cross-device sync | Online changes normally appear on the other online device within 5 seconds |
| Offline operation | Core create, edit, complete and timer workflows remain usable offline |
| Data persistence | Data survives refresh, browser restart and device restart |
| Sync recovery | Queued offline changes sync after reconnection without manual re-entry |
| Data integrity | No silent loss of accepted user changes |
| Responsive usability | All primary workflows usable at 360px mobile width and common laptop widths |
| PWA installation | Installable on supported Android browsers and desktop Chromium-based browsers |
| Reporting | CSV exports reflect stored records and selected date filters |
| Functional quality | All P0 acceptance tests pass before release |

Targets are product requirements; actual performance must be verified through testing on the target devices.

---

## 3. Users and Core Use Cases

### 3.1 Primary user

One individual using LEVEL UP for personal study, planning and productivity. The initial product does not require multiple user roles.

### 3.2 Core use cases

- As a user, I want to add subjects and chapters so that I can organise my syllabus.
- As a user, I want to plan tasks and goals so that I know what to work on.
- As a user, I want to start a focus session linked to a subject/topic and save the actual time spent.
- As a user, I want to see my study progress and consistency using real recorded activity.
- As a user, I want to earn XP for meaningful completed work.
- As a user, I want to update information on my phone and see it on my laptop, and vice versa.
- As a user, I want to keep working when offline and have changes synchronised later.
- As a user, I want to export and restore my data without depending on a vendor.

---

## 4. Scope and Prioritisation

Priorities use the following definitions:

- **P0 — Must have:** required for a usable first release.
- **P1 — Should have:** important, but may follow the first stable release.
- **P2 — Could have:** optional enhancement.

| Module | Scope | Priority |
|---|---|---|
| Account/device identity and sync | Private access, device registration, sync status, conflict handling | P0 |
| Home dashboard | Daily overview, priorities, target, streak and upcoming exams | P0 |
| Subjects and syllabus | Subject, chapter, topic, notes and progress management | P0 |
| Tasks and goals | CRUD, due dates, priority, completion and goal tracking | P0 |
| Focus timer | Timer controls, session metadata and session history | P0 |
| Planner | Daily/weekly/monthly calendar and exam schedule | P0 |
| Progress | Core totals, trends and subject summaries | P0 |
| Data backup | Full export/import and restore validation | P0 |
| PWA/offline | Installability, app shell caching and offline data access | P0 |
| XP and levels | Rules-based XP, level progression and activity ledger | P0 |
| Achievements | Initial milestone set and unlock tracking | P1 |
| Advanced analytics | Additional filters and richer charts | P1 |
| Notifications | Due-date and timer notifications where supported | P1 |
| Custom icons/themes | Expanded appearance options | P2 |

---

## 5. Functional Requirements

### 5.1 Home Dashboard

The dashboard is the default landing page and must answer:
1. What should I study today?
2. What have I completed?
3. What is still pending?
4. How am I progressing?

**Requirements**
- Display a time-appropriate greeting and local date.
- Display current level, total XP and progress to next level.
- Display daily study target and actual focused study time for the current local day.
- Display completed and pending tasks for today.
- Display current streak and best streak.
- Display upcoming examinations with countdown.
- Display today's priorities, recent study sessions and weekly study summary.
- Allow the daily target to be changed in Settings and from a convenient dashboard control.
- Provide clear empty states and direct links to create the first subject, task or study plan.
- All dashboard figures must be derived from stored application records; no hard-coded sample metrics.

**Acceptance criteria**
- Completing a task or session updates relevant dashboard values without a full page reload.
- Dashboard date boundaries use the configured device/account timezone consistently.
- Upcoming examinations are ordered by date and overdue tasks are visibly distinguished.

### 5.2 Subject Management

**Subject fields**
- ID
- Name (required)
- Colour
- Icon identifier
- Priority (Low, Medium, High)
- Optional description
- Created and updated timestamps
- Archived/deleted state as appropriate

**Requirements**
- Create, view, edit, archive and delete subjects.
- Prevent accidental duplicate subject creation where names match after trimming and case normalisation; allow intentional duplicates only through an explicit decision.
- Warn before deleting a subject that contains chapters, tasks or sessions.
- Prefer archive or soft-delete behaviour so accidental deletion can be recovered until permanently purged.
- Show subject-level study time and syllabus completion.

### 5.3 Chapters and Topics

Each subject can contain chapters; chapters may contain topics.

**Chapter fields**
- ID, subject ID, title, description/notes
- Status: Not Started, In Progress, Revision Required, Needs Practice, Completed
- Priority, optional deadline
- Sort order
- Created/updated timestamps

**Topic fields**
- ID, chapter ID, title, optional notes
- Status and sort order
- Created/updated timestamps

**Requirements**
- Add, edit, reorder and delete chapters and topics.
- Store personal notes.
- Update status and priority.
- Set optional deadlines.
- Show chapter count and completion percentage by subject.
- Show overall syllabus completion.
- Define completion percentage as completed items divided by all active syllabus items. The interface must clearly state whether it is chapter-based or topic-based; use topic-based calculation when topics exist, otherwise chapter-based calculation for that chapter.
- Changing a status must update progress and any eligible XP exactly once.

### 5.4 Study Goals

Support daily and weekly goals.

**Goal types**
- Time target (minutes)
- Count target (e.g. questions, chapters)
- Completion target (specific task/chapter set)

**Requirements**
- Create, edit, pause, complete and delete goals.
- Set period, target value, unit and optional subject association.
- Show current progress and remaining amount.
- Derive progress from linked records where possible; do not count the same activity twice.
- Allow manually completed goals when a goal is not directly measurable, while recording the completion event.
- Daily and weekly goal boundaries follow the configured timezone.

### 5.5 Focus Mode and Study Timer

**Session setup**
- Subject (optional for general study)
- Chapter/topic (optional; must belong to selected subject)
- Planned duration
- Session type: Study, Revision, Practice, Reading, Custom
- Optional note

**Timer controls**
- Start, pause, resume, reset and finish.
- Configurable Pomodoro presets: focus duration, short break, long break and long-break interval.
- Custom duration.
- Large countdown and progress indicator.
- Prevent accidental duplicate active timers across tabs where feasible.
- Restore an active timer after refresh/reopen using persisted start time and pause state; do not rely only on an in-memory interval.
- Handle background tab throttling and device sleep by calculating remaining time from timestamps.
- Ask for confirmation before discarding an in-progress session.

**Session record**
- ID, subject/topic references, session type
- Planned duration and actual elapsed focus duration
- Start and end timestamps
- Completion status: Completed, Interrupted, Abandoned
- Optional notes
- Device/source metadata for diagnostics, without collecting unnecessary device fingerprinting

**Requirements**
- Save a session when the user finishes or explicitly ends it.
- Distinguish focus time from break time; breaks do not count toward study hours or XP.
- An interrupted session may record actual focus time but must not receive full completion XP unless the XP rule explicitly allows partial credit.
- Session history must be filterable by date, subject and session type.
- Timer completion notification is best-effort and requires permission where the platform supports it.

### 5.6 Planner, Tasks and Calendar

**Task fields**
- ID, title (required), description/notes
- Optional subject/chapter reference
- Due date/time (optional)
- Priority: Low, Medium, High
- Status: To Do, In Progress, Completed, Cancelled
- Optional estimated duration
- Created/updated/completed timestamps

**Requirements**
- Create, view, edit, complete, reopen and delete tasks.
- Display pending, completed and overdue lists.
- Support daily, weekly and monthly calendar views.
- Display tasks, exams, goals and deadlines in the calendar with distinct visual treatments.
- Allow navigation between dates and a Today shortcut.
- Selecting a calendar item opens its details.
- Date-only events must not shift to another day due to UTC conversion.
- Calendar must be usable on a narrow mobile screen; provide a list/agenda alternative.

### 5.7 Examination Planner

**Exam fields**
- ID, subject reference or subject name
- Exam date (required), optional time and location
- Preparation status
- Linked chapters/topics
- Notes
- Created/updated timestamps

**Requirements**
- Create, edit and delete examinations.
- Show countdown to upcoming exams.
- Display preparation progress based on linked syllabus items where possible.
- Provide a subject-wise exam preparation overview.
- Clearly distinguish past exams from upcoming exams.
- Prevent invalid dates and warn about duplicate exam entries.

### 5.8 Gamification: XP, Levels, Streaks and Achievements

Gamification must be subtle and supportive. It must not encourage inflated or duplicate activity.

**XP earning principles**
- XP is awarded only for meaningful completed work.
- Starting a timer, opening the app or merely creating a task does not award XP.
- XP events must be recorded in an immutable or auditable XP ledger.
- Each source activity can award a given reward only once.
- Corrections/reversals must use compensating ledger entries rather than silently rewriting history.

**Suggested initial XP rules (configurable constants)**
| Activity | Suggested XP | Rule |
|---|---:|---|
| Completed focus session | 10 XP | Minimum 10 minutes of actual focus; one reward per session |
| Completed chapter | 20 XP | Award once when chapter first reaches Completed |
| Completed daily goal | 15 XP | Award once per goal period |
| Completed revision task | 10 XP | Award once when task is completed |
| Completed subject | 50 XP | Award once when all active syllabus items meet completion criteria |

The product must prevent farming XP by repeatedly toggling an item between completed and incomplete. Reopening an item does not automatically grant XP again.

**Levels**
- Show current level, total XP, XP within current level and XP required for next level.
- Use a simple documented progression curve, for example an increasing threshold per level.
- Store total XP as the sum of ledger entries; do not maintain an unrelated manually edited total.
- Trigger a level-up celebration once when a threshold is crossed.

**Streak definition**
- A successful study day is a local calendar day with at least 20 minutes of recorded focus time (configurable).
- Current streak counts consecutive successful days ending today, or yesterday if today has not yet ended and no session has been recorded.
- Best streak is the maximum historical consecutive run.
- Store timestamps in UTC and calculate day buckets using the configured timezone.
- Do not break streaks due to app inactivity if the user has already met the day's threshold.
- Document behaviour for timezone changes and daylight-saving transitions.

**Achievements**
Initial achievements:
- First study session
- First completed chapter
- Five-day study streak
- Ten-hour total focus milestone
- Complete an entire subject
- Meet a weekly study target

Achievement unlocks must be derived from actual events and stored once. Provide a dedicated achievements page with locked/unlocked states and unlock dates.

### 5.9 Progress and Analytics

**Metrics**
- Total focus time
- Daily, weekly and monthly focus time
- Subject-wise focus time
- Completed session count
- Average session duration
- Daily goal completion rate
- Syllabus completion by subject and overall
- Weekly consistency and streak history

**Charts**
- Weekly study hours
- Monthly study trend
- Subject-wise time distribution
- Subject completion percentages
- Daily consistency

**Requirements**
- Charts must use actual stored data.
- Define date range inclusively and display the active timezone.
- Exclude break time, abandoned zero-duration sessions and deleted/archived records according to documented rules.
- Avoid misleading averages: state whether average duration is based on completed sessions only.
- Provide useful empty states when no records exist.
- Charts must remain readable on mobile and support accessible labels/legends.

### 5.10 Reports and Data Export

**CSV reports**
- User-selectable date range.
- Weekly and monthly report presets.
- Export sessions, task completion, goal progress and relevant summary metrics.
- Include clear column headers, ISO date/time values and timezone context.
- Use UTF-8 encoding and safe CSV escaping.
- File names should include report type and date range.

**Full backup**
- Export all user-owned application data, including subjects, chapters, topics, tasks, goals, exams, sessions, settings, XP ledger and achievements.
- Include schema version, export timestamp and timezone metadata.
- Prefer a versioned JSON backup format; optionally package it as a ZIP if attachments are later supported.
- Validate file structure and version before import.
- Provide preview of record counts and confirmation before replacing or merging data.
- Never silently overwrite current data.
- Support restore to a fresh device.
- Include a documented backup reminder in the interface, but do not force cloud backup.

### 5.11 Settings

Settings include:
- Daily study target.
- Timezone (default from device; user can override).
- Light, dark and system theme.
- Notification preferences.
- Timer/Pomodoro durations.
- Minimum focus minutes for streak qualification.
- XP/gamification display preferences (turning off visuals must not corrupt history).
- Sync status and device list.
- Manual sync/retry control.
- Data export/import.
- Reset application data with strong confirmation.
- About, privacy and version information.

---

## 6. Cross-Device Synchronisation — Critical Requirement

This is a core product requirement, not an optional enhancement.

### 6.1 Required user experience

- The same personal dataset is available on the Windows laptop and Android phone.
- A change made on one online device is normally visible on the other online device within 5 seconds.
- The user should not need to press a sync button during normal online use.
- Offline edits are saved locally and placed in an outgoing sync queue.
- When connectivity returns, queued changes upload automatically.
- Incoming changes are applied to local storage and reflected in the UI.
- Sync status is visible: Synced, Syncing, Offline, Pending changes or Attention required.
- Failed sync attempts retry with exponential backoff and a manual retry option.
- The system must not claim data is synced until the server acknowledges it.

### 6.2 Architecture decision

Use a **local-first PWA with a self-hosted sync backend**.

- Frontend: React + TypeScript.
- Local database: IndexedDB, accessed through a small persistence layer (e.g. Dexie).
- Backend: self-hosted PocketBase or an equivalently simple backend with authentication, persistent storage and realtime change notifications.
- Server database: backend-managed SQLite for a single-user deployment; choose PostgreSQL only if scale or concurrency later requires it.
- Transport: HTTPS for all remote communication; realtime channel (WebSocket or backend-supported subscription) for prompt updates.
- PWA service worker: cache application shell and static assets; it is not the source of truth for user data.
- Sync engine: explicit pull/push queue, version checks, retry logic and conflict resolution.

**Important constraint:** A central server must be running and reachable by both devices for cross-network synchronisation. Self-hosting avoids a mandatory third-party data processor, but the user is responsible for hosting, secure remote access, updates and backups. Hosting only on the laptop means the laptop must be on and reachable for the phone to sync. For reliable access away from home, deploy the backend on an always-on machine or private server with secure remote connectivity. Do not expose an unauthenticated database/API directly to the public internet.

### 6.3 Data ownership and authority

- Each device maintains a local IndexedDB replica.
- The server stores the shared canonical dataset and accepts authenticated changes.
- Local writes are committed immediately, then queued for synchronisation.
- Each record has a stable UUID, created_at, updated_at, version/revision and deleted_at (for tombstones where needed).
- Each mutation has a unique operation ID so retries are idempotent.
- Server acknowledgements advance the local sync cursor.
- Deletions must synchronise as tombstones before eventual cleanup, otherwise deleted records can reappear from another device.

### 6.4 Conflict handling

A conflict occurs when the same record is changed independently on two devices before either change is received by the other.

Required behaviour:
- Detect conflicts using record versions/revisions; do not rely only on client clocks.
- For independent field changes, merge fields where safe.
- For simultaneous edits to the same field, use a documented deterministic policy (server revision ordering) and retain enough conflict metadata to recover the losing value.
- For high-value content such as notes, avoid silent destructive overwrites. Preserve a conflict copy or present a simple “choose version” resolution screen.
- Completion, XP and session events must be append-only/idempotent to prevent duplicate awards.
- Deletions must win over stale updates unless the user explicitly restores the item.
- Test conflict scenarios with two browser/device clients.

### 6.5 Security and privacy

- Use authenticated access even for a single-user deployment.
- Use HTTPS/TLS for traffic outside localhost.
- Store passwords using the backend's secure password hashing; never store plaintext passwords.
- Keep server secrets out of frontend bundles and source control.
- Apply least-privilege access rules to the user's records.
- Provide a logout/device-revoke mechanism if authentication is enabled.
- Do not add analytics, advertising SDKs or third-party trackers.
- Explain that local browser data can be lost if the user clears site storage or removes the browser profile; recommend periodic encrypted/off-device backups.
- Consider client-side encryption for sensitive notes as a future enhancement; if implemented, document key recovery carefully because lost keys can make backups unreadable.

### 6.6 Sync acceptance tests

1. Create a subject on laptop while both devices are online; verify it appears on phone within target latency.
2. Edit a chapter on phone; verify laptop updates without manual refresh.
3. Create a task offline on phone; reconnect and verify it appears on laptop.
4. Edit the same note on both devices while offline; verify conflict detection and safe recovery.
5. Delete an item on one device while the other is offline; verify it does not reappear after sync.
6. Interrupt network during upload; verify retry does not duplicate tasks, sessions or XP.
7. Refresh either device during pending sync; verify queued operations remain.
8. Restore a backup to a second device and verify records can subsequently sync.

---

## 7. Technical Requirements and Architecture

### 7.1 Recommended stack

| Layer | Recommendation | Rationale |
|---|---|---|
| UI | React + TypeScript | Component-based, maintainable UI and type safety |
| Build tooling | Vite | Fast development and straightforward production builds |
| Styling | CSS modules or well-structured plain CSS; optional utility framework | Keep visual system consistent without overcomplicating |
| Components | Accessible reusable components | Consistent forms, dialogs, navigation and cards |
| Icons | Lucide or equivalent open-source icon set | Consistent lightweight iconography |
| Charts | Recharts or equivalent | Responsive charts using real data |
| Local persistence | IndexedDB via Dexie | Structured local storage and indexing |
| PWA | Web App Manifest + service worker (e.g. Vite PWA plugin) | Installability and app-shell caching |
| Backend | Self-hosted PocketBase (initial recommendation) | Simple single-user auth, data API and realtime support |
| Server storage | SQLite managed by backend | Simple deployment and backup |
| Validation | Zod or equivalent | Shared schema validation at boundaries |
| Testing | Vitest + React Testing Library + Playwright | Unit, component and end-to-end coverage |
| Version control | Git | Change history and recoverability |

The exact backend may be changed if implementation testing shows a better maintainable option, but the local-first sync contract must remain.

### 7.2 High-level architecture

```text
 Windows Laptop PWA                         Android PWA
 React + TypeScript                         React + TypeScript
          |                                          |
      UI / State                                  UI / State
          |                                          |
    Domain Services                             Domain Services
          |                                          |
   IndexedDB (Dexie)                           IndexedDB (Dexie)
          |                                          |
    Local Sync Queue                            Local Sync Queue
          |                                          |
          +------------ HTTPS / Realtime -----------+
                               |
                    Self-hosted Sync Backend
                    Authentication + API
                    Realtime notifications
                               |
                         Server Database
                         Persistent backup
```

### 7.3 Application layers

1. **Presentation layer:** pages, components, responsive navigation and accessible controls.
2. **Application/domain layer:** business rules for goals, XP, streaks, sessions and progress.
3. **Repository layer:** consistent read/write interface independent of UI.
4. **Local persistence layer:** IndexedDB repositories and migrations.
5. **Sync layer:** outbox queue, pull cursor, retries, version checks and conflict handling.
6. **Backend layer:** authentication, validation, authorisation, canonical records and realtime updates.
7. **PWA layer:** manifest, service worker, app-shell cache and install experience.

Business rules must not be duplicated across components. A single domain service should calculate XP, streaks, goal progress and analytics.

### 7.4 Data model (logical)

| Entity | Important fields / relationships |
|---|---|
| UserProfile | id, display_name, timezone, created_at |
| Device | id, user_id, label, last_seen_at, revoked_at |
| Subject | id, user_id, name, colour, icon, priority, timestamps, version, deleted_at |
| Chapter | id, subject_id, title, status, notes, deadline, sort_order, version |
| Topic | id, chapter_id, title, status, notes, sort_order, version |
| StudyGoal | id, period, type, target, unit, subject_id, start/end, status |
| Task | id, title, description, subject_id, chapter_id, due_at, priority, status |
| Exam | id, subject_id, exam_at, preparation_status, notes |
| StudySession | id, subject_id, topic_id, type, planned_minutes, actual_seconds, start/end, status |
| XPEvent | id, source_type, source_id, amount, reason, created_at, idempotency_key |
| Achievement | id, key, unlocked_at, metadata |
| UserSettings | timezone, daily_target, theme, timer settings, notification settings |
| SyncOperation | operation_id, entity_type, entity_id, operation, payload, created_at, retry_count |
| SyncMetadata | last_pull_cursor, last_success_at, sync_state |

All user-owned records must include an ownership boundary. Use UUIDs generated on the client so records can be created offline.

### 7.5 Data and time rules

- Persist event timestamps in UTC.
- Store date-only concepts (exam date without time, all-day deadlines) as date-only values rather than converting them through UTC.
- Store the user's IANA timezone (e.g. `Asia/Kolkata`) for day/week/month grouping.
- Define week start (Monday by default) and make it consistent across calendar and reports.
- Use elapsed-time calculations based on timestamps, not timer tick counts.
- Validate imported dates and schema versions.
- Avoid floating-point accumulation for XP; use integer values.

### 7.6 Performance and reliability

- Load the app shell quickly and lazy-load secondary screens/charts where appropriate.
- Paginate or virtualise long histories if needed.
- Index frequently queried IndexedDB fields (date, subject ID, status).
- Debounce search and avoid unnecessary rerenders.
- Handle storage quota errors and show actionable messages.
- Use schema migrations for local and server data.
- Make sync idempotent and resilient to retries.
- Never treat a failed server request as a successful sync.
- Keep the app usable if realtime connection drops; polling/reconnect fallback may be used.

---

## 8. UI/UX Requirements

### 8.1 Design direction

Premium, minimal productivity interface inspired by the clarity of Notion, Linear and Todoist, with a restrained RPG progression layer. Do not copy their interfaces.

**Visual characteristics**
- Clean typography and clear hierarchy.
- Balanced spacing and consistent grid.
- Rounded cards with restrained shadows.
- Muted neutral surfaces with one primary accent and limited semantic colours.
- Consistent iconography.
- Subtle transitions only where they improve feedback.
- Strong contrast and accessible focus states.
- Empty, loading, success and error states for every major workflow.

Avoid childish game visuals, excessive neon, dense dashboards, gratuitous gradients and decorative controls with no function.

### 8.2 Navigation

Five primary sections:
1. Home
2. Study
3. Planner
4. Focus
5. Progress

Desktop: persistent left sidebar with profile/settings access.  
Mobile: bottom navigation with safe-area spacing; secondary pages accessible without crowding the tab bar.  
Settings: profile/secondary navigation.

### 8.3 Responsive behaviour

- Design mobile-first and support 360px width.
- No horizontal page overflow.
- Tables become cards or horizontally scrollable only when appropriate.
- Calendar offers agenda/list mode on mobile.
- Timer controls are large enough for touch.
- Forms use mobile-friendly inputs and clear validation.
- Test portrait and landscape layouts.
- Support keyboard navigation on desktop and visible focus indicators.

### 8.4 Accessibility

- Use semantic HTML and accessible labels.
- Maintain WCAG AA contrast where practical.
- Do not communicate status using colour alone.
- Support keyboard navigation and reduced-motion preference.
- Provide accessible chart summaries or text equivalents.
- Use appropriate dialog focus management.

---

## 9. PWA and Offline Requirements

### 9.1 Installability

- Provide a valid web app manifest with name, short name, icons, theme colour, background colour and display mode.
- Provide appropriate icons and install guidance.
- Serve over HTTPS in production (localhost is acceptable for local development).
- Verify installation on supported Android browsers and desktop browsers.

### 9.2 Offline behaviour

**Must work offline**
- Open the previously loaded application shell.
- Read locally stored subjects, chapters, tasks, goals, exams and session history.
- Create and edit local records.
- Run the timer and save completed sessions.
- Update completion status and calculate local progress.
- Queue changes for later synchronisation.

**May be limited offline**
- First-time login/device registration.
- Sync status from the server.
- Remote backup operations.
- Cross-device updates until connectivity returns.

### 9.3 Service worker rules

- Cache static application assets and app shell.
- Use versioned cache names and clean old caches safely.
- Do not cache authenticated API responses in a way that exposes one user's data to another.
- IndexedDB is the local user-data store; service-worker cache is not a replacement for it.
- Show a clear offline indicator.

---

## 10. Notifications

- Timer completion notifications where browser/platform permissions allow.
- Optional reminders for upcoming exams and overdue tasks.
- Ask permission contextually, not immediately on first launch.
- The app must remain fully usable if notifications are denied.
- Explain platform limitations: browser/PWA background notifications may vary by device, browser and installation state.
- Do not promise exact alarm behaviour on every Android device or Windows browser.

---

## 11. Security, Privacy and Backup

- Single-user access is sufficient for initial release, but authentication is required for remote sync.
- Use HTTPS for remote traffic.
- Validate all client input on the server as well as client.
- Enforce record ownership in backend access rules.
- Protect secrets and backup files.
- Do not collect analytics or personal information unrelated to product operation.
- Do not send study data to external AI, advertising or analytics services.
- Provide full export and restore.
- Provide a clear destructive reset flow with typed confirmation or equivalent deliberate action.
- Document local browser storage limitations and server backup responsibilities.

---

## 12. Error Handling and Data Integrity

The application must:
- Validate required fields and reasonable value ranges.
- Prevent invalid subject/topic relationships.
- Prevent duplicate timer completion and duplicate XP awards.
- Preserve pending sync operations across refreshes.
- Retry transient network errors safely.
- Distinguish validation, offline, permission and server errors.
- Display actionable messages instead of raw stack traces.
- Confirm destructive operations.
- Use soft deletion/tombstones for synchronised records.
- Provide recovery for conflicted notes and failed imports.
- Avoid partially importing a backup; validate first, then commit transactionally where possible.

---

## 13. Testing and QA Plan

### 13.1 Test levels

- Unit tests: XP, level thresholds, streaks, goal calculations, date boundaries, CSV escaping and conflict rules.
- Component tests: forms, dialogs, timer controls, navigation and empty states.
- Integration tests: repositories, IndexedDB persistence, sync queue and backend APIs.
- End-to-end tests: complete user journeys in desktop and mobile browser contexts.
- Manual device tests: real Windows laptop and Android phone, including install and offline transitions.

### 13.2 Required test scenarios

| Area | Test |
|---|---|
| Subjects | Create, edit, archive, delete and duplicate handling |
| Syllabus | Create chapters/topics, update statuses, verify percentages |
| Tasks | Create, edit, complete, reopen, overdue and calendar display |
| Exams | Create, edit, countdown, past exam and preparation progress |
| Timer | Start, pause, resume, reset, finish, refresh recovery and background timing |
| Sessions | Verify actual duration, metadata, history and filters |
| XP | Award once, reject duplicate event, verify level threshold |
| Streaks | Threshold day, consecutive days, missed day, timezone boundary |
| Analytics | Compare charts and totals against known fixture records |
| CSV | Date filtering, UTF-8, commas/quotes/newlines and accurate totals |
| Backup | Export, import, invalid file, version mismatch and restore |
| Persistence | Refresh, close/reopen browser and device restart |
| Sync | Online propagation, offline queue, retry, duplicate prevention and conflicts |
| PWA | Install, launch, update and offline app shell |
| Responsive | 360px mobile, tablet and common laptop widths |
| Accessibility | Keyboard navigation, labels, contrast and reduced motion |

### 13.3 Release gate

Do not call the application complete until:
- All P0 workflows pass.
- No known critical data-loss or duplicate-award bug remains.
- Laptop-to-phone and phone-to-laptop sync tests pass.
- Offline edits survive reload and later synchronise.
- Backup and restore have been tested.
- PWA install has been verified on target platforms.
- README setup and recovery instructions are accurate.

Do not claim a test passed unless it was actually executed and its result recorded.

---

## 14. Delivery Plan and Milestones

A practical implementation sequence:

| Milestone | Deliverables |
|---|---|
| 1. Foundation | Project setup, design system, routing, local database, migrations |
| 2. Core study data | Subjects, chapters, topics, notes and syllabus progress |
| 3. Planning | Tasks, goals, exams and calendar |
| 4. Focus | Timer, session persistence and history |
| 5. Progression | XP ledger, levels, streaks and achievements |
| 6. Dashboard and analytics | Real metrics, charts and reports |
| 7. Sync and offline | Self-hosted backend, auth, sync queue, conflict handling, service worker |
| 8. Hardening | Import/export, responsive polish, accessibility, QA and documentation |

Cross-device sync architecture should be proven early (during Milestone 1 or 2), not left until the end. This reduces the risk of building features around a local-only data model that later needs major changes.

---

## 15. Documentation and Handover

The project must include a beginner-friendly README covering:

- Prerequisites and dependency installation.
- How to run the frontend locally.
- How to run/configure the self-hosted backend.
- Environment variables and safe secret handling.
- How to build for production.
- How to deploy the PWA over HTTPS.
- How to install on Android.
- How to access/install on Windows.
- How to connect a second device to the same account.
- How sync works and what happens offline.
- How to export and restore data.
- How to back up the server database.
- Common errors and recovery steps.

Also include:
- Architecture overview.
- Data model reference.
- Sync protocol and conflict policy.
- XP/streak calculation rules.
- Test instructions and known limitations.

---

## 16. Risks, Constraints and Open Decisions

| Risk / decision | Impact | Mitigation / decision |
|---|---|---|
| Self-hosted server unavailable | Devices cannot exchange changes until server returns | Local-first queue, retry, visible sync state and server backup |
| Remote access configuration | Phone may not reach a laptop-only server outside home | Use always-on host or secure private network/tunnel; never expose database unauthenticated |
| Offline edit conflicts | Potential loss of one version | Revision checks, field merge and recoverable conflict copies |
| Browser storage cleared | Local unsynced data may be lost | Sync indicator, backup reminders and export |
| PWA background limitations | Notifications/timer behaviour varies | Timestamp-based timer and best-effort notifications |
| Timezone changes | Streak/report day grouping may change | Store UTC timestamps plus IANA timezone; document policy |
| Scope growth | Delayed first usable release | Enforce P0/P1/P2 priorities and defer non-goals |

### 16.1 Decisions to confirm before production deployment

1. **Hosting location:** existing always-on home device, private server, or another self-hosted host.
2. **Remote access:** secure VPN/private network or HTTPS reverse proxy with authentication.
3. **Account protection:** password-based login and whether a recovery method is required.
4. **Backup policy:** manual export only or automated server-side backups.
5. **Conflict UX:** automatic safe merge plus conflict copy, or user choice for all same-field conflicts.

Recommended defaults: self-hosted PocketBase, authenticated HTTPS access, local IndexedDB cache, automatic sync queue, recoverable note conflicts and both manual export and scheduled server backups.

---

## 17. Final Acceptance Criteria

LEVEL UP is ready for personal daily use when all of the following are true:

- Runs successfully in a modern desktop browser on Windows.
- Installs or is accessible as a PWA on Android.
- Uses the same dataset on phone and laptop.
- Online changes normally propagate within five seconds.
- Offline changes are retained and sync after reconnection.
- Dashboard displays real data.
- Subjects, chapters and topics can be managed.
- Tasks, goals and examinations can be scheduled.
- Focus timer functions correctly and recovers safely after refresh.
- Study sessions are recorded accurately.
- XP, levels, streaks and achievements follow documented rules.
- Analytics and reports use actual records.
- CSV and full backup export work.
- Backup import/restore is validated.
- Data persists after application and device restarts.
- Core features remain usable offline.
- The interface is responsive and accessible.
- Major workflows and sync failure cases have been tested.
- Beginner-friendly documentation is provided.

**Product definition of done:** LEVEL UP is not complete when the screens are built. It is complete when the user's data is reliable, the workflows work end-to-end, and the same study life follows the user between laptop and phone.
