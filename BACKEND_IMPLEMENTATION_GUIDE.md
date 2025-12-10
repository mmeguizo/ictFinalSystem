# Backend Ticket System Implementation Summary

## Overview
Complete backend implementation for the ICT ticket management system with MIS (Management Information System) and ITS (ICT Support) ticket types, auto-assignment, SLA tracking, and analytics.

## Database Schema (Prisma)

### Core Models Created:

1. **Ticket** - Main ticket table
   - Fields: id, ticketNumber, type, title, description, status, priority
   - SLA fields: dueDate, estimatedDuration, actualDuration
   - Timestamps: createdAt, updatedAt, resolvedAt, closedAt
   - Relations: createdBy (User), misTicket, itsTicket, assignments, notes, attachments, statusHistory

2. **MISTicket** - Website/Software requests
   - Fields: category (WEBSITE/SOFTWARE)
   - Website: websiteNewRequest, websiteUpdate
   - Software: softwareNewRequest, softwareUpdate, softwareInstall

3. **ITSTicket** - Borrow/Maintenance requests
   - Borrow: borrowRequest, borrowDetails
   - Maintenance: maintenanceDesktopLaptop, maintenanceInternetNetwork, maintenancePrinter, maintenanceDetails

4. **TicketAssignment** - Multiple users per ticket
   - Allows collaborative work
   - Tracks assignedAt timestamp

5. **TicketNote** - Comments/updates
   - Fields: content, isInternal (staff-only notes)
   - Relations: user, ticket

6. **TicketAttachment** - File uploads
   - Metadata: filename, originalName, mimeType, size, url

7. **TicketStatusHistory** - Audit trail
   - Tracks: fromStatus, toStatus, comment, user, timestamp

### Enums:
- TicketType: MIS, ITS
- TicketStatus: PENDING, ASSIGNED, IN_PROGRESS, ON_HOLD, RESOLVED, CLOSED, CANCELLED
- Priority: LOW, MEDIUM, HIGH, CRITICAL
- MISCategory: WEBSITE, SOFTWARE

## Module Structure

```
backend/src/modules/tickets/
├── dto/
│   ├── create-ticket.dto.ts           # Base ticket DTO
│   ├── create-mis-ticket.dto.ts       # MIS-specific fields
│   ├── create-its-ticket.dto.ts       # ITS-specific fields
│   ├── update-ticket-status.dto.ts    # Status updates
│   └── create-ticket-note.dto.ts      # Note creation
├── services/
│   ├── ticket.service.ts              # Main business logic
│   └── auto-assignment.service.ts     # Intelligent routing
├── utils/
│   └── sla.utils.ts                   # SLA calculations
├── ticket.repository.ts               # Database operations
├── ticket.types.ts                    # GraphQL schema
├── ticket.resolvers.ts                # GraphQL resolvers
└── index.ts                           # Barrel exports
```

## Key Features Implemented

### 1. Auto-Assignment Logic (`auto-assignment.service.ts`)
**Purpose**: Automatically route tickets to appropriate staff based on type and workload

**Rules**:
- MIS tickets → DEVELOPER or ADMIN roles
- ITS tickets → OFFICE_HEAD or ADMIN roles
- Selects user with lowest current workload
- Updates ticket status to ASSIGNED

**Methods**:
- `assignTicket(ticketId, ticketType)` - Auto-assign based on rules
- `manualAssign(ticketId, userId)` - Manual override by admins
- `unassign(ticketId, userId)` - Remove assignment
- `reassign(ticketId, fromUserId, toUserId)` - Transfer ownership

### 2. SLA Management (`sla.utils.ts`)
**Purpose**: Track service level agreements and deadlines

**Configuration** (hours by priority):
- CRITICAL: 4 hours
- HIGH: 24 hours (1 day)
- MEDIUM: 72 hours (3 days)
- LOW: 168 hours (7 days)

**Functions**:
- `calculateDueDate(priority, createdAt)` - Auto-set deadlines
- `calculateEstimatedDuration(type, priority)` - Time estimates
- `isOverdue(dueDate)` - Check if past deadline
- `getTimeRemaining(dueDate)` - Hours until due
- `calculateSLACompliance(tickets)` - Compliance percentage
- `getSLAStatus(dueDate)` - Returns: 'on-track' | 'at-risk' | 'overdue'

### 3. Ticket Repository (`ticket.repository.ts`)
**Purpose**: Database access layer with Prisma

