# Notes & Comments Feature

## Overview

The notes feature allows users to add comments and internal notes to tickets. This provides a communication channel between ticket creators, approvers, and technical staff throughout the ticket lifecycle.

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER VIEWS TICKET                        │
│               (/tickets/TKT-2024-0001)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              TICKET DETAIL PAGE LOADS                       │
├─────────────────────────────────────────────────────────────┤
│ • Ticket information                                        │
│ • Approval workflow status                                  │
│ • Status history timeline                                   │
│ • Notes & Comments section ◄── NEW FEATURE                 │
│   ├── Add Note Form (at top)                               │
│   └── Existing Notes List (below)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              USER WRITES NOTE                               │
├─────────────────────────────────────────────────────────────┤
│ 1. Type comment in textarea                                 │
│    "Fixed the login button issue"                           │
│                                                             │
│ 2. (Optional) Check "Internal Note" checkbox                │
│    ☑ Internal Note (only visible to staff)                 │
│                                                             │
│ 3. Click "Add Note" button                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND VALIDATION                            │
├─────────────────────────────────────────────────────────────┤
│ File: ticket-detail.page.ts → submitNote()                 │
│ - Check note content is not empty                           │
│ - Show warning if empty: "Please enter a note"             │
│ - Disable button while submitting                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              GRAPHQL MUTATION                               │
├─────────────────────────────────────────────────────────────┤
│ File: ticket.service.ts → addTicketNote()                  │
│                                                             │
│ mutation AddTicketNote {                                    │
│   addTicketNote(                                            │
│     ticketId: 42                                            │
│     input: {                                                │
│       content: "Fixed the login button issue"              │
│       isInternal: false                                     │
│     }                                                       │
│   ) {                                                       │
│     id, content, createdAt, user { name, role }            │
│   }                                                         │
│ }                                                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND RESOLVER                               │
├─────────────────────────────────────────────────────────────┤
│ File: ticket.resolvers.ts → addTicketNote                  │
│ - Verify user is authenticated (context.currentUser)        │
│ - Call ticketService.addNote()                             │
│ - Pass ticketId, userId, and note input                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              TICKET SERVICE                                 │
├─────────────────────────────────────────────────────────────┤
│ File: ticket.service.ts → addNote()                        │
│ - Validate ticket exists                                    │
│ - Call repository.addNote()                                 │
│ - Create TicketNote record in database                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              DATABASE INSERT                                │
├─────────────────────────────────────────────────────────────┤
│ INSERT INTO TicketNote (                                    │
│   ticketId, userId, content, isInternal, createdAt         │
│ ) VALUES (                                                  │
│   42, 10, 'Fixed the login button issue', false, NOW()    │
│ );                                                          │
│                                                             │
│ Returns: New note with ID and populated user relation      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND SUCCESS HANDLING                      │
├─────────────────────────────────────────────────────────────┤
│ File: ticket-detail.page.ts                                 │
│ 1. Show success message: "Note added successfully"         │
│ 2. Clear note textarea                                      │
│ 3. Uncheck "Internal Note" checkbox                         │
│ 4. Reload ticket data to fetch updated notes list          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              PAGE REFRESHES                                 │
├─────────────────────────────────────────────────────────────┤
│ • Form is cleared and ready for next note                   │
│ • New note appears in notes list below                      │
│ • Note shows: author, role, timestamp, content              │
│ • Internal tag displayed if isInternal = true               │
└─────────────────────────────────────────────────────────────┘
```

## UI Components

### Add Note Form

```
┌─────────────────────────────────────────────────────────────┐
│  Add a Note                                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Enter your comment or note...                         │ │
│  │                                                       │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ☐ Internal Note (only visible to staff)    [Add Note]    │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Auto-resizing textarea (3-6 rows)
- Checkbox for marking notes as internal
- Button disabled when textarea is empty
- Loading state while submitting

### Notes List Display

```
┌─────────────────────────────────────────────────────────────┐
│  John Doe (DEVELOPER)              2025-12-10 10:30 AM     │
│  ─────────────────────────────────────────────────────────  │
│  Fixed the login button issue. The problem was in the      │
│  authentication middleware.                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Jane Smith (OFFICE_HEAD)  [Internal]  2025-12-10 09:15 AM │
│  ─────────────────────────────────────────────────────────  │
│  Approved. Assign to development team for urgent fix.      │
└─────────────────────────────────────────────────────────────┘
```

