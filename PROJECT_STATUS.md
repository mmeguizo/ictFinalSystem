# Project Status & Implementation Tracker

> **Title:** Design and Development of an Intelligent Service Request Monitoring and Analysis Platform for ICT Department
> **Last Updated:** May 26, 2026

## Recent Update: May 26, 2026 — Documentation & Version Sync

- Updated the root `CHANGELOG.md` with a new `2.7.1` entry covering the manual ITS ticket detail fix, floating AI chat window UX improvements, and documentation synchronization work.
- Updated `docs/USER_MANUAL.md` version metadata and refreshed key sections for AI Quick Draft, admin skills management, the documentation center route, and the floating AI chat window behavior.
- Updated the shared in-app documentation page (`/docs`) so the latest changelog version and user-manual highlights now appear inside the frontend UI.

## Recent Update: May 26, 2026 — Manual ITS Ticket Detail Fix

- Fixed a ticket-detail loading bug where saved manual ITS tickets could appear in lists and notifications but fail to open with "Ticket not found".
- Root cause: the GraphQL `Ticket.controlNumber` field was declared non-null while the database allows null and the ITS creation path did not populate it. GraphQL could therefore null the whole `ticketByNumber` response for existing ITS rows with no control number.
- Updated the backend GraphQL schema so `controlNumber` matches the database as optional.
- Updated `createITSTicket()` to generate and persist a control number for new ITS tickets so future manual ITS tickets open correctly from direct links and notifications.

## Recent Update: May 26, 2026 — Smart Routing by Expertise (Feature 1b)

- Implemented **Smart Routing by Expertise** (Feature 1b): Tickets are now auto-assigned to the best-qualified, least-busy staff member instead of any available person.
- Added new **`UserSkill` Prisma model** with a dedicated `user_skills` database table (migration `20260526013917_add_user_skills`). Skill tags: `WEBSITE`, `SOFTWARE`, `BORROW_REQUEST`, `MAINTENANCE_DESKTOP_LAPTOP`, `MAINTENANCE_INTERNET_NETWORK`, `MAINTENANCE_PRINTER`.
- **Completely rewrote `AutoAssignmentService.assignTicket()`**: builds a required-skills list from ticket checkbox fields and keyword hints, scores DEVELOPER/TECHNICAL candidates by matching-skill count descending then workload ascending, falls back to MIS_HEAD/ITS_HEAD if no specialist found. Routing reason is written to `TicketStatusHistory`.
- Added **`updateUserSkills` GraphQL mutation** (ADMIN only) using an atomic `$transaction` delete + bulk insert. Added `skills: [String!]!` field on the `User` GraphQL type.
- Added **Admin Panel Skills Management UI**: "Skills / Expertise" column in the user table showing skill `nz-tag` badges; "Manage Skills" button per row opening a multi-select modal.
- Re-seeded the database with 11 staff users each carrying realistic skill profiles.
- Regenerated `graphql.ts` via `npm run codegen` — clean pass with all new types and operations.

## Previous Update: May 26, 2026 — Natural Language Ticket Input (Feature 1a) & Department Comparison (Feature 1d)

- Implemented **Natural Language Ticket Input** (Feature 1a) with real-time NLP parsing and form pre-fill! Users can now submit a single unstructured sentence (e.g. _"I want to borrow a projector and laptop under MRN-401 for room 103 tomorrow morning for 2 hours"_) and have the form automatically choose between MIS or ITS departments, patch checklist choices, and fill out details in real-time using Gemini AI or raw fallback parsing.
- Implemented **Department Comparison Reports** (Feature 1d) as a dedicated comparative analytics tab on the Analytics page.
- Enabled multi-department (MIS vs ITS) analytics in the backend GraphQL schema by extending `AnalyticsFilterInput` and `slaMetrics` to support an optional `type` filter.
- Developed side-by-side grouped comparative bar charts for Status and Priority breakdown across MIS and ITS departments.
- Constructed a Head-to-Head Key Performance Indicators (KPIs) comparison dashboard showcasing SLA Compliance, Average Resolution hours, SLA breaches, and completed volume.
- Fully validated the build (both backend code and final frontend package) with zero errors.

