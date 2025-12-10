# Troubleshooting Guide

## Date Display Issues

### Problem: "Invalid Date" or "-" shown for dates

**Symptom**: The ticket detail page shows "-" for `createdAt` and `dueDate` fields instead of formatted dates.

**Root Cause**:
This issue occurs when the date formatting functions receive `null`, `undefined`, or improperly formatted date values. Here's the detailed breakdown:

1. **GraphQL Data Flow**:
   ```
   Database (MySQL DateTime) 
     → Prisma Client (JavaScript Date object) 
     → GraphQL Resolver (auto-serialized to ISO 8601 string)
     → Apollo Client (received as string)
     → Component (needs parsing back to Date)
   ```

2. **Why dates can be invalid**:
   - **Null values**: Optional fields like `dueDate`, `resolvedAt`, `closedAt` can be `null` in the database
   - **Empty strings**: GraphQL might serialize `null` as empty string `""` depending on schema
   - **Type mismatches**: JavaScript's `new Date()` returns "Invalid Date" for invalid inputs

3. **Original formatting code problem**:
   ```typescript
   // ❌ PROBLEMATIC CODE
   formatDate(dateString?: string): string {
     if (!dateString) return '-';
     return new Date(dateString).toLocaleString(); // Returns "Invalid Date" for bad input
   }
   ```
   
   Issues:
   - Only checked for falsy values, not invalid Date objects
   - Didn't validate the Date object after creation
   - `new Date("").toLocaleString()` returns "Invalid Date" (not caught)

### Solution Implementation

**Fixed formatting functions** in `ticket-detail.page.ts`:

```typescript
formatDate(dateString?: string | number | Date | null): string {
  // Return dash for null, undefined, or empty string
  if (!dateString) return '-';
  
  // Parse the date - handle ISO strings, timestamps, and Date objects
  const d = dateString instanceof Date ? dateString : new Date(dateString);
  
  // Check if date is valid by testing if getTime() returns NaN
  if (isNaN(d.getTime())) {
    console.warn('⚠️ Invalid date value:', dateString);
    return '-';
  }
  
  return d.toLocaleString();
}
```

**Why this fix works**:

1. **Comprehensive null checking**: `if (!dateString)` catches `null`, `undefined`, `""`, `0`, `false`
2. **Type flexibility**: Accepts `string | number | Date | null` to handle all possible GraphQL return types
3. **Validation after parsing**: Uses `isNaN(d.getTime())` to detect invalid Date objects
   - `new Date("invalid").getTime()` returns `NaN`
   - `isNaN(NaN)` returns `true`, so we can safely return `-`
4. **Debug logging**: Warns in console when invalid dates are encountered (helps catch data issues)

### Verification Steps

1. **Check browser console** for the debug logs added:
   ```typescript
   console.log('🎫 Ticket data received:', ticket);
   console.log('📅 createdAt:', ticket.createdAt, 'Type:', typeof ticket.createdAt);
   console.log('📅 dueDate:', ticket.dueDate, 'Type:', typeof ticket.dueDate);
   ```

2. **Expected output**:
   - `createdAt` should be an ISO string like `"2025-12-10T04:23:45.123Z"` (type: `string`)
   - `dueDate` should be an ISO string like `"2025-12-11T04:23:45.123Z"` (type: `string`)
   - If you see `null` or `undefined`, the backend is not setting these fields

3. **Test different scenarios**:
   - ✅ Ticket with both dates set (normal case)
   - ✅ Ticket with `dueDate = null` (should show "-")
   - ✅ Ticket with `resolvedAt = null` (resolved date is optional)
   - ✅ Old tickets with legacy date formats

### Backend Data Validation

**When is `dueDate` set?**
- Automatically calculated in `ticket.service.ts` using `calculateDueDate()` based on priority
- Default SLA times:
  - CRITICAL: 4 hours
  - HIGH: 24 hours (1 day)
  - MEDIUM: 72 hours (3 days)
  - LOW: 168 hours (7 days)

**When is `createdAt` set?**
- Automatically by Prisma with `@default(now())` in schema
- Should NEVER be null for valid tickets

**If dates are still showing as "-"**:
1. Check database directly:
   ```sql
   SELECT id, ticketNumber, createdAt, dueDate FROM Ticket WHERE ticketNumber = 'XXX-YYYYMMDD-001';
   ```
2. Check backend GraphQL response in Network tab (should see ISO strings)
3. Check frontend Apollo cache in DevTools

### Related Files

- **Frontend date formatting**: `frontend/src/app/features/tickets/ticket-detail.page.ts`
- **Backend date calculation**: `backend/src/modules/tickets/utils/sla.utils.ts`
- **Database schema**: `backend/prisma/schema.prisma`
- **GraphQL types**: `backend/src/modules/tickets/ticket.types.ts`

### Common Mistakes to Avoid

1. ❌ Using `new Date()` without validation
2. ❌ Not checking for `null` in optional date fields
3. ❌ Assuming GraphQL always returns Date objects (it returns strings)
4. ❌ Using `Number.isNaN()` instead of `isNaN()` for date validation
   - `Number.isNaN(d.getTime())` works ✅
   - `isNaN(d.getTime())` also works ✅
   - `Number.isNaN(d)` does NOT work ❌ (Date object is not NaN)

### Best Practices

1. **Always validate dates after parsing**:
   ```typescript
   const d = new Date(dateString);
   if (isNaN(d.getTime())) {
     // Handle invalid date
   }
   ```

2. **Use optional chaining with dates**:
   ```typescript
   {{ formatDate(ticket()?.dueDate) }}
   ```

3. **Add debug logging during development**:
   ```typescript
   console.log('Date value:', dateValue, 'Type:', typeof dateValue);
   ```

4. **Consider using a date library** for complex operations:
   - `date-fns` (lightweight, tree-shakeable)
   - `luxon` (modern, timezone-aware)
   - `dayjs` (lightweight, moment.js-like API)

## Other Common Issues

### GraphQL Null Errors

**Problem**: "Cannot return null for non-nullable field Ticket.notes"

**Cause**: Backend query doesn't include required relations in Prisma `include`

**Fix**: Update repository query to include all relations marked as `!` (non-nullable) in GraphQL schema
```typescript
// In ticket.repository.ts
return this.prisma.ticket.findUnique({
  where: { ticketNumber },
  include: {
    notes: { include: { user: true } },
    statusHistory: { include: { user: true } },
    // ... other non-nullable relations
  },
});
```

---

*Last updated: December 10, 2025*
