# Frontend Ticket System Documentation

## Overview

The ticket system frontend provides a complete interface for submitting, tracking, and managing IT support tickets with an integrated approval workflow. The system mirrors the manual paper-based process digitally.

## Architecture

### Component Structure

```
src/app/features/tickets/
├── tickets-layout.component.ts         # Layout with sidebar navigation (NEW)
├── submit-ticket.page.ts/html/scss     # Ticket submission form
├── my-tickets.page.ts/html/scss        # List of user's tickets
└── ticket-detail.page.ts/html/scss     # Detailed ticket view with approval tracking
```

### Service Layer

```
src/app/core/services/
└── ticket.service.ts                   # GraphQL client for ticket operations
```

### Routing (Updated)

```typescript
/tickets                  → TicketsLayoutComponent (Layout with sidebar)
  ├── /tickets           → MyTicketsPage       (List all user's tickets)
  ├── /tickets/new       → SubmitTicketPage    (Create new ticket)
  └── /tickets/:number   → TicketDetailPage    (View ticket details)
```

**Note**: All ticket routes now use a shared layout with persistent sidebar navigation.

## User Flow

### Visual User Journey (Updated with Sidebar)

```
┌────────────────────────────────────────────────────────────┐
│  User navigates to /tickets                                │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌──────────────┬─────────────────────────────────────────────┐
│   Tickets    │  My Tickets (Table)                         │
│              │  ◄── /tickets                               │
│ • My Tickets │  - View all tickets                         │
│ • New Ticket │  - Filter by status                         │
│              │  - Click View or ticket number              │
└──────────────┴─────────────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │                      │
         ▼                      ▼
┌──────────────┬───────  ┌──────────────┬───────────────────┐
│   Tickets    │         │   Tickets    │  ⟳ Submitting...  │
│              │  Form   │              │  [Loading state]  │
│ • My Tickets │  with   │ • My Tickets │                   │
│ • New Ticket │  spinner│ • New Ticket │  ◄── On submit    │
└──────────────┴───────  └──────────────┴───────────────────┘
         │                      │
         │                      ▼ (Success)
         │              Redirects to /tickets
         │
         ▼ (Click View)
┌──────────────┬─────────────────────────────────────────────┐
│   Tickets    │  ⟳ Loading...                               │
│              │  [Shows spinner immediately]                │
│ • My Tickets │  ◄── /tickets/:ticketNumber                 │
│ • New Ticket │                                             │
└──────────────┴─────────────────────────────────────────────┘
         │
         ▼ (Data loaded)
┌──────────────┬─────────────────────────────────────────────┐
│   Tickets    │  Ticket Details                             │
│              │  - Approval workflow                        │
│ • My Tickets │  - Status history                           │
│ • New Ticket │  - Notes & comments (with add form)         │
│              │  - Can navigate via sidebar anytime         │
└──────────────┴─────────────────────────────────────────────┘
```

**Key UX Improvements**:
- ✅ Persistent sidebar for easy navigation between pages
- ✅ Loading spinner on submit (entire card, not just button)
- ✅ Loading spinner on detail page (shows immediately)
- ✅ Clear visual feedback at every step

## Components

### 0. TicketsLayoutComponent (`tickets-layout.component.ts`) **NEW**

**Purpose**: Provide consistent layout with sidebar navigation for all ticket pages

**Features**:
- Persistent sidebar with navigation links
- **Collapsible sidebar** with toggle button
- Highlights active route
- Responsive design (auto-collapses on mobile)
- Clean, professional layout
- Collapsed width: 80px (shows icons only)
- Expanded width: 250px (shows full menu)

**Template Structure**:
```html
<nz-layout class="tickets-layout">
  <nz-sider nzTheme="light" nzWidth="250px">
    <div class="sidebar-header">
      <h3>Tickets</h3>
    </div>
    <ul nz-menu nzMode="inline">
      <li nz-menu-item [routerLink]="['/tickets']">
        📋 My Tickets
      </li>
      <li nz-menu-item [routerLink]="['/tickets/new']">
        ➕ Submit New Ticket
      </li>
    </ul>
  </nz-sider>
  <nz-content>
    <router-outlet />
  </nz-content>
</nz-layout>
```

**Styling**:
- Sidebar: 250px width, white background, subtle shadow
- Content: Responsive padding, gray background
- Menu items: Rounded corners, hover effects, active highlighting

