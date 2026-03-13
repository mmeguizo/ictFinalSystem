# Changelog

All notable changes to the ICT Support Ticketing System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-03-12

### Added - Analytics Page & SLA Tracking

This release implements Phase 1 of the SLA & Analytics roadmap.

#### actualDuration Tracking (Chunk E1)
- **Backend**: When a ticket status changes to `RESOLVED`, the system now automatically calculates and saves `actualDuration` (hours from creation to resolution)
- **Backend**: When a ticket status changes to `CLOSED` without a prior resolution, `actualDuration` is also calculated
- This enables future SLA compliance reporting and staff performance metrics

#### Analytics Page Foundation (Chunk D1)
- **New Route**: `/analytics` — Dedicated analytics page accessible to ADMIN, DIRECTOR, MIS_HEAD, ITS_HEAD, SECRETARY roles
- **Date Range Filter**: Date range picker to filter analytics by time period
- **Overview Statistics**: Total tickets, open/active, resolved/closed, and overdue counts
- **SLA Compliance**: Visual compliance rate with circular progress indicator
- **SLA Status**: Overdue, Due Today, and Due Soon metrics with color-coded indicators
- **Ticket Type Breakdown**: MIS vs ITS distribution with progress bars
- **Status Breakdown**: Table showing ticket counts per status with visual distribution bars
- **Priority Breakdown**: Table showing ticket counts per priority level
- **Navigation**: Analytics menu item added to sidebar for authorized roles

#### Frontend GraphQL Queries
- Added `TICKET_ANALYTICS` query with date range filter support
- Added `SLA_METRICS` query for real-time SLA compliance data
- Added `TicketAnalytics`, `SLAMetrics`, `StatusCount`, `TypeCount`, `PriorityCount` interfaces

### Files Modified
- `backend/src/modules/tickets/ticket.repository.ts` — actualDuration calculation on status change
- `frontend/src/app/core/services/ticket.service.ts` — Analytics GraphQL queries and interfaces
- `frontend/src/app/features/analytics/analytics.page.ts` — New analytics component
- `frontend/src/app/features/analytics/analytics.page.html` — Analytics page template
- `frontend/src/app/features/analytics/analytics.page.scss` — Analytics page styles
- `frontend/src/app/app.routes.ts` — Analytics route with approverGuard
- `frontend/src/app/layout/main-layout.ts` — Analytics navigation menu item
- `PROJECT_STATUS.md` — Updated completion status for Chunks E1 and D1
- `CHANGELOG.md` — This entry

---

## [1.3.0] - 2025-12-19

### Fixed — SLA Tracker & Real-Time Updates

#### Bug Fixes

- **SLA tracker stuck on Assignment step** — When MIS head assigns a staff member, the `DIRECTOR_APPROVED → ASSIGNED` transition now properly records a status history entry. Previously `manualAssign()` only recorded history for `FOR_REVIEW` tickets, so the SLA tracker couldn't find the transition.
- **Ticket creator's SLA tracker not updating in real-time** — `assignUser()` now publishes `TICKET_STATUS_CHANGED` event in addition to `TICKET_ASSIGNED`. Since `TICKET_ASSIGNED` is per-user (only the assigned staff), the ticket creator was never notified of status changes during assignment.
- **Gemini AI JSON truncation** — Increased `maxOutputTokens` from 1024 → 2048 to prevent response truncation. Added partial JSON recovery logic that attempts to repair truncated JSON by closing unclosed brackets/braces before failing.
- **Developer can't start work on SCHEDULED tickets** — Added `SCHEDULED` to the `canUpdateStatus` workable statuses. Developers now see "Start Work" and "Update Status & Details" buttons when their ticket is in `SCHEDULED` status.

#### Improvements

- **AI clean_ticket actionable** — Added "Apply to Description" button in the AI Analysis panel on the submit-ticket page. When clicked, copies the AI-rewritten description into the form's Additional Notes field.
- **SLA reminder popup scoped to regular users** — The auto-popup SLA processing time modal now only appears for `USER` role (requesters). The "Learn More" button on the SLA banner remains available to all roles.
- **SCHEDULED → IN_PROGRESS transition** — Added default status comment in repository transition map.

#### Files Modified

