# Ticket Approval Workflow System

## Overview

The ticket approval workflow system implements a multi-tier approval process that mirrors the manual paper-based system. Tickets progress through several approval stages before being assigned to technical staff.

## Workflow Stages

```
User Submission → PENDING → Secretary Approval → SECRETARY_APPROVED → 
Director Approval → DIRECTOR_APPROVED → Auto-Assignment → ASSIGNED → 
IN_PROGRESS → RESOLVED → CLOSED
```

### Visual Flow

```
┌─────────────┐
│   User      │
│  Submits    │
│   Ticket    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   PENDING   │ ◄── Awaiting Secretary Approval
└──────┬──────┘
       │
       ▼ (Secretary approves)
┌─────────────────────┐
│ SECRETARY_APPROVED  │ ◄── Awaiting Director Approval
└──────┬──────────────┘
       │
       ▼ (Director approves)
┌─────────────────────┐
│ DIRECTOR_APPROVED   │
└──────┬──────────────┘
       │
       ▼ (Auto-assignment triggered)
┌─────────────┐
│  ASSIGNED   │ ◄── Assigned to MIS/ITS team
└──────┬──────┘
       │
       ▼ (Staff starts work)
┌─────────────┐
│ IN_PROGRESS │
└──────┬──────┘
       │
       ▼ (Work completed)
┌─────────────┐
│  RESOLVED   │
└──────┬──────┘
       │
       ▼ (Ticket closed)
┌─────────────┐
│   CLOSED    │
└─────────────┘
```

## Database Schema

### Ticket Model Fields

```prisma
model Ticket {
  // ... basic fields ...
  
  // Approval tracking
  secretaryApprovedById  Int?
  secretaryApprovedAt    DateTime?
  directorApprovedById   Int?
  directorApprovedAt     DateTime?
  
  secretaryApprover      User?     @relation("SecretaryApprovals", fields: [secretaryApprovedById], references: [id])
  directorApprover       User?     @relation("DirectorApprovals", fields: [directorApprovedById], references: [id])
  
  // Status history for audit trail
  statusHistory          TicketStatusHistory[]
}
```

### Status Enum

```prisma
enum TicketStatus {
  PENDING              // Initial state after user submission
  SECRETARY_APPROVED   // Secretary has approved
  DIRECTOR_APPROVED    // Director has approved
  ASSIGNED             // Assigned to technical staff
  IN_PROGRESS          // Work in progress
  ON_HOLD              // Temporarily paused
  RESOLVED             // Work completed
  CLOSED               // Ticket closed
  CANCELLED            // Ticket cancelled
}
```

## GraphQL API

### Mutations

#### Approve Ticket as Secretary

```graphql
mutation ApproveTicketAsSecretary($ticketId: Int!, $comment: String) {
  approveTicketAsSecretary(ticketId: $ticketId, comment: $comment) {
    id
    ticketNumber
    status
    secretaryApprovedById
    secretaryApprovedAt
  }
}
```

**Authorization**: Requires `ADMIN` or `OFFICE_HEAD` role

**Validation**:
- Ticket must be in `PENDING` status
- Secretary approval cannot be reversed

**Side Effects**:
- Updates ticket status to `SECRETARY_APPROVED`
- Records secretary user ID and timestamp
- Creates status history entry with optional comment

#### Approve Ticket as Director

```graphql
mutation ApproveTicketAsDirector($ticketId: Int!, $comment: String) {
  approveTicketAsDirector(ticketId: $ticketId, comment: $comment) {
    id
    ticketNumber
    status
    directorApprovedById
    directorApprovedAt
  }
}
```

**Authorization**: Requires `ADMIN` or `OFFICE_HEAD` role

**Validation**:
- Ticket must be in `SECRETARY_APPROVED` status
- Director approval cannot be reversed

**Side Effects**:
- Updates ticket status to `DIRECTOR_APPROVED`
- Records director user ID and timestamp
- Creates status history entry with optional comment
- **Triggers auto-assignment** to MIS or ITS team based on ticket type
- Updates status to `ASSIGNED` after assignment

### Queries

#### Get User's Created Tickets