**Key Methods**:
- `generateTicketNumber(type)` - Format: `MIS-20251209-001`
- `create(data)` - Create ticket with relations
- `findById(id)` - Get full ticket details
- `findByTicketNumber(number)` - Lookup by ticket number
- `findMany(filters)` - List with status/type/user filters
- `updateStatus(ticketId, userId, status, comment)` - Status changes with history
- `assignUser(ticketId, userId)` - Add assignment
- `addNote(ticketId, userId, content, isInternal)` - Add comment
- `addAttachment(...)` - Upload file metadata
- `getAnalytics(filters)` - Dashboard metrics
- `getSLAMetrics()` - Overdue/due today/due soon counts

### 4. Ticket Service (`ticket.service.ts`)
**Purpose**: Main business logic orchestration

**Methods**:
- `createMISTicket(dto, userId)` - Create MIS ticket → auto-assign → return with assignments
- `createITSTicket(dto, userId)` - Create ITS ticket → auto-assign → return with assignments
- `getTicket(id)` - Full ticket with all relations
- `getTickets(filters)` - List tickets
- `updateStatus(ticketId, userId, dto)` - Change status + history entry
- `assignUser(ticketId, userId)` - Manual assignment
- `addNote(ticketId, userId, dto)` - Add note
- `getAnalytics(filters)` - Dashboard data
- `getSLAMetrics()` - SLA compliance
- `getUserTickets(userId)` - Assigned to user
- `getUserCreatedTickets(userId)` - Created by user

## GraphQL API

### Types:
- Ticket, MISTicket, ITSTicket
- TicketAssignment, TicketNote, TicketAttachment, TicketStatusHistory
- TicketAnalytics, SLAMetrics
- All enums exposed

### Queries:
```graphql
ticket(id: Int!): Ticket
ticketByNumber(ticketNumber: String!): Ticket
tickets(filter: TicketFilterInput): [Ticket!]!
myTickets: [Ticket!]!                    # Assigned to me
myCreatedTickets: [Ticket!]!             # Created by me
ticketAnalytics(filter: AnalyticsFilterInput): TicketAnalytics!
slaMetrics: SLAMetrics!
```

### Mutations:
```graphql
createMISTicket(input: CreateMISTicketInput!): Ticket!
createITSTicket(input: CreateITSTicketInput!): Ticket!
updateTicketStatus(ticketId: Int!, input: UpdateTicketStatusInput!): Ticket!
assignTicket(ticketId: Int!, userId: Int!): Ticket!       # Admin/OfficeHead only
unassignTicket(ticketId: Int!, userId: Int!): Ticket!     # Admin/OfficeHead only
addTicketNote(ticketId: Int!, input: CreateTicketNoteInput!): TicketNote!
```

### Authorization:
- All queries/mutations require authentication (`context.user`)
- Assignment mutations restricted to ADMIN and OFFICE_HEAD roles

## Data Flow Examples

### Creating a MIS Ticket:
```
1. User submits form with CreateMISTicketInput
2. ticketService.createMISTicket(dto, userId)
3. Generate ticket number: MIS-20251209-001
4. Calculate dueDate based on priority (e.g., MEDIUM = 72 hours)
5. Create Ticket + MISTicket records in database
6. autoAssignment.assignTicket(ticketId, MIS)
   - Find all DEVELOPER/ADMIN users
   - Get their current workload (active tickets)
   - Select user with least workload
   - Create TicketAssignment record
   - Update ticket status to ASSIGNED
7. Return full ticket with assignments
```

### Updating Ticket Status:
```
1. User calls updateTicketStatus mutation
2. ticketService.updateStatus(ticketId, userId, dto)
3. repository.updateStatus() uses transaction:
   - Update ticket.status field
   - Set resolvedAt/closedAt if applicable
   - Create TicketStatusHistory entry with fromStatus/toStatus
4. Return updated ticket
```

### Getting Analytics:
```
1. Call ticketAnalytics query with date range
2. repository.getAnalytics() runs:
   - groupBy status (count per status)
   - groupBy type (MIS vs ITS counts)
   - groupBy priority (count per priority)
   - total count
3. Return aggregated data for dashboard charts
```

## SLA Tracking Example

**Scenario**: CRITICAL MIS ticket created at 9:00 AM

1. **Creation**:
   - Priority: CRITICAL
   - dueDate: 1:00 PM (9:00 AM + 4 hours)
   - estimatedDuration: 3 hours

2. **Status Checks**:
   - 11:00 AM: `getSLAStatus()` → 'on-track' (2 hours remaining)
   - 12:30 PM: `getSLAStatus()` → 'at-risk' (30 mins remaining)
   - 1:30 PM: `getSLAStatus()` → 'overdue' (-30 mins)

3. **Dashboard Metrics**:
   - `getSLAMetrics()` returns:
     - overdue: count of tickets past dueDate
     - dueToday: count due within today
     - dueSoon: count due within 3 days

## Integration Points