**Note Display**:
- **Regular notes**: Gray background (#fafafa), gray border
- **Internal notes**: Orange background (#fff7e6), orange border, orange tag
- **Header**: Author name, role in parentheses, timestamp right-aligned
- **Content**: Preserves line breaks with `white-space: pre-wrap`

## Code Structure

### Frontend Service (`ticket.service.ts`)

#### GraphQL Mutation

```typescript
const ADD_TICKET_NOTE = gql`
  mutation AddTicketNote($ticketId: Int!, $input: CreateTicketNoteInput!) {
    addTicketNote(ticketId: $ticketId, input: $input) {
      id
      ticketId
      content
      isInternal
      createdAt
      user {
        id
        name
        role
      }
    }
  }
`;
```

#### TypeScript Interfaces

```typescript
export interface CreateTicketNoteInput {
  content: string;
  isInternal?: boolean;
}

export interface TicketNote {
  id: number;
  ticketId: number;
  content: string;
  isInternal: boolean;
  createdAt: string;
  user: {
    id: number;
    name: string;
    role: string;
  };
}
```

#### Service Method

```typescript
addTicketNote(
  ticketId: number,
  input: CreateTicketNoteInput
): Observable<TicketNote> {
  return this.apollo
    .mutate<{ addTicketNote: TicketNote }>({
      mutation: ADD_TICKET_NOTE,
      variables: { ticketId, input },
    })
    .pipe(
      map((result) => {
        if (!result.data?.addTicketNote) {
          throw new Error('Failed to add note');
        }
        return result.data.addTicketNote;
      })
    );
}
```

### Frontend Component (`ticket-detail.page.ts`)

#### Component State

```typescript
readonly submittingNote = signal(false);    // Loading state
readonly noteContent = signal('');          // Textarea value
readonly isInternalNote = signal(false);    // Checkbox state
```

#### Submit Handler

```typescript
submitNote(): void {
  const content = this.noteContent().trim();
  if (!content) {
    this.message.warning('Please enter a note');
    return;
  }

  const ticket = this.ticket();
  if (!ticket) return;

  this.submittingNote.set(true);
  this.ticketService
    .addTicketNote(ticket.id, {
      content,
      isInternal: this.isInternalNote(),
    })
    .subscribe({
      next: () => {
        this.message.success('Note added successfully');
        this.noteContent.set('');           // Clear form
        this.isInternalNote.set(false);     // Reset checkbox
        this.loadTicket(ticket.ticketNumber); // Refresh ticket
      },
      error: (error) => {
        this.message.error('Failed to add note');
        this.submittingNote.set(false);
      },
      complete: () => {
        this.submittingNote.set(false);
      },
    });
}
```

### Template (`ticket-detail.page.html`)

```html
<!-- Add Note Form -->
<div class="add-note-form">
  <h4>Add a Note</h4>
  <textarea
    nz-input
    [ngModel]="noteContent()"
    (ngModelChange)="noteContent.set($event)"
    placeholder="Enter your comment or note..."
    [nzAutosize]="{ minRows: 3, maxRows: 6 }"
    [disabled]="submittingNote()"
  ></textarea>
  
  <div class="form-actions">
    <label nz-checkbox 
      [ngModel]="isInternalNote()" 
      (ngModelChange)="isInternalNote.set($event)" 
      [disabled]="submittingNote()">
      Internal Note (only visible to staff)
    </label>
    
    <button
      nz-button
      nzType="primary"
      (click)="submitNote()"
      [nzLoading]="submittingNote()"
      [disabled]="!noteContent().trim()"
    >
      Add Note
    </button>
  </div>
</div>

<nz-divider></nz-divider>

<!-- Notes List -->
@if (t.notes && t.notes.length > 0) {
  <div class="notes-list">
    @for (note of t.notes; track note.id) {
      <div class="note-item" [class.internal]="note.isInternal">
        <div class="note-header">
          <strong>{{ note.user.name }}</strong>
          <span class="note-role">({{ note.user.role }})</span>
          @if (note.isInternal) {
            <nz-tag nzColor="orange">Internal</nz-tag>
          }
          <span class="note-time">{{ formatDate(note.createdAt) }}</span>
        </div>
        <div class="note-content">{{ note.content }}</div>
      </div>
    }
  </div>
} @else {
  <nz-empty nzNotFoundContent="No notes yet"></nz-empty>
}
```

### Styling (`ticket-detail.page.scss`)

```scss
.add-note-form {
  margin-bottom: 24px;

  h4 {
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 500;
  }

  textarea {
    margin-bottom: 12px;
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;

    label {
      flex: 1;
    }

    button {
      flex-shrink: 0;
    }
  }
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note-item {
  padding: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fafafa;

  &.internal {
    background: #fff7e6;
    border-color: #ffd591;
  }

  .note-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .note-role {
      color: #8c8c8c;
      font-size: 12px;
    }

    .note-time {
      margin-left: auto;
      color: #8c8c8c;
      font-size: 12px;
    }
  }

  .note-content {
    white-space: pre-wrap;
    line-height: 1.6;
  }
}
```

## Backend Implementation

### GraphQL Schema (`ticket.types.ts`)

```graphql
type TicketNote {
  id: Int!
  ticketId: Int!
  userId: Int!
  user: User!
  content: String!
  isInternal: Boolean!
  createdAt: String!
  updatedAt: String!
}

input CreateTicketNoteInput {
  content: String!
  isInternal: Boolean
}

extend type Mutation {
  addTicketNote(ticketId: Int!, input: CreateTicketNoteInput!): TicketNote!
}
```

### Resolver (`ticket.resolvers.ts`)

```typescript
addTicketNote: async (
  _: any,
  { ticketId, input }: { ticketId: number; input: CreateTicketNoteDto },
  context: any
) => {
  if (!context.currentUser) {
    throw new Error('Unauthorized');
  }
  return ticketService.addNote(ticketId, context.currentUser.id, input);
}
```

**Authorization**: Requires authenticated user (any role can add notes)

### Service Method (`ticket.service.ts`)

```typescript
async addNote(ticketId: number, userId: number, dto: CreateTicketNoteDto) {
  return this.repository.addNote(
    ticketId, 
    userId, 
    dto.content, 
    dto.isInternal || false
  );
}
```

### Database Schema (`schema.prisma`)

```prisma
model TicketNote {
  id         Int      @id @default(autoincrement())
  ticketId   Int
  ticket     Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  
  userId     Int
  user       User     @relation(fields: [userId], references: [id])
  
  content    String   @db.Text
  isInternal Boolean  @default(false)
  
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  @@index([ticketId])
  @@index([userId])
}
```

## Use Cases

### 1. Ticket Creator Adds Update

```
User: "I tried the suggested fix but still having issues"
Type: Regular note (isInternal: false)
Visible to: Everyone
```

### 2. Technical Staff Adds Progress Update

```
Developer: "Deployed fix to production. Monitoring for 24 hours."
Type: Regular note (isInternal: false)
Visible to: Everyone (keeps requester informed)
```

### 3. Internal Discussion Between Staff

```
Office Head: "Priority changed to HIGH. Needs immediate attention."
Type: Internal note (isInternal: true)
Visible to: Staff only (ADMIN, OFFICE_HEAD, DEVELOPER)
```

### 4. Approval Comment

```
Director: "Approved for development. Budget allocated."
Type: Regular note (isInternal: false)
Visible to: Everyone (shows approval rationale)
```

## Access Control

| User Role | Can Add Notes | Can View Regular Notes | Can View Internal Notes |
|-----------|--------------|----------------------|------------------------|
| Regular User | ✅ Yes | ✅ Yes (all tickets they created) | ❌ No |
| DEVELOPER | ✅ Yes | ✅ Yes (assigned tickets) | ✅ Yes (assigned tickets) |
| OFFICE_HEAD | ✅ Yes | ✅ Yes (all tickets) | ✅ Yes (all tickets) |
| ADMIN | ✅ Yes | ✅ Yes (all tickets) | ✅ Yes (all tickets) |

**Note**: Internal notes visibility filtering happens at the backend/GraphQL layer based on user role.

## Testing Checklist

- [ ] Add regular note as ticket creator
- [ ] Add internal note as staff member
- [ ] Verify internal notes show orange background and tag
- [ ] Verify note appears immediately after submission
- [ ] Verify form clears after successful submission
- [ ] Verify button is disabled when textarea is empty
- [ ] Verify loading state shows during submission
- [ ] Verify error message on submission failure
- [ ] Verify notes are sorted chronologically (newest first)
- [ ] Verify line breaks in note content are preserved

## Future Enhancements

- [ ] **Edit/Delete notes**: Allow users to edit or delete their own notes
- [ ] **Mentions**: `@username` to notify specific users
- [ ] **Attachments**: Upload files with notes
- [ ] **Rich text editor**: Support formatting (bold, italic, lists)
- [ ] **Real-time updates**: Use GraphQL subscriptions for live note updates
- [ ] **Note reactions**: Thumbs up, heart, etc.
- [ ] **Note threading**: Reply to specific notes
- [ ] **Activity feed**: Separate timeline for all ticket activities including notes
