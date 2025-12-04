# Frontend Enterprise Refactor - Implementation Guide

## 📋 What Was Done

This refactor transforms the Angular frontend from a flat structure with manual GraphQL into an enterprise-grade application following industry best practices.

## 🏗️ Architecture Changes

### Before (Flat Structure)
```
src/app/
├── api/ (manual GraphQL queries)
├── auth/ (guards, callbacks)
├── core/services/ (simple user service)
├── features/ (mixed concerns)
├── layout/
└── pages/
```

### After (Enterprise Structure)
```
src/app/
├── core/                          # Singleton services, guards, interceptors
│   ├── config/
│   │   └── environment.ts         # ✅ Centralized configuration
│   ├── guards/
│   │   └── auth.guard.ts          # ✅ Route protection with role checking
│   ├── interceptors/
│   │   ├── auth.interceptor.ts    # ✅ Auto JWT injection
│   │   ├── error.interceptor.ts   # ✅ Global error handling
│   │   └── loading.interceptor.ts # ✅ Loading state tracking
│   └── services/
│       ├── auth.service.ts        # ✅ Enhanced with signals & computed
│       ├── storage.service.ts     # ✅ SSR-safe localStorage wrapper
│       ├── notification.service.ts # ✅ Toast/message wrapper
│       └── loading.service.ts     # ✅ Global loading state
│
├── graphql/                       # ✅ GraphQL infrastructure
│   ├── operations/
│   │   ├── user.operations.graphql  # GraphQL queries/mutations
│   │   └── auth.operations.graphql
│   └── generated/
│       └── graphql.ts             # Auto-generated types (run npm run codegen)
│
└── shared/                        # ✅ Reusable components
    ├── components/
    │   └── page-header/
    ├── directives/
    │   └── has-role.directive.ts
    └── pipes/
        └── role-label.pipe.ts
```

## 🔄 Request Flow (Frontend → Backend)

### 1. User Action (e.g., Update Profile)
```typescript
// Component calls service method
await this.userService.updateProfile({ name: 'John' });
```

### 2. HTTP Request Created
```typescript
// Apollo Client creates HTTP POST to http://localhost:4000/graphql
// Request body contains GraphQL operation
```

### 3. Auth Interceptor Adds Token
```typescript
// core/interceptors/auth.interceptor.ts
// Automatically adds: Authorization: Bearer <token>
const token = authService.getToken();
req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` }});
```

### 4. Loading Interceptor Tracks Request
```typescript
// core/interceptors/loading.interceptor.ts
// Increments loading counter
loadingService.startLoading();
```

### 5. Request Sent to Backend
```
POST http://localhost:4000/graphql
Headers: {
  Authorization: Bearer eyJhbGc...
  Content-Type: application/json
}
Body: {
  query: "mutation UpdateMyProfile($input: UpdateProfileInput!) { ... }",
  variables: { input: { name: "John" } }
}
```

### 6. Backend Processing
```typescript
// backend/src/index.ts → Apollo Server
// backend/src/context.ts → Extract & verify JWT
// backend/src/modules/users/user.resolvers.ts → updateMyProfile resolver
// backend/src/modules/users/user.service.ts → Business logic
// backend/src/modules/users/user.repository.ts → Database query
// backend/src/lib/prisma.ts → Execute SQL
```

### 7. Response Returns
```json
{
  "data": {
    "updateMyProfile": {
      "id": 1,
      "name": "John",
      "avatarUrl": "https://..."
    }
  }
}
```

### 8. Error Interceptor Catches Errors (if any)
```typescript
// core/interceptors/error.interceptor.ts
// Extracts error message and shows notification
notification.error(error.message);
```

### 9. Loading Interceptor Completes
```typescript
// core/interceptors/loading.interceptor.ts
// Decrements loading counter
loadingService.stopLoading();
```

### 10. Component Receives Response
```typescript
// Service updates state
this.authService.updateUser({ name: 'John' });
// Component reactively updates via signals
```

## 🎯 Key Files and Their Roles

### Core Infrastructure

#### `core/config/environment.ts`
**Purpose**: Centralized configuration  
**Used By**: app.config.ts, any service needing config  
**Exports**: `environment` object with apiUrl, auth0 settings

#### `core/services/auth.service.ts`
**Purpose**: Authentication state management  
**Used By**: Components, guards, interceptors  
**Key Methods**:
- `currentUser` - Signal with current user
- `isAuthenticated` - Computed boolean
- `isAdmin` - Computed boolean
- `setAuth(user, token)` - Set both user and token
- `logout()` - Clear state and redirect

#### `core/services/storage.service.ts`
**Purpose**: SSR-safe localStorage wrapper  
**Used By**: AuthService, any service needing storage  
**Key Methods**:
- `set<T>(key, value)` - Store value
- `get<T>(key)` - Retrieve value
- `remove(key)` - Delete value
- `clear()` - Clear all storage

#### `core/services/notification.service.ts`
**Purpose**: User feedback messages  
**Used By**: Error interceptor, services, components  
**Key Methods**:
- `success(message)` - Green success toast
- `error(message)` - Red error toast
- `warning(message)` - Yellow warning toast
- `info(message)` - Blue info toast

#### `core/services/loading.service.ts`
**Purpose**: Global loading state  
**Used By**: Loading interceptor, components  
**Key Properties**:
- `isLoading` - Computed signal (true if any requests active)
- `startLoading()` - Increment counter
- `stopLoading()` - Decrement counter

### Interceptors (HTTP Request/Response Pipeline)

#### `core/interceptors/auth.interceptor.ts`
**Purpose**: Add JWT to outgoing requests  
**Executes**: Before every HTTP request  
**Logic**: Reads token from AuthService → Adds Authorization header

#### `core/interceptors/error.interceptor.ts`
**Purpose**: Global error handling  
**Executes**: On HTTP error response  
**Logic**: Extracts error message → Shows notification → Re-throws error

#### `core/interceptors/loading.interceptor.ts`
**Purpose**: Track request state  
**Executes**: Before/after every HTTP request  
**Logic**: Increment counter on start → Decrement on complete

### Guards (Route Protection)

#### `core/guards/auth.guard.ts`
**Purpose**: Protect routes from unauthenticated users  
**Used In**: Route definitions  
**Logic**: Check `authService.isAuthenticated()` → Allow or redirect to login

**Example Route Usage**:
```typescript
{
  path: 'dashboard',
  component: DashboardPage,
  canActivate: [authGuard] // ← Requires authentication
}
```

#### `roleGuard(roles)` Factory
**Purpose**: Protect routes by role  
**Example**:
```typescript
{
  path: 'admin',
  component: AdminPage,
  canActivate: [roleGuard(['ADMIN'])] // ← Requires ADMIN role
}
```

### GraphQL Infrastructure

#### `graphql/operations/user.operations.graphql`
**Purpose**: Define GraphQL queries/mutations  
**Contains**: GetMe, UpdateMyProfile, SetMyPassword, etc.  
**Used By**: Code generator → Creates typed services

#### `codegen.yml`
**Purpose**: GraphQL Code Generator configuration  
**Points To**: Backend schema at http://localhost:4000/graphql  
**Generates**: `graphql/generated/graphql.ts` with typed services

#### `graphql/generated/graphql.ts` (Generated)
**Purpose**: Type-safe GraphQL operations  
**Contains**: 
- TypeScript interfaces for all GraphQL types
- Injectable Angular services (e.g., `GetMeGQL`, `UpdateMyProfileGQL`)
- Fully typed mutations and queries

**Usage Example**:
```typescript
// Before (untyped)
this.apollo.mutate({ mutation: UPDATE_PROFILE, variables: { input } });