---

### 1. SubmitTicketPage (`submit-ticket.page.ts`)

**Purpose**: Create new MIS or ITS tickets

**Features**:
- Toggle between MIS and ITS ticket types
- Dynamic form based on ticket type
- Validation and error handling
- **Loading spinner during submission** (wraps entire card)
- Shows "Submitting ticket..." message
- Redirects to `/tickets` after successful submission

**Template Structure** (Updated):
```html
<nz-spin [nzSpinning]="busy()" nzTip="Submitting ticket...">
  <nz-card [nzTitle]="...">
    <!-- Form content -->
  </nz-card>
</nz-spin>
```

**Key Methods**:

```typescript
// Handle ticket type selection
onTicketTypeChange(type: 'MIS' | 'ITS'): void {
  this.selectedType.set(type);
}

// Handle MIS ticket submission
onMISSubmit(formData: any): void {
  this.busy.set(true);
  this.ticketService.createMISTicket(formData)
    .subscribe({
      next: (result) => {
        this.message.success('MIS ticket submitted successfully!');
        this.router.navigateByUrl('/tickets');
      },
      error: (error) => {
        this.message.error('Failed to submit ticket');
      },
      complete: () => {
        this.busy.set(false);
      }
    });
}

// Handle ITS ticket submission (similar pattern)
onITSSubmit(formData: any): void { /* ... */ }
```

**Template Structure**:

```html
<nz-card>
  <!-- Ticket type selector -->
  <nz-segmented [nzOptions]="typeOptions" />
  
  <!-- MIS Form (shown when selectedType === 'MIS') -->
  <app-mis-form *ngIf="selectedType() === 'MIS'" />
  
  <!-- ITS Form (shown when selectedType === 'ITS') -->
  <app-its-form *ngIf="selectedType() === 'ITS'" />
</nz-card>
```

**Form Fields**:

| Ticket Type | Fields |
|------------|---------|
| **MIS** | title, description, category (WEBSITE/SOFTWARE), softwareType, websiteUrl, priority |
| **ITS** | title, description, deviceType, deviceModel, serialNumber, priority |

---

### 2. MyTicketsPage (`my-tickets.page.ts`)

**Purpose**: Display all tickets created by the current user

**Features**:
- Paginated table of tickets
- Status filtering (ALL, PENDING, SECRETARY_APPROVED, etc.)
- Color-coded status and priority tags
- Shows assigned staff members
- Click-through to detail page
- Empty state when no tickets

**State Management**:

```typescript
// Reactive signals
loading = signal<boolean>(true);
tickets = signal<TicketListItem[]>([]);
statusFilter = signal<string>('ALL');

// Computed filtered tickets
filteredTickets = computed(() => {
  const filter = this.statusFilter();
  if (filter === 'ALL') return this.tickets();
  return this.tickets().filter(t => t.status === filter);
});
```

**Key Methods**:

```typescript
// Load user's tickets on init
loadTickets(): void {
  this.loading.set(true);
  this.ticketService.getMyCreatedTickets().subscribe({
    next: (tickets) => {
      this.tickets.set(tickets);
      this.loading.set(false);
    },
    error: (error) => {
      this.message.error('Failed to load tickets');
      this.loading.set(false);
    }
  });
}

// Get color for status tag
getStatusColor(status: string): string {
  const colorMap = {
    'PENDING': 'orange',
    'SECRETARY_APPROVED': 'blue',
    'DIRECTOR_APPROVED': 'cyan',
    'ASSIGNED': 'purple',
    'IN_PROGRESS': 'geekblue',
    'RESOLVED': 'green',
    'CLOSED': 'default',
    'CANCELLED': 'red'
  };
  return colorMap[status] || 'default';
}

// Get color for priority tag
getPriorityColor(priority: string): string {
  const colorMap = {
    'LOW': 'default',
    'MEDIUM': 'blue',
    'HIGH': 'orange',
    'CRITICAL': 'red'
  };
  return colorMap[priority] || 'default';
}

// Format date for display
formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

// Get comma-separated list of assigned staff
getAssignedStaff(assignments: any[]): string {
  if (!assignments || assignments.length === 0) return 'Unassigned';
  return assignments.map(a => a.user.name).join(', ');
}
```

**Template Structure**:

