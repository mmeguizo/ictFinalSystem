# Backend Documentation Guidelines

## 📝 When to Update Documentation

**IMPORTANT**: Always update documentation when making backend changes!

### Update `TICKET_APPROVAL_WORKFLOW.md` When:

#### Database Changes
- ✅ Adding new tables or fields
- ✅ Modifying Prisma schema
- ✅ Changing relationships
- ✅ Adding indexes

#### GraphQL Changes
- ✅ Adding new mutations or queries
- ✅ Modifying GraphQL types
- ✅ Changing input types
- ✅ Adding new enums

#### Service Logic Changes
- ✅ Adding new service methods
- ✅ Modifying business logic
- ✅ Changing validation rules
- ✅ Updating error handling

#### Authorization Changes
- ✅ Adding new role guards
- ✅ Modifying permissions
- ✅ Changing access control

---

## 📋 What to Document

### For Database Changes:
```prisma
// Document new fields
model Ticket {
  // ... existing fields
  
  // NEW: Approval tracking
  secretaryApprovedById  Int?
  secretaryApprovedAt    DateTime?
}
```

### For GraphQL Changes:
```graphql
# Document new mutations
mutation ApproveTicketAsSecretary($ticketId: Int!, $comment: String) {
  approveTicketAsSecretary(ticketId: $ticketId, comment: $comment) {
    # ... fields
  }
}
```

### For Service Methods:
```typescript
/**
 * Approve ticket as secretary
 * @param ticketId - ID of ticket to approve
 * @param secretaryId - ID of approving secretary
 * @param comment - Optional approval comment
 * @throws Error if ticket not in PENDING status
 */
async approveAsSecretary(ticketId: number, secretaryId: number, comment?: string): Promise<Ticket>
```

---

## 🔄 Documentation Workflow

1. **Plan change** - Think about impact
2. **Implement change** - Write code
3. **Test change** - Verify functionality
4. **Update docs** - Document in TICKET_APPROVAL_WORKFLOW.md
5. **Commit together** - Code + docs in same commit

---

## 📚 Documentation Structure

### TICKET_APPROVAL_WORKFLOW.md Sections:

1. **Overview** - High-level explanation
2. **Workflow Stages** - Visual flow diagram
3. **Database Schema** - Prisma models
4. **GraphQL API** - Mutations and queries
5. **Service Layer** - Business logic methods
6. **Resolvers** - GraphQL implementations
7. **Auto-Assignment Logic** - Automatic workflows
8. **Status History Tracking** - Audit trail
9. **Role-Based Access Control** - Permissions
10. **Testing** - How to test changes
11. **Error Scenarios** - Common issues

---

## 💡 Best Practices

### Visual Diagrams
Use flow diagrams for workflows:
```
User Submission → PENDING → Secretary Approval → 
SECRETARY_APPROVED → Director Approval → 
DIRECTOR_APPROVED → Auto-Assignment → ASSIGNED
```

### Code Examples
Include working examples:
```typescript
// Example: Approve ticket as secretary
const ticket = await ticketService.approveAsSecretary(
  ticketId: 42,
  secretaryId: 10,
  comment: "Approved for processing"
);
```

### Error Documentation
Document error cases:
```typescript
// Throws if ticket not in PENDING status
if (ticket.status !== 'PENDING') {
  throw new Error('Ticket must be in PENDING status');
}
```

---

## 🎯 Quick Reference

| Change Type | Document In | Include |
|-------------|-------------|---------|
| Database field | Schema section | Field purpose, type, relationships |
| GraphQL mutation | API section | Signature, arguments, return type, auth |
| Service method | Service section | Purpose, parameters, return, errors |
| Resolver | Resolvers section | Auth guards, validation, flow |
| Workflow change | Workflow section | Updated flow diagram |

---

## ⚠️ Common Mistakes to Avoid

❌ **Don't**: Add code without documentation
❌ **Don't**: Document only in code comments
❌ **Don't**: Leave TODO markers in docs
❌ **Don't**: Skip visual diagrams for complex flows
❌ **Don't**: Forget to update "Recent Changes" section

✅ **Do**: Update docs immediately with code
✅ **Do**: Use clear, visual explanations
✅ **Do**: Include code examples
✅ **Do**: Document error cases
✅ **Do**: Keep docs current and accurate

---

## 📝 Template for New Features

When adding a new feature, document:

```markdown
## [Feature Name]

### Overview
Brief explanation of what it does

### Database Changes
```prisma
// Prisma schema additions
```

### GraphQL API
```graphql
# New mutations/queries
```

### Service Methods
```typescript
// Method signatures
```

### Authorization
Who can use this feature

### Testing
How to test it

### Examples
Real usage examples
```

---

## 🔗 Related Documentation

- Frontend docs: `../frontend/docs/TICKET_SYSTEM.md`
- API contracts: Shared between backend/frontend
- Database migrations: `prisma/migrations/`

---

Last Updated: December 10, 2025
