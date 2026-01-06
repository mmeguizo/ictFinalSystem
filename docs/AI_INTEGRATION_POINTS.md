# AI Integration Points for ICT Service Request Platform

This document outlines the potential AI integration points based on the research proposal:
"Design and Development of an Intelligent Service Request Monitoring and Analysis Platform for ICT Department"

## Overview

The research objectives mention the following AI-powered features:
1. AI-Powered Self-Service Portal
2. Automated Ticket Routing and Categorization
3. Real-Time Tracking and Status Updates
4. Integrated Reporting and Analytics
5. SLA Enforcement and Performance Tracking

---

## 1. AI-Powered Ticket Categorization

### Where to Integrate
- **File:** `backend/src/modules/tickets/services/ticket.service.ts`
- **Method:** `createMISTicket()` and `createITSTicket()`

### What to Implement
```typescript
// Before creating ticket, analyze the description
async analyzeTicketContent(title: string, description: string): Promise<{
  suggestedCategory: 'WEBSITE' | 'SOFTWARE';
  suggestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedTags: string[];
  confidence: number;
}> {
  // Call AI service (OpenAI, Claude, or local model)
  // Analyze title and description
  // Return suggested categorization
}
```

### AI Features
- Analyze ticket description to suggest:
  - **Category:** WEBSITE vs SOFTWARE for MIS tickets
  - **Priority:** Based on urgency keywords ("urgent", "critical", "broken", etc.)
  - **Estimated duration:** Based on similar past tickets
- **Confidence score:** Show how confident the AI is

### User Experience
- Show AI suggestions as pre-filled values in the form
- Allow user to override suggestions
- Display confidence score to help decision

---

## 2. Smart Ticket Routing

### Where to Integrate
- **File:** `backend/src/modules/tickets/services/auto-assignment.service.ts`
- **Method:** `assignTicket()` and new `suggestAssignment()`

### What to Implement
```typescript
async suggestAssignment(ticketId: number): Promise<{
  suggestedUser: User;
  reason: string;
  confidence: number;
  alternatives: { user: User; score: number }[];
}> {
  // Analyze ticket content
  // Check developer skills/expertise
  // Check current workload
  // Check past performance on similar tickets
  // Return best match
}
```

### AI Features
- Match ticket requirements to developer skills
- Consider current workload balance
- Learn from past ticket assignments and outcomes
- Factor in developer availability and response time history

### Data Points to Track (for ML model)
- Developer's completed tickets by category
- Average resolution time per developer per category
- Developer's current active ticket count
- Developer's skills/expertise tags (add to User model)

---

## 3. Intelligent Priority Scoring

### Where to Integrate
- **File:** `backend/src/modules/tickets/utils/priority.utils.ts` (create new)
- **Called from:** `createMISTicket()`, `createITSTicket()`

### What to Implement
```typescript
interface PriorityFactors {
  keywordsFound: string[];      // "urgent", "broken", "ASAP"
  requesterRole: string;        // DIRECTOR tickets may be higher priority
  affectedUsers: number;        // How many users are affected
  systemCritical: boolean;      // Core system vs peripheral
  similarTicketHistory: {
    avgResolutionTime: number;
    escalationRate: number;
  };
}

async calculateSmartPriority(
  title: string, 
  description: string, 
  context: PriorityFactors
): Promise<Priority> {
  // AI analysis of urgency
  // Return calculated priority
}
```

### Keywords to Detect
- **CRITICAL:** "system down", "cannot login", "production issue", "all users affected"
- **HIGH:** "urgent", "ASAP", "deadline", "broken", "error"
- **MEDIUM:** "issue", "problem", "not working correctly"
- **LOW:** "enhancement", "feature request", "when possible"

---

## 4. Chatbot/Self-Service Portal

### Where to Integrate
- **New component:** `frontend/src/app/features/chatbot/`
- **Backend endpoint:** `backend/src/modules/ai/chatbot.service.ts`

### Features
1. **FAQ Bot:** Answer common questions without creating tickets
2. **Guided Ticket Creation:** Ask questions to gather complete information
3. **Status Checking:** "What's the status of my ticket?"
4. **Knowledge Base Search:** Find solutions from past tickets