```graphql
query MyCreatedTickets {
  myCreatedTickets {
    id
    ticketNumber
    title
    type
    status
    priority
    createdAt
    createdBy {
      id
      name
      email
    }
    assignments {
      user {
        id
        name
        role
      }
      assignedAt
    }
  }
}
```

#### Get Ticket Details

```graphql
query GetTicketByNumber($ticketNumber: String!) {
  ticketByNumber(ticketNumber: $ticketNumber) {
    id
    ticketNumber
    title
    description
    type
    status
    priority
    secretaryApprovedById
    secretaryApprovedAt
    directorApprovedById
    directorApprovedAt
    createdAt
    updatedAt
    createdBy {
      id
      name
      email
      role
    }
    secretaryApprover {
      id
      name
      role
    }
    directorApprover {
      id
      name
      role
    }
    misTicket {
      category
      softwareType
      websiteUrl
    }
    itsTicket {
      deviceType
      deviceModel
      serialNumber
    }
    assignments {
      id
      assignedAt
      user {
        id
        name
        email
        role
      }
    }
    notes {
      id
      content
      isInternal
      createdAt
      user {
        id
        name
        role
      }
    }
    statusHistory {
      id
      fromStatus
      toStatus
      comment
      createdAt
      user {
        id
        name
        role
      }
    }
  }
}
```

## Service Layer

### TicketService Methods

#### approveAsSecretary

```typescript
async approveAsSecretary(
  ticketId: number,
  secretaryId: number,
  comment?: string
): Promise<Ticket>
```

**Logic**:
1. Fetch ticket and validate it exists
2. Validate current status is `PENDING`
3. Update ticket with secretary approval details
4. Create status history record: `PENDING` → `SECRETARY_APPROVED`
5. Return updated ticket

**Error Handling**:
- Throws if ticket not found
- Throws if ticket already approved by secretary
- Throws if ticket not in `PENDING` status

#### approveAsDirector

```typescript
async approveAsDirector(
  ticketId: number,
  directorId: number,
  comment?: string
): Promise<Ticket>
```

**Logic**:
1. Fetch ticket and validate it exists
2. Validate current status is `SECRETARY_APPROVED`
3. Update ticket with director approval details and status `DIRECTOR_APPROVED`
4. Create status history record: `SECRETARY_APPROVED` → `DIRECTOR_APPROVED`
5. **Trigger auto-assignment**:
   - Call `autoAssignmentService.assignTicket(ticketId)`
   - Service assigns based on ticket type (MIS/ITS)
   - Updates status to `ASSIGNED`
6. Return updated ticket

**Error Handling**:
- Throws if ticket not found
- Throws if ticket already approved by director
- Throws if ticket not in `SECRETARY_APPROVED` status
- Logs but doesn't fail if auto-assignment fails

## Resolvers

### approveTicketAsSecretary

```typescript
@Mutation(() => Ticket)
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OFFICE_HEAD)
async approveTicketAsSecretary(
  @Args('ticketId', { type: () => Int }) ticketId: number,
  @Args('comment', { type: () => String, nullable: true }) comment: string | undefined,
  @Context() context: { currentUser: User }
): Promise<Ticket>
```

**Guards**:
- `GqlAuthGuard`: Validates JWT token
- `RolesGuard`: Checks user has `ADMIN` or `OFFICE_HEAD` role

**Context**:
- Uses `context.currentUser` from Auth0 JWT payload
- `currentUser` populated by authentication middleware

### approveTicketAsDirector

```typescript
@Mutation(() => Ticket)
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OFFICE_HEAD)
async approveTicketAsDirector(
  @Args('ticketId', { type: () => Int }) ticketId: number,
  @Args('comment', { type: () => String, nullable: true }) comment: string | undefined,
  @Context() context: { currentUser: User }
): Promise<Ticket>
```

**Guards**: Same as secretary approval

## Auto-Assignment Logic

When the director approves a ticket:

1. **Trigger**: Director approval mutation calls `autoAssignmentService.assignTicket()`
2. **Team Selection**:
   - If `type === 'MIS'` → Assign to MIS team members
   - If `type === 'ITS'` → Assign to ITS team members
3. **Assignment Strategy**:
   - Round-robin or least-busy algorithm
   - Considers user availability and current workload
