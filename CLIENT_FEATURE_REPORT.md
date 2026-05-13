# ICT Intelligent Service Request System — Feature Report

**As of May 7, 2026**
**Prepared for: Client Review**

---

## What We've Built

An intelligent, web-based ICT support ticketing platform for CHMSU's ICT Department. The system automates ticket routing, enforces SLA deadlines, and uses AI (Google Gemini) to assist both staff and end-users in resolving issues faster.

---

## Current Features

### 1. Ticket Management (Full Lifecycle)

- Users submit ICT support requests through dedicated **MIS** (software/website) and **ITS** (equipment/maintenance) forms
- Tickets go through an **11-step workflow**: submission → secretary review → director approval → department assignment → staff work → resolution → closure
- Each step is time-stamped and visible in a **status history timeline**
- Users can track their tickets in real-time without refreshing the page
- Control numbers are auto-generated for every ticket
- Tickets can be **reopened** if cancelled

### 2. Role-Based Access (8 Roles)

| Role          | What They Can Do                                                      |
| ------------- | --------------------------------------------------------------------- |
| **USER**      | Submit tickets, view own tickets, chat with AI, rate resolved tickets |
| **SECRETARY** | Review and forward tickets to director                                |
| **DIRECTOR**  | Approve or disapprove tickets after secretary review                  |
| **MIS_HEAD**  | Assign MIS tickets to developers; view analytics                      |
| **ITS_HEAD**  | Assign ITS tickets to technical staff; view analytics                 |
| **DEVELOPER** | Work on assigned MIS tickets; update status                           |
| **TECHNICAL** | Work on assigned ITS tickets; update status                           |
| **ADMIN**     | Full system access: users, tickets, analytics, reports, docs          |

### 3. AI Chat Assistant (Built-in)

- Available on every page via a **floating chat button**
- Answers ICT questions by searching:
  - Knowledge Base articles
  - Past resolved tickets (including staff notes and observations)
  - Curated troubleshooting solutions database
- Can **detect when a user wants to create a ticket** and guide them through the process
- Supports **natural language questions** ("why is my printer not working?")
- Staff and admin users can ask **live operational questions** such as approval queues, escalations, workload, MIS vs ITS breakdowns, and knowledge coverage
- Admin users can request **bounded user-directory answers** in chat (for example, regular users, deactivated accounts, newest users); staff get aggregate counts only
- The chat can explain **delete vs deactivate safeguards** and blocked hard deletes, but it does not perform destructive actions
- Responses render with **full formatting** — tables, headings, code blocks
- Typing Enter sends a message; Shift+Enter for multi-line
- Staff get more detailed technical responses; users get plain-language guidance

### 4. AI-Powered Ticket Analysis

- When creating a ticket, users can click **"Analyze with AI"** to get:
  - Rewritten/cleaner description
  - Suggested category and priority
  - Root cause analysis
  - Suggested solutions
  - Related past tickets
  - Matching Knowledge Base articles
- AI priority suggestion is auto-applied if user hasn't manually set one

### 5. Knowledge Base

- Staff-maintained library of ICT articles and FAQs
- Category filters and full-text search
- View count and "Was this helpful?" tracking
- Seeded with 6 common ICT FAQs at launch

### 6. Troubleshooting Solutions Database

- Staff can create, edit, and delete curated troubleshooting solutions
- **Automatically populated** from resolved tickets — when a ticket is closed, the system extracts a solution from the ticket description, resolution, and staff notes
- Solutions are tagged with auto-generated keywords
- New solutions default to **Internal** visibility; staff can publish them as **Public** when ready
- The AI chat assistant searches this database when answering questions
- Regular users only see solutions that staff have marked as **Public**

### 7. Ticket Notes

- Staff can add **internal notes** (staff-only) or **public notes** (visible to ticket creator) on any ticket
- Staff can **delete** notes they no longer need
- Staff can **toggle** a note between Internal and Public at any time
- Notes are included in the AI's knowledge base for future similar issues