// After (fully typed)
this.updateMyProfileGQL.mutate({ input }).subscribe({
  next: (result) => {
    const user = result.data?.updateMyProfile; // ← Fully typed!
  }
});
```

### Shared Components

#### `shared/components/page-header/page-header.component.ts`
**Purpose**: Reusable page header  
**Usage**:
```html
<app-page-header title="Dashboard" subtitle="Welcome back">
  <button actions nz-button>Action</button>
</app-page-header>
```

#### `shared/directives/has-role.directive.ts`
**Purpose**: Conditionally show elements by role  
**Usage**:
```html
<div *appHasRole="'ADMIN'">Admin only</div>
<div *appHasRole="['ADMIN', 'DEVELOPER']">Admin or Dev</div>
```

#### `shared/pipes/role-label.pipe.ts`
**Purpose**: Format role enum to readable label  
**Usage**:
```html
{{ user.role | roleLabel }}
<!-- ADMIN → Administrator -->
```

## 🔌 File Associations Map

```
app.config.ts
  ├─ imports → environment.ts (config)
  ├─ imports → auth.interceptor.ts
  ├─ imports → error.interceptor.ts
  ├─ imports → loading.interceptor.ts
  └─ provides → Apollo Client (GraphQL)

auth.interceptor.ts
  └─ injects → auth.service.ts (to get token)

error.interceptor.ts
  └─ injects → notification.service.ts (to show errors)

loading.interceptor.ts
  └─ injects → loading.service.ts (to track state)

auth.service.ts
  ├─ injects → storage.service.ts (to persist data)
  ├─ injects → router (for logout redirect)
  └─ exports → signals: currentUser, isAuthenticated, isAdmin

auth.guard.ts
  ├─ injects → auth.service.ts (to check auth state)
  └─ injects → router (for redirects)

has-role.directive.ts
  └─ injects → auth.service.ts (to check user role)

Component (e.g., DashboardPage)
  ├─ injects → auth.service.ts (for user data)
  └─ injects → GeneratedGQL services (for API calls)

GeneratedGQL service (e.g., GetMeGQL)
  ├─ uses → Apollo Client (from app.config.ts)
  ├─ HTTP request → auth.interceptor → error.interceptor → loading.interceptor
  └─ calls → Backend GraphQL endpoint