- `backend/src/modules/ai/gemini.service.ts` — maxOutputTokens increase, `mapAnalysis()` helper, `repairTruncatedJson()` recovery
- `backend/src/modules/tickets/services/auto-assignment.service.ts` — `manualAssign()` now creates status history for DIRECTOR_APPROVED → ASSIGNED
- `backend/src/modules/tickets/services/ticket.service.ts` — `assignUser()` publishes TICKET_STATUS_CHANGED event
- `backend/src/modules/tickets/ticket.repository.ts` — Added SCHEDULED → IN_PROGRESS default comment
- `frontend/src/app/features/tickets/ticket-detail.page.ts` — Added SCHEDULED to workable statuses
- `frontend/src/app/features/tickets/ticket-detail.page.html` — Added SCHEDULED case with Start Work button
- `frontend/src/app/features/tickets/submit-ticket.page.ts` — Added `applyCleanTicket()` method
- `frontend/src/app/features/tickets/submit-ticket.page.html` — AI clean_ticket display with Apply button
- `frontend/src/app/features/tickets/submit-ticket.page.scss` — Clean ticket styling
- `frontend/src/app/features/tickets/mis-form.component.ts` — Added `setDetails()` method
- `frontend/src/app/features/tickets/its-form.component.ts` — Added `setDetails()` method
- `frontend/src/app/features/dashboard/dashboard.page.ts` — SLA popup scoped to USER role

---

## [2.1.0] - 2026-03-12

### Added — AI-Powered Ticket Analysis (Gemini Integration)

#### Features

- **Gemini AI ticket analysis** — Analyzes ticket descriptions using Google Gemini 2.0 Flash to provide: clean rewritten description, summary, category classification, priority assessment, root cause analysis, suggested solutions, and keywords
- **Smart Suggestions on ticket creation** — "Analyze with AI" button on submit-ticket page that queries AI + searches similar resolved tickets + finds related Knowledge Base articles
- **Similar tickets search** — MySQL fulltext search in BOOLEAN MODE on Ticket(title, description) to find past tickets with similar issues
- **Related KB articles** — Searches Knowledge Base articles by keywords extracted from the ticket description
- **AI priority auto-apply** — If AI returns a priority and user hasn't manually overridden, the suggested priority is auto-applied

#### Backend

- Created `backend/src/modules/ai/` module: `gemini.service.ts`, `ai.types.ts`, `ai.resolvers.ts`, `index.ts`
- Added `GEMINI_API_KEY` and `GEMINI_MODEL` to backend config
- Added fulltext index on `Ticket(title, description)` with migration `20260312_add_fulltext_index`
- Registered AI module in Apollo Server

#### Frontend

- Created `frontend/src/app/core/services/ai.service.ts` — Apollo GraphQL service with `getSmartSuggestions()` and `analyzeTicket()` queries
- Updated submit-ticket page with AI section: collapse panels for AI Analysis, Similar Tickets, Related KB Articles
- Added NzCollapseModule, NzListModule, NzBadgeModule imports

---

## [2.0.0] - 2026-03-01

### Added — Knowledge Base, Analytics, SLA, Real-Time Dashboard

#### Knowledge Base (Feature 1a - Chunk A1)

- Full CRUD for Knowledge Base articles with WYSIWYG editor (ngx-quill)
- Category-based browsing and fulltext search
- View count and helpful count tracking
- Seeded with 6 common ICT FAQ articles

#### Analytics & Reporting (Feature 1d)

- Dedicated Analytics page with tabs: Overview, SLA, Staff Performance
- Charts: Pie (by status, by type), Bar (by priority, staff workload), Line (trends)
- Date range picker for filtering
- Export to PDF (jsPDF + jspdf-autotable) and Excel (xlsx + file-saver)

#### SLA Enforcement (Feature 1e)

- SLA Processing Time Tracker (5-step × 5-min pipeline on ticket detail)
- SLA breach cron job (every 5 minutes, 2-level escalation)
- SLA dashboard tab with overdue list, compliance rate, avg resolution
- `actualDuration` auto-calculated on RESOLVED/CLOSED

#### Real-Time Dashboard (Feature 1c - Chunk C1)

- WebSocket-driven dashboard refresh (replaced 60s polling)
- Live connection indicator + pulse animations on stat card updates
- 5-minute fallback polling as safety net

#### Satisfaction Survey (Feature 1f - Chunk F1)

- Star rating (1-5) + comment after ticket resolution
- Only available to ticket creator on RESOLVED/CLOSED tickets

#### Smart Priority Suggestion (Feature 1b - Chunk B2)

- Keyword NLP engine with weighted rules and confidence scoring
- Auto-suggest priority on ticket creation form with override option