4. **Result**:
   - Creates `TicketAssignment` record
   - Updates ticket status to `ASSIGNED`
   - Creates status history entry

## Status History Tracking

Every status change creates a `TicketStatusHistory` record:

```typescript
{
  ticketId: number,
  fromStatus: TicketStatus | null,  // null for initial creation
  toStatus: TicketStatus,
  comment: string | null,           // Optional approval comment
  userId: number,                   // User who triggered the change
  createdAt: DateTime
}
```

**Key Transitions Tracked**:
- User submission: `null` → `PENDING`
- Secretary approval: `PENDING` → `SECRETARY_APPROVED`
- Director approval: `SECRETARY_APPROVED` → `DIRECTOR_APPROVED`
- Auto-assignment: `DIRECTOR_APPROVED` → `ASSIGNED`
- Staff starts work: `ASSIGNED` → `IN_PROGRESS`
- Work completed: `IN_PROGRESS` → `RESOLVED`
- Ticket closed: `RESOLVED` → `CLOSED`

## Role-Based Access Control

### Required Roles for Approval

| Action | Required Role |
|--------|--------------|
| Submit ticket | Any authenticated user |
| Secretary approval | `ADMIN` or `OFFICE_HEAD` |
| Director approval | `ADMIN` or `OFFICE_HEAD` |
| View own tickets | Ticket creator |
| View all tickets | `ADMIN`, `OFFICE_HEAD`, `MIS_STAFF`, `ITS_STAFF` |
| Assign tickets | `ADMIN`, `OFFICE_HEAD` |
| Work on tickets | Assigned staff |

### Authorization Flow

```
Request → JWT Token → Auth Middleware → context.currentUser → 
GqlAuthGuard → RolesGuard → Resolver
```

## Testing Approval Workflow

### Manual Testing Steps

1. **User submits ticket**:
   ```graphql
   mutation {
     createMISTicket(input: {
       title: "Test Ticket"
       description: "Testing approval flow"
       category: WEBSITE
       priority: MEDIUM
     }) {
       id
       ticketNumber
       status  # Should be PENDING
     }
   }
   ```

2. **Secretary approves** (as ADMIN/OFFICE_HEAD):
   ```graphql
   mutation {
     approveTicketAsSecretary(ticketId: 1, comment: "Approved by secretary") {
       ticketNumber
       status  # Should be SECRETARY_APPROVED
       secretaryApprovedAt
     }
   }
   ```

3. **Director approves** (as ADMIN/OFFICE_HEAD):
   ```graphql
   mutation {
     approveTicketAsDirector(ticketId: 1, comment: "Approved by director") {
       ticketNumber
       status  # Should be ASSIGNED (after auto-assignment)
       directorApprovedAt
     }
   }
   ```

4. **Check status history**:
   ```graphql
   query {
     ticketByNumber(ticketNumber: "TKT-2024-0001") {
       statusHistory {
         fromStatus
         toStatus
         comment
         createdAt
         user {
           name
           role
         }
       }
     }
   }
   ```

## Error Scenarios

### Common Errors

1. **Ticket not found**:
   ```
   Error: Ticket with ID 999 not found
   ```

2. **Invalid status transition**:
   ```
   Error: Cannot approve ticket as secretary. Ticket must be in PENDING status.
   Current status: SECRETARY_APPROVED
   ```

3. **Already approved**:
   ```
   Error: Ticket has already been approved by secretary
   ```

4. **Unauthorized**:
   ```
   Error: User does not have required role: ADMIN or OFFICE_HEAD
   ```

## Best Practices

1. **Always validate ticket status** before state transitions
2. **Record all approvals** with user ID and timestamp for audit trail
3. **Use optional comments** for approval rationale
4. **Handle auto-assignment failures gracefully** - log error but don't fail approval
5. **Maintain status history** for complete audit trail
6. **Enforce role-based access** at resolver level with guards
7. **Use transactions** for operations that modify multiple tables

## Future Enhancements

- [ ] Add approval deadline/SLA tracking
- [ ] Implement approval delegation when approver is unavailable
- [ ] Add batch approval functionality
- [ ] Support multi-level approval chains (configurable)
- [ ] Add email notifications for approval requests
- [ ] Implement approval history report generation
