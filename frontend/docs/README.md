# Documentation Guidelines

## 📝 When to Update Documentation

**IMPORTANT**: Always update documentation when making changes to the codebase!

### Update These Files When:

#### 1. `TICKET_SYSTEM.md` - Frontend ticket features
Update when:
- ✅ Adding new ticket-related components
- ✅ Modifying routing structure
- ✅ Changing user flows or navigation
- ✅ Adding new UI patterns
- ✅ Updating component features or methods
- ✅ Fixing UX issues

**What to include**:
- Component structure and file locations
- Updated route configuration
- Visual flow diagrams
- Code examples
- State management changes

#### 2. `TICKET_APPROVAL_WORKFLOW.md` - Backend approval system
Update when:
- ✅ Adding/modifying GraphQL mutations or queries
- ✅ Changing service methods
- ✅ Updating database schema
- ✅ Modifying authorization/roles
- ✅ Changing approval workflow logic

**What to include**:
- GraphQL schema changes
- Service method signatures
- Database schema updates
- Authorization rules
- Flow diagrams

#### 3. `NOTES_FEATURE.md` - Notes and comments
Update when:
- ✅ Modifying note functionality
- ✅ Changing note permissions
- ✅ Adding note-related features

#### 4. Create New Docs For:
- Major new features (create `[FEATURE_NAME].md`)
- New modules or subsystems
- Complex workflows that need detailed explanation

---

## 📋 Documentation Checklist

Before marking a task complete, ensure:

- [ ] Updated relevant `.md` files with changes
- [ ] Added visual diagrams for new flows
- [ ] Documented new components/methods
- [ ] Updated route configuration docs
- [ ] Added code examples for new patterns
- [ ] Updated "Recent Changes" sections
- [ ] Verified all links and references work

---

## 🎨 Documentation Style Guide

### Visual Diagrams
Use ASCII art for flow diagrams:
```
┌──────────────┬─────────────────┐
│   Sidebar    │   Main Content  │
│              │                 │
│ • Item 1     │   [Content]     │
│ • Item 2     │                 │
└──────────────┴─────────────────┘
```

### Code Examples
Always include:
- File path comments
- Method signatures
- Brief explanations

```typescript
// File: ticket.service.ts
addTicketNote(ticketId: number, input: CreateTicketNoteInput): Observable<TicketNote> {
  // Implementation
}
```

### Sections to Include
1. **Overview** - What the feature does
2. **Visual Flow** - User journey diagram
3. **Components** - Structure and purpose
4. **Code** - Key implementations
5. **Testing** - How to test

---

## 🔄 Update Workflow

1. Make code changes
2. Test functionality
3. Update relevant documentation
4. Add to "Recent Changes" section
5. Commit code AND docs together

**Remember**: Documentation is code! Keep it up-to-date.

---

## 📚 Current Documentation Files

| File | Purpose | Update When |
|------|---------|-------------|
| `TICKET_SYSTEM.md` | Frontend ticket features, components, flows | Adding/modifying ticket UI |
| `TICKET_APPROVAL_WORKFLOW.md` | Backend approval logic, GraphQL, database | Changing backend ticket logic |
| `NOTES_FEATURE.md` | Notes and comments functionality | Modifying note features |
| `README.md` | This file - documentation guidelines | Meta changes |

---

## 💡 Tips

- **Be visual**: Use diagrams to explain flows
- **Be specific**: Include file paths and line numbers
- **Be clear**: Write for developers who are new to the project
- **Be current**: Update immediately when making changes
- **Be thorough**: Document the "why" not just the "what"

---

Last Updated: December 10, 2025