```html
<nz-card>
  <!-- Filter bar -->
  <div class="filter-bar">
    <nz-select [(ngModel)]="statusFilter" placeholder="Filter by status">
      <nz-option nzValue="ALL" nzLabel="All Tickets" />
      <nz-option nzValue="PENDING" nzLabel="Pending" />
      <nz-option nzValue="SECRETARY_APPROVED" nzLabel="Secretary Approved" />
      <!-- ... more options ... -->
    </nz-select>
  </div>

  <!-- Tickets table -->
  <nz-table [nzData]="filteredTickets()" [nzLoading]="loading()">
    <thead>
      <tr>
        <th>Ticket #</th>
        <th>Type</th>
        <th>Title</th>
        <th>Status</th>
        <th>Priority</th>
        <th>Assigned To</th>
        <th>Created</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let ticket of filteredTickets()">
        <td><strong>{{ ticket.ticketNumber }}</strong></td>
        <td><nz-tag [nzColor]="ticket.type === 'MIS' ? 'blue' : 'purple'">{{ ticket.type }}</nz-tag></td>
        <td>{{ ticket.title }}</td>
        <td><nz-tag [nzColor]="getStatusColor(ticket.status)">{{ ticket.status }}</nz-tag></td>
        <td><nz-tag [nzColor]="getPriorityColor(ticket.priority)">{{ ticket.priority }}</nz-tag></td>
        <td>{{ getAssignedStaff(ticket.assignments) }}</td>
        <td>{{ formatDate(ticket.createdAt) }}</td>
        <td>
          <a [routerLink]="['/tickets', ticket.ticketNumber]">View</a>
        </td>
      </tr>
    </tbody>
  </nz-table>

  <!-- Empty state -->
  <nz-empty *ngIf="!loading() && filteredTickets().length === 0" />
</nz-card>
```

**Status Colors**:

| Status | Color | Meaning |
|--------|-------|---------|
| PENDING | Orange | Awaiting secretary approval |
| SECRETARY_APPROVED | Blue | Awaiting director approval |
| DIRECTOR_APPROVED | Cyan | Approved, being assigned |
| ASSIGNED | Purple | Assigned to staff |
| IN_PROGRESS | Geekblue | Work in progress |
| RESOLVED | Green | Work completed |
| CLOSED | Default/Gray | Ticket closed |
| CANCELLED | Red | Ticket cancelled |

---

### 3. TicketDetailPage (`ticket-detail.page.ts`)

**Purpose**: Display comprehensive ticket details with approval workflow visualization

**Features**:
- Full ticket information
- Approval progress tracking
- Conditional approval status alerts
- Assigned staff display
- Status history timeline
- **Notes/comments section with add form** (see NOTES_FEATURE.md)
- Type-specific details (MIS/ITS)
- **Loading state shows spinner immediately** (prevents "failed to load" flash)

**State Management** (Updated):

```typescript
// Reactive signals
loading = signal<boolean>(true);  // ✅ Now starts as true for immediate spinner
ticket = signal<TicketDetail | null>(null);
submittingNote = signal(false);   // NEW: For note submission
noteContent = signal('');         // NEW: Note textarea value
isInternalNote = signal(false);   // NEW: Internal flag
```

**Loading Behavior**:
- Initial state: `loading = true` → Shows spinner immediately
- On data fetch success: `loading = false` → Shows ticket details
- On error: `loading = false` + error message
- **Prevents**: Flash of "Ticket not found" before data loads

**Key Methods**:

```typescript
// Calculate approval progress
getApprovalProgress(): { current: number; total: number } {
  const ticket = this.ticket();
  if (!ticket) return { current: 0, total: 2 };
  
  let current = 0;
  if (ticket.secretaryApprovedAt) current++;
  if (ticket.directorApprovedAt) current++;
  
  return { current, total: 2 };
}

// Check if awaiting secretary approval
isAwaitingSecretaryApproval(): boolean {
  const ticket = this.ticket();
  return ticket?.status === 'PENDING' && !ticket?.secretaryApprovedAt;
}

// Check if awaiting director approval
isAwaitingDirectorApproval(): boolean {
  const ticket = this.ticket();
  return ticket?.status === 'SECRETARY_APPROVED' && !ticket?.directorApprovedAt;
}

// Check if fully approved
isFullyApproved(): boolean {
  const ticket = this.ticket();
  return !!(ticket?.secretaryApprovedAt && ticket?.directorApprovedAt);
}

// Format date for display
formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
}
```