## Previous Update: May 25, 2026

- Added a global `ticketAssignmentActivity` GraphQL subscription so dashboards can observe all ticket assignment events without breaking the existing per-user assignment subscription.
- Extended the Angular `RealtimeService` to maintain a capped 20-item live activity stream from ticket-created, assignment, and status-change events.
- Added a Live Activity panel to the dashboard and wired assignment activity into the dashboard's WebSocket refresh trigger so counters stay current after assignments made to other users.
- Validated both frontend and backend successfully with `npm run build`.

## Previous Update: May 14, 2026

- Hardened ticket RBAC in the backend so `MIS_HEAD` and `ITS_HEAD` are now restricted to their own department tickets when reading ticket details, ticket-number lookups, ticket lists, analytics, SLA metrics, trends, staff performance, note management, and attachment management.
- Restricted the generic `tickets` and analytics GraphQL queries to staff/privileged roles instead of any authenticated user.
- Added department-scope checks before head-level ticket actions such as review, approval, assignment, acknowledgement, resolution updates, and note creation.
- Validated the backend successfully with `npm run build`.

---

## Legend

- [x] Fully implemented and working
- [~] Partially implemented (needs more work)
- [ ] Not yet started

---

## Infrastructure & Foundation

- [x] Database schema (Prisma + MySQL, 14 migrations)
- [x] Backend server (Express 4 + Apollo Server 3 + GraphQL)
- [x] Frontend framework (Angular 20 + NG-ZORRO)
- [x] Authentication — JWT + Auth0 SSO + local login
- [x] Authorization — 8 roles (ADMIN, DIRECTOR, SECRETARY, MIS_HEAD, ITS_HEAD, DEVELOPER, TECHNICAL, USER)
- [x] Role-based route guards (authGuard, adminGuard, guestGuard, approverGuard, secretaryGuard, userTicketGuard)
- [x] User management (CRUD, profile, avatar upload, avatar initial fallback)
- [x] File storage (multer, avatar + ticket attachments)
- [x] WebSocket infrastructure (graphql-ws, PubSub, 4 event types)
- [x] Real-time service (Angular signals — lastNotification, lastStatusChange, lastTicketCreated, lastAssignment)
- [x] Notification system (14+ triggers, real-time push + 30s polling fallback)
- [x] Notification bell component with badge + dropdown
- [x] Notifications page (/notifications)
- [x] Real-time table refresh (secretary-approval, my-tickets, ticket-detail auto-refresh on WS events)
- [x] User deactivation (service methods + admin UI + deactivate-first delete workflow)

---

## Feature 1a: AI-Powered Self-Service Portal

### What It Means

An intelligent portal where users can submit tickets, get AI-assisted suggestions, search a knowledge base, and receive automated recommendations.

### Status

- [x] Basic self-service ticket submission (MIS + ITS forms at /tickets/new)
- [x] Users can view their own tickets (myCreatedTickets query)
- [x] Users can track ticket status in real-time
- [x] Users can reopen cancelled tickets
- [x] **AI chatbot for guided ticket creation**
- [x] **Natural language ticket input (NLP parsing)**
- [x] **Knowledge base / FAQ system** — full CRUD, search, categories, metrics, seeded with 6 ICT FAQs
- [x] **Smart suggestions (similar past tickets, auto-fill)** — Gemini AI analysis + fulltext similar ticket search + related KB articles
- [ ] **AI-powered search across tickets**

### Chunk A3: AI Chatbot ✅

1. [x] AI chatbot widget (floating button, conversation history, role-aware)
2. [x] RAG pipeline (KB + resolved tickets + solutions)
3. [x] Intent detection (ticket creation, report generation, role-based help, out-of-scope redirect)
4. [x] Rich markdown rendering (tables, headers, Enter-to-send)
5. [x] Role-based `/help` command with capability and restriction guidance
6. [x] Out-of-scope guardrails with quick-option redirect inside chat
7. [x] Chat scope hardening to keep answers inside supported ICT capabilities