### 8. Real-Time Notifications

- All users receive instant push notifications for ticket status changes, assignments, approvals, and comments
- Notification bell with unread count badge in the header
- Full notifications history page
- Fallback polling every 30 seconds if WebSocket disconnects

### 9. SLA Enforcement

- Every ticket automatically gets a **due date** based on priority:
  - Critical: 4 hours
  - High: 24 hours
  - Medium: 72 hours
  - Low: 168 hours (1 week)
- A 5-step **SLA processing time tracker** shows live progress on every ticket
- Overdue tickets are **escalated automatically** via cron job (every 5 minutes)
  - Level 1: Notifies assigned staff + department head
  - Level 2: Escalates to admin + director
- SLA compliance rate visible in analytics

### 10. Analytics & Reporting (Staff Only)

Available to: ADMIN, MIS_HEAD, ITS_HEAD, SECRETARY, DIRECTOR

- **Overview charts**: tickets by status, type, priority
- **Trend analysis**: tickets created vs. resolved per day/week/month
- **Staff performance**: per-staff assigned count, resolved count, average resolution time, SLA compliance
- **SLA dashboard**: overdue list, compliance rate, average processing time
- **Date range filter** for all charts
- **Export to PDF** (formatted report with charts and tables)
- **Export to Excel** (raw data for further analysis)
- **Generate from chat** — typing "generate a report" in the AI chat produces clickable download buttons

### 11. User Satisfaction Survey

- After a ticket is resolved, the ticket creator receives a prompt to rate their experience
- 1–5 star rating + optional comment
- Ratings visible to staff and admin

### 12. File Attachments

- Users and staff can upload files to tickets (screenshots, documents, etc.)
- Files are securely stored and available for download from the ticket detail page
- Soft-delete (files can be removed without permanent data loss)

### 13. User Management (Admin)

- Admin can create, view, edit, and deactivate user accounts
- Permanent delete is **guarded** — the system blocks deletion if the user still has open tickets or active ticket assignments
- The admin UI now recommends **Deactivate** first and presents permanent delete as a secondary, high-risk action
- Profile photos (avatar upload)
- Role assignment
- Login via local credentials or Auth0 SSO

---

## Recent Improvements (This Sprint — May 2026)

- Staff can now **delete and toggle visibility** of ticket notes
- The AI now uses **staff diagnostic notes from past tickets** to answer questions more accurately
- The AI can now answer **operational admin/staff questions** from live system data instead of only general ticket summaries
- The AI now explains **admin deletion safeguards** directly in chat when asked
- **Chat markdown rendering** fully fixed — tables and headings no longer show as raw symbols
- Pressing **Enter sends** chat messages; Shift+Enter for line breaks
- Regular users are **blocked from accessing internal-only solutions** via the API
- Resolved tickets automatically contribute to the **troubleshooting solutions knowledge base**
- Several security fixes: auth token handling, JWT secret guard, role name corrections

---

## Technology Stack

| Layer      | Technology                                    |
| ---------- | --------------------------------------------- |
| Frontend   | Angular 20, NG-ZORRO (Ant Design), TypeScript |
| Backend    | Node.js, NestJS-style Express, Apollo GraphQL |
| Database   | MySQL + Prisma ORM                            |
| AI         | Google Gemini 2.0 Flash (analysis + chat)     |
| Real-time  | WebSocket (graphql-ws)                        |
| Auth       | JWT + Auth0 SSO                               |
| Reports    | ExcelJS (Excel), jsPDF (PDF)                  |
| Deployment | PM2 process manager                           |

---

## What's Coming Next

- [ ] Activity feed (live "who's doing what" stream on dashboard)
- [ ] Ticket templates (pre-filled forms for common request types)
- [ ] Department comparison in analytics
- [ ] Performance scorecards per staff member
- [ ] Bulk ticket operations (close/assign multiple at once)

---

_System developed by the ICT Department Development Team._
_For questions about features or access, contact the system administrator._
