# ICT Support Ticketing System — User Manual

**Intelligent Service Request Monitoring and Analysis Platform**
**Carlos Hilado Memorial State University — ICT Department**

> **Version**: 2.2.0 | **Last Updated**: March 13, 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Getting Started — Login & Navigation](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Submitting a Ticket](#4-submitting-a-ticket)
5. [Tracking Your Tickets](#5-tracking-your-tickets)
6. [Ticket Detail Page](#6-ticket-detail-page)
7. [SLA Processing Time Tracker](#7-sla-processing-time-tracker)
8. [Approval Workflow (Secretary & Director)](#8-approval-workflow)
9. [Assignment & Scheduling (Department Heads)](#9-assignment--scheduling)
10. [Working on Tickets (Technical Staff)](#10-working-on-tickets)
11. [Admin Functions](#11-admin-functions)
12. [Analytics & Reports](#12-analytics--reports)
13. [Knowledge Base](#13-knowledge-base)
14. [Notifications](#14-notifications)
15. [AI-Powered Smart Suggestions](#15-ai-powered-smart-suggestions)
16. [Satisfaction Survey](#16-satisfaction-survey)
17. [Role Reference Guide](#17-role-reference-guide)
18. [Ticket Status Reference](#18-ticket-status-reference)
19. [Frequently Asked Questions](#19-faq)

---

## 1. System Overview

The ICT Support Ticketing System is a web-based service request platform designed for the ICT Department of CHMSU. It enables employees (end-users) to submit service requests, which are then routed through a structured approval and assignment workflow, tracked with SLA enforcement, and enhanced by AI-powered analysis.

### Key Capabilities

| Feature                 | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| **Ticket Management**   | Submit, track, and resolve IT service requests (MIS and ITS)          |
| **Approval Workflow**   | Multi-level review: Secretary → Director → Department Head            |
| **SLA Enforcement**     | 5-step, 25-minute processing time target with automated breach alerts |
| **AI Analysis**         | Google Gemini-powered ticket analysis with smart suggestions          |
| **Knowledge Base**      | Self-service FAQ library to resolve common issues                     |
| **Real-Time Updates**   | WebSocket-driven live dashboard and notifications                     |
| **Analytics**           | Charts, trends, SLA compliance, staff performance, PDF/Excel export   |
| **Satisfaction Survey** | Star rating feedback after ticket resolution                          |

### System Roles (8 Roles)

| Role          | Responsibility                                             |
| ------------- | ---------------------------------------------------------- |
| **USER**      | Submit tickets, track progress, rate satisfaction          |
| **SECRETARY** | Review and endorse incoming tickets                        |
| **DIRECTOR**  | Approve or disapprove reviewed tickets                     |
| **MIS_HEAD**  | Assign MIS tickets to developers, schedule visits          |
| **ITS_HEAD**  | Assign ITS tickets to technicians, schedule visits         |
| **DEVELOPER** | Work on MIS tickets (software/web development)             |
| **TECHNICAL** | Work on ITS tickets (hardware/network support)             |
| **ADMIN**     | Full system access, user management, acknowledge schedules |

---

## 2. Getting Started

### 2.1 Logging In

The system supports two login methods:

**Option A — Social Login (Auth0)**

1. On the login page, click **"Login with Google"** or **"Login with Microsoft"**
2. Authenticate with your organizational account
3. You will be redirected to the Dashboard

**Option B — Email & Password**

1. Enter your registered email and password
2. Click **"Login"**
3. You will be redirected to the Dashboard

### 2.2 Navigation

After login, the sidebar and top navigation bar provide access to all pages:

| Menu Item             | URL                  | Who Can Access                                 |
| --------------------- | -------------------- | ---------------------------------------------- |
| **Dashboard**         | `/dashboard`         | All users                                      |
| **My Tickets**        | `/tickets`           | All users                                      |
| **Submit New Ticket** | `/tickets/new`       | USER, SECRETARY, ADMIN                         |
| **Approvals**         | `/tickets/approvals` | SECRETARY, DIRECTOR, MIS_HEAD, ITS_HEAD, ADMIN |
| **Analytics**         | `/analytics`         | ADMIN, DIRECTOR, MIS_HEAD, ITS_HEAD            |
| **Knowledge Base**    | `/knowledge-base`    | All users                                      |
| **Notifications**     | `/notifications`     | All users                                      |
| **Admin Panel**       | `/admin`             | ADMIN only                                     |

### 2.3 Logging Out

Click your profile avatar or name in the top-right corner, then select **"Logout"**. Your session token will be cleared.

---

## 3. Dashboard

The Dashboard is the first page you see after login. It provides a real-time overview of ticket activity.

### 3.1 Statistics Cards

The top row shows live-updating stat cards:

| Card              | Description                                     |
| ----------------- | ----------------------------------------------- |
| **Total Tickets** | Total number of tickets in the system           |
| **For Review**    | Tickets awaiting Secretary review               |
| **Reviewed**      | Tickets reviewed and awaiting Director approval |
| **Assigned**      | Tickets assigned to department heads or staff   |
| **In Progress**   | Tickets currently being worked on               |
| **On Hold**       | Tickets paused by staff                         |
| **Resolved**      | Completed tickets                               |
| **Closed**        | Finalized tickets                               |
| **Cancelled**     | Rejected or cancelled tickets                   |
| **Ongoing**       | Combined count of all active tickets            |

- Cards update in **real-time** via WebSocket — no manual refresh needed
- A green **Live** indicator appears when the WebSocket connection is active
- Cards **pulse** briefly when their values change

### 3.2 SLA Reminder

On login, regular users (USER role) see a popup explaining the **5-step SLA processing time** (25 minutes total). This helps set expectations for how quickly tickets are processed.

- The popup appears automatically once per login
- All roles can view the SLA information via the **"Learn More"** button on the banner
- The banner can be dismissed

### 3.3 Recent Tickets

A table at the bottom shows the **last 10 tickets** created, with columns:

- Ticket Number, Title, Type, Status, Priority, Created Date, Assigned To
- Click any row to navigate to the ticket detail page

---

## 4. Submitting a Ticket

**Who can submit**: USER, SECRETARY, ADMIN

### 4.1 Navigate to Submit

- Click **"Submit New Ticket"** in the sidebar, or
- Go to `/tickets/new`

### 4.2 Choose Ticket Type

Toggle between two ticket types at the top of the form:

| Type                                    | Purpose                                      | Routed To            |
| --------------------------------------- | -------------------------------------------- | -------------------- |
| **MIS** (Management Information System) | Website and software development requests    | MIS_HEAD → DEVELOPER |
| **ITS** (ICT Support)                   | Equipment borrowing and maintenance requests | ITS_HEAD → TECHNICAL |

### 4.3 Fill Out the Form

#### Common Fields (Both Types)

| Field       | Required | Description                                       |
| ----------- | -------- | ------------------------------------------------- |
| Title       | ✅       | Brief description of the issue (min 5 characters) |
| Description | ✅       | Detailed explanation (min 10 characters)          |
| Priority    | Optional | LOW, MEDIUM, HIGH, or CRITICAL (default: MEDIUM)  |

#### MIS-Specific Fields

| Field                | Description                                |
| -------------------- | ------------------------------------------ |
| Category             | **WEBSITE** or **SOFTWARE**                |
| Website New Request  | Checkbox — need a new website              |
| Website Update       | Checkbox — update an existing website      |
| Website URL          | URL of the affected website                |
| Software New Request | Checkbox — need new software               |
| Software Update      | Checkbox — update existing software        |
| Software Install     | Checkbox — install or configure software   |
| Estimated Duration   | Estimated hours (auto-calculated if empty) |
| Additional Notes     | Extra context or details                   |

#### ITS-Specific Fields

| Field                        | Description                              |
| ---------------------------- | ---------------------------------------- |
| Device Type                  | Desktop, Laptop, Printer, Network, Other |
| Device Model                 | Make/model of equipment                  |
| Serial Number                | Device serial number                     |
| Borrow Request               | Checkbox — need to borrow equipment      |
| Borrow Details               | What equipment, duration, purpose        |
| Maintenance Desktop/Laptop   | Checkbox — desktop/laptop repair         |
| Maintenance Internet/Network | Checkbox — network/internet issue        |
| Maintenance Printer          | Checkbox — printer repair                |
| Maintenance Details          | Description of maintenance needed        |

### 4.4 AI Analysis (Optional)

Before submitting, you can click **"Analyze with AI"** to get intelligent suggestions:

1. Click the **"Analyze with AI"** button
2. The system sends your title and description to Google Gemini AI
3. Results appear in collapsible panels:
   - **AI Analysis** — Rewritten description, summary, category, priority suggestion, root cause, solutions
   - **Similar Issues** — Past resolved tickets with matching problems
   - **Related KB Articles** — Knowledge Base articles that may help

4. If AI suggests a priority, it auto-applies (you can override)
5. Click **"Apply to Description"** to use the AI-rewritten version as your ticket description

### 4.5 Submit

Click the **"Submit"** button. The ticket is created with status **FOR_REVIEW** and automatically assigned a:

- **Ticket Number**: `TKT-YYYYMMDD-NNN` (e.g., TKT-20260313-001)
- **Control Number**: `YYYY-MM-NNN` (e.g., 2026-03-001)
- **Due Date**: Auto-calculated based on priority:
  - CRITICAL: 4 hours
  - HIGH: 24 hours
  - MEDIUM: 72 hours
  - LOW: 168 hours (7 days)

After submission, you are redirected to My Tickets.

---

## 5. Tracking Your Tickets

### 5.1 My Tickets Page

Navigate to **My Tickets** (`/tickets`) to see all tickets you've created.

**Features:**

- **Status Filter**: Dropdown to filter by status (All, For Review, Reviewed, Assigned, etc.)
- **Color-coded Tags**: Status and priority are color-coded for quick scanning
- **Assigned Staff**: Shows who is working on your ticket
- **Click to Detail**: Click any row to open the full ticket detail page

### 5.2 Real-Time Updates

Your ticket list updates automatically when:

- A secretary reviews your ticket
- The director approves it
- Staff is assigned
- Status changes at any step

No need to refresh the page.

---

## 6. Ticket Detail Page

Click on any ticket to see its full detail page (`/tickets/:ticketNumber`).

### 6.1 Ticket Information

The top section shows:

- Ticket number, control number, title, description
- Type (MIS/ITS), Status, Priority
- Created by, Created date, Due date
- Assigned staff (if assigned)

### 6.2 Status History Timeline

A vertical timeline showing every status transition:

- Who changed the status
- When it changed
- Any comment associated with the transition
- Example: "Secretary reviewed → REVIEWED — Mar 10, 2026 10:15 AM"

### 6.3 Notes & Comments

- **Add a Note**: Text area with submit button to add comments
- **Internal Note**: Checkbox (staff only) to mark a note as internal — hidden from the ticket creator
- **Notes List**: All notes displayed with author name, role badge, timestamp, and content

### 6.4 Attachments

- **Upload**: Drag-and-drop or click to upload files
- **Download**: Click on any attachment to download
- **Delete**: Soft-delete (mark as removed, not physically deleted)

### 6.5 Action Buttons (Varies by Role & Status)

| Role                  | Status                 | Available Actions                   |
| --------------------- | ---------------------- | ----------------------------------- |
| SECRETARY             | FOR_REVIEW             | Review, Reject (with reason)        |
| DIRECTOR              | REVIEWED               | Approve, Disapprove (with reason)   |
| MIS_HEAD / ITS_HEAD   | ASSIGNED               | Assign to staff, Schedule visit     |
| ADMIN                 | PENDING_ACKNOWLEDGMENT | Acknowledge schedule                |
| DEVELOPER / TECHNICAL | SCHEDULED              | Start Work                          |
| DEVELOPER / TECHNICAL | IN_PROGRESS            | Update Status, Put On Hold, Resolve |
| DEVELOPER / TECHNICAL | ON_HOLD                | Resume Work                         |
| USER (creator)        | CANCELLED              | Reopen ticket                       |

---

## 7. SLA Processing Time Tracker

Located on the Ticket Detail Page, the SLA tracker shows the ticket's progress through the 5-step processing pipeline.

### 7.1 The 5 Steps (25 Minutes Total)

| Step | Name                     | Expected | What Happens                                             |
| ---- | ------------------------ | -------- | -------------------------------------------------------- |
| 1    | **Secretary Review**     | 5 min    | Secretary reviews and endorses the ticket                |
| 2    | **Director Endorsement** | 5 min    | Director approves the reviewed ticket                    |
| 3    | **Assignment**           | 5 min    | Auto-assigned to department head, then to specific staff |
| 4    | **Schedule Visit**       | 5 min    | Department head sets visit date and target completion    |
| 5    | **Acknowledgment**       | 5 min    | Admin acknowledges the schedule, staff starts work       |

### 7.2 Visual Display

- ✅ **Completed steps** show a green checkmark with timestamp
- ⏳ **Current step** is highlighted and shows elapsed time
- ⬚ **Pending steps** are grayed out
- A **progress bar** shows overall completion (e.g., "Step 3 of 5")
- Updates in **real-time** as staff process the ticket

### 7.3 SLA Breach Alerts

If a ticket exceeds its due date:

1. A **cron job** (runs every 5 minutes) detects the breach
2. **Level 1 escalation**: Notifies the assigned staff member and department head
3. **Level 2 escalation**: Notifies the ADMIN and DIRECTOR
4. The ticket is flagged as **overdue** in analytics

---

## 8. Approval Workflow (Secretary & Director)

### 8.1 Secretary Workflow

**Page**: Approvals (`/tickets/approvals`)

1. See all tickets with status **FOR_REVIEW**
2. Click a ticket to view its details
3. Click **"Review"** to endorse it → Status becomes **REVIEWED**
4. Or click **"Reject"** → Enter a reason → Status becomes **CANCELLED**
   - The ticket creator is notified and can reopen the ticket

### 8.2 Director Workflow

**Page**: Approvals (`/tickets/approvals`)

1. See all tickets with status **REVIEWED**
2. Click a ticket to view its details
3. Click **"Approve"** → Status becomes **DIRECTOR_APPROVED**
   - The ticket is then auto-assigned to MIS_HEAD or ITS_HEAD based on type
4. Or click **"Disapprove"** → Enter a reason → Status becomes **CANCELLED**
   - The ticket creator is notified and can reopen the ticket

---

## 9. Assignment & Scheduling (Department Heads)

### 9.1 Assigning Staff

**Who**: MIS_HEAD (for MIS tickets) or ITS_HEAD (for ITS tickets)

1. After director approval, the ticket auto-arrives in the department head's queue
2. Open the ticket detail page
3. Click **"Assign to Staff"**
4. Select a staff member from the dropdown (sorted by current workload)
5. The ticket is assigned and the staff member is notified

### 9.2 Scheduling a Visit

After assigning staff:

1. Click **"Schedule Visit"** on the ticket
2. Set the **Date to Visit** (when staff will visit the requestor)
3. Set the **Target Completion Date**
4. Add **Monitor Notes** (optional instructions for the admin)
5. Submit → Status becomes **PENDING_ACKNOWLEDGMENT**

### 9.3 Admin Acknowledgment

**Who**: ADMIN

1. View tickets with status **PENDING_ACKNOWLEDGMENT**
2. Review the scheduled visit details
3. Click **"Acknowledge"** → Status becomes **SCHEDULED**
4. The assigned staff can now start working on the ticket

---

## 10. Working on Tickets (Technical Staff)

**Who**: DEVELOPER (MIS tickets) or TECHNICAL (ITS tickets)

### 10.1 Viewing Assigned Tickets

- Go to **My Tickets** to see all tickets assigned to you
- The Dashboard also shows your workload summary

### 10.2 Starting Work

When a ticket has status **SCHEDULED**:

1. Open the ticket detail page
2. Click **"Start Work"** → Status becomes **IN_PROGRESS**
3. Or click **"Update Status & Details"** for more options

### 10.3 Updating Progress

While working on a ticket (status **IN_PROGRESS**):

- **Add Notes**: Document your progress, troubleshooting steps, findings
- **Upload Attachments**: Screenshots, logs, documents
- **Put On Hold**: If waiting for parts, information, or access → Status becomes **ON_HOLD**
- **Resume**: When ready to continue → Status returns to **IN_PROGRESS**

### 10.4 Resolving a Ticket

When the work is complete:

1. Click **"Resolve"** or update status to **RESOLVED**
2. Add a **final comment** describing what was done
3. Add **recommendations** for preventing future issues (optional)
4. The ticket creator is notified and prompted to submit a satisfaction survey
5. The system auto-calculates **actual duration** (time from creation to resolution)

---

## 11. Admin Functions

**Who**: ADMIN only

### 11.1 Admin Panel (`/admin`)

- **User Management**: View, create, edit, and delete user accounts
- **Role Assignment**: Change user roles (USER, SECRETARY, DIRECTOR, etc.)
- **System Overview**: See all tickets regardless of department
- **Acknowledge Schedules**: Process PENDING_ACKNOWLEDGMENT tickets

### 11.2 Knowledge Base Management

- Create, edit, publish, and archive Knowledge Base articles
- Accessible from the Knowledge Base page with admin editorial controls

### 11.3 Ticket Oversight

- View tickets across all departments and statuses
- Can close resolved tickets
- Receives SLA breach escalation notifications

---

## 12. Analytics & Reports

**Who**: ADMIN, DIRECTOR, MIS_HEAD, ITS_HEAD

**Page**: Analytics (`/analytics`)

### 12.1 Date Range Filter

All analytics data can be filtered by date range using the date picker at the top of the page.

### 12.2 Overview Tab

| Chart/Card     | Description                                       |
| -------------- | ------------------------------------------------- |
| **Stat Cards** | Total, Open, Resolved, Overdue ticket counts      |
| **Pie Chart**  | Tickets by Status (all 11 statuses)               |
| **Pie Chart**  | Tickets by Type (MIS vs ITS)                      |
| **Bar Chart**  | Tickets by Priority (LOW, MEDIUM, HIGH, CRITICAL) |

### 12.3 SLA Tab

| Widget                      | Description                                                 |
| --------------------------- | ----------------------------------------------------------- |
| **SLA Compliance Rate**     | Percentage of tickets resolved within SLA (progress circle) |
| **Average Resolution Time** | Average hours to resolve tickets                            |
| **Overdue Tickets Table**   | List of tickets past due date with time exceeded            |
| **Due Today / Due Soon**    | Tickets needing attention                                   |

### 12.4 Trends Tab

| Chart                             | Description                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| **Tickets Created Per Day**       | Line chart showing submission volume (7-day, 30-day, custom) |
| **Average Resolution Time Trend** | Line chart of resolution speed over time                     |

### 12.5 Staff Performance Tab

| Widget                       | Description                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------- |
| **Staff Workload Bar Chart** | Tickets assigned per staff member                                            |
| **Performance Table**        | Per-staff metrics: Assigned, Resolved, Avg Resolution Time, SLA Compliance % |

### 12.6 Exporting Reports

**Export to PDF**

- Click **"Export to PDF"** on the Analytics page
- Generates a formatted PDF with all visible charts and data tables
- Includes report title, date range, and page numbers
- File: `ICTSystem_Report_[DATE].pdf`

**Export to Excel**

- Click **"Export to Excel"**
- Generates multi-sheet Excel workbook: Summary, By Status, By Priority, By Type, Staff Performance, SLA Metrics
- Data is formatted and ready for further analysis
- File: `ICTSystem_Report_[DATE].xlsx`

---

## 13. Knowledge Base

**Who**: All authenticated users can read; ADMIN can manage

**Page**: Knowledge Base (`/knowledge-base`)

### 13.1 Browsing Articles

- Articles are displayed as a **card grid**
- Each card shows: Title, Category tag, View count, Helpful count
- Click a card to read the full article in a **detail modal**

### 13.2 Searching

- Use the **search bar** at the top to search by keyword
- Full-text search across article titles and content
- Results update in real-time as you type

### 13.3 Category Filters

Filter articles by category:

- NETWORK, SOFTWARE, HARDWARE, ACCOUNT, GENERAL, PRINTER, SECURITY
- Select **"All Categories"** to see everything

### 13.4 Interacting with Articles

- **View Count**: Automatically incremented when you open an article
- **Helpful Vote**: Click **"Mark as Helpful"** if the article solved your problem
- **Related Articles**: Sidebar shows related articles based on category and tags

### 13.5 Admin Article Management

Admins can:

- **Create** new articles with the WYSIWYG editor (rich text formatting)
- **Edit** existing articles
- **Publish / Archive** articles (DRAFT → PUBLISHED → ARCHIVED)
- **Delete** articles

The system comes pre-loaded with **6 ICT FAQ articles** covering common issues.

---

## 14. Notifications

### 14.1 Notification Bell

The **bell icon** in the top navigation bar shows:

- A **red badge** with the count of unread notifications
- Click the bell to see the **last 5 notifications** in a dropdown
- Click a notification to navigate to the related ticket

### 14.2 Notifications Page (`/notifications`)

- **Full list** of all your notifications (paginated)
- **Filters**: All, Unread, Read
- **Sort**: Newest first
- **Actions**: Mark as read (individual or bulk), Mark all as read

### 14.3 What Triggers Notifications

| Event                          | Who Gets Notified                               |
| ------------------------------ | ----------------------------------------------- |
| New ticket submitted           | Secretary, Admin                                |
| Ticket reviewed by secretary   | Ticket creator, Director                        |
| Ticket rejected by secretary   | Ticket creator                                  |
| Ticket approved by director    | Department Head, Ticket creator                 |
| Ticket disapproved by director | Ticket creator                                  |
| Staff assigned to ticket       | Assigned staff, Ticket creator                  |
| Status changed                 | Ticket creator, Assigned staff, Department head |
| Note added                     | All ticket participants                         |
| File uploaded                  | All ticket participants                         |
| SLA breach detected            | Assigned staff, Department head, Admin          |
| SLA escalation (Level 2)       | Director, Admin                                 |
| Ticket resolved                | Ticket creator (with survey prompt)             |

### 14.4 Real-Time Delivery

Notifications are delivered in **real-time** via WebSocket. If WebSocket is unavailable, the system falls back to **30-second polling**.

---

## 15. AI-Powered Smart Suggestions

The system uses **Google Gemini 2.0 Flash** to provide intelligent analysis of service requests.

### 15.1 How to Use

1. On the **Submit Ticket** page, fill in the Title and Description
2. Click **"Analyze with AI"**
3. Wait a few seconds for the AI to process

### 15.2 What You Get

| Output           | Description                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| **Clean Ticket** | AI-rewritten, professional version of your description                 |
| **Summary**      | Brief one-sentence summary of the issue                                |
| **Category**     | Suggested category (Network, Software, Hardware, etc.)                 |
| **Priority**     | Suggested priority with confidence score (auto-applied if > threshold) |
| **Root Cause**   | Analysis of what might be causing the issue                            |
| **Solutions**    | Suggested next steps or solutions                                      |
| **Keywords**     | Extracted keywords used for searching similar issues                   |

### 15.3 Apply AI Suggestion

- The AI-rewritten "Clean Ticket" description appears in a green highlighted box
- Click **"Apply to Description"** to copy it into your ticket's Additional Notes field
- You can edit the text before submitting

### 15.4 Similar Issues & KB Articles

After AI analysis, the system also shows:

- **Similar Resolved Tickets**: Past tickets with matching problems (full-text search)
- **Related Knowledge Base Articles**: FAQ articles matching the ticket keywords
- These may help you solve the issue without needing to submit a ticket

---

## 16. Satisfaction Survey

### 16.1 When It Appears

After your ticket is **RESOLVED** or **CLOSED**, you will see a survey prompt on the ticket detail page.

### 16.2 How to Submit

1. Open the resolved ticket
2. Select a **star rating** (1 to 5 stars)
3. Optionally add a **comment** about your experience
4. Click **Submit**

### 16.3 Purpose

- Helps measure service quality
- Identifies areas for improvement
- Feeds into staff performance analytics
- Low ratings may trigger follow-up from management

---

## 17. Role Reference Guide

### USER (End-User / Requestor)

**What you can do:**

- Submit MIS or ITS tickets
- Track your tickets in real-time
- Add notes and attachments to your tickets
- Use AI analysis when creating tickets
- Browse the Knowledge Base
- Reopen cancelled tickets
- Submit satisfaction surveys after resolution
- View notifications

**What you see:**

- Dashboard with your ticket statistics
- My Tickets (your created tickets only)
- Submit New Ticket form
- Knowledge Base
- Notifications

---

### SECRETARY

**What you can do:**

- Review incoming tickets (FOR_REVIEW → REVIEWED)
- Reject tickets with a reason (FOR_REVIEW → CANCELLED)
- Submit tickets on behalf of users
- View all tickets for oversight

**What you see:**

- Dashboard, Approvals page (tickets pending review)
- My Tickets, Submit New Ticket
- Knowledge Base, Notifications

---

### DIRECTOR

**What you can do:**

- Approve reviewed tickets (REVIEWED → DIRECTOR_APPROVED)
- Disapprove tickets with a reason (REVIEWED → CANCELLED)
- View analytics and reports
- Respond to SLA breach escalations

**What you see:**

- Dashboard, Approvals page (tickets pending approval)
- Analytics, Knowledge Base, Notifications

---

### MIS_HEAD (MIS Department Head)

**What you can do:**

- Assign MIS tickets to DEVELOPER staff
- Schedule visits (set visit date and target completion)
- View MIS department analytics
- Monitor staff workload and performance

**What you see:**

- Dashboard (MIS tickets), Approvals, Analytics
- Knowledge Base, Notifications

---

### ITS_HEAD (ITS Department Head)

**What you can do:**

- Assign ITS tickets to TECHNICAL staff
- Schedule visits (set visit date and target completion)
- View ITS department analytics
- Monitor staff workload and performance

**What you see:**

- Dashboard (ITS tickets), Approvals, Analytics
- Knowledge Base, Notifications

---

### DEVELOPER

**What you can do:**

- View assigned MIS tickets
- Start work on SCHEDULED tickets
- Update status: In Progress, On Hold, Resolved
- Add notes, upload attachments

**What you see:**

- Dashboard (your assigned tickets)
- My Tickets (assigned to you)
- Knowledge Base, Notifications

---

### TECHNICAL

**What you can do:**

- View assigned ITS tickets
- Start work on SCHEDULED tickets
- Update status: In Progress, On Hold, Resolved
- Add notes, upload attachments

**What you see:**

- Dashboard (your assigned tickets)
- My Tickets (assigned to you)
- Knowledge Base, Notifications

---

### ADMIN

**What you can do:**

- Everything — full system access
- Manage users and roles
- Acknowledge scheduled visits (PENDING_ACKNOWLEDGMENT → SCHEDULED)
- Manage Knowledge Base articles
- View all analytics
- Close tickets

**What you see:**

- All pages: Dashboard, Admin Panel, Tickets, Approvals, Analytics, Knowledge Base, Notifications

---

## 18. Ticket Status Reference

### Complete Lifecycle Flow

```
FOR_REVIEW ──[Secretary Reviews]──→ REVIEWED ──[Director Approves]──→ DIRECTOR_APPROVED
     │                                   │                                    │
     │ [Secretary Rejects]              │ [Director Disapproves]          [Auto-Assign]
     ↓                                   ↓                                    ↓
  CANCELLED ←──────────────────── CANCELLED                              ASSIGNED
  (creator can reopen)                                                       │
                                                                    [Head Schedules]
                                                                             ↓
                                                                PENDING_ACKNOWLEDGMENT
                                                                             │
                                                                   [Admin Acknowledges]
                                                                             ↓
                                                                        SCHEDULED
                                                                             │
                                                                    [Staff Starts Work]
                                                                             ↓
                                                          ON_HOLD ←→ IN_PROGRESS
                                                                             │
                                                                     [Staff Resolves]
                                                                             ↓
                                                                        RESOLVED
                                                                             │
                                                                      [Close/Survey]
                                                                             ↓
                                                                         CLOSED
```

### Status Descriptions

| Status                     | Meaning                                      | Who Acts Next                  |
| -------------------------- | -------------------------------------------- | ------------------------------ |
| **FOR_REVIEW**             | Newly submitted, awaiting secretary          | SECRETARY                      |
| **REVIEWED**               | Secretary endorsed, awaiting director        | DIRECTOR                       |
| **DIRECTOR_APPROVED**      | Director approved, being auto-assigned       | System                         |
| **ASSIGNED**               | Assigned to department head/staff            | MIS_HEAD or ITS_HEAD           |
| **PENDING_ACKNOWLEDGMENT** | Visit scheduled, awaiting admin confirmation | ADMIN                          |
| **SCHEDULED**              | Schedule confirmed, staff can begin          | DEVELOPER or TECHNICAL         |
| **IN_PROGRESS**            | Staff actively working on it                 | DEVELOPER or TECHNICAL         |
| **ON_HOLD**                | Temporarily paused (waiting for info/parts)  | DEVELOPER or TECHNICAL         |
| **RESOLVED**               | Work completed                               | USER (survey) or ADMIN (close) |
| **CLOSED**                 | Finalized and archived                       | —                              |
| **CANCELLED**              | Rejected by secretary or director            | USER (can reopen)              |

### Priority Levels

| Priority     | Color  | Auto-Due Date      | Description                           |
| ------------ | ------ | ------------------ | ------------------------------------- |
| **CRITICAL** | Red    | 4 hours            | System down, service outage           |
| **HIGH**     | Orange | 24 hours           | Major impact, urgent attention needed |
| **MEDIUM**   | Blue   | 72 hours (3 days)  | Standard request, normal processing   |
| **LOW**      | Gray   | 168 hours (7 days) | Minor request, no urgency             |

---

## 19. FAQ

**Q: How do I check the status of my ticket?**
A: Go to **My Tickets** (`/tickets`). Your tickets are listed with current status. Click any ticket to see full details and the SLA tracker.

**Q: How long should my ticket take to process?**
A: The SLA target is **25 minutes** for the initial processing (review → approval → assignment → scheduling → acknowledgment). Actual resolution time depends on the complexity of the issue and your priority level.

**Q: My ticket was rejected/cancelled. What do I do?**
A: Open the cancelled ticket and click **"Reopen"**. You may want to update the description to address the rejection reason before the secretary reviews it again.

**Q: How do I know when my ticket is being worked on?**
A: You will receive a **notification** when your ticket status changes. The SLA tracker on the ticket detail page shows real-time progress. Your dashboard also updates automatically.

**Q: What is the difference between MIS and ITS tickets?**
A: **MIS** tickets are for software and website development requests (handled by developers). **ITS** tickets are for hardware, network, and equipment requests (handled by technicians).

**Q: Can I add more information after submitting a ticket?**
A: Yes. Open your ticket and use the **Notes** section to add comments. You can also upload **attachments** (screenshots, documents).

**Q: What does "Analyze with AI" do?**
A: It uses Google Gemini AI to analyze your ticket description and provide a professional rewrite, suggested priority, potential root cause, and solutions. It also finds similar past tickets and Knowledge Base articles that may help.

**Q: Who can see my ticket?**
A: Your ticket is visible to you (the creator), the Secretary, Director, relevant Department Head, assigned staff, and Admin. Internal notes added by staff are hidden from you.

**Q: How do I export analytics reports?**
A: On the **Analytics** page, click **"Export to PDF"** or **"Export to Excel"** at the top. The export includes all visible charts and data for the selected date range.

**Q: What happens if my ticket is overdue?**
A: The system automatically detects overdue tickets every 5 minutes and sends escalation notifications to the assigned staff, department head, Admin, and Director.

---

_This manual covers system version 2.2.0. For technical documentation, see the `backend/README.md` and `frontend/README.md` files._