---

## Feature 1b: Automated Ticket Routing and Categorization

### What It Means

Tickets are automatically routed to the right department/person and categorized intelligently.

### Status

- [x] Rule-based auto-routing by ticket type (MIS → MIS_HEAD, ITS → ITS_HEAD)
- [x] Workload-based assignment (selectUserByWorkload in auto-assignment.service.ts)
- [x] Auto-assign after director approval (approveAsDirector → autoAssignment.assignTicket)
- [x] Manual assignment by department heads (MIS_HEAD assigns DEVELOPER, ITS_HEAD assigns TECHNICAL)
- [x] Manual unassign capability
- [x] **AI-based ticket categorization** — Gemini AI classifies into Network/Hardware/Software/Account Access/Printer/Security/Other
- [x] **Priority auto-suggestion based on content** — keyword NLP engine with confidence scoring + Gemini AI priority analysis
- [x] **Smart routing based on staff expertise/availability** — UserSkill model, skills-scoring algorithm, keyword heuristics, workload tiebreaker, graceful fallback to head
- [x] **Escalation rules (auto-escalate if SLA breach — 2-level cron job)**

### Next Steps (Chunked)

#### Chunk B1: Escalation Rules ✅

1. [x] Create scheduled job (cron) that checks for SLA breaches every 5 minutes
2. [x] When ticket is overdue: create notification to department head + admin
3. [x] Add `escalatedAt` and `escalationLevel` fields to Ticket model
4. [x] Show escalation badge on overdue tickets in UI
5. [ ] Test: Create ticket, wait for SLA to pass, verify escalation notification

#### Chunk B2: Smart Priority Suggestion ✅

1. [x] Analyze ticket description keywords to suggest priority (e.g., "urgent", "broken", "down" → HIGH) — priority-suggestion.ts with weighted keyword rules + category weights
2. [x] Show suggested priority on ticket creation form (user can override) — priority selector + suggestion badge with confidence indicator
3. [ ] Test: Type "server is down" → system suggests HIGH priority

#### Chunk B3: AI Categorization ✅ (via Gemini)

1. [x] Train/integrate text classifier for ticket type/category — Gemini AI analyzes and classifies tickets
2. [x] Auto-suggest category based on description — shown in AI Analysis panel on ticket creation form
3. [ ] Test: Describe network issue → system suggests ITS/NETWORK_MAINTENANCE

---

## Feature 1c: Real-Time Tracking and Status Updates

### What It Means

Users and staff can see ticket progress in real-time without refreshing the page.

### Status

