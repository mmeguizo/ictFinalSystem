# ICT Ticket System - Backend API Documentation

**Version**: 1.0.0  
**Last Updated**: December 9, 2025  
**Base URL**: `http://localhost:4000/graphql`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Ticket Types](#ticket-types)
4. [API Reference](#api-reference)
   - [Mutations](#mutations)
   - [Queries](#queries)
5. [Data Models](#data-models)
6. [Enums](#enums)
7. [Business Rules](#business-rules)
8. [SLA (Service Level Agreement)](#sla-service-level-agreement)
9. [Error Handling](#error-handling)
10. [Examples](#examples)
11. [Changelog](#changelog)

---

## Overview

The ICT Ticket System Backend provides a GraphQL API for managing service requests across two main categories:

- **MIS (Management Information System)**: Website and software development requests
- **ITS (ICT Support)**: Equipment borrowing and maintenance requests

### Key Features

✅ Automated ticket routing based on type and staff workload  
✅ SLA tracking with automatic deadline calculation  
✅ Multi-user collaboration on tickets  
✅ Complete audit trail of status changes  
✅ Internal notes for staff communication  
✅ Real-time analytics and metrics  
✅ File attachment support  
✅ Role-based access control

---

## Authentication

All API requests require authentication via JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

The token is obtained during login and contains user information including:
- User ID
- Email
- Name
- Role (ADMIN, DEVELOPER, OFFICE_HEAD, USER)

**Unauthorized Access**: Returns error message and prevents operation.

---

## Ticket Types

### MIS Tickets (Management Information System)

For software and website development requests.

**Categories**:
- `WEBSITE`: Website-related requests
  - New website development
  - Website updates/modifications
  
- `SOFTWARE`: Software-related requests
  - New software development
  - Software updates/enhancements
  - Software installation/configuration

**Automatically Assigned To**: DEVELOPER or ADMIN roles

---

### ITS Tickets (ICT Support)

For equipment and maintenance requests.

**Request Types**:
- **Borrow**: Equipment borrowing requests
- **Maintenance**: Equipment repair/maintenance
  - Desktop/Laptop maintenance
  - Internet/Network issues
  - Printer maintenance

**Automatically Assigned To**: OFFICE_HEAD or ADMIN roles

---

## API Reference

### Mutations

#### Create MIS Ticket

Create a new Management Information System ticket.

```graphql
mutation {
  createMISTicket(input: CreateMISTicketInput!) {
    id
    ticketNumber
    status
    priority
    dueDate
    assignments {
      user {
        name
        role
      }
    }
  }
}
```

**Input Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | String | ✅ | Ticket title (min 5 characters) |
| `description` | String | ✅ | Detailed description (min 10 characters) |
| `category` | MISCategory | ✅ | WEBSITE or SOFTWARE |
| `priority` | Priority | ❌ | LOW, MEDIUM, HIGH, CRITICAL (default: MEDIUM) |
| `websiteNewRequest` | Boolean | ❌ | New website needed |
| `websiteUpdate` | Boolean | ❌ | Update existing website |
| `softwareNewRequest` | Boolean | ❌ | New software needed |
| `softwareUpdate` | Boolean | ❌ | Update existing software |
| `softwareInstall` | Boolean | ❌ | Install/configure software |
| `estimatedDuration` | Int | ❌ | Estimated hours (auto-calculated if not provided) |

**Access**: All authenticated users

**Auto-Assignment**: System automatically assigns to developer with lowest workload

**Example**:
```graphql
mutation {
  createMISTicket(input: {
    title: "Department Website Redesign"
    description: "Need a modern, responsive website for the Computer Science department"
    category: WEBSITE
    websiteNewRequest: true
    priority: HIGH
  }) {
    ticketNumber
    status
    dueDate
    assignments {
      user {
        name
      }
    }
  }
}
```

---

#### Create ITS Ticket

Create a new ICT Support ticket.

```graphql
mutation {
  createITSTicket(input: CreateITSTicketInput!) {
    id
    ticketNumber
    status
    priority
    dueDate
    assignments {
      user {
        name
        role
      }
    }
  }
}
```

**Input Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | String | ✅ | Ticket title (min 5 characters) |
| `description` | String | ✅ | Detailed description (min 10 characters) |
| `priority` | Priority | ❌ | LOW, MEDIUM, HIGH, CRITICAL (default: MEDIUM) |
| `borrowRequest` | Boolean | ❌ | Need to borrow equipment |
| `borrowDetails` | String | ❌ | Details about borrowing request |
| `maintenanceDesktopLaptop` | Boolean | ❌ | Desktop/laptop needs repair |
| `maintenanceInternetNetwork` | Boolean | ❌ | Internet/network issue |
| `maintenancePrinter` | Boolean | ❌ | Printer needs repair |
| `maintenanceDetails` | String | ❌ | Details about maintenance needed |
| `estimatedDuration` | Int | ❌ | Estimated hours (auto-calculated if not provided) |

**Access**: All authenticated users

**Auto-Assignment**: System automatically assigns to office head with lowest workload

**Example**:
```graphql
mutation {
  createITSTicket(input: {
    title: "Laptop Screen Not Working"
    description: "Faculty laptop screen is flickering and has dead pixels"
    maintenanceDesktopLaptop: true
    maintenanceDetails: "Dell Latitude 7420, Asset #12345"
    priority: HIGH
  }) {
    ticketNumber
    status
    dueDate
  }
}
```

---

#### Update Ticket Status

Change the status of a ticket and add a comment to the history.

```graphql
mutation {
  updateTicketStatus(
    ticketId: Int!
    input: UpdateTicketStatusInput!
  ) {
    id
    status
    statusHistory {
      fromStatus
      toStatus
      comment
      user { name }
      createdAt
    }
  }
}
```

**Input Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | TicketStatus | ✅ | New status for ticket |
| `comment` | String | ❌ | Optional comment explaining the change |

**Available Status Transitions**:
```
PENDING → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
                          ↓
                      ON_HOLD (can resume to IN_PROGRESS)
                          ↓
                      CANCELLED
```

**Access**: 
- Ticket creator can view history
- Assigned users can update status
- ADMIN/OFFICE_HEAD can update any ticket

**Example**:
```graphql
mutation {
  updateTicketStatus(
    ticketId: 42
    input: {
      status: RESOLVED
      comment: "Website deployed to production server. User training completed."
    }
  ) {
    status
    resolvedAt
  }
}
```

---

#### Assign Ticket

Manually assign a user to a ticket (in addition to or replacing auto-assignment).

```graphql
mutation {
  assignTicket(ticketId: Int!, userId: Int!) {
    id
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

**Access**: ADMIN and OFFICE_HEAD only

**Use Case**: 
- Add additional developers to a complex ticket
- Reassign to a specialist
- Balance workload manually

**Example**:
```graphql
mutation {
  assignTicket(ticketId: 42, userId: 7) {
    assignments {
      user {
        name
      }
    }
  }
}
```

---

#### Unassign Ticket

Remove a user assignment from a ticket.

```graphql
mutation {
  unassignTicket(ticketId: Int!, userId: Int!) {
    id
    assignments {
      user {
        name
      }
    }
  }
}
```

**Access**: ADMIN and OFFICE_HEAD only

**Note**: If all users are unassigned, ticket status reverts to PENDING.

---

#### Add Ticket Note

Add a comment or update to a ticket.

```graphql
mutation {
  addTicketNote(
    ticketId: Int!
    input: CreateTicketNoteInput!
  ) {
    id
    content
    isInternal
    user {
      name
    }
    createdAt
  }
}
```

**Input Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | String | ✅ | Note content (min 1 character) |
| `isInternal` | Boolean | ❌ | If true, only staff can see (default: false) |

**Access**: All authenticated users can add notes to tickets they're involved with

**Internal Notes**: Only visible to ADMIN, DEVELOPER, and OFFICE_HEAD roles

**Example**:
```graphql
mutation {
  addTicketNote(
    ticketId: 42
    input: {
      content: "Design mockups completed. Proceeding with frontend development."
      isInternal: false
    }
  ) {
    id
    content
    createdAt
  }
}
```

---

### Queries

#### Get Single Ticket

Retrieve complete ticket details by ID.

```graphql
query {
  ticket(id: Int!) {
    id
    ticketNumber
    type
    title
    description
    status
    priority
    dueDate
    estimatedDuration
    actualDuration
    createdBy {
      name
      email
    }
    misTicket {
      category
      websiteNewRequest
      websiteUpdate
      softwareNewRequest
      softwareUpdate
      softwareInstall
    }
    itsTicket {
      borrowRequest
      borrowDetails
      maintenanceDesktopLaptop
      maintenanceInternetNetwork
      maintenancePrinter
      maintenanceDetails
    }
    assignments {
      user {
        name
        role
      }
      assignedAt
    }
    notes {
      content
      isInternal
      user { name }
      createdAt
    }
    statusHistory {
      fromStatus
      toStatus
      comment
      user { name }
      createdAt
    }
    createdAt
    updatedAt
    resolvedAt
    closedAt
  }
}
```

**Access**: All authenticated users can view tickets they created or are assigned to

---

#### Get Ticket by Number

Retrieve ticket using its unique ticket number.

```graphql
query {
  ticketByNumber(ticketNumber: String!) {
    id
    ticketNumber
    title
    status
  }
}
```

**Example**:
```graphql
query {
  ticketByNumber(ticketNumber: "MIS-20251209-001") {
    title
    status
  }
}
```

---

#### List Tickets with Filters

Get multiple tickets with optional filtering.

```graphql
query {
  tickets(filter: TicketFilterInput) {
    id
    ticketNumber
    title
    status
    priority
    type
    dueDate
    createdBy { name }
    assignments {
      user { name }
    }
    createdAt
  }
}
```

**Filter Options**:
| Field | Type | Description |
|-------|------|-------------|
| `status` | TicketStatus | Filter by status |
| `type` | TicketType | Filter by MIS or ITS |
| `createdById` | Int | Filter by creator |
| `assignedToUserId` | Int | Filter by assigned user |

**Example**:
```graphql
query {
  tickets(filter: {
    status: IN_PROGRESS
    type: MIS
  }) {
    ticketNumber
    title
    priority
  }
}
```

---

#### My Tickets

Get all tickets assigned to the current user.

```graphql
query {
  myTickets {
    id
    ticketNumber
    title
    status
    priority
    dueDate
    createdBy { name }
  }
}
```

**Access**: All authenticated users

**Use Case**: Staff dashboard showing their workload

---

#### My Created Tickets

Get all tickets created by the current user.

```graphql
query {
  myCreatedTickets {
    id
    ticketNumber
    title
    status
    priority
    assignments {
      user { name }
    }
    createdAt
  }
}
```

**Access**: All authenticated users

**Use Case**: User tracking their submitted requests

---

#### Ticket Analytics

Get aggregated statistics for dashboard.

```graphql
query {
  ticketAnalytics(filter: AnalyticsFilterInput) {
    total
    byStatus {
      status
      count
    }
    byType {
      type
      count
    }
    byPriority {
      priority
      count
    }
  }
}
```

**Filter Options**:
| Field | Type | Description |
|-------|------|-------------|
| `startDate` | String | ISO date string (e.g., "2025-12-01") |
| `endDate` | String | ISO date string (e.g., "2025-12-31") |

**Example**:
```graphql
query {
  ticketAnalytics(filter: {
    startDate: "2025-12-01"
    endDate: "2025-12-31"
  }) {
    total
    byStatus {
      status
      count
    }
  }
}
```

**Response Example**:
```json
{
  "total": 156,
  "byStatus": [
    { "status": "PENDING", "count": 12 },
    { "status": "IN_PROGRESS", "count": 34 },
    { "status": "RESOLVED", "count": 98 }
  ],
  "byType": [
    { "type": "MIS", "count": 89 },
    { "type": "ITS", "count": 67 }
  ],
  "byPriority": [
    { "priority": "CRITICAL", "count": 5 },
    { "priority": "HIGH", "count": 23 },
    { "priority": "MEDIUM", "count": 87 },
    { "priority": "LOW", "count": 41 }
  ]
}
```

---

#### SLA Metrics

Get Service Level Agreement compliance metrics.

```graphql
query {
  slaMetrics {
    overdue
    dueToday
    dueSoon
  }
}
```

**Returns**:
- `overdue`: Number of tickets past their due date
- `dueToday`: Number of tickets due today
- `dueSoon`: Number of tickets due within 3 days

**Use Case**: Dashboard alerts and warnings

---

## Data Models

### Ticket

Core ticket entity representing a service request.

```typescript
type Ticket {
  id: Int!
  ticketNumber: String!        // Format: MIS-20251209-001
  type: TicketType!             // MIS or ITS
  title: String!
  description: String!
  status: TicketStatus!
  priority: Priority!
  
  // SLA fields
  dueDate: String               // ISO datetime
  estimatedDuration: Int        // Hours
  actualDuration: Int           // Hours (calculated on resolution)
  
  // Relations
  createdBy: User!
  createdById: Int!
  misTicket: MISTicket          // If type = MIS
  itsTicket: ITSTicket          // If type = ITS
  assignments: [TicketAssignment!]!
  notes: [TicketNote!]!
  attachments: [TicketAttachment!]!
  statusHistory: [TicketStatusHistory!]!
  
  // Timestamps
  createdAt: String!
  updatedAt: String!
  resolvedAt: String
  closedAt: String
}
```

---

### MISTicket

Extension for MIS-type tickets.

```typescript
type MISTicket {
  id: Int!
  ticketId: Int!
  category: MISCategory!        // WEBSITE or SOFTWARE
  
  // Website options
  websiteNewRequest: Boolean!
  websiteUpdate: Boolean!
  
  // Software options
  softwareNewRequest: Boolean!
  softwareUpdate: Boolean!
  softwareInstall: Boolean!
  
  createdAt: String!
  updatedAt: String!
}
```

---

### ITSTicket

Extension for ITS-type tickets.

```typescript
type ITSTicket {
  id: Int!
  ticketId: Int!
  
  // Borrow fields
  borrowRequest: Boolean!
  borrowDetails: String
  
  // Maintenance fields
  maintenanceDesktopLaptop: Boolean!
  maintenanceInternetNetwork: Boolean!
  maintenancePrinter: Boolean!
  maintenanceDetails: String
  
  createdAt: String!
  updatedAt: String!
}
```

---

### TicketAssignment

Represents a user assigned to work on a ticket.

```typescript
type TicketAssignment {
  id: Int!
  ticketId: Int!
  userId: Int!
  user: User!
  assignedAt: String!
}
```

**Note**: Multiple users can be assigned to the same ticket for collaboration.

---

### TicketNote

Comment or update on a ticket.

```typescript
type TicketNote {
  id: Int!
  ticketId: Int!
  userId: Int!
  user: User!
  content: String!
  isInternal: Boolean!          // Staff-only if true
  createdAt: String!
  updatedAt: String!
}
```

---

### TicketStatusHistory

Audit trail of status changes.

```typescript
type TicketStatusHistory {
  id: Int!
  ticketId: Int!
  userId: Int!
  user: User!
  fromStatus: TicketStatus
  toStatus: TicketStatus!
  comment: String
  createdAt: String!
}
```

---

### TicketAttachment

File uploaded to a ticket.

```typescript
type TicketAttachment {
  id: Int!
  ticketId: Int!
  filename: String!             // Stored filename
  originalName: String!         // Original upload name
  mimeType: String!
  size: Int!                    // Bytes
  url: String!                  // Access URL
  createdAt: String!
}
```

---

## Enums

### TicketType

```graphql
enum TicketType {
  MIS      # Management Information System
  ITS      # ICT Support
}
```

---

### TicketStatus

```graphql
enum TicketStatus {
  PENDING       # Newly created, awaiting assignment
  ASSIGNED      # Assigned to staff member(s)
  IN_PROGRESS   # Work has started
  ON_HOLD       # Temporarily paused
  RESOLVED      # Work completed, awaiting closure
  CLOSED        # Ticket completed and closed
  CANCELLED     # Ticket cancelled/invalid
}
```

---

### Priority

```graphql
enum Priority {
  LOW           # 7 days SLA
  MEDIUM        # 3 days SLA (default)
  HIGH          # 24 hours SLA
  CRITICAL      # 4 hours SLA
}
```

---

### MISCategory

```graphql
enum MISCategory {
  WEBSITE       # Website development/updates
  SOFTWARE      # Software development/updates
}
```

---

## Business Rules

### Auto-Assignment Rules

1. **MIS Tickets** are assigned to:
   - Users with DEVELOPER role
   - Users with ADMIN role
   - Selection based on current workload (fewest active tickets)

2. **ITS Tickets** are assigned to:
   - Users with OFFICE_HEAD role
   - Users with ADMIN role
   - Selection based on current workload (fewest active tickets)

3. **Fallback**: If no eligible users found, ticket stays in PENDING status

---

### Status Transition Rules

Valid transitions:
```
PENDING → ASSIGNED
ASSIGNED → IN_PROGRESS
ASSIGNED → CANCELLED
IN_PROGRESS → ON_HOLD
IN_PROGRESS → RESOLVED
IN_PROGRESS → CANCELLED
ON_HOLD → IN_PROGRESS
ON_HOLD → CANCELLED
RESOLVED → CLOSED
RESOLVED → IN_PROGRESS (if reopened)
```

---

### Assignment Rules

1. **Multiple Assignments**: One ticket can have multiple assigned users
2. **Unassignment**: If all users removed, status reverts to PENDING
3. **Manual Override**: ADMIN/OFFICE_HEAD can manually assign anyone
4. **Auto-Assignment**: Happens automatically on ticket creation

---

### Note Visibility Rules

1. **Public Notes** (`isInternal: false`):
   - Visible to ticket creator
   - Visible to assigned staff
   - Visible to all staff roles

2. **Internal Notes** (`isInternal: true`):
   - Visible to ADMIN
   - Visible to DEVELOPER
   - Visible to OFFICE_HEAD
   - **NOT** visible to regular USER who created ticket

---

## SLA (Service Level Agreement)

### Due Date Calculation

Due dates are automatically calculated based on priority:

| Priority | SLA Time | Example |
|----------|----------|---------|
| CRITICAL | 4 hours | Created 9:00 AM → Due 1:00 PM |
| HIGH | 24 hours | Created Monday 9 AM → Due Tuesday 9 AM |
| MEDIUM | 72 hours | Created Mon 9 AM → Due Thu 9 AM |
| LOW | 168 hours | Created Mon 9 AM → Due next Mon 9 AM |

---

### SLA Status

Tickets are categorized into three SLA states:

**On Track** ✅
- More than 4 hours until due date
- Normal priority handling

**At Risk** ⚠️
- Less than 4 hours until due date
- Requires attention
- Yellow badge in UI

**Overdue** 🔴
- Past due date
- Critical attention needed
- Red badge in UI
- Notification to supervisor

---

### Estimated Duration

If not provided manually, system calculates based on:

**MIS Tickets**:
- CRITICAL: 3 hours
- HIGH: 8 hours
- MEDIUM: 16 hours
- LOW: 24 hours

**ITS Tickets**:
- CRITICAL: 2 hours
- HIGH: 4 hours
- MEDIUM: 8 hours
- LOW: 16 hours

---

## Error Handling

### Common Error Responses

#### Unauthorized
```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

**Solution**: Ensure valid JWT token in Authorization header

---

#### Forbidden
```json
{
  "errors": [
    {
      "message": "Forbidden: Insufficient permissions",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

**Solution**: User role lacks permission for this operation

---

#### Not Found
```json
{
  "errors": [
    {
      "message": "Ticket not found",
      "extensions": {
        "code": "NOT_FOUND"
      }
    }
  ]
}
```

**Solution**: Check ticket ID is correct

---

#### Validation Error
```json
{
  "errors": [
    {
      "message": "Validation failed",
      "extensions": {
        "code": "BAD_USER_INPUT",
        "errors": [
          "title must be at least 5 characters",
          "description must be at least 10 characters"
        ]
      }
    }
  ]
}
```

**Solution**: Fix input according to validation rules

---

## Examples

### Complete Ticket Lifecycle

#### 1. User Creates Ticket
```graphql
mutation {
  createMISTicket(input: {
    title: "Student Portal Login Issues"
    description: "Students reporting unable to login to portal. Error: 'Invalid credentials' even with correct password."
    category: SOFTWARE
    softwareUpdate: true
    priority: HIGH
  }) {
    ticketNumber
    dueDate
    assignments {
      user { name }
    }
  }
}
```

**Response**:
```json
{
  "ticketNumber": "MIS-20251209-015",
  "dueDate": "2025-12-10T15:30:00Z",
  "assignments": [
    { "user": { "name": "Jane Developer" } }
  ]
}
```

---

#### 2. Developer Starts Work
```graphql
mutation {
  updateTicketStatus(
    ticketId: 42
    input: {
      status: IN_PROGRESS
      comment: "Investigating database authentication service"
    }
  ) {
    status
  }
}
```

---

#### 3. Developer Adds Progress Note
```graphql
mutation {
  addTicketNote(
    ticketId: 42
    input: {
      content: "Found issue in LDAP configuration. Applying fix to production server."
      isInternal: false
    }
  ) {
    id
  }
}
```

---

#### 4. Developer Resolves Ticket
```graphql
mutation {
  updateTicketStatus(
    ticketId: 42
    input: {
      status: RESOLVED
      comment: "Fixed LDAP configuration. All students can now login successfully. Monitoring for 24 hours."
    }
  ) {
    status
    resolvedAt
  }
}
```

---

#### 5. User Confirms & Closes
```graphql
mutation {
  updateTicketStatus(
    ticketId: 42
    input: {
      status: CLOSED
      comment: "Confirmed working. Thank you!"
    }
  ) {
    status
    closedAt
  }
}
```

---

### Dashboard Analytics Example

```graphql
query DashboardData {
  # Get all tickets overview
  analytics: ticketAnalytics {
    total
    byStatus {
      status
      count
    }
    byType {
      type
      count
    }
  }
  
  # Get SLA warnings
  sla: slaMetrics {
    overdue
    dueToday
    dueSoon
  }
  
  # Get my assigned work
  myWork: myTickets {
    ticketNumber
    title
    priority
    dueDate
    status
  }
}
```

---

## Changelog

### Version 1.0.0 (December 9, 2025)

**Initial Release**

✅ **Features Added**:
- Complete ticket creation system (MIS and ITS types)
- Auto-assignment based on workload
- SLA tracking with automatic deadline calculation
- Multi-user collaboration support
- Status history audit trail
- Internal and public notes
- File attachment support
- Real-time analytics
- Role-based access control

✅ **API Endpoints**:
- 6 Mutations: createMISTicket, createITSTicket, updateTicketStatus, assignTicket, unassignTicket, addTicketNote
- 7 Queries: ticket, ticketByNumber, tickets, myTickets, myCreatedTickets, ticketAnalytics, slaMetrics

✅ **Database Schema**:
- 7 tables: Ticket, MISTicket, ITSTicket, TicketAssignment, TicketNote, TicketAttachment, TicketStatusHistory
- 4 enums: TicketType, TicketStatus, Priority, MISCategory
- Complete relationships with cascade deletes

✅ **Business Logic**:
- Intelligent routing algorithm
- SLA compliance tracking
- Ticket number generation (format: TYPE-YYYYMMDD-XXX)
- Workload balancing

✅ **Security**:
- JWT authentication
- Role-based authorization
- Input validation
- SQL injection prevention via Prisma ORM

---

### Upcoming Features (Planned)

**Version 1.1.0** (Planned Q1 2026):
- Email notifications on status changes
- File upload/download for attachments
- Ticket templates for common requests
- Bulk operations (assign multiple, status change multiple)
- Export tickets to PDF/Excel
- Advanced search with full-text
- Ticket priority escalation rules
- Custom SLA per department

**Version 1.2.0** (Planned Q2 2026):
- Mobile app support
- Real-time notifications via WebSocket
- Ticket dependencies (blocked by)
- Recurring ticket scheduling
- AI-powered ticket categorization
- Sentiment analysis on user feedback
- Integration with external systems (email, Slack)

---

## Support

**Documentation Issues**: Report to ICT Development Team  
**API Bugs**: Create issue in GitHub repository  
**Feature Requests**: Submit via ticket system (dogfooding!)

**Contact**:
- Email: ict@chmsu.edu.ph
- System Admin: [Admin Name]
- Lead Developer: [Developer Name]

---

**© 2025 CHMSU ICT Department. All rights reserved.**
