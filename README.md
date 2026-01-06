"# ICT Support Ticketing System

A comprehensive ticketing system for ICT support requests, built with Angular 18+ and Node.js/GraphQL.

## Features

- **Dual Ticket Types**: MIS (Software/Website) and ITS (Borrow/Maintenance) requests
- **Review & Approval Workflow**: Secretary review → Director approval → Office Head assignment
- **Auto-incrementing Control Numbers**: Format `YYYY-MM-NNN` (e.g., `2025-12-001`)
- **Role-based Access Control**: USER, SECRETARY, DIRECTOR, OFFICE_HEAD, DEVELOPER, ADMIN
- **Dual Authentication**: Auth0 SSO (Google/Microsoft) + Local email/password
- **Real-time Status Tracking**: Full ticket lifecycle with status history

## Tech Stack

### Frontend
- Angular 18+ with standalone components
- Ng-Zorro (Ant Design) UI components
- Apollo Client for GraphQL
- Signal-based state management

### Backend
- Node.js with Express
- Apollo Server (GraphQL)
- Prisma ORM with MySQL
- JWT authentication

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL database
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/mmeguizo/ictFinalSystem.git
cd ictFinalSystem
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your database and Auth0 credentials
```

4. Run database migrations
```bash
npx prisma migrate dev
npx prisma generate
```

5. Start the backend
```bash
npm run dev
```

6. Install frontend dependencies (new terminal)
```bash
cd frontend
npm install
```

7. Start the frontend
```bash
npm start
```

## Ticket Workflow

```
User Creates Ticket → FOR_REVIEW
       ↓
Secretary Reviews → REVIEWED  
       ↓
Director Approves → DIRECTOR_APPROVED
       ↓
Auto-assign → ASSIGNED (to Office Head)
       ↓
Office Head assigns to staff
       ↓
IN_PROGRESS ↔ ON_HOLD
       ↓
RESOLVED → CLOSED
```

## API Documentation

### Queries
- `tickets` - Get all tickets (with optional filters)
- `myCreatedTickets` - Get tickets created by current user
- `ticketsForSecretaryReview` - Get tickets awaiting secretary review
- `ticketsPendingDirectorApproval` - Get tickets awaiting director approval
- `allSecretaryTickets` - Get all tickets for admin/secretary oversight

### Mutations
- `createMISTicket` - Create a new MIS ticket
- `createITSTicket` - Create a new ITS ticket
- `reviewTicketAsSecretary` - Mark ticket as reviewed
- `approveTicketAsDirector` - Approve ticket as director
- `assignTicket` - Assign user to ticket

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## License

This project is licensed under the MIT License.
" 