---

This release completes the ticket assignment workflow from department heads to staff members.

#### Role-Based Navigation

| Role                      | Menu Items                                                    |
| ------------------------- | ------------------------------------------------------------- |
| `USER`                    | My Tickets (tickets they created)                             |
| `MIS_HEAD` / `ITS_HEAD`   | Tickets to Assign (assigned tickets needing staff assignment) |
| `DEVELOPER` / `TECHNICAL` | My Work Queue (tickets assigned to them for work)             |
| `SECRETARY`               | New Ticket, Review Queue                                      |
| `ADMIN`                   | Dashboard, All Tickets, User Management                       |

#### New Features

1. **MIS_HEAD/ITS_HEAD Assignment Modal**
   - Dropdown list of DEVELOPER or TECHNICAL staff
   - "Assign" button on tickets in ASSIGNED status without staff
   - Automatically loads appropriate staff based on department head role

2. **DEVELOPER/TECHNICAL Status Update Modal**
   - Status options: In Progress, On Hold, Resolved
   - Optional comment field for status changes
   - Updates ticket with status history

3. **Smart Button Visibility**
   - "Assign" button: Only shows for department heads on unassigned tickets
   - "Update" button: Only shows for staff on their assigned tickets

#### Backend Enhancements

- `usersByRole(role)` query - Get users by specific role
- `usersByRoles(roles)` query - Get users by multiple roles
- `myTickets` query - Get tickets assigned to current user

#### Complete Workflow

```
User creates ticket → FOR_REVIEW
       ↓
Secretary reviews → REVIEWED
       ↓
Director approves → DIRECTOR_APPROVED
       ↓
Auto-assign to MIS_HEAD/ITS_HEAD → ASSIGNED
       ↓
Department head assigns to DEVELOPER/TECHNICAL → Still ASSIGNED (with staff)
       ↓
Staff updates → IN_PROGRESS → ON_HOLD → RESOLVED
       ↓
Admin/Secretary closes → CLOSED
```

### Files Modified

- `backend/src/modules/users/user.types.ts` - Added usersByRole, usersByRoles queries
- `backend/src/modules/users/user.resolvers.ts` - Resolver implementations
- `backend/src/modules/users/user.repository.ts` - Database methods
- `frontend/src/app/core/services/ticket.service.ts` - Assignment/status methods
- `frontend/src/app/features/tickets/my-tickets.page.ts` - Role-based UI logic
- `frontend/src/app/features/tickets/my-tickets.page.html` - Assignment/status modals
- `frontend/src/app/layout/main-layout.ts` - Role-based navigation

---

## [1.2.0] - 2025-12-19

### Changed - Role Structure Update

This release restructures user roles for clearer department organization and ticket routing.

#### New Role Structure

| Role        | Description                     | Manages         |
| ----------- | ------------------------------- | --------------- |
| `ADMIN`     | System administrator            | Full access     |
| `DIRECTOR`  | Approves tickets after review   | -               |
| `SECRETARY` | Reviews tickets before director | -               |
| `MIS_HEAD`  | Head of MIS department          | DEVELOPER staff |
| `ITS_HEAD`  | Head of ITS department          | TECHNICAL staff |
| `DEVELOPER` | MIS staff (system developers)   | -               |
| `TECHNICAL` | ITS staff (technical support)   | -               |
| `USER`      | Regular ticket creator          | -               |

#### Removed

- `OFFICE_HEAD` role (replaced by `MIS_HEAD` and `ITS_HEAD`)
- `Department` enum (no longer needed - role determines department)

#### Auto-Assignment Logic

- **MIS tickets** → Auto-assigned to `MIS_HEAD`
- **ITS tickets** → Auto-assigned to `ITS_HEAD`
- Department heads then manually assign to their staff

#### UI Improvements

- Secretary review table now wider with better column spacing
- Action buttons have more room

---

## [1.1.0] - 2025-12-19

### Changed - Review Workflow Update

This release changes the ticket approval workflow from "approval" to "review" terminology for the secretary role, as secretaries review tickets rather than approve them. Only the director has approval authority.

#### Status Changes

| Old Status           | New Status   | Description                                        |
| -------------------- | ------------ | -------------------------------------------------- |
| `PENDING`            | `FOR_REVIEW` | Ticket awaiting secretary review                   |
| `SECRETARY_APPROVED` | `REVIEWED`   | Secretary has reviewed, awaiting director approval |

#### Workflow Changes