**Template Structure**:

```html
<nz-spin [nzSpinning]="loading()">
  <!-- Header Card: Basic ticket info -->
  <nz-card nzTitle="Ticket Information">
    <nz-descriptions nzBordered [nzColumn]="2">
      <nz-descriptions-item nzTitle="Ticket Number">
        <strong>{{ ticket()?.ticketNumber }}</strong>
      </nz-descriptions-item>
      <nz-descriptions-item nzTitle="Type">
        <nz-tag [nzColor]="ticket()?.type === 'MIS' ? 'blue' : 'purple'">
          {{ ticket()?.type }}
        </nz-tag>
      </nz-descriptions-item>
      <nz-descriptions-item nzTitle="Status">
        <nz-tag [nzColor]="getStatusColor(ticket()?.status)">
          {{ ticket()?.status }}
        </nz-tag>
      </nz-descriptions-item>
      <!-- ... more fields ... -->
    </nz-descriptions>
  </nz-card>

  <!-- Approval Workflow Card -->
  <nz-card nzTitle="Approval Workflow">
    <!-- Progress bar -->
    <nz-progress 
      [nzPercent]="(getApprovalProgress().current / getApprovalProgress().total) * 100"
      nzStatus="active" />
    
    <!-- Conditional alerts -->
    <nz-alert *ngIf="isAwaitingSecretaryApproval()"
      nzType="info"
      nzMessage="Awaiting Secretary Approval" />
    
    <nz-alert *ngIf="isAwaitingDirectorApproval()"
      nzType="info"
      nzMessage="Awaiting Director Approval" />
    
    <nz-alert *ngIf="isFullyApproved()"
      nzType="success"
      nzMessage="Fully Endorsed" />
  </nz-card>

  <!-- Assigned Staff Card -->
  <nz-card nzTitle="Assigned Staff">
    <div *ngFor="let assignment of ticket()?.assignments">
      {{ assignment.user.name }} ({{ assignment.user.role }})
      - Assigned: {{ formatDate(assignment.assignedAt) }}
    </div>
    <nz-empty *ngIf="!ticket()?.assignments?.length" />
  </nz-card>

  <!-- Status History Timeline -->
  <nz-card nzTitle="Status History">
    <nz-timeline>
      <nz-timeline-item *ngFor="let history of ticket()?.statusHistory">
        <p><strong>{{ history.toStatus }}</strong></p>
        <p *ngIf="history.comment">Comment: {{ history.comment }}</p>
        <p class="text-muted">
          {{ formatDate(history.createdAt) }} by {{ history.user.name }}
        </p>
      </nz-timeline-item>
    </nz-timeline>
  </nz-card>

  <!-- Notes/Comments -->
  <nz-card nzTitle="Notes & Comments">
    <div class="note-item" *ngFor="let note of ticket()?.notes">
      <div class="note-header">
        <strong>{{ note.user.name }}</strong>
        <span class="note-role">({{ note.user.role }})</span>
        <span class="note-date">{{ formatDate(note.createdAt) }}</span>
      </div>
      <p>{{ note.content }}</p>
      <nz-tag *ngIf="note.isInternal" nzColor="orange">Internal</nz-tag>
    </div>
    <nz-empty *ngIf="!ticket()?.notes?.length" />
  </nz-card>
</nz-spin>
```

**Approval States Visualization**:

```
State 1: PENDING
┌────────────────────────────┐
│ ⚠️ Awaiting Secretary      │
│    Approval                │
│                            │
│ Progress: 0/2              │
│ ▱▱▱▱▱▱▱▱▱▱ 0%             │
└────────────────────────────┘

State 2: SECRETARY_APPROVED
┌────────────────────────────┐
│ ✓ Secretary Approved       │
│ ⚠️ Awaiting Director       │
│    Approval                │
│                            │
│ Progress: 1/2              │
│ ▰▰▰▰▰▱▱▱▱▱ 50%            │
└────────────────────────────┘

State 3: DIRECTOR_APPROVED
┌────────────────────────────┐
│ ✓ Secretary Approved       │
│ ✓ Director Approved        │
│ ✅ Fully Endorsed          │
│                            │
│ Progress: 2/2              │
│ ▰▰▰▰▰▰▰▰▰▰ 100%           │
└────────────────────────────┘
```