### Implementation Approach
```typescript
// Chatbot conversation flow
interface ChatContext {
  stage: 'greeting' | 'problem_identification' | 'gathering_details' | 'ticket_creation';
  collectedInfo: Partial<CreateMISTicketInput>;
  conversationHistory: Message[];
}

async processChatMessage(message: string, context: ChatContext): Promise<{
  response: string;
  updatedContext: ChatContext;
  action?: 'create_ticket' | 'show_faq' | 'search_kb';
}> {
  // Use LLM to understand intent
  // Extract relevant information
  // Guide conversation
}
```

---

## 5. Analytics and Insights

### Where to Integrate
- **File:** `backend/src/modules/analytics/` (create new module)
- **Dashboard:** `frontend/src/app/features/dashboard/`

### AI-Powered Analytics
1. **Trend Detection:**
   - "Website tickets increased 50% this month"
   - "Training requests peak in January"

2. **Anomaly Detection:**
   - "Unusual spike in login issues today"
   - "Resolution time for Developer X is 30% higher than average"

3. **Predictions:**
   - "Expected 15 new tickets next week based on patterns"
   - "This ticket will likely take 4 hours to resolve"

4. **Recommendations:**
   - "Consider assigning more staff to website category"
   - "Developer Y has capacity for 3 more tickets"

### Data to Collect for ML
```typescript
interface TicketAnalyticsData {
  // For each ticket
  ticketId: number;
  category: string;
  priority: string;
  createdAt: Date;
  resolvedAt: Date;
  assignedTo: number;
  statusTransitions: StatusTransition[];
  noteCount: number;
  
  // Derived metrics
  resolutionTime: number;      // in minutes
  firstResponseTime: number;   // time to first note
  escalated: boolean;          // was priority increased?
  reopened: boolean;           // was it reopened after resolved?
}
```

---

## 6. SLA Prediction and Alerts

### Where to Integrate
- **File:** `backend/src/modules/tickets/services/sla.service.ts`
- **Scheduler:** Cron job for periodic checks

### Features
```typescript
async predictSLABreach(ticketId: number): Promise<{
  willBreach: boolean;
  probability: number;
  estimatedResolutionTime: Date;
  riskFactors: string[];
  recommendations: string[];
}> {
  // Analyze current progress
  // Compare to similar past tickets
  // Factor in current workload
  // Return prediction
}
```

### Alert System
- Email/notification when ticket at risk of SLA breach
- Daily summary of at-risk tickets to managers
- Real-time dashboard indicators

---

## Implementation Priority

### Phase 1 (Quick Wins - Keyword-based)
1. ✅ Auto-categorization based on keywords
2. ✅ Priority suggestion based on urgency words
3. ✅ Simple workload-based assignment

### Phase 2 (AI Integration)
1. OpenAI/Claude integration for description analysis
2. Smart routing based on skills matching
3. Chatbot for ticket creation

### Phase 3 (Machine Learning)
1. Train models on historical ticket data
2. Prediction models for resolution time
3. Anomaly detection for trends

---

## Technical Requirements

### For AI Integration
1. **API Keys:** OpenAI API key or Claude API key
2. **Environment Variables:**
   ```env
   OPENAI_API_KEY=sk-...
   AI_MODEL=gpt-4
   AI_TEMPERATURE=0.3
   ```

3. **Dependencies:**
   ```json
   "openai": "^4.0.0",
   // or
   "@anthropic-ai/sdk": "^0.5.0"
   ```

### For Machine Learning
1. **Data Export:** Need historical ticket data
2. **Training Pipeline:** Python scripts for model training
3. **Model Serving:** API endpoint for predictions

---

## Current System Status

### ✅ Implemented
- Complete ticket workflow (FOR_REVIEW → REVIEWED → DIRECTOR_APPROVED → ASSIGNED → IN_PROGRESS → RESOLVED)
- Role-based routing (MIS_HEAD, ITS_HEAD, DEVELOPER, TECHNICAL)
- Status history tracking
- Notes and comments

### 🔄 Ready for AI Integration
- Ticket creation flow (can add suggestion step)
- Assignment flow (can add smart routing)
- Dashboard (can add predictive analytics)

### 📋 Data Being Collected
- All ticket details (category, priority, description)
- Status transitions with timestamps
- Assignment history
- Notes and comments
- User roles and actions

This data can be used to train ML models for future intelligent features.

---

## Next Steps

1. **Study OpenAI API:** https://platform.openai.com/docs
2. **Review Claude API:** https://docs.anthropic.com/
3. **Decide on approach:** API-based vs local model
4. **Start with Phase 1:** Keyword-based suggestions (no AI needed)
5. **Add Phase 2:** API integration for smarter analysis