1. **Ticket Creation** → Status: `FOR_REVIEW` (was `PENDING`)
2. **Secretary Reviews** → Status changes to `REVIEWED` (was `SECRETARY_APPROVED`)
3. **Director Approves** → Status: `DIRECTOR_APPROVED` (unchanged)
4. **Auto-assignment** → Assigns to department head (MIS_HEAD or ITS_HEAD)
5. **Department Head** → Manually assigns to developers or technical staff

#### Database Field Renames

| Old Field               | New Field               |
| ----------------------- | ----------------------- |
| `secretaryApprovedById` | `secretaryReviewedById` |
| `secretaryApprovedAt`   | `secretaryReviewedAt`   |

#### API Changes

| Old Query/Mutation                | New Query/Mutation          |
| --------------------------------- | --------------------------- |
| `ticketsPendingSecretaryApproval` | `ticketsForSecretaryReview` |
| `approveTicketAsSecretary`        | `reviewTicketAsSecretary`   |

#### UI Changes

- Secretary page button changed from "Approve" to "Review"
- Status labels updated throughout the application
- Filter dropdowns updated with new status values

### Files Modified

- `backend/prisma/schema.prisma` - Enum and field updates
- `backend/src/modules/tickets/ticket.types.ts` - GraphQL schema
- `backend/src/modules/tickets/ticket.service.ts` - Service methods
- `backend/src/modules/tickets/ticket.resolvers.ts` - Resolver updates
- `backend/src/modules/tickets/auto-assignment.service.ts` - Department head routing
- `frontend/src/app/core/services/ticket.service.ts` - API calls
- `frontend/src/app/features/approvals/secretary-approval.page.*` - UI updates
- `frontend/src/app/features/tickets/my-tickets.page.*` - Status filters
- `frontend/src/app/features/tickets/ticket-detail.page.*` - Detail view

---

## [1.0.0] - 2025-12-18

### Added - Control Number System

- Auto-incrementing control numbers in format `YYYY-MM-NNN` (e.g., `2025-12-001`)
- `TicketCounter` table for atomic increment operations
- Race-condition-safe control number generation

### Added - Initial Ticket System

- MIS Ticket creation (Website, Software requests)
- ITS Ticket creation (Borrow, Maintenance requests)
- Ticket assignment workflow
- Secretary and Director approval workflow
- Status tracking and history
- User role management (ADMIN, DEVELOPER, SECRETARY, DIRECTOR, OFFICE_HEAD, USER)

### Added - Authentication

- Dual authentication system
  - Auth0 SSO (Google, Microsoft)
  - Local email/password login with JWT
- Role-based access control
- Profile management with avatar upload

---

## Ticket Status Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TICKET LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   [User Creates Ticket]                                             │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │   FOR_REVIEW    │  ← Initial status                             │
│   └────────┬────────┘                                               │
│            │ Secretary reviews                                      │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │    REVIEWED     │  ← Awaiting director                          │
│   └────────┬────────┘                                               │
│            │ Director approves                                      │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │DIRECTOR_APPROVED│                                               │
│   └────────┬────────┘                                               │
│            │ Auto-assign to Office Head                             │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │    ASSIGNED     │  ← Office Head assigns to staff               │
│   └────────┬────────┘                                               │
│            │ Staff starts work                                      │
│            ▼                                                        │
│   ┌─────────────────┐      ┌─────────────────┐                      │
│   │  IN_PROGRESS    │ ←──→ │    ON_HOLD      │                      │
│   └────────┬────────┘      └─────────────────┘                      │
│            │ Work completed                                         │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │    RESOLVED     │                                               │
│   └────────┬────────┘                                               │
│            │ User confirms                                          │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │     CLOSED      │  ← Final status                               │
│   └─────────────────┘                                               │
│                                                                     │
│   ┌─────────────────┐                                               │
│   │   CANCELLED     │  ← Can occur at any stage                     │
│   └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## User Roles

| Role          | Permissions                                    |
| ------------- | ---------------------------------------------- |
| `USER`        | Create tickets, view own tickets               |
| `SECRETARY`   | Review tickets (FOR_REVIEW → REVIEWED)         |
| `DIRECTOR`    | Approve tickets (REVIEWED → DIRECTOR_APPROVED) |
| `OFFICE_HEAD` | Assign tickets to staff, manage team           |
| `DEVELOPER`   | Handle MIS tickets (software/website)          |
| `ADMIN`       | Full system access, all permissions            |