- [x] WebSocket server (graphql-ws over ws)
- [x] PubSub event system (4 events: TICKET_STATUS_CHANGED, TICKET_CREATED, TICKET_ASSIGNED, NOTIFICATION_CREATED)
- [x] GraphQL subscriptions (ticketStatusChanged, ticketCreated, ticketAssigned, notificationCreated)
- [x] Frontend RealtimeService with Angular signals
- [x] Notification bell with real-time push + polling fallback
- [x] Real-time table refresh on secretary-approval page
- [x] Real-time table refresh on my-tickets page
- [x] Real-time ticket detail auto-refresh
- [x] Force-refresh on notification click (forceTicketRefresh signal)
- [x] Status history timeline on ticket detail page
- [x] SLA Processing Time Tracker on ticket detail page (5 steps × 5 min)
- [x] Dashboard with WebSocket-driven real-time refresh (upgraded from 60s polling)
- [x] SLA reminder banner on login (Processing Time awareness)
- [x] **Real-time dashboard counters (WebSocket-driven, not polling)** — live indicator, pulse animations, 5-min fallback
- [x] **Live activity feed (who's doing what right now)**

### Next Steps (Chunked)

#### Chunk C1: Real-Time Dashboard ✅

1. [x] Replace dashboard 60s polling with WebSocket-driven refresh using RealtimeService signals
2. [x] Add live counter animations when values change (pulse animation + live dot indicator)
3. [ ] Test: Create ticket in one tab, dashboard updates instantly in another

#### Chunk C2: Activity Feed ✅

1. [x] Create activity feed subscription (combines all events into chronological stream)
2. [x] Add activity feed panel to dashboard (shows last 20 events: "User X created ticket", "Secretary reviewed ticket Y")
3. [ ] Test: Multiple users perform actions, all appear in feed

---

## Feature 1d: Integrated Reporting and Analytics

### What It Means

Dashboards and reports with charts, graphs, trends, and exportable data for ICT managers.

### Status

- [x] Backend: `ticketAnalytics` query (total, byStatus, byType, byPriority with date range filter)
- [x] Backend: `slaMetrics` query (overdue, dueToday, dueSoon, complianceRate, averageResolutionHours, overdueTickets)
- [x] Backend: `ticketTrends` query (created/resolved per day with date range filter)
- [x] Backend: `staffPerformance` query (per-staff assigned, resolved, avg resolution, SLA compliance)
- [x] Dashboard page with basic stat cards (total, ongoing, in-progress, resolved, etc.)
- [x] Recent tickets table on dashboard
- [x] **Dedicated Analytics page with charts (/analytics)**
- [x] **Trend analysis (tickets over time — created vs resolved per day)**
- [x] **Staff performance metrics (avg resolution time per staff)**
- [x] **Date range picker for reports**
- [x] **Export to PDF/Excel (jsPDF + xlsx libraries)**
- [x] **Department comparison reports**

### Next Steps (Chunked)

#### Chunk D1: Analytics Page Foundation ✅

1. [x] Install chart library (ng2-charts + chart.js)
2. [x] Create analytics feature module with route /analytics
3. [x] Add navigation link for admin/head roles
4. [x] Create basic layout with date range picker calling `ticketAnalytics` query
5. [ ] Test: Navigate to /analytics, see raw data from API

#### Chunk D2: Charts — Tickets Overview ✅

1. [x] Pie chart: Tickets by Status
2. [x] Pie chart: Tickets by Type (MIS vs ITS)
3. [x] Bar chart: Tickets by Priority
4. [x] Stat cards: Total, Open, Resolved, Overdue
5. [ ] Test: Charts render with real data, date filter works

#### Chunk D3: Charts — Trends & Performance ✅

1. [x] Line chart: Tickets created per day/week/month
2. [x] Line chart: Average resolution time trend
3. [x] Bar chart: Staff workload (tickets per staff member)
4. [x] Table: Staff performance (avg resolution time, tickets completed)
5. [ ] Test: Trend charts show meaningful data

#### Chunk D4: Export & Reports ✅

1. [x] Add "Export to PDF" button (using jsPDF + jspdf-autotable)
2. [x] Add "Export to Excel" button (using xlsx + file-saver)
3. [x] Generate formatted report with header, date range, charts, and data tables
4. [ ] Test: Export produces readable PDF/Excel file

---

## Feature 1e: SLA Enforcement and Performance Tracking

### What It Means

Service Level Agreements are enforced automatically — the system tracks processing time for each step and alerts when deadlines are missed.

### Status

- [x] Backend: SLA utility functions (calculateDueDate, calculateEstimatedDuration, calculateSLACompliance, isOverdue, getTimeRemaining)
- [x] Backend: Due date auto-calculation on ticket creation (CRITICAL: 4h, HIGH: 24h, MEDIUM: 72h, LOW: 168h)
- [x] Backend: `slaMetrics` query (overdue, dueToday, dueSoon)
- [x] Frontend: SLA Processing Time Tracker on ticket detail (5-step timeline with progress)
- [x] Frontend: SLA reminder banner/modal on login (awareness for users)
- [x] Backend: `actualDuration` field — auto-calculated on RESOLVED/CLOSED status change
- [x] **SLA dashboard tab (overdue tickets list, SLA compliance rate, avg resolution time)**
- [x] **SLA breach notifications (node-cron, every 5 minutes)**
- [x] **SLA breach escalation (2-level: staff+head → admin+director)**
- [ ] **Performance scorecards per staff member**
- [ ] **SLA compliance percentage charts**

### Next Steps (Chunked)

#### Chunk E1: actualDuration Tracking ✅

1. [x] When ticket status changes to RESOLVED or CLOSED, calculate and save `actualDuration` (time from creation to resolution in hours)
2. [ ] Test: Resolve ticket, verify actualDuration is populated in DB

#### Chunk E2: SLA Breach Cron Job ✅

1. [x] Create scheduled task (node-cron) that runs every 5 minutes
2. [x] Query tickets where `dueDate < now` and status is not RESOLVED/CLOSED/CANCELLED
3. [x] Create notification for assigned staff + head + admin: "Ticket X is overdue"
4. [x] Mark ticket as `escalatedAt = now` to avoid duplicate notifications
5. [ ] Test: Create LOW priority ticket, manually set dueDate to past, verify notification sent

#### Chunk E3: SLA Dashboard ✅

1. [x] Create SLA dashboard page at /sla or integrate into /analytics (Tab 2 in Analytics)
2. [x] Show: Overdue tickets list with time exceeded
3. [x] Show: SLA compliance rate (% completed within SLA) with progress circle
4. [x] Show: Average processing time per step vs expected
5. [ ] Test: Page loads with real data, overdue tickets are highlighted

---

## Feature 1f: Comprehensive Ticket Lifecycle Management

### What It Means

Full end-to-end ticket management from creation through multi-stage approval, assignment, scheduling, monitoring, resolution, and closure.

### Status

- [x] 11 ticket statuses: FOR_REVIEW → REVIEWED → DIRECTOR_APPROVED → ASSIGNED → PENDING_ACKNOWLEDGMENT → SCHEDULED → IN_PROGRESS → ON_HOLD → RESOLVED → CLOSED → CANCELLED
- [x] Secretary review workflow (reviewAsSecretary / rejectAsSecretary)
- [x] Director approval workflow (approveAsDirector / disapproveAsDirector)
- [x] Auto-assignment after director approval
- [x] Manual assignment by department heads
- [x] Schedule visit workflow (head sets dateToVisit + targetCompletion)
- [x] Admin schedule acknowledgment (acknowledgeSchedule / rejectSchedule)
- [x] Monitoring workflow (addMonitorAndRecommendations)
- [x] Status updates by staff (IN_PROGRESS, ON_HOLD, RESOLVED)
- [x] Ticket closure
- [x] Ticket reopen (creator can reopen CANCELLED tickets)
- [x] Notes system (internal/public with notifications)
- [x] **Delete ticket notes** — Staff roles can delete notes; USER role blocked at resolver level
- [x] **Toggle note visibility** — Staff can switch notes between Internal and Public inline from ticket detail
- [x] File attachments (upload, download, soft-delete)
- [x] Control number generation (atomic counter)
- [x] Polymorphic ticket types (MIS: WEBSITE/SOFTWARE, ITS: borrow/maintenance)
- [x] Dual department forms (MIS form, ITS form)
- [ ] **Ticket templates (pre-filled forms for common requests)**
- [ ] **Ticket duplication (clone existing ticket)**
- [ ] **Bulk operations (close multiple, assign multiple)**
- [ ] **Ticket merge (combine duplicate tickets)**
- [x] **Satisfaction survey (after resolution — star rating + comments)**

### AI Chatbot / Self-Service Chat

- [x] **AI chatbot widget** — Floating chat button on all pages; conversation history; role-aware responses
- [x] **RAG context from Knowledge Base** — AI searches KB articles for relevant answers
- [x] **RAG context from resolved tickets** — AI searches past resolved tickets (title, description, resolution, staff notes) for similar issues
- [x] **RAG context from Troubleshooting Solutions** — AI searches curated solution database
- [x] **Ticket creation from chat** — AI can detect intent and guide user to create a ticket
- [x] **Excel report download from chat** — AI detects report requests and renders clickable download buttons
- [x] **Operational admin/staff chat queries** — Chat now answers approval queues, escalations, workload, department/category breakdowns, user summaries, and KB/solution coverage from selected Prisma tables
- [x] **Role-based help and restrictions** — `/help` now shows allowed capabilities and limits per user role
- [x] **Out-of-scope quick redirect** — Non-ICT prompts are redirected back to supported quick options instead of free-form answers
- [x] **Hallucination reduction guardrails** — Backend pre-checks and prompt constraints now keep chat responses aligned with system-backed capabilities
- [x] **Persistent non-modal chat drawer** — Users can keep the AI chat open while clicking other tabs and links unless they explicitly close it
- [x] **Profile-aware user avatars** — Chat messages and the header now use the current user's avatar, with first-letter fallback when no valid image is available
- [x] **Deletion safeguard policy in chat** — Chat explains deactivate-vs-delete rules and audited hard deletes, but stays read-only for destructive actions
- [x] **Rich markdown in chat** — Tables, headers, blockquotes, code blocks, bold/italic rendered properly
- [x] **Enter-to-send keyboard shortcut** — Enter sends message; Shift+Enter inserts newline

### Troubleshooting Solutions Database

- [x] **Solutions CRUD** — Staff can create, edit, delete curated troubleshooting solutions
- [x] **Auto-extraction from resolved tickets** — When a ticket is resolved, a solution is automatically created from title + description + resolution + staff notes (default visibility: INTERNAL)
- [x] **Solution visibility control** — PUBLIC / INTERNAL visibility flag; USER role sees PUBLIC only via API
- [x] **Embedding generation** — Each solution gets a vector embedding for semantic RAG search
- [x] **Solutions used in AI RAG pipeline** — Semantic search + fulltext search against solution database

### Next Steps (Chunked)

#### Chunk F1: Satisfaction Survey ✅

1. [x] Add `satisfactionRating` (1-5) and `satisfactionComment` fields to Ticket model
2. [x] Create migration (20260224065532_add_escalation_and)
3. [x] Add `submitSatisfaction` mutation (only by ticket creator, only when RESOLVED/CLOSED)
4. [x] On ticket detail page (for creator): Show rating modal with star selector when status is RESOLVED/CLOSED
5. [ ] Test: Creator rates resolved ticket, data saved

#### Chunk F2: Ticket Templates

1. [ ] Create `TicketTemplate` model (name, type, category, defaultTitle, defaultDescription, defaultPriority)
2. [ ] Admin can create/manage templates
3. [ ] On ticket creation page: "Use Template" dropdown that pre-fills form
4. [ ] Test: Select template, form auto-fills, submit works

---

## Recommended Implementation Order

These are ordered by **research alignment** (most critical for the thesis) and **dependency chain**:

### Phase 1: SLA & Analytics (Highest research value)

1. **Chunk E1** — actualDuration tracking (1-2 hours)
2. **Chunk D1** — Analytics page foundation (2-3 hours)
3. **Chunk D2** — Charts: Tickets overview (2-3 hours)
4. **Chunk E3** — SLA Dashboard (3-4 hours)
5. **Chunk D3** — Charts: Trends & performance (3-4 hours)

### Phase 2: Enforcement & Automation

6. **Chunk E2** — SLA breach cron job + notifications (3-4 hours)
7. **Chunk B1** — Escalation rules (2-3 hours)
8. **Chunk C1** — Real-time dashboard (no polling) (1-2 hours)

### Phase 3: Reporting & Export

9. **Chunk D4** — Export to PDF/Excel (3-4 hours)
10. **Chunk F1** — Satisfaction survey (2-3 hours)

### Phase 4: Intelligence & Knowledge

11. ~~**Chunk A1** — Knowledge base foundation~~ ✅
12. ~~**Chunk A2** — Smart ticket suggestions~~ ✅
13. ~~**Chunk B2** — Smart priority suggestion~~ ✅

### Phase 5: Advanced (If time permits)

14. **Chunk C2** — Activity feed (2-3 hours)
15. **Chunk F2** — Ticket templates (2-3 hours)
16. **Chunk A3** — AI chatbot (8-12 hours, requires AI API)
17. ~~**Chunk B3** — AI categorization~~ ✅ (via Gemini)

---

## Summary Matrix

| Feature                              | Status   | Completion                                                                                                                                                      |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a. AI-Powered Self-Service Portal   | **Done** | ~95% (portal + KB + AI suggestions + chatbot + RAG pipeline + markdown rendering + operational chat answers + help/out-of-scope guardrails + persistent drawer) |
| 1b. Automated Ticket Routing         | Partial  | ~85% (rule-based + escalation + AI categorization)                                                                                                              |
| 1c. Real-Time Tracking               | **Done** | ~97% (WebSocket + signals + real-time dashboard + assignment events)                                                                                            |
| 1d. Integrated Reporting & Analytics | **Done** | ~94% (analytics + charts + trends + PDF/Excel + Excel-from-chat + staff/admin chat queries)                                                                     |
| 1e. SLA Enforcement & Performance    | Partial  | ~88% (cron + escalation + SLA dashboard + tracker fix)                                                                                                          |
| 1f. Ticket Lifecycle Management      | **Done** | ~98% (full workflow + satisfaction survey + note management)                                                                                                    |
| AI Training Pipeline                 | **Done** | ~95% (auto-extract solutions + notes in RAG + visibility enforcement)                                                                                           |
| Infrastructure                       | **Done** | ~97%                                                                                                                                                            |

---

## Recent Fixes & Improvements (May 11, 2026)

### Bug Fixes

- **User quick-menu chat routing fixed** — Regular-user prompts for Internet / Network, Printer Issues, Software / Apps, and Check Ticket Status no longer get blocked by the staff-only analytics/report denial branch.
- **Ticket-status prompt no longer misread as analytics** — Analytics matching now requires real reporting terms, so "status of my tickets" stays in the ticket-status flow instead of matching the `stat` substring in "status".
- **Category analytics detection tightened** — Bare troubleshooting words like `internet`, `printer`, and `software` no longer trigger department breakdown analytics unless the message also asks for counts, summaries, reports, or breakdowns.
- **Ticket-status fallback improved** — When a user asks about their tickets but has none yet, chat now returns a direct "no recent tickets" response instead of falling through to a generic answer.
- **Report detection narrowed** — Bare mentions of Excel no longer count as report requests unless the message is actually asking for an Excel report/export.

---

## Recent Fixes & Improvements (May 7, 2026)

### New Features

- **Delete ticket notes** — Staff roles can delete any note via the ticket detail page. Regular users are blocked at the API level.
- **Toggle note visibility** — Staff can flip a note between Internal (staff-only) and Public (visible to ticket creator) without leaving the page.
- **AI training pipeline from resolved tickets** — Auto-creates a TroubleshootingSolution when any ticket reaches RESOLVED/CLOSED status. Staff notes are included in the extracted solution content. Solutions start as INTERNAL so staff can review before publishing.
- **Staff notes in AI chat context** — The AI chat assistant now retrieves staff notes from resolved tickets via the RAG pipeline, giving the AI access to technician observations and workarounds.
- **Solution visibility enforcement** — USER role cannot see INTERNAL troubleshooting solutions via GraphQL API; restricted at resolver level.
- **Operational chat answers for staff/admin** — The chat assistant now runs safe table-backed queries for approval queues, escalations, workloads, KB/solution coverage, and department-specific ticket breakdowns instead of relying only on generic analytics summaries.
- **Admin-only user directory answers in chat** — Aggregate user counts are available to staff/admin, while person-level user lists stay ADMIN only in chat.
- **Deletion safeguard policy surfaced in chat** — The assistant now explains why hard-delete can be blocked and recommends deactivation/reassignment without attempting destructive actions.
- **Chat widget: rich markdown** — Full GFM markdown support using `marked` v18 (tables, headers, blockquotes, code blocks, HR). Custom compact heading renderer prevents oversized H1 text in chat bubbles.
- **Chat widget: Enter-to-send** — Enter key sends message; Shift+Enter inserts newline.

### Bug Fixes

- **Send button disappearing** — `nz-input-group` wrapper applied `overflow: hidden` which clipped the Send button on mouse-out; replaced with plain flex layout.
- **Build error: `ticketId` in note queries** — Three GQL query selections were missing `ticketId` on note sub-fields causing TS2345 at build time.
- **Phantom roles** — `ICT_STAFF` and `SUPERVISOR` role strings (not in Prisma enum) replaced with correct values in 4 backend locations.
- **Report access role alignment** — Added `SECRETARY` to the REST report-download permission check so chat-generated report links and backend authorization use the same staff role list.
- **Auth token key mismatch** — HTTP interceptor now reads correct `auth_token` key.
- **JWT_SECRET guard** — Backend refuses to start in production without a secure `JWT_SECRET`.
- **Form subscription memory leak** — `valueChanges` subscriptions in MIS/ITS forms were never unsubscribed; fixed with proper cleanup.

### Documentation

- **Client-meeting documentation refresh** — Updated `CHANGELOG.md`, `docs/USER_MANUAL.md`, `docs/BACKEND_API_MANUAL.md`, and `CLIENT_FEATURE_REPORT.md` to cover operational chat answers, admin-only user-directory questions, delete safeguards, and the finalized report-access role list.
- **Copilot handoff context** — Added `.copilot-context.md` at the repo root so future Copilot chats can resume from the latest AI chat/admin safeguards workstream and validation steps.

---

## Recent Fixes & Improvements (March 13, 2026)

### Bug Fixes

- **Gemini JSON truncation** — Increased `maxOutputTokens` from 1024 to 2048; added partial JSON recovery for truncated responses
- **SLA tracker not updating on assignment** — `manualAssign()` now properly records `DIRECTOR_APPROVED → ASSIGNED` status history entry (was missing, causing SLA tracker Step 3 to appear stuck)
- **Real-time SLA tracker for ticket creator** — `assignUser()` now publishes `TICKET_STATUS_CHANGED` event (was only publishing `TICKET_ASSIGNED` per-user), so the ticket creator's SLA tracker updates without page reload
- **Developer can't start work on SCHEDULED tickets** — Added `SCHEDULED` to `canUpdateStatus` workable statuses; added "Start Work" button for `SCHEDULED` status in ticket detail

### Improvements

- **AI clean_ticket actionable** — Added "Apply to Description" button that copies AI-rewritten description into the form's Additional Notes field
- **SLA reminder popup scoped** — Auto-popup now only shows for regular users (USER role); "Learn More" button remains for all roles
- **Status transition `SCHEDULED → IN_PROGRESS`** — Added default comment in repository

### Documentation (Session 3)

- **In-app Documentation page** — Created `/docs` route with Changelog and User Manual tabs rendered as styled HTML
- **Admin sidebar link** — "Documentation" menu item with book icon visible to ADMIN role (all roles can access via URL)
- **CHANGELOG.md updated** — Added v2.2.0, v2.1.0, v2.0.0 entries covering all work since December 2025
- **User Manual created** — Comprehensive `docs/USER_MANUAL.md` with 19 sections covering all features, roles, and workflows
- **Interactive navigation** — Table of Contents links scroll smoothly to sections; "Back to TOC" buttons after each section; floating back-to-top button (appears after scrolling 300px)