```

## 📦 Installation & Setup

### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

This will install the new GraphQL codegen packages added to `package.json`:
- @graphql-codegen/cli
- @graphql-codegen/typescript
- @graphql-codegen/typescript-operations
- @graphql-codegen/typescript-apollo-angular

### Step 2: Start Backend Server
```bash
cd ../backend
npm start
```
Backend must be running on http://localhost:4000 for code generation.

### Step 3: Generate GraphQL Types
```bash
cd ../frontend
npm run codegen
```

This will:
1. Connect to backend GraphQL endpoint
2. Fetch schema
3. Read operation files in `graphql/operations/`
4. Generate `graphql/generated/graphql.ts` with typed services

### Step 4: Start Frontend
```bash
npm start
```

## 🔄 Using Generated GraphQL Services

### Before (Manual)
```typescript
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

const GET_ME = gql`
  query GetMe {
    me { id email name role }
  }
`;

this.apollo.query({ query: GET_ME }).subscribe(result => {
  const user = result.data?.me; // ❌ Untyped!
});
```

### After (Generated)
```typescript
import { GetMeGQL } from '@app/graphql/generated/graphql';

constructor(private getMeGQL = inject(GetMeGQL)) {}

this.getMeGQL.fetch().subscribe(result => {
  const user = result.data?.me; // ✅ Fully typed!
  // IDE autocomplete for: user.id, user.email, user.name, user.role
});
```

## 🎓 Development Workflow

### Adding New GraphQL Operations

1. **Create operation file**:
```graphql
# graphql/operations/ticket.operations.graphql
query GetAllTickets {
  tickets {
    id
    title
    status
  }
}

mutation CreateTicket($input: CreateTicketInput!) {
  createTicket(input: $input) {
    id
    title
  }
}
```

2. **Regenerate types**:
```bash
npm run codegen
```

3. **Use in service**:
```typescript
import { GetAllTicketsGQL, CreateTicketGQL } from '@app/graphql/generated/graphql';

@Injectable()
export class TicketService {
  private readonly getAllTicketsGQL = inject(GetAllTicketsGQL);
  private readonly createTicketGQL = inject(CreateTicketGQL);

  loadTickets() {
    return this.getAllTicketsGQL.fetch(); // Fully typed!
  }

  createTicket(input: CreateTicketInput) {
    return this.createTicketGQL.mutate({ input }); // Fully typed!
  }
}
```

### Watching for Changes
```bash
npm run codegen:watch
```
Auto-regenerates types when operation files change.

## 🚀 Next Steps

### Phase 1: Update Existing Components ✅
Replace old UserService with new AuthService:

```typescript
// OLD
private readonly userService = inject(UserService);
const user = this.userService.currentUser();

// NEW
private readonly authService = inject(AuthService);
const user = this.authService.currentUser();
const isAdmin = this.authService.isAdmin();
const userName = this.authService.userName();
```

### Phase 2: Migrate to Generated Services
Replace manual Apollo queries with generated services:

```typescript
// OLD (api/user-api.service.ts)
this.apollo.mutate({
  mutation: UPDATE_MY_PROFILE_MUTATION,
  variables: { input }
});

// NEW
this.updateMyProfileGQL.mutate({ input }).subscribe({
  next: (result) => {
    this.authService.updateUser(result.data!.updateMyProfile);
  }
});
```

### Phase 3: Add Route Guards
Protect routes with auth guards:

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.page'),
    canActivate: [authGuard] // ← Requires authentication
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.page'),
    canActivate: [adminGuard] // ← Requires ADMIN role
  }
];
```

### Phase 4: Refactor Features (Example: Tickets)
Apply smart/dumb component pattern:

```
features/tickets/
├── pages/
│   ├── ticket-list/ (smart container)
│   └── ticket-submit/ (smart container)
├── components/
│   ├── ticket-card/ (dumb presenter)
│   ├── ticket-form/ (dumb presenter)
│   └── ticket-filters/ (dumb presenter)
└── services/
    └── ticket.service.ts (state management)
```

## 🎯 Benefits Achieved

✅ **Type Safety** - Full TypeScript coverage with generated GraphQL types  
✅ **Separation of Concerns** - Clear layers: interceptors → services → components  
✅ **Reusability** - Shared components, directives, pipes  
✅ **Testability** - Pure functions, injectable services, signals  
✅ **Performance** - OnPush change detection, computed signals  
✅ **Developer Experience** - Auto-complete everywhere, clear file structure  
✅ **Maintainability** - Easy to find code, consistent patterns  
✅ **SSR-Safe** - All platform checks in place  
✅ **Scalability** - Easy to add new features following established patterns

## 📞 Quick Reference

### Common Tasks

**Get current user**:
```typescript
const authService = inject(AuthService);
const user = authService.currentUser();
```

**Check if admin**:
```typescript
const isAdmin = authService.isAdmin();
```

**Show notification**:
```typescript
const notification = inject(NotificationService);
notification.success('Profile updated!');
```

**Check loading state**:
```typescript
const loadingService = inject(LoadingService);
const isLoading = loadingService.isLoading();
```

**Call GraphQL mutation**:
```typescript
const updateProfileGQL = inject(UpdateMyProfileGQL);
updateProfileGQL.mutate({ input }).subscribe();
```

---

**This refactor transforms your frontend into a production-ready, enterprise-grade Angular application that matches the quality of your backend architecture!** 🎉