### With Frontend:
- GraphQL operations defined in `frontend/src/graphql/operations/`
- Run `npm run codegen` to generate TypeScript types
- Use generated hooks: `useCreateMISTicketMutation()`, `useTicketsQuery()`, etc.

### With Storage Module:
- TicketAttachment.url points to files uploaded via storage service
- Use existing upload endpoint for file handling

### With Auth:
- All resolvers check `context.user` from JWT
- Role-based access for assignment operations
- User ID automatically captured for createdBy, assignments, notes

## Next Steps Required

1. **Run Prisma Commands** (in backend directory):
   ```bash
   npx prisma generate          # Generate Prisma client with new types
   npx prisma migrate dev --name add_ticket_system  # Apply schema changes
   ```

2. **Restart Backend Server**:
   ```bash
   npm run dev                  # Restart to load new schema
   ```

3. **Test GraphQL API**:
   - Open http://localhost:4000/graphql
   - Test createMISTicket mutation
   - Verify auto-assignment works
   - Check ticket queries

4. **Frontend Integration**:
   - Run `npm run codegen` in frontend
   - Create ticket submission pages
   - Build dashboard with analytics
   - Add ticket list/detail views

5. **File Upload** (optional):
   - Add mutation for ticket attachments
   - Integrate with storage service
   - Update frontend forms to handle files

## File Associations Map

### When User Submits MIS Ticket:
```
frontend/features/tickets/submit-ticket.page.ts
  → calls createMISTicket mutation
  → backend/src/modules/tickets/ticket.resolvers.ts (createMISTicket)
  → backend/src/modules/tickets/services/ticket.service.ts (createMISTicket)
  → backend/src/modules/tickets/ticket.repository.ts (generateTicketNumber, create)
  → backend/src/modules/tickets/utils/sla.utils.ts (calculateDueDate, calculateEstimatedDuration)
  → Prisma creates Ticket + MISTicket records
  → backend/src/modules/tickets/services/auto-assignment.service.ts (assignTicket)
  → backend/src/modules/users (query eligible users by role)
  → Prisma creates TicketAssignment record
  → Returns ticket with assignments to frontend
```

### When Admin Views Dashboard:
```
frontend/features/dashboard/dashboard.page.ts
  → calls ticketAnalytics + slaMetrics queries
  → backend/src/modules/tickets/ticket.resolvers.ts
  → backend/src/modules/tickets/services/ticket.service.ts
  → backend/src/modules/tickets/ticket.repository.ts (getAnalytics, getSLAMetrics)
  → Prisma aggregates data (groupBy, count)
  → Returns analytics object to frontend
  → Frontend renders charts with data
```

### When User Adds Note:
```
frontend/features/tickets/ticket-detail.page.ts
  → calls addTicketNote mutation
  → backend/src/modules/tickets/ticket.resolvers.ts (addTicketNote)
  → backend/src/modules/tickets/services/ticket.service.ts (addNote)
  → backend/src/modules/tickets/ticket.repository.ts (addNote)
  → Prisma creates TicketNote record
  → Returns note with user data to frontend
  → Frontend appends note to ticket timeline
```

## Validation Rules

### DTOs (class-validator):
- **CreateTicketDto**: title min 5 chars, description min 10 chars
- **CreateMISTicketDto**: category required (WEBSITE/SOFTWARE), at least one checkbox
- **CreateITSTicketDto**: at least one request type (borrow or maintenance)
- **CreateTicketNoteDto**: content required, min 1 char

### Business Rules:
- Ticket numbers are unique and auto-generated
- Only one MISTicket or ITSTicket per Ticket (polymorphic)
- Multiple users can be assigned to same ticket
- Status transitions tracked in history
- Internal notes visible only to staff
- Admins/OfficeHeads can assign/unassign
- SLA deadlines auto-calculated on creation

## Database Indexes

For performance:
- `Ticket.status` - Filter by status frequently
- `Ticket.createdById` - User's created tickets
- `Ticket.type` - Filter by MIS/ITS
- `TicketAssignment.ticketId, userId` - Unique constraint + query
- `TicketAssignment.userId` - User's assigned tickets
- `TicketNote.ticketId` - Ticket's notes
- `TicketNote.userId` - User's notes
- `TicketAttachment.ticketId` - Ticket's attachments
- `TicketStatusHistory.ticketId` - Ticket's history

## Cascade Deletes

When a Ticket is deleted:
- MISTicket/ITSTicket deleted (onDelete: Cascade)
- All TicketAssignments deleted (onDelete: Cascade)
- All TicketNotes deleted (onDelete: Cascade)
- All TicketAttachments deleted (onDelete: Cascade)
- All TicketStatusHistory deleted (onDelete: Cascade)

This maintains referential integrity and prevents orphaned records.
