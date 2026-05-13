# Project Status & Implementation Tracker

> **Title:** Design and Development of an Intelligent Service Request Monitoring and Analysis Platform for ICT Department
> **Last Updated:** March 12, 2026

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
- [x] User management (CRUD, profile, avatar upload)
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
- [ ] **AI chatbot for guided ticket creation**
- [ ] **Natural language ticket input (NLP parsing)**
- [x] **Knowledge base / FAQ system** — full CRUD, search, categories, metrics, seeded with 6 ICT FAQs
- [x] **Smart suggestions (similar past tickets, auto-fill)** — Gemini AI analysis + fulltext similar ticket search + related KB articles
- [ ] **AI-powered search across tickets**

### Chunk A3: AI Chatbot ✅

1. [x] AI chatbot widget (floating button, conversation history, role-aware)
2. [x] RAG pipeline (KB + resolved tickets + solutions)
3. [x] Intent detection (ticket creation, report generation)
4. [x] Rich markdown rendering (tables, headers, Enter-to-send)

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
- [ ] **Smart routing based on staff expertise/availability**
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
- [ ] **Live activity feed (who's doing what right now)**

### Next Steps (Chunked)

#### Chunk C1: Real-Time Dashboard ✅

1. [x] Replace dashboard 60s polling with WebSocket-driven refresh using RealtimeService signals
2. [x] Add live counter animations when values change (pulse animation + live dot indicator)
3. [ ] Test: Create ticket in one tab, dashboard updates instantly in another

#### Chunk C2: Activity Feed

1. [ ] Create activity feed subscription (combines all events into chronological stream)
2. [ ] Add activity feed panel to dashboard (shows last 20 events: "User X created ticket", "Secretary reviewed ticket Y")
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
- [x] **Dedicated Analytics page with charts**
- [ ] **Trend analysis (tickets over time)**
- [ ] **Staff performance metrics (avg resolution time per staff)**
- [ ] **Department comparison reports**
- [ ] **Export to PDF/Excel**
- [x] **Date range picker for reports**

### Next Steps (Chunked)

#### Chunk D1: Analytics Page Foundation
1. [x] Install chart library (ng2-charts or ngx-echarts)
2. [x] Create analytics feature module with route /analytics
3. [x] Add navigation link for admin/head roles
4. [x] Create basic layout with date range picker calling `ticketAnalytics` query
5. [x] Test: Navigate to /analytics, see raw data from API

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
- [~] Backend: `actualDuration` field — now automatically calculated on RESOLVED/CLOSED status
- [ ] **SLA dashboard page (overdue tickets list, SLA compliance rate)**
- [ ] **SLA breach notifications (scheduled cron job)**
- [ ] **SLA breach escalation (auto-assign to manager)**
- [ ] **Performance scorecards per staff member**
- [ ] **SLA compliance percentage charts**

### Next Steps (Chunked)

#### Chunk E1: actualDuration Tracking
1. [x] When ticket status changes to RESOLVED or CLOSED, calculate and save `actualDuration` (time from creation to resolution in hours)
2. [x] Test: Resolve ticket, verify actualDuration is populated in DB

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

| Feature | Status | Completion |
|---------|--------|------------|
| 1a. AI-Powered Self-Service Portal | Partial | ~30% (basic portal, no AI) |
| 1b. Automated Ticket Routing | Partial | ~60% (rule-based, no AI) |
| 1c. Real-Time Tracking | **Done** | ~90% (WebSocket + signals) |
| 1d. Integrated Reporting & Analytics | Partial | ~40% (analytics page, date filter, no charts/export) |
| 1e. SLA Enforcement & Performance | Partial | ~50% (utils + tracker + actualDuration, no dashboard) |
| 1f. Ticket Lifecycle Management | **Done** | ~95% (full workflow) |
| Infrastructure | **Done** | ~95% |
