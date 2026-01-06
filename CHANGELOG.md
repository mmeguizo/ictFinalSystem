# Changelog

All notable changes to the ICT Support Ticketing System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-12-19

### Added - Department Head Assignment Workflow

This release completes the ticket assignment workflow from department heads to staff members.

#### Role-Based Navigation
| Role | Menu Items |
|------|------------|
| `USER` | My Tickets (tickets they created) |
| `MIS_HEAD` / `ITS_HEAD` | Tickets to Assign (assigned tickets needing staff assignment) |
| `DEVELOPER` / `TECHNICAL` | My Work Queue (tickets assigned to them for work) |
| `SECRETARY` | New Ticket, Review Queue |
| `ADMIN` | Dashboard, All Tickets, User Management |

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
| Role | Description | Manages |
|------|-------------|---------|
| `ADMIN` | System administrator | Full access |
| `DIRECTOR` | Approves tickets after review | - |
| `SECRETARY` | Reviews tickets before director | - |
| `MIS_HEAD` | Head of MIS department | DEVELOPER staff |
| `ITS_HEAD` | Head of ITS department | TECHNICAL staff |
| `DEVELOPER` | MIS staff (system developers) | - |
| `TECHNICAL` | ITS staff (technical support) | - |
| `USER` | Regular ticket creator | - |

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
| Old Status | New Status | Description |
|------------|------------|-------------|
| `PENDING` | `FOR_REVIEW` | Ticket awaiting secretary review |
| `SECRETARY_APPROVED` | `REVIEWED` | Secretary has reviewed, awaiting director approval |

#### Workflow Changes
1. **Ticket Creation** → Status: `FOR_REVIEW` (was `PENDING`)
2. **Secretary Reviews** → Status changes to `REVIEWED` (was `SECRETARY_APPROVED`)
3. **Director Approves** → Status: `DIRECTOR_APPROVED` (unchanged)
4. **Auto-assignment** → Assigns to department head (MIS_HEAD or ITS_HEAD)
5. **Department Head** → Manually assigns to developers or technical staff

#### Database Field Renames
| Old Field | New Field |
|-----------|-----------|
| `secretaryApprovedById` | `secretaryReviewedById` |
| `secretaryApprovedAt` | `secretaryReviewedAt` |

#### API Changes
| Old Query/Mutation | New Query/Mutation |
|--------------------|-------------------|
| `ticketsPendingSecretaryApproval` | `ticketsForSecretaryReview` |
| `approveTicketAsSecretary` | `reviewTicketAsSecretary` |

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

| Role | Permissions |
|------|-------------|
| `USER` | Create tickets, view own tickets |
| `SECRETARY` | Review tickets (FOR_REVIEW → REVIEWED) |
| `DIRECTOR` | Approve tickets (REVIEWED → DIRECTOR_APPROVED) |
| `OFFICE_HEAD` | Assign tickets to staff, manage team |
| `DEVELOPER` | Handle MIS tickets (software/website) |
| `ADMIN` | Full system access, all permissions |