---

## TicketService (`ticket.service.ts`)

**Purpose**: GraphQL client for all ticket operations

### GraphQL Queries

#### MY_CREATED_TICKETS

Fetches all tickets created by the current user:

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
        email
        role
      }
      assignedAt
    }
  }
}
```

#### TICKET_BY_NUMBER

Fetches complete ticket details including approval info, notes, and history:

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
    createdBy { id name email role }
    secretaryApprover { id name role }
    directorApprover { id name role }
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
      user { id name email role }
    }
    notes {
      id
      content
      isInternal
      createdAt
      user { id name role }
    }
    statusHistory {
      id
      fromStatus
      toStatus
      comment
      createdAt
      user { id name role }
    }
  }
}
```

### GraphQL Mutations

#### CREATE_MIS_TICKET

```graphql
mutation CreateMISTicket($input: CreateMISTicketInput!) {
  createMISTicket(input: $input) {
    id
    ticketNumber
    title
    status
  }
}
```

#### CREATE_ITS_TICKET

```graphql
mutation CreateITSTicket($input: CreateITSTicketInput!) {
  createITSTicket(input: $input) {
    id
    ticketNumber
    title
    status
  }
}
```

### Service Methods

```typescript
@Injectable({ providedIn: 'root' })
export class TicketService {
  constructor(private apollo: Apollo) {}

  // Create MIS ticket
  createMISTicket(input: CreateMISTicketInput): Observable<any> {
    return this.apollo.mutate({
      mutation: CREATE_MIS_TICKET,
      variables: { input }
    }).pipe(map(result => result.data.createMISTicket));
  }

  // Create ITS ticket
  createITSTicket(input: CreateITSTicketInput): Observable<any> {
    return this.apollo.mutate({
      mutation: CREATE_ITS_TICKET,
      variables: { input }
    }).pipe(map(result => result.data.createITSTicket));
  }

  // Get user's created tickets
  getMyCreatedTickets(): Observable<TicketListItem[]> {
    return this.apollo.query<{ myCreatedTickets: TicketListItem[] }>({
      query: MY_CREATED_TICKETS,
      fetchPolicy: 'network-only'
    }).pipe(map(result => result.data.myCreatedTickets));
  }

  // Get ticket by number
  getTicketByNumber(ticketNumber: string): Observable<TicketDetail> {
    return this.apollo.query<{ ticketByNumber: TicketDetail }>({
      query: TICKET_BY_NUMBER,
      variables: { ticketNumber },
      fetchPolicy: 'network-only'
    }).pipe(map(result => result.data.ticketByNumber));
  }
}
```

### TypeScript Interfaces

```typescript
// Summary for list view
export interface TicketListItem {
  id: number;
  ticketNumber: string;
  title: string;
  type: 'MIS' | 'ITS';
  status: string;
  priority: string;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
    email: string;
  };
  assignments: Array<{
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
    };
    assignedAt: string;
  }>;
}

// Complete details for detail view
export interface TicketDetail extends TicketListItem {
  description: string;
  secretaryApprovedById?: number;
  secretaryApprovedAt?: string;
  directorApprovedById?: number;
  directorApprovedAt?: string;
  updatedAt: string;
  secretaryApprover?: {
    id: number;
    name: string;
    role: string;
  };
  directorApprover?: {
    id: number;
    name: string;
    role: string;
  };
  misTicket?: {
    category: string;
    softwareType?: string;
    websiteUrl?: string;
  };
  itsTicket?: {
    deviceType: string;
    deviceModel?: string;
    serialNumber?: string;
  };
  notes: Array<{
    id: number;
    content: string;
    isInternal: boolean;
    createdAt: string;
    user: {
      id: number;
      name: string;
      role: string;
    };
  }>;
  statusHistory: Array<{
    id: number;
    fromStatus?: string;
    toStatus: string;
    comment?: string;
    createdAt: string;
    user: {
      id: number;
      name: string;
      role: string;
    };
  }>;
}
```

---

## Authentication Integration

### Apollo Client Setup

The ticket service uses Apollo Client with Auth0 authentication:

```typescript
// In app.config.ts
provideApollo({
  link: ApolloLink.from([
    // Auth link adds JWT token to headers
    setContext((_, { headers }) => {
      const token = localStorage.getItem('auth_token');
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : ''
        }
      };
    }),
    // HTTP link to GraphQL endpoint
    httpLink.create({ uri: 'http://localhost:4000/graphql' })
  ]),
  cache: new InMemoryCache()
})
```

### Why Apollo Link vs HttpInterceptor?

Apollo Client uses its own HTTP implementation and **bypasses Angular's HttpClient**, so Angular HttpInterceptors don't apply. Instead, Apollo Link's `setContext` adds authentication headers directly to GraphQL requests.

**Flow**:
```
Component → TicketService → Apollo Client → setContext Link 
→ Add Auth Header → HTTP Link → GraphQL Server
```

---

## UI Components (Ng-Zorro)

### Used Components

| Component | Usage |
|-----------|-------|
| `nz-card` | Container for sections |
| `nz-table` | Ticket list table |
| `nz-descriptions` | Key-value pairs in detail view |
| `nz-tag` | Status/priority/type badges |
| `nz-alert` | Approval status messages |
| `nz-progress` | Approval progress bar |
| `nz-timeline` | Status history visualization |
| `nz-empty` | Empty state when no data |
| `nz-spin` | Loading spinner |
| `nz-select` | Status filter dropdown |
| `nz-segmented` | Ticket type selector |

### Styling Patterns

```scss
// Filter bar
.filter-bar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
  
  nz-select {
    width: 200px;
  }
}

// Note item styling
.note-item {
  border-bottom: 1px solid #f0f0f0;
  padding: 12px 0;
  
  .note-header {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    
    .note-role {
      color: #999;
    }
    
    .note-date {
      margin-left: auto;
      color: #999;
      font-size: 12px;
    }
  }
}
```

---

## Testing the System

### Manual Testing Workflow

1. **Submit a ticket**:
   - Navigate to `/tickets/new`
   - Select MIS or ITS
   - Fill in required fields
   - Click Submit
   - Should redirect to `/tickets`

2. **View tickets list**:
   - Navigate to `/tickets`
   - Should see submitted ticket with `PENDING` status (orange tag)
   - Try filtering by status
   - Verify assigned staff shows "Unassigned"

3. **View ticket details**:
   - Click ticket number from list
   - Should navigate to `/tickets/TKT-2024-0001`
   - Verify all ticket information displays
   - Should see "Awaiting Secretary Approval" alert
   - Progress bar should show 0%

4. **After secretary approval** (backend):
   - Refresh detail page
   - Should see "Awaiting Director Approval" alert
   - Progress bar should show 50%
   - Status should be `SECRETARY_APPROVED` (blue tag)

5. **After director approval** (backend):
   - Refresh detail page
   - Should see "Fully Endorsed" alert (green)
   - Progress bar should show 100%
   - Status should be `ASSIGNED` (purple tag)
   - Assigned staff should be populated

6. **Check status history**:
   - Scroll to timeline section
   - Should see all status transitions
   - Each entry should show status, comment (if any), timestamp, and user

---

## Error Handling

### GraphQL Error Responses

```typescript
// In component
this.ticketService.getMyCreatedTickets().subscribe({
  next: (tickets) => {
    // Success
  },
  error: (error) => {
    if (error.graphQLErrors) {
      // GraphQL-specific errors
      error.graphQLErrors.forEach((err: any) => {
        this.message.error(err.message);
      });
    } else if (error.networkError) {
      // Network errors
      this.message.error('Network error. Please try again.');
    } else {
      // Generic errors
      this.message.error('An unexpected error occurred.');
    }
  }
});
```

### Common Error Scenarios

1. **Unauthorized**: Token expired or invalid
   - User should be redirected to login
   - Auth guard should prevent access

2. **Network error**: Backend not running
   - Show friendly error message
   - Provide retry option

3. **Not found**: Ticket doesn't exist
   - Show 404 message
   - Redirect to tickets list

4. **Validation error**: Invalid form data
   - Display field-specific errors
   - Highlight invalid fields

---

## Performance Considerations

### Query Optimization

```typescript
// Use network-only fetch policy to always get fresh data
getMyCreatedTickets(): Observable<TicketListItem[]> {
  return this.apollo.query({
    query: MY_CREATED_TICKETS,
    fetchPolicy: 'network-only'  // ← Always fetch from server
  });
}
```

