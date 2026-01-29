# Development Guide - CHMSU ICT System

## Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [AI Assistant Guidelines](#ai-assistant-guidelines)
- [Code Standards](#code-standards)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

---

## Project Overview

An intelligent service request monitoring and analysis platform for the ICT Department at Central Mindanao University (CHMSU). The system manages IT service tickets with role-based approval workflows, scheduling, monitoring, and analytics.

### Key Features
- 🎫 **Ticket Management** - Submit, track, and manage IT service requests
- 👥 **Role-Based Access** - USER, STAFF, SECRETARY, MIS_HEAD, ITS_HEAD, ADMIN roles
- 📅 **Schedule & Monitor** - Department heads can schedule visits and add monitor notes
- 🔔 **Notifications** - Real-time notifications for ticket updates
- 🔐 **Authentication** - JWT-based auth with optional Auth0 SSO
- 📊 **Analytics** - Track ticket metrics and performance

---

## Tech Stack

### Backend
- **Runtime:** Node.js with TypeScript
- **API:** GraphQL (Apollo Server)
- **Database:** MySQL with Prisma ORM
- **Authentication:** JWT (jose library)
- **Architecture:** NestJS-style modular structure

### Frontend
- **Framework:** Angular 17+ with Signals
- **GraphQL Client:** Apollo Angular
- **UI Library:** NG-Zorro (Ant Design)
- **State Management:** Angular Signals
- **Styling:** SCSS

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- MySQL 8+
- Git

### Installation

#### 1. Clone Repository
```bash
git clone https://github.com/mmeguizo/ictFinalSystem.git
cd ictFinalSystem
```

#### 2. Backend Setup
```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Start dev server
npm run dev
```

Backend runs on `http://localhost:4000/graphql`

#### 3. Frontend Setup
```bash
cd frontend
npm install

# Start dev server
npx ng serve
```

Frontend runs on `http://localhost:4200`

### Default Credentials
After seeding, you can login with:
- **Admin:** admin@example.com / password
- **User:** user@example.com / password

---

## Project Structure

### Backend Structure
```
backend/
├── src/
│   ├── modules/              # Feature modules
│   │   ├── auth/            # Authentication & authorization
│   │   ├── users/           # User management
│   │   ├── tickets/         # Ticket system
│   │   ├── notifications/   # Notification system
│   │   └── storage/         # File upload handling
│   ├── lib/                  # Shared utilities
│   │   ├── prisma.ts        # Prisma client singleton
│   │   ├── errors.ts        # Error handling & formatting
│   │   └── logger.ts        # Logging utility
│   ├── config/               # Configuration
│   │   ├── auth.ts          # JWT configuration
│   │   └── index.ts         # App config
│   ├── context.ts            # GraphQL context
│   └── index.ts              # Main entry point
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── migrations/           # Database migrations
│   └── seed.ts              # Database seeding
└── uploads/                  # Uploaded files (avatars, etc.)
```

### Frontend Structure
```
frontend/src/app/
├── api/                      # API services (GraphQL)
│   ├── user-api.service.ts
│   ├── ticket-api.service.ts
│   ├── admin-api.service.ts
│   └── notification-api.service.ts
├── auth/                     # Authentication
│   ├── auth.service.ts
│   ├── auth.guard.ts
│   └── role.guard.ts
├── core/                     # Core services
├── features/                 # Feature pages/components
│   ├── admin/
│   ├── tickets/
│   │   ├── my-tickets.page.ts
│   │   ├── ticket-detail.page.ts
│   │   └── submit-ticket.page.ts
│   └── notifications/
├── layout/                   # Layout components
│   └── main-layout.ts
├── shared/                   # Shared components
└── pages/                    # Other pages
```

---

## Development Workflow

### Working with Database

#### Create Migration
```bash
cd backend
npx prisma migrate dev --name your_migration_name
```

#### Reset Database (Development Only!)
```bash
npx prisma migrate reset
```

#### Open Prisma Studio (Database GUI)
```bash
npx prisma studio
```

### Working with GraphQL

#### Backend: Add New Query/Mutation
1. Define in GraphQL schema (`src/modules/*/schema.ts`)
2. Implement service method (`src/modules/*/service.ts`)
3. Create resolver (`src/modules/*/resolvers.ts`)
4. Test in GraphQL Playground

#### Frontend: Use Query/Mutation
1. Define GraphQL operation in service (`src/app/api/*.service.ts`)
2. Inject service in component
3. Call method and handle response

### Building for Production

#### Backend
```bash
cd backend
npm run build
npm start
```

#### Frontend
```bash
cd frontend
npx ng build
# Output in dist/ictsystem/
```

---

## AI Assistant Guidelines

### Two Operating Modes

This project uses a **dual-mode approach** for AI assistance:

#### 1. Learning Mode (Default)
When you **ask questions** or seek guidance:
- AI provides guidance and direction, NOT full implementations
- Explains concepts and best practices
- Shares relevant documentation links
- Suggests file locations and patterns
- Offers to show code only when requested

**Examples:**
- "How do I create an admin service?"
- "What's the best way to handle user roles?"
- "Where should I put this logic?"

#### 2. Implementation Mode
When you say **"agent"** or explicitly request implementation:
- AI implements changes directly
- Creates/edits files as needed
- Runs commands and handles tasks
- Makes decisions on your behalf

**Examples:**
- "agent: create the admin service"
- "agent: fix this bug"
- "agent: add getAllUsers method"

### Keywords

**Learning Mode:**
- "how do I..."
- "what's the best way..."
- "explain..."
- "guide me..."

**Implementation Mode:**
- "agent: [task]"
- "implement this"
- "do this for me"

---

## Code Standards

### TypeScript
- ✅ Use strict type checking
- ✅ Export interfaces for all data structures
- ✅ Use `readonly` where applicable
- ✅ Prefer `const` over `let`
- ✅ Descriptive variable names

### Angular
- ✅ Use signals for reactive state
- ✅ Implement `OnPush` change detection
- ✅ Use standalone components
- ✅ Follow Angular style guide
- ✅ Reactive patterns with RxJS when appropriate

### GraphQL
- ✅ Type all queries/mutations
- ✅ Use variables, not inline values
- ✅ Implement proper error handling
- ✅ Appropriate fetchPolicy usage

### Naming Conventions
- **Files:** `kebab-case.ts` (e.g., `admin-api.service.ts`)
- **Classes:** `PascalCase` (e.g., `AdminApiService`)
- **Variables:** `camelCase` (e.g., `userData`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `GET_ALL_USERS_QUERY`)

---

## Common Patterns

### Frontend Service Pattern
```typescript
@Injectable({ providedIn: 'root' })
export class XxxApiService {
  private readonly apollo = inject(Apollo);
  
  getXxx(token?: string) {
    const authToken = token || getStoredToken();
    return this.apollo.query<XxxData, XxxVariables>({
      query: GET_XXX_QUERY,
      fetchPolicy: 'network-only',
      context: buildAuthContext(authToken),
    });
  }
}
```

### Frontend Component Pattern
```typescript
@Component({
  selector: 'app-xxx',
  imports: [CommonModule, NzXxxModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './xxx.html',
  styleUrls: ['./xxx.scss'],
})
export class XxxComponent {
  readonly data = signal<Type[]>([]);
  readonly loading = signal(false);
  
  private readonly xxxService = inject(XxxApiService);
  
  constructor() {
    effect(() => {
      // Reactive updates
    });
  }
}
```

### Backend Resolver Pattern
```typescript
export const xxxResolvers = {
  Query: {
    xxx: async (_: any, args: any, context: GraphQLContext) => {
      requireAuth(context);
      return context.services.xxx.getXxx(args);
    },
  },
  Mutation: {
    createXxx: async (_: any, args: any, context: GraphQLContext) => {
      requireAuth(context);
      requireRole(context, ['ADMIN']);
      return context.services.xxx.createXxx(args);
    },
  },
};
```

### Authentication Pattern
```typescript
// Frontend: Pass token to GraphQL
function buildAuthContext(token?: string) {
  if (!token) return undefined;
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  return { headers };
}

// Backend: Verify token
export async function requireAuth(context: GraphQLContext) {
  if (!context.currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}
```

---

## Troubleshooting

### Common Issues

#### JWT Token Expired
**Symptom:** "Internal server error" or "ERR_JWT_EXPIRED"
**Solution:** Logout and login again. Token auto-expiration is handled, but you may need to clear localStorage.

```javascript
// In browser console:
localStorage.clear();
location.href = '/login';
```

#### Database Connection Failed
**Symptom:** "Can't reach database server"
**Solution:** 
1. Check MySQL is running
2. Verify `.env` DATABASE_URL is correct
3. Run `npx prisma migrate dev`

#### Apollo Cache Issues
**Symptom:** Data not updating after mutation
**Solution:** Use `fetchPolicy: 'network-only'` or refetch queries

```typescript
await this.apollo.mutate({ ... });
await this.apollo.query({ query: GET_XXX, fetchPolicy: 'network-only' });
```

#### Build Errors
**Symptom:** "Module not found" or type errors
**Solution:**
```bash
# Backend
rm -rf node_modules package-lock.json
npm install

# Frontend
rm -rf node_modules package-lock.json
npm install
```

---

## Resources

### Official Documentation
- **Angular:** https://angular.dev/
- **Angular Signals:** https://angular.dev/guide/signals
- **Prisma:** https://www.prisma.io/docs
- **GraphQL:** https://graphql.org/learn/
- **Apollo Angular:** https://apollo-angular.com/
- **NG-Zorro:** https://ng.ant.design/

### Learning Resources
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/intro.html
- **Clean Code JavaScript:** https://github.com/ryanmcdermott/clean-code-javascript
- **GraphQL Best Practices:** https://graphql.org/learn/best-practices/

### Project Documentation
- [Backend Implementation Guide](../BACKEND_IMPLEMENTATION_GUIDE.md)
- [Backend Quick Start](../BACKEND_QUICK_START.md)
- [Backend Architecture](../backend/ARCHITECTURE.md)
- [Frontend Architecture Diagrams](../frontend/ARCHITECTURE_DIAGRAMS.md)
- [Ticket System Documentation](../frontend/docs/TICKET_SYSTEM.md)

---

## Contributing

### Before You Start
1. Read this development guide
2. Understand the two-mode AI assistant approach
3. Check existing patterns in the codebase
4. Follow code quality standards

### Making Changes
1. Create a feature branch
2. Follow existing patterns and conventions
3. Test your changes locally
4. Commit with clear, descriptive messages
5. Submit a pull request

### Getting Help
- Use **Learning Mode** to understand concepts
- Use **Implementation Mode** when you need code generated
- Check existing documentation
- Review similar implementations in the codebase

---

## License

This project is proprietary software developed for Central Mindanao University (CHMSU).

---

**Need help?** Use Learning Mode with your AI assistant by asking questions!

**Want something implemented?** Use Implementation Mode by prefixing with "agent:"