### Pagination (Future Enhancement)

```typescript
// Add pagination variables
getMyCreatedTickets(page: number, limit: number): Observable<any> {
  return this.apollo.query({
    query: MY_CREATED_TICKETS,
    variables: { page, limit }
  });
}
```

---

## Future Enhancements

- [ ] **Add note functionality**: Create mutation and form to post notes on tickets
- [ ] **Real-time updates**: Use GraphQL subscriptions for live status changes
- [ ] **Batch operations**: Select multiple tickets for bulk actions
- [ ] **Advanced filtering**: Filter by date range, priority, assigned staff
- [ ] **Export functionality**: Download tickets as CSV/PDF
- [ ] **Attachment support**: Upload files to tickets
- [ ] **Email notifications**: Notify users of status changes
- [ ] **Mobile responsive**: Optimize for mobile devices
- [ ] **Ticket search**: Full-text search across title/description
- [ ] **Analytics dashboard**: Visualize ticket metrics and trends

---

## Troubleshooting

### Common Issues

1. **Tickets not loading**:
   - Check browser console for errors
   - Verify backend is running on `localhost:4000`
   - Check Auth0 token is valid in localStorage
   - Verify GraphQL endpoint is correct

2. **Submission fails**:
   - Check form validation errors
   - Verify required fields are filled
   - Check network tab for GraphQL errors
   - Ensure backend schema is up to date

3. **Detail page shows loading forever**:
   - Check if ticket number in URL is correct
   - Verify backend query returns data
   - Check for GraphQL errors in network tab

4. **Status colors not showing**:
   - Verify Ng-Zorro CSS is imported in `angular.json`
   - Check component has proper imports for `NzTagModule`
   - Verify color mapping function returns valid colors

---

## Recent UX Improvements (Dec 2025)

### 1. Sidebar Navigation (Updated)
- **Added**: `TicketsLayoutComponent` with persistent sidebar
- **Updated**: Made sidebar collapsible with toggle button
- **Benefit**: Easy navigation + space saving when needed
- **Collapsed State**: 80px width, shows icons only
- **Expanded State**: 250px width, shows full menu labels
- **Toggle**: Button at bottom of sidebar
- **Location**: All `/tickets/*` routes now use this layout
- **Files**: `tickets-layout.component.ts`, `app.routes.ts`

### 2. Submit Form Loading State
- **Added**: Full card spinner during ticket submission
- **Before**: Button disabled, form visible, no visual feedback
- **After**: Entire card shows spinner with "Submitting ticket..." message
- **Files**: `submit-ticket.page.ts` (added NzSpinModule), `submit-ticket.page.html`

### 3. Detail Page Loading Fix
- **Fixed**: "Failed to load" error when clicking View button
- **Before**: `loading = signal(false)` caused flash of error
- **After**: `loading = signal(true)` shows spinner immediately
- **Benefit**: Smooth loading experience, no error flash
- **Files**: `ticket-detail.page.ts`

### 4. Navigation Link Fixes
- **Fixed**: "New Ticket" button in my-tickets page (was `/submit-ticket`, now `/tickets/new`)
- **Fixed**: All navigation now uses correct nested routes under `/tickets`

### 5. Backend GraphQL Fix
- **Fixed**: "Cannot return null for non-nullable field Ticket.notes" error
- **Issue**: `findByTicketNumber` query wasn't including `notes` and `statusHistory`
- **Solution**: Added `notes` and `statusHistory` includes to repository query
- **Benefit**: Ticket detail page now loads without errors
- **Files**: `backend/src/modules/tickets/ticket.repository.ts`

---

## Development Tips

1. **Use signals for reactive state** - Keep components reactive and simple
2. **Fetch fresh data** - Use `fetchPolicy: 'network-only'` to avoid stale cache
3. **Handle loading states** - Always show loading indicators during async operations
4. **Provide empty states** - Use `nz-empty` when no data is available
5. **Color-code status** - Visual indicators help users quickly understand ticket state
6. **Keep components focused** - Each component should have a single responsibility
7. **Use TypeScript interfaces** - Ensure type safety for all data structures
8. **Test with real data** - Create tickets in all statuses to test UI thoroughly
9. **Update documentation** - When adding/modifying components, update this file with changes
