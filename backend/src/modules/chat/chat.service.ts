import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { Prisma } from "@prisma/client";
import { config } from "../../config";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { solutionService } from "../solutions/solution.service";
import { embeddingService } from "./embedding.service";

/**
 * Chat service that provides RAG-powered AI chat for ICT support.
 *
 * Flow:
 * 1. User sends message
 * 2. Service searches KB articles, resolved tickets, and troubleshooting solutions
 * 3. Context + conversation history sent to Gemini
 * 4. AI responds with knowledge-grounded answer
 * 5. If no answer found, AI can guide ticket creation
 */

const CHAT_SYSTEM_PROMPT = `You are an expert AI support assistant for the CHMSU ICT Department help desk (Carlos Hilado Memorial State University).
Your role is to help users resolve ICT issues with accurate, detailed, step-by-step troubleshooting guidance.

CORE BEHAVIOR:
- You are knowledgeable, proactive, and thorough. Give complete answers — never say "I don't know" if relevant context is provided.
- Think step-by-step through problems. If the user's question is vague, infer the likely issue from context and ask a clarifying question.
- Always provide actionable solutions, not just descriptions of the problem.
- Be PROACTIVE: suggest next steps, related solutions, and preventive measures. Don't just answer — anticipate follow-up needs.

ROLE-BASED ACCESS CONTROL:
- Check the CURRENT USER section in context data for the user's role.
- ADMIN: Full access — operational analytics, reports, and admin-only user directory answers. Chat is still read-only for destructive actions.
- DEVELOPER / TECHNICAL / MIS_HEAD / ITS_HEAD / DIRECTOR / SECRETARY: Can access operational analytics and reports. Cannot access admin-only user directory lists or perform admin-level mutations.
- USER (regular user): Can ONLY ask about troubleshooting, knowledge base solutions, their own ticket status, and create new tickets. Do NOT provide analytics, statistics, reports, or staff-level features to regular users. If they ask for analytics, politely explain that feature is available to ICT staff only.
- If an ACCESS LEVEL restriction notice is in the context, strictly follow it.

CONTEXT DATA RULES:
1. ALWAYS check the provided CONTEXT DATA first (knowledge base articles, resolved tickets, troubleshooting solutions). This is your PRIMARY source of truth.
2. When context data is provided, you MUST use it. Synthesize and present the information clearly — do not ignore it.
3. Operational/admin context may include analytics, approval queues, workload, user summaries, knowledge coverage, or safety policy notes. Use that data directly and do not claim the system lacks context when those sections are present.
4. When referencing a Knowledge Base article, include a clickable link: [KB: Article Title](kb:ARTICLE_ID) — replace ARTICLE_ID with the actual numeric ID.
5. When multiple context sources are relevant, combine them into a comprehensive answer.
6. If NO relevant context is provided, use your general ICT knowledge confidently. Note: "Based on general ICT best practices:" before the answer.
7. For issues requiring physical intervention (hardware failure, cable issues), suggest creating a support ticket.

KNOWLEDGE PRIORITY:
1. Knowledge Base articles (highest — curated solutions)
2. Troubleshooting Solutions from resolved tickets (proven fixes)
3. Resolved ticket history (past similar issues)
4. General ICT knowledge (last resort, but still provide a useful answer)

RESPONSE FORMAT:
- Use markdown: bullet points, numbered steps, bold for emphasis, code blocks for commands.
- Keep responses focused but thorough. Aim for complete solutions.
- For multi-step fixes, number each step clearly.
- If you provide multiple possible solutions, label them (Solution 1, Solution 2, etc.)
- Always end troubleshooting responses with a proactive suggestion: "If this doesn't work, would you like me to create a support ticket?"

WHEN ASKED ABOUT TICKET STATUS:
- Report status accurately from context: ticket number, status, assigned staff, recent updates.
- If the user has multiple tickets, list them in a clear table format.
- Include SLA information if available (overdue warnings, due dates).

WHEN ASKED ABOUT ANALYTICS OR STATISTICS (staff/admin only):
- Present data clearly with formatting (tables, bullet points, numbered lists).
- Include totals, breakdowns by category/status/priority, and any notable insights.
- Be accurate — only report numbers from the provided data.
- Proactively highlight concerning metrics (high overdue count, increasing trend, etc.)
- If SLA warnings are present in context, mention them.

WHEN SAFETY POLICY DATA IS PROVIDED:
- Explain the safeguard clearly and directly.
- Make it explicit that chat is read-only for delete/deactivate/reassign actions.
- If deletion is blocked, recommend the safer alternative (usually deactivation or reassignment).

WHEN GUIDING TICKET CREATION:
- Ask for: What is the problem? What device/system is affected? When did it start? Is it affecting others?
- Once you have enough info, respond with a JSON block wrapped in \`\`\`ticket-data tags:
\`\`\`ticket-data
{"title": "...", "description": "...", "type": "MIS or ITS", "priority": "LOW/MEDIUM/HIGH/CRITICAL"}
\`\`\`

USER CONTEXT:
- You may receive the current user's name, role, and other details. Use this to personalize responses.
- Admins/staff may ask different questions than regular users — adjust detail level accordingly.
- Address the user by name when appropriate for a personalized experience.

CATEGORIES:
- MIS (Management Information Systems): Website issues, software problems, system accounts
- ITS (Information Technology Services): Hardware, network, printer, device borrowing, connectivity

WHEN ASKED FOR REPORTS (staff/admin only):
- If report generation data is provided in context, present the download links exactly as shown.
- Explain what each report contains and offer alternative report types.
- If the user lacks permission, politely explain that report generation requires admin or staff role.

SLA AWARENESS:
- If SLA warning data is present in context, proactively mention it to staff/admin users.
- For overdue tickets, suggest immediate attention and escalation.`;

const STAFF_ROLES = [
  "ADMIN",
  "DEVELOPER",
  "TECHNICAL",
  "MIS_HEAD",
  "ITS_HEAD",
  "DIRECTOR",
  "SECRETARY",
] as const;

const SECRETARY_REVIEW_ACCESS_ROLES = [
  "ADMIN",
  "SECRETARY",
  "MIS_HEAD",
  "ITS_HEAD",
] as const;

const DIRECTOR_REVIEW_ACCESS_ROLES = [
  "ADMIN",
  "DIRECTOR",
  "MIS_HEAD",
  "ITS_HEAD",
] as const;

const ACTIVE_TICKET_STATUSES = [
  "FOR_REVIEW",
  "REVIEWED",
  "DIRECTOR_APPROVED",
  "ASSIGNED",
  "PENDING",
  "IN_PROGRESS",
  "ON_HOLD",
] as const;

const EXCLUDED_OPERATIONAL_DATA_RESPONSE =
  "I can answer operational questions from User, Ticket, TicketAssignment, TicketStatusHistory, MISTicket, ITSTicket, KnowledgeArticle, and TroubleshootingSolution data. I do not query notifications, chat history, attachments, ticket counters, or migration/internal tables in chat.";

export class ChatService {
  private genAI: GoogleGenerativeAI | null = null;

  private getClient(): GoogleGenerativeAI {
    if (!this.genAI) {
      if (!config.gemini.apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
      }
      this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    }
    return this.genAI;
  }

  isAvailable(): boolean {
    return Boolean(config.gemini.apiKey);
  }

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  async createSession(userId: number, title?: string) {
    return prisma.chatSession.create({
      data: {
        userId,
        title: title || "New Chat",
      },
    });
  }

  async getSessions(userId: number) {
    return prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
      },
    });
  }

  /**
   * Admin-only: get all chat sessions across all users
   */
  async getAllSessions() {
    return prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            picture: true,
          },
        },
        _count: { select: { messages: true } },
      },
    });
  }

  async getSession(sessionId: number, userId: number) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found");
    }

    return session;
  }

  async deleteSession(sessionId: number, userId: number) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found");
    }
    await prisma.chatSession.delete({ where: { id: sessionId } });
    return true;
  }

  // ========================================
  // CORE CHAT (RAG)
  // ========================================

  /**
   * Send a message and get an AI response.
   * This is the main entry point for the chat feature.
   */
  async sendMessage(
    sessionId: number,
    userId: number,
    userMessage: string,
  ): Promise<{ reply: string; metadata?: string }> {
    // 1. Verify session ownership + get user info
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 20 },
        user: { select: { name: true, role: true, email: true } },
      },
    });

    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found");
    }

    // 2. Save user message
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "USER",
        content: userMessage,
      },
    });

    // 3. Check if this is a ticket status query
    const ticketContext = await this.checkTicketStatusQuery(
      userMessage,
      userId,
    );

    // 3b. Role-gated: Analytics and report requests only for staff/admin
    const userRole = session.user?.role || "USER";
    const isStaffOrAdmin = STAFF_ROLES.includes(userRole as any);

    const analyticsRequest = await this.checkAnalyticsQuery(
      userMessage,
      userRole,
    );
    const reportRequest = this.checkReportRequest(userMessage, userRole);
    const deletionPolicy = this.checkDeletionPolicyQuery(userMessage, userRole);

    // Short-circuit: if the user is clearly asking for help/ticket creation, don't deny
    const ticketCreationIntentPatterns = [
      /\b(request|open|unlock|extend|create|submit|emergency|help|can i|please)\b/i,
      /\bcreate\s+(a|new)?\s*ticket\b/i,
    ];
    const hasTicketCreationIntent = ticketCreationIntentPatterns.some((p) =>
      p.test(userMessage),
    );

    if (
      !isStaffOrAdmin &&
      !ticketContext &&
      !hasTicketCreationIntent &&
      (analyticsRequest || reportRequest)
    ) {
      const denyReply =
        "I'm sorry, but analytics and report generation are available only to ICT staff and administrators. " +
        "I can still help with troubleshooting, knowledge base lookups, checking your ticket status, or creating a new support ticket.";

      await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "ASSISTANT",
          content: denyReply,
        },
      });

      return { reply: denyReply };
    }

    const analyticsContext = isStaffOrAdmin ? analyticsRequest : null;
    const reportContext = isStaffOrAdmin ? reportRequest : null;

    // 3d. SLA context for staff/admin — proactive SLA awareness
    const slaContext = isStaffOrAdmin
      ? await this.getSLAContext(userMessage, userRole)
      : null;

    // 4. Search for relevant context (RAG — fulltext + vector)
    const ragContext = await this.retrieveContext(userMessage);

    // 5. Build context string
    let contextStr = "";

    // Add user context so AI knows who it's talking to
    if (session.user) {
      contextStr += `\n--- CURRENT USER ---\nName: ${session.user.name}\nRole: ${session.user.role}\n`;
    }

    if (ticketContext) {
      contextStr += "\n--- TICKET STATUS DATA ---\n" + ticketContext + "\n";
    }

    if (analyticsContext) {
      contextStr += "\n--- ANALYTICS DATA ---\n" + analyticsContext + "\n";
    }

    if (deletionPolicy) {
      contextStr += "\n--- SAFETY POLICY ---\n" + deletionPolicy + "\n";
    }

    if (reportContext) {
      contextStr += "\n--- REPORT GENERATION ---\n" + reportContext + "\n";
    }

    if (slaContext) {
      contextStr += "\n--- SLA WARNINGS ---\n" + slaContext + "\n";
    }

    // For regular users, add a role restriction notice so the AI doesn't offer staff features
    if (!isStaffOrAdmin) {
      contextStr +=
        "\n--- ACCESS LEVEL ---\nThis user has a regular USER role. Do NOT offer analytics, statistics, reports, or any admin/staff features. Only help with troubleshooting, knowledge base lookups, checking their own ticket status, and creating new tickets.\n";
    }

    if (ragContext.kbArticles.length > 0) {
      contextStr += "\n--- KNOWLEDGE BASE ARTICLES ---\n";
      for (const article of ragContext.kbArticles) {
        contextStr += `[Article ID: ${article.id}] Title: ${article.title}\nCategory: ${article.category}\nContent: ${article.content.substring(0, 1500)}\nLink format: [KB: ${article.title}](kb:${article.id})\n\n`;
      }
    }

    if (ragContext.resolvedTickets.length > 0) {
      contextStr += "\n--- RESOLVED TICKETS (similar issues) ---\n";
      for (const ticket of ragContext.resolvedTickets) {
        contextStr += `Issue: ${ticket.title}\nDescription: ${ticket.description?.substring(0, 300) || "N/A"}\nResolution: ${ticket.resolution || "Resolved"}\n`;
        if (ticket.notes) {
          contextStr += `Notes:\n${ticket.notes.substring(0, 1200)}\n`;
        }
        contextStr += "\n";
      }
    }

    if (ragContext.solutions.length > 0) {
      contextStr += "\n--- TROUBLESHOOTING SOLUTIONS ---\n";
      for (const sol of ragContext.solutions) {
        contextStr += `Problem: ${sol.problem}\nSolution: ${sol.solution.substring(0, 500)}\nRelevance: ${sol.score ? `${(sol.score * 100).toFixed(0)}%` : "keyword match"}\n\n`;
      }
    }

    // 6. Call Gemini with context + conversation history
    const reply = await this.callGemini(
      session.messages,
      userMessage,
      contextStr,
    );

    // 7. Save assistant reply
    const metadata: any = {};
    if (ragContext.kbArticles.length > 0)
      metadata.kbArticleIds = ragContext.kbArticles.map((a: any) => a.id);
    if (ragContext.resolvedTickets.length > 0)
      metadata.ticketIds = ragContext.resolvedTickets.map((t: any) => t.id);
    if (ragContext.solutions.length > 0)
      metadata.solutionIds = ragContext.solutions.map((s: any) => s.id);

    const metadataStr =
      Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;

    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: reply,
        metadata: metadataStr,
      },
    });

    // 8. Update session title from first message
    if (session.messages.length === 0) {
      const title =
        userMessage.length > 60
          ? userMessage.substring(0, 57) + "..."
          : userMessage;
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });
    }

    return { reply, metadata: metadataStr || undefined };
  }

  // ========================================
  // CONTEXT RETRIEVAL (RAG)
  // ========================================

  private async retrieveContext(query: string) {
    // Extract meaningful keywords — filter out common stop words
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "shall",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "its",
      "our",
      "their",
      "this",
      "that",
      "these",
      "those",
      "what",
      "which",
      "who",
      "whom",
      "how",
      "when",
      "where",
      "why",
      "not",
      "no",
      "nor",
      "but",
      "and",
      "or",
      "if",
      "then",
      "so",
      "too",
      "very",
      "just",
      "about",
      "up",
      "out",
      "on",
      "off",
      "in",
      "to",
      "for",
      "of",
      "with",
      "at",
      "by",
      "from",
      "as",
      "into",
      "like",
      "please",
      "know",
      "check",
      "tell",
      "show",
      "many",
      "much",
      "any",
      "some",
    ]);

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .map((k) => k.replace(/[^a-zA-Z0-9]/g, ""))
      .filter((w) => w.length >= 3 && !stopWords.has(w))
      .slice(0, 8);

    const [kbArticles, resolvedTickets, fulltextSolutions, vectorSolutions] =
      await Promise.all([
        this.searchKBArticles(keywords),
        this.searchResolvedTickets(keywords),
        solutionService.searchForContext(query, 3),
        embeddingService.searchSimilarSolutions(query, 3, 0.4),
      ]);

    // Merge fulltext + vector solutions, deduplicate by id
    const seenIds = new Set<number>();
    const solutions: any[] = [];

    // Vector results first (higher quality matches)
    for (const sol of vectorSolutions) {
      if (!seenIds.has(sol.id)) {
        seenIds.add(sol.id);
        solutions.push(sol);
      }
    }
    // Then fulltext results
    for (const sol of fulltextSolutions) {
      if (!seenIds.has(sol.id)) {
        seenIds.add(sol.id);
        solutions.push(sol);
      }
    }

    return { kbArticles, resolvedTickets, solutions: solutions.slice(0, 5) };
  }

  private async searchKBArticles(keywords: string[]): Promise<any[]> {
    if (keywords.length === 0) return [];

    // Use OR-based search (any keyword match) for better recall
    const searchTerms = keywords.join(" ");

    try {
      return await prisma.$queryRaw<any[]>`
        SELECT id, title, content, category
        FROM KnowledgeArticle
        WHERE status = 'PUBLISHED'
          AND MATCH(title, content) AGAINST(${searchTerms} IN BOOLEAN MODE)
        ORDER BY MATCH(title, content) AGAINST(${searchTerms} IN BOOLEAN MODE) DESC
        LIMIT 5
      `;
    } catch {
      // Fallback to LIKE search
      return prisma.knowledgeArticle.findMany({
        where: {
          status: "PUBLISHED",
          OR: keywords.slice(0, 5).map((kw) => ({
            OR: [{ title: { contains: kw } }, { content: { contains: kw } }],
          })),
        },
        select: { id: true, title: true, content: true, category: true },
        take: 5,
      });
    }
  }

  private async searchResolvedTickets(keywords: string[]): Promise<any[]> {
    if (keywords.length === 0) return [];

    // Use OR-based search for better recall
    const searchTerms = keywords.join(" ");

    try {
      return await prisma.$queryRaw<any[]>`
        SELECT t.id, t.title, t.description, t.resolution,
          GROUP_CONCAT(CONCAT('Staff note: ', n.content) SEPARATOR '\n') AS notes
        FROM Ticket t
        LEFT JOIN TicketNote n ON n.ticketId = t.id
        WHERE t.status IN ('RESOLVED', 'CLOSED')
          AND t.resolution IS NOT NULL
          AND MATCH(t.title, t.description) AGAINST(${searchTerms} IN BOOLEAN MODE)
        GROUP BY t.id, t.title, t.description, t.resolution
        ORDER BY MATCH(t.title, t.description) AGAINST(${searchTerms} IN BOOLEAN MODE) DESC
        LIMIT 5
      `;
    } catch {
      const tickets = await prisma.ticket.findMany({
        where: {
          status: { in: ["RESOLVED", "CLOSED"] },
          resolution: { not: null },
          OR: keywords.slice(0, 5).map((kw) => ({
            OR: [
              { title: { contains: kw } },
              { description: { contains: kw } },
            ],
          })),
        },
        select: {
          id: true,
          title: true,
          description: true,
          resolution: true,
          notes: {
            orderBy: { createdAt: "asc" },
            select: { content: true },
          },
        },
        take: 5,
      });

      return tickets.map((ticket) => ({
        ...ticket,
        notes:
          ticket.notes
            ?.map((note) => `Staff note: ${note.content}`)
            .join("\n") || null,
      }));
    }
  }

  // ========================================
  // TICKET STATUS QUERY
  // ========================================

  private async checkTicketStatusQuery(
    message: string,
    userId: number,
  ): Promise<string | null> {
    // Check if the user is asking about a specific ticket
    const ticketNumMatch = message.match(
      /(?:ticket|#)\s*(\w{3,4}-\d{4}-\d{2}-\d+)/i,
    );

    if (ticketNumMatch) {
      const ticketNumber = ticketNumMatch[1].toUpperCase();
      const ticket = await prisma.ticket.findUnique({
        where: { ticketNumber },
        include: {
          assignments: {
            include: { user: { select: { name: true, role: true } } },
          },
          statusHistory: { orderBy: { createdAt: "desc" }, take: 3 },
          notes: {
            where: { isInternal: false },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { user: { select: { name: true } } },
          },
        },
      });

      if (ticket && ticket.createdById === userId) {
        return this.formatTicketStatus(ticket);
      }
    }

    // Check if asking about "my tickets" / "my request" generally
    const statusKeywords =
      /\b(status|ticket|request|update|progress|where|track)\b/i;
    if (statusKeywords.test(message)) {
      const recentTickets = await prisma.ticket.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          assignments: {
            include: { user: { select: { name: true, role: true } } },
          },
          notes: {
            where: { isInternal: false },
            orderBy: { createdAt: "desc" },
            take: 3,
            include: { user: { select: { name: true } } },
          },
        },
      });

      if (recentTickets.length > 0) {
        let status = "Here are your recent tickets:\n";
        for (const t of recentTickets) {
          const assigned =
            t.assignments.map((a: any) => a.user.name).join(", ") ||
            t.assignedDeveloperName ||
            "Not yet assigned";
          status += `- **${t.ticketNumber}**: ${t.title} — Status: **${t.status}** — Assigned to: ${assigned}\n`;
          if (t.resolution) status += `  Resolution: ${t.resolution}\n`;
          if ((t as any).notes?.length > 0) {
            for (const note of (t as any).notes) {
              status += `  Note by ${note.user.name}: ${note.content}\n`;
            }
          }
        }
        return status;
      }

      return "You do not have any recent support tickets yet. If you are currently experiencing an issue, I can help troubleshoot it or create a new support ticket for you.";
    }

    return null;
  }

  private formatTicketStatus(ticket: any): string {
    const assigned =
      ticket.assignments
        ?.map((a: any) => `${a.user.name} (${a.user.role})`)
        .join(", ") || "Not yet assigned";
    const lastUpdate = ticket.statusHistory?.[0];

    let status = `Ticket **${ticket.ticketNumber}**: ${ticket.title}\n`;
    status += `- **Status**: ${ticket.status}\n`;
    status += `- **Priority**: ${ticket.priority}\n`;
    status += `- **Assigned to**: ${assigned}\n`;
    if (ticket.assignedDeveloperName)
      status += `- **Developer/Technician**: ${ticket.assignedDeveloperName}\n`;
    if (ticket.dateToVisit)
      status += `- **Date to Visit**: ${new Date(ticket.dateToVisit).toLocaleDateString()}\n`;
    if (ticket.resolution) status += `- **Resolution**: ${ticket.resolution}\n`;
    if (lastUpdate) {
      status += `- **Last Update**: Changed from ${lastUpdate.fromStatus || "N/A"} to ${lastUpdate.toStatus} on ${new Date(lastUpdate.createdAt).toLocaleDateString()}\n`;
    }
    if (ticket.notes?.length > 0) {
      status += `- **Notes**:\n`;
      for (const note of ticket.notes) {
        status += `  - ${note.user.name}: ${note.content}\n`;
      }
    }

    return status;
  }

  // ========================================
  // ANALYTICS QUERIES (READ-ONLY)
  // ========================================

  private async checkAnalyticsQuery(
    message: string,
    role: string = "USER",
  ): Promise<string | null> {
    const normalizedMessage = message.toLowerCase();

    const excludedDataResponse =
      this.checkExcludedOperationalQuery(normalizedMessage);
    if (excludedDataResponse) {
      return excludedDataResponse;
    }

    const supportedScopeResponse = this.checkOperationalCoverageQuery(
      normalizedMessage,
      role,
    );
    if (supportedScopeResponse) {
      return supportedScopeResponse;
    }

    try {
      const userContext = await this.buildUserQueryContext(message, role);
      if (userContext) {
        return userContext;
      }

      const approvalContext = await this.buildApprovalWorkflowContext(
        message,
        role,
      );
      if (approvalContext) {
        return approvalContext;
      }

      const escalationContext = await this.buildEscalationContext(
        message,
        role,
      );
      if (escalationContext) {
        return escalationContext;
      }

      const workloadContext = await this.buildWorkloadContext(message, role);
      if (workloadContext) {
        return workloadContext;
      }

      const categoryContext = await this.buildCategoryBreakdownContext(
        message,
        role,
      );
      if (categoryContext) {
        return categoryContext;
      }

      const knowledgeContext = await this.buildKnowledgeCoverageContext(
        message,
        role,
      );
      if (knowledgeContext) {
        return knowledgeContext;
      }

      return this.buildGeneralAnalyticsContext(message, role);
    } catch (err: any) {
      logger.error("[ChatService] Analytics query failed:", err.message);
      return null;
    }
  }

  private async buildGeneralAnalyticsContext(
    message: string,
    role: string,
  ): Promise<string | null> {
    const normalizedMessage = message.toLowerCase();
    const departmentScope = this.getDepartmentScope(role, message);
    const analyticsWhere = departmentScope ? { type: departmentScope } : {};

    const analyticsPatterns = [
      /how many\s+(tickets?|requests?|issues?)/i,
      /ticket.*\b(statistics?|analytics?|report|count|total|summary)\b/i,
      /\b(statistics?|analytics?|report|summary|dashboard|overview)\b.*(ticket|request|issue)/i,
      /most\s+(common|frequent|painful|problematic|recurring)/i,
      /ticket.*(per|by)\s+(day|week|month|category|status|priority|type)/i,
      /(average|mean|median).*(resolution|response|time)/i,
      /\b(workload|performance|productivity)\b/i,
      /(busiest|peak|slowest)\s*(day|time|period|month)/i,
      /\b(sla|overdue|compliance|breach)\b.*\b(tickets?|requests?|count|report|status|rate|data)\b/i,
      /\b(tickets?|requests?|count|report|status|rate|data)\b.*\b(sla|overdue|compliance|breach)\b/i,
      /\bdeadline\b.*\b(tickets?|requests?|count|report|sla|compliance)\b/i,
      /\b(unresolved|pending|backlog)\b.*\b(tickets?|requests?)\b/i,
    ];

    if (!analyticsPatterns.some((pattern) => pattern.test(normalizedMessage))) {
      return null;
    }

    const results: string[] = [];

    if (departmentScope) {
      results.push(`**Analytics Scope**: ${departmentScope} tickets only`);
    }

    const statusCounts = await prisma.ticket.groupBy({
      by: ["status"],
      where: analyticsWhere,
      _count: { id: true },
    });
    if (statusCounts.length > 0) {
      results.push("**Tickets by Status:**");
      const totalTickets = statusCounts.reduce(
        (sum, statusEntry) => sum + statusEntry._count.id,
        0,
      );
      results.push(`Total tickets: ${totalTickets}`);
      for (const statusEntry of statusCounts) {
        results.push(`- ${statusEntry.status}: ${statusEntry._count.id}`);
      }
    }

    const typeCounts = await prisma.ticket.groupBy({
      by: ["type"],
      where: analyticsWhere,
      _count: { id: true },
    });
    if (typeCounts.length > 0) {
      results.push("\n**Tickets by Type:**");
      for (const typeEntry of typeCounts) {
        results.push(`- ${typeEntry.type}: ${typeEntry._count.id}`);
      }
    }

    const priorityCounts = await prisma.ticket.groupBy({
      by: ["priority"],
      where: analyticsWhere,
      _count: { id: true },
    });
    if (priorityCounts.length > 0) {
      results.push("\n**Tickets by Priority:**");
      for (const priorityEntry of priorityCounts) {
        results.push(`- ${priorityEntry.priority}: ${priorityEntry._count.id}`);
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.ticket.count({
      where: { ...analyticsWhere, createdAt: { gte: todayStart } },
    });
    results.push(`\n**Today's tickets**: ${todayCount}`);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekCount = await prisma.ticket.count({
      where: { ...analyticsWhere, createdAt: { gte: weekStart } },
    });
    results.push(`**This week's tickets**: ${weekCount}`);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCount = await prisma.ticket.count({
      where: { ...analyticsWhere, createdAt: { gte: monthStart } },
    });
    results.push(`**This month's tickets**: ${monthCount}`);

    const commonIssuesWhere = departmentScope
      ? Prisma.sql`WHERE type = ${departmentScope}`
      : Prisma.empty;
    const commonIssues = await prisma.$queryRaw<
      Array<{ title: string; count: bigint }>
    >(Prisma.sql`
      SELECT title, COUNT(*) as count
      FROM Ticket
      ${commonIssuesWhere}
      GROUP BY title
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 5
    `);
    if (commonIssues.length > 0) {
      results.push("\n**Most Recurring Issues:**");
      for (const issue of commonIssues) {
        results.push(`- "${issue.title}" — ${issue.count} tickets`);
      }
    }

    const avgResolutionWhere = departmentScope
      ? Prisma.sql`WHERE resolvedAt IS NOT NULL AND type = ${departmentScope}`
      : Prisma.sql`WHERE resolvedAt IS NOT NULL`;
    const avgResolution = await prisma.$queryRaw<
      Array<{ avg_hours: number | null }>
    >(Prisma.sql`
      SELECT AVG(TIMESTAMPDIFF(HOUR, createdAt, resolvedAt)) as avg_hours
      FROM Ticket
      ${avgResolutionWhere}
    `);
    if (avgResolution[0]?.avg_hours) {
      const averageHours = Math.round(avgResolution[0].avg_hours);
      results.push(
        `\n**Average Resolution Time**: ${averageHours >= 24 ? `${Math.round(averageHours / 24)} days` : `${averageHours} hours`}`,
      );
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const overdueTickets = await prisma.ticket.findMany({
      where: {
        ...analyticsWhere,
        status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
        createdAt: { lt: sevenDaysAgo },
      },
      select: {
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    if (overdueTickets.length > 0) {
      results.push("\n**Overdue Tickets (>7 days unresolved):**");
      for (const ticket of overdueTickets) {
        const daysOld = Math.round(
          (Date.now() - new Date(ticket.createdAt).getTime()) / 86400000,
        );
        results.push(
          `- ${ticket.ticketNumber}: ${ticket.title} — ${ticket.status} — ${ticket.priority} — ${daysOld} days old`,
        );
      }
    }

    const workload = await this.getActiveWorkloadRows(10, departmentScope);
    if (workload.length > 0) {
      results.push("\n**Current Staff Workload (active tickets):**");
      for (const workloadRow of workload) {
        results.push(
          `- ${workloadRow.displayName} (${workloadRow.role}): ${workloadRow.activeCount} active ticket(s)`,
        );
      }
    }

    const completedSlaTickets = await prisma.ticket.findMany({
      where: {
        ...analyticsWhere,
        dueDate: { not: null },
        status: { in: ["RESOLVED", "CLOSED"] },
        OR: [{ resolvedAt: { not: null } }, { closedAt: { not: null } }],
      },
      select: {
        dueDate: true,
        resolvedAt: true,
        closedAt: true,
      },
    });

    const slaTotal = completedSlaTickets.length;
    const slaMet = completedSlaTickets.filter((ticket) => {
      const completedAt = ticket.resolvedAt || ticket.closedAt;
      return (
        completedAt != null &&
        ticket.dueDate != null &&
        completedAt <= ticket.dueDate
      );
    }).length;

    if (slaTotal > 0) {
      const complianceRate = Math.round((slaMet / slaTotal) * 100);
      results.push(
        `\n**SLA Compliance**: ${slaMet}/${slaTotal} completed ticket(s) met SLA (${complianceRate}%)`,
      );
    }

    if (
      role === "ADMIN" &&
      /\b(user|users|staff|account)\b/i.test(normalizedMessage)
    ) {
      const userAggregateContext = await this.buildUserAggregateContext();
      if (userAggregateContext) {
        results.push(`\n${userAggregateContext}`);
      }
    }

    return results.length > 0 ? results.join("\n") : null;
  }

  private async buildUserQueryContext(
    message: string,
    role: string,
  ): Promise<string | null> {
    const normalizedMessage = message.toLowerCase();
    const wantsAggregate =
      /how many\s+user/i.test(normalizedMessage) ||
      /user.*(count|total|registered|breakdown|distribution|statistic)/i.test(
        normalizedMessage,
      ) ||
      /registered\s+user/i.test(normalizedMessage) ||
      /(user|staff|account)\s*(breakdown|by role|per role|distribution)/i.test(
        normalizedMessage,
      ) ||
      /role.*(user|count|breakdown|distribution)/i.test(normalizedMessage);

    const wantsRegularUsers =
      /\b(show|list|display|who are)\b.*\b(regular users?|users? with role user)\b/i.test(
        message,
      );
    const wantsAdmins =
      /\b(show|list|display|who are)\b.*\b(admins?|administrators?)\b/i.test(
        message,
      );
    const wantsDeactivatedUsers =
      /\b(show|list|display|who are)\b.*\b(deactivated|inactive|disabled)\s+(users?|accounts?)\b/i.test(
        message,
      );
    const wantsRecentUsers =
      /\b(show|list|display)\b.*\b(new|newest|recent)\s+users?\b/i.test(
        message,
      );
    const wantsStaffDirectory =
      /\b(show|list|display|who are)\b.*\b(staff|employees?)\b/i.test(message);

    const wantsDirectoryList =
      wantsRegularUsers ||
      wantsAdmins ||
      wantsDeactivatedUsers ||
      wantsRecentUsers ||
      wantsStaffDirectory;

    if (!wantsAggregate && !wantsDirectoryList) {
      return null;
    }

    if (!wantsDirectoryList) {
      return this.buildUserAggregateContext();
    }

    if (role !== "ADMIN") {
      const aggregateContext = await this.buildUserAggregateContext();
      return [
        "**User Directory Access**",
        "Person-level user lists in chat are ADMIN only. I can still provide aggregate user counts and role breakdowns.",
        aggregateContext,
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    const requestedLimit = this.extractRequestedLimit(message, 3, 5);
    const userWhere: any = {};
    let title = "**User Directory:**";

    if (wantsRegularUsers) {
      userWhere.role = "USER";
      title = `**Regular Users (top ${requestedLimit}):**`;
    } else if (wantsAdmins) {
      userWhere.role = "ADMIN";
      title = `**Admin Accounts (top ${requestedLimit}):**`;
    } else if (wantsDeactivatedUsers) {
      userWhere.isActive = false;
      title = `**Deactivated User Accounts (top ${requestedLimit}):**`;
    } else if (wantsStaffDirectory) {
      userWhere.role = { in: STAFF_ROLES.filter((entry) => entry !== "ADMIN") };
      title = `**Staff Accounts (top ${requestedLimit}):**`;
    } else if (wantsRecentUsers) {
      title = `**Newest User Accounts (top ${requestedLimit}):**`;
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: requestedLimit,
    });

    if (users.length === 0) {
      return `${title}\nNo matching users were found.`;
    }

    const lines = [title];
    for (const user of users) {
      lines.push(
        `- ${user.name || user.email} — ${user.email} — ${user.role} — ${user.isActive ? "Active" : "Inactive"} — Joined ${this.formatDateOnly(user.createdAt)}`,
      );
    }

    return lines.join("\n");
  }

  private async buildUserAggregateContext(): Promise<string | null> {
    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: { id: true },
    });
    const activeCount = await prisma.user.count({ where: { isActive: true } });
    const inactiveCount = await prisma.user.count({
      where: { isActive: false },
    });
    const totalUsers = activeCount + inactiveCount;
    if (totalUsers === 0) {
      return null;
    }

    const lines = ["**User Statistics:**"];
    lines.push(`Total registered users: ${totalUsers}`);
    lines.push(`- Active: ${activeCount}`);
    lines.push(`- Deactivated: ${inactiveCount}`);
    lines.push("**Users by Role:**");
    for (const roleEntry of usersByRole) {
      lines.push(`- ${roleEntry.role}: ${roleEntry._count.id}`);
    }
    return lines.join("\n");
  }

  private async buildApprovalWorkflowContext(
    message: string,
    role: string,
  ): Promise<string | null> {
    const secretaryQueueQuery =
      /\b(secretary review|for review)\b/i.test(message) ||
      /\b(secretary)\b.*\b(pending|queue|review|awaiting)\b/i.test(message);
    const directorQueueQuery =
      /\b(pending director approval|director approval)\b/i.test(message) ||
      /\b(director)\b.*\b(pending|approval|queue|awaiting)\b/i.test(message);

    if (!secretaryQueueQuery && !directorQueueQuery) {
      return null;
    }

    if (
      secretaryQueueQuery &&
      !SECRETARY_REVIEW_ACCESS_ROLES.includes(role as any)
    ) {
      return "**Secretary Review Queue**\nThis queue is visible only to ADMIN, SECRETARY, MIS_HEAD, and ITS_HEAD users.";
    }

    if (
      directorQueueQuery &&
      !DIRECTOR_REVIEW_ACCESS_ROLES.includes(role as any)
    ) {
      return "**Director Approval Queue**\nThis queue is visible only to ADMIN, DIRECTOR, MIS_HEAD, and ITS_HEAD users.";
    }

    const requestedLimit = this.extractRequestedLimit(message, 5, 5);
    const departmentScope = this.getDepartmentScope(role, message);
    const queryStatus = secretaryQueueQuery ? "FOR_REVIEW" : "REVIEWED";

    const queueWhere: any = {
      status: queryStatus,
      ...(departmentScope ? { type: departmentScope } : {}),
    };

    const [totalCount, queueTickets] = await Promise.all([
      prisma.ticket.count({ where: queueWhere }),
      prisma.ticket.findMany({
        where: queueWhere,
        select: {
          ticketNumber: true,
          title: true,
          type: true,
          priority: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: requestedLimit,
      }),
    ]);

    const header = secretaryQueueQuery
      ? "**Tickets Pending Secretary Review:**"
      : "**Tickets Pending Director Approval:**";
    const lines = [header, `Total tickets in queue: ${totalCount}`];
    if (queueTickets.length === 0) {
      lines.push("No tickets are currently waiting in this approval queue.");
      return lines.join("\n");
    }

    for (const ticket of queueTickets) {
      lines.push(
        `- ${ticket.ticketNumber}: ${ticket.title} — ${ticket.type} — ${ticket.priority} — Submitted ${this.formatDateOnly(ticket.createdAt)}`,
      );
    }

    return lines.join("\n");
  }

  private async buildEscalationContext(
    message: string,
    role: string,
  ): Promise<string | null> {
    const wantsEscalations = /\b(escalated?|escalation)\b/i.test(message);
    const wantsOldestTickets =
      /\b(oldest|stuck|aging|ageing)\b.*\b(ticket|request)\b/i.test(message);
    const wantsStatusHistory =
      /\b(status history|status changes|recent transitions?)\b/i.test(message);

    if (!wantsEscalations && !wantsOldestTickets && !wantsStatusHistory) {
      return null;
    }

    const requestedLimit = this.extractRequestedLimit(message, 5, 5);
    const departmentScope = this.getDepartmentScope(role, message);

    if (wantsStatusHistory) {
      const historyEntries = await prisma.ticketStatusHistory.findMany({
        where: {
          ...(departmentScope ? { ticket: { type: departmentScope } } : {}),
        },
        select: {
          createdAt: true,
          fromStatus: true,
          toStatus: true,
          ticket: { select: { ticketNumber: true, title: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: requestedLimit,
      });

      if (historyEntries.length === 0) {
        return "**Recent Status Transitions:**\nNo recent status history entries were found.";
      }

      const lines = ["**Recent Status Transitions:**"];
      for (const historyEntry of historyEntries) {
        lines.push(
          `- ${historyEntry.ticket.ticketNumber}: ${historyEntry.fromStatus || "NEW"} → ${historyEntry.toStatus} on ${this.formatDateOnly(historyEntry.createdAt)} by ${historyEntry.user.name || "Staff"}`,
        );
      }
      return lines.join("\n");
    }

    if (wantsEscalations) {
      const escalationWhere: any = {
        escalationLevel: { gt: 0 },
        ...(departmentScope ? { type: departmentScope } : {}),
      };
      const [escalationCounts, escalatedTickets] = await Promise.all([
        prisma.ticket.groupBy({
          by: ["escalationLevel"],
          where: escalationWhere,
          _count: { id: true },
          orderBy: { escalationLevel: "desc" },
        }),
        prisma.ticket.findMany({
          where: escalationWhere,
          select: {
            ticketNumber: true,
            title: true,
            type: true,
            priority: true,
            escalationLevel: true,
            escalatedAt: true,
          },
          orderBy: [{ escalationLevel: "desc" }, { escalatedAt: "desc" }],
          take: requestedLimit,
        }),
      ]);

      const lines = ["**Escalated Tickets:**"];
      if (escalatedTickets.length === 0) {
        lines.push("No escalated tickets were found.");
        return lines.join("\n");
      }

      for (const escalationCount of escalationCounts) {
        lines.push(
          `- Level ${escalationCount.escalationLevel}: ${escalationCount._count.id} ticket(s)`,
        );
      }
      for (const ticket of escalatedTickets) {
        lines.push(
          `- ${ticket.ticketNumber}: ${ticket.title} — ${ticket.type} — ${ticket.priority} — Level ${ticket.escalationLevel}${ticket.escalatedAt ? ` — Escalated ${this.formatDateOnly(ticket.escalatedAt)}` : ""}`,
        );
      }

      return lines.join("\n");
    }

    const oldestActiveTickets = await prisma.ticket.findMany({
      where: {
        status: { in: [...ACTIVE_TICKET_STATUSES] },
        ...(departmentScope ? { type: departmentScope } : {}),
      },
      select: {
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: requestedLimit,
    });

    if (oldestActiveTickets.length === 0) {
      return "**Oldest Active Tickets:**\nNo active tickets were found.";
    }

    const lines = ["**Oldest Active Tickets:**"];
    for (const ticket of oldestActiveTickets) {
      const ageInDays = Math.round(
        (Date.now() - new Date(ticket.createdAt).getTime()) / 86400000,
      );
      lines.push(
        `- ${ticket.ticketNumber}: ${ticket.title} — ${ticket.status} — ${ticket.priority} — ${ageInDays} day(s) old`,
      );
    }
    return lines.join("\n");
  }

  private async buildWorkloadContext(
    message: string,
    role: string,
  ): Promise<string | null> {
    const normalizedMessage = message.toLowerCase();
    const wantsWorkload =
      /\b(workload|productivity|assigned tickets|active tickets per staff)\b/i.test(
        message,
      ) ||
      /\b(who has|who is)\b.*\b(most|highest|busiest)\b.*\b(ticket|workload)\b/i.test(
        message,
      );

    if (!wantsWorkload) {
      return null;
    }

    const requestedLimit = this.extractRequestedLimit(message, 5, 10);
    const departmentScope = this.getDepartmentScope(role, message);
    const workloadRows = await this.getActiveWorkloadRows(
      requestedLimit,
      departmentScope,
    );

    if (workloadRows.length === 0) {
      return "**Current Staff Workload:**\nNo active assignments were found.";
    }

    const lines = ["**Current Staff Workload:**"];
    for (const workloadRow of workloadRows) {
      lines.push(
        `- ${workloadRow.displayName} (${workloadRow.role}): ${workloadRow.activeCount} active ticket(s)`,
      );
    }

    if (
      normalizedMessage.includes("most") ||
      normalizedMessage.includes("busiest")
    ) {
      const busiest = workloadRows[0];
      lines.push(
        `\nBusiest staff member right now: ${busiest.displayName} with ${busiest.activeCount} active ticket(s).`,
      );
    }

    return lines.join("\n");
  }

  private async buildCategoryBreakdownContext(
    message: string,
    role: string,
  ): Promise<string | null> {
    const categoryKeywords =
      /\b(website|software|borrow|printer|network|internet|hardware|maintenance)\b/i;
    const analyticsKeywords =
      /\b(show|list|count|how many|breakdown|summary|analytics|statistics|stats|report|reports|dashboard|overview|distribution|compare)\b/i;
    const categoryIntent =
      /\b(mis|its)\b.*\b(category|breakdown|request|requests|tickets)\b/i.test(
        message,
      ) ||
      (analyticsKeywords.test(message) && categoryKeywords.test(message));

    if (!categoryIntent) {
      return null;
    }

    const departmentScope = this.getDepartmentScope(role, message);
    const lines = ["**Department / Category Breakdown:**"];

    if (!departmentScope || departmentScope === "MIS") {
      const [
        misCount,
        websiteNewRequest,
        websiteUpdate,
        softwareNewRequest,
        softwareUpdate,
        softwareInstall,
      ] = await Promise.all([
        prisma.ticket.count({ where: { type: "MIS" } }),
        prisma.mISTicket.count({ where: { websiteNewRequest: true } }),
        prisma.mISTicket.count({ where: { websiteUpdate: true } }),
        prisma.mISTicket.count({ where: { softwareNewRequest: true } }),
        prisma.mISTicket.count({ where: { softwareUpdate: true } }),
        prisma.mISTicket.count({ where: { softwareInstall: true } }),
      ]);

      lines.push(`MIS tickets: ${misCount}`);
      lines.push(`- Website new requests: ${websiteNewRequest}`);
      lines.push(`- Website updates: ${websiteUpdate}`);
      lines.push(`- Software new requests: ${softwareNewRequest}`);
      lines.push(`- Software updates: ${softwareUpdate}`);
      lines.push(`- Software installations: ${softwareInstall}`);
    }

    if (!departmentScope || departmentScope === "ITS") {
      const [
        itsCount,
        borrowRequest,
        desktopLaptop,
        internetNetwork,
        printerMaintenance,
      ] = await Promise.all([
        prisma.ticket.count({ where: { type: "ITS" } }),
        prisma.iTSTicket.count({ where: { borrowRequest: true } }),
        prisma.iTSTicket.count({ where: { maintenanceDesktopLaptop: true } }),
        prisma.iTSTicket.count({ where: { maintenanceInternetNetwork: true } }),
        prisma.iTSTicket.count({ where: { maintenancePrinter: true } }),
      ]);

      lines.push(`ITS tickets: ${itsCount}`);
      lines.push(`- Borrow requests: ${borrowRequest}`);
      lines.push(`- Desktop/Laptop maintenance: ${desktopLaptop}`);
      lines.push(`- Internet/Network maintenance: ${internetNetwork}`);
      lines.push(`- Printer maintenance: ${printerMaintenance}`);
    }

    return lines.join("\n");
  }

  private async buildKnowledgeCoverageContext(
    message: string,
    role: string,
  ): Promise<string | null> {
    const knowledgeBaseIntent =
      /\b(knowledge base|kb|faq|faqs|article|articles)\b/i.test(message) &&
      /\b(count|counts|summary|stat|analytic|breakdown|most viewed|most helpful|coverage|updated|how many|show|list)\b/i.test(
        message,
      );
    const solutionIntent =
      /\b(troubleshooting solution|troubleshooting solutions|solution library|solution database|solutions?)\b/i.test(
        message,
      ) &&
      /\b(count|counts|summary|stat|analytic|breakdown|visibility|category|updated|how many|show|list)\b/i.test(
        message,
      );

    if (!knowledgeBaseIntent && !solutionIntent) {
      return null;
    }

    const lines: string[] = [];

    if (knowledgeBaseIntent) {
      const [articlesByStatus, articlesByCategory, topArticles] =
        await Promise.all([
          prisma.knowledgeArticle.groupBy({
            by: ["status"],
            _count: { id: true },
          }),
          prisma.knowledgeArticle.groupBy({
            by: ["category"],
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
          }),
          prisma.knowledgeArticle.findMany({
            where: { status: "PUBLISHED" },
            select: {
              title: true,
              category: true,
              viewCount: true,
              helpfulCount: true,
            },
            orderBy: [{ viewCount: "desc" }, { helpfulCount: "desc" }],
            take: 3,
          }),
        ]);

      lines.push("**Knowledge Base Coverage:**");
      for (const statusEntry of articlesByStatus) {
        lines.push(`- ${statusEntry.status}: ${statusEntry._count.id}`);
      }
      if (articlesByCategory.length > 0) {
        lines.push("**Articles by Category:**");
        for (const categoryEntry of articlesByCategory.slice(0, 5)) {
          lines.push(`- ${categoryEntry.category}: ${categoryEntry._count.id}`);
        }
      }
      if (topArticles.length > 0) {
        lines.push("**Most Viewed Published Articles:**");
        for (const article of topArticles) {
          lines.push(
            `- ${article.title} (${article.category}) — ${article.viewCount} view(s), ${article.helpfulCount} helpful vote(s)`,
          );
        }
      }
    }

    if (solutionIntent) {
      const [solutionsByVisibility, solutionsByCategory, recentSolutions] =
        await Promise.all([
          prisma.troubleshootingSolution.groupBy({
            by: ["visibility"],
            _count: { id: true },
          }),
          prisma.troubleshootingSolution.groupBy({
            by: ["category"],
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
          }),
          prisma.troubleshootingSolution.findMany({
            select: {
              problem: true,
              category: true,
              visibility: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 3,
          }),
        ]);

      if (lines.length > 0) {
        lines.push("");
      }
      lines.push("**Troubleshooting Solutions Coverage:**");
      for (const visibilityEntry of solutionsByVisibility) {
        lines.push(
          `- ${visibilityEntry.visibility}: ${visibilityEntry._count.id}`,
        );
      }
      if (solutionsByCategory.length > 0) {
        lines.push("**Solutions by Category:**");
        for (const categoryEntry of solutionsByCategory.slice(0, 5)) {
          lines.push(`- ${categoryEntry.category}: ${categoryEntry._count.id}`);
        }
      }
      if (recentSolutions.length > 0) {
        lines.push("**Recently Updated Solutions:**");
        for (const solution of recentSolutions) {
          lines.push(
            `- ${solution.problem.substring(0, 80)}${solution.problem.length > 80 ? "..." : ""} — ${solution.category} — ${solution.visibility} — Updated ${this.formatDateOnly(solution.updatedAt)}`,
          );
        }
      }
    }

    return lines.length > 0 ? lines.join("\n") : null;
  }

  private checkExcludedOperationalQuery(message: string): string | null {
    const wantsData =
      /\b(show|list|count|how many|what|which|analytics|report|summary|dashboard)\b/i.test(
        message,
      );
    const excludedTables =
      /\b(notification|notifications|chat history|chat session|chat sessions|chat message|chat messages|attachment|attachments|ticket counter|ticket counters|migration|migrations|_prisma_migrations)\b/i.test(
        message,
      );

    if (wantsData && excludedTables) {
      return EXCLUDED_OPERATIONAL_DATA_RESPONSE;
    }

    return null;
  }

  private checkOperationalCoverageQuery(
    message: string,
    role: string,
  ): string | null {
    const asksAboutCoverage =
      /\b(what|which)\b.*\b(data|tables|queries|questions|analytics)\b/i.test(
        message,
      ) ||
      /\bwhat can you answer\b/i.test(message) ||
      /\bwhat can you access\b/i.test(message);

    if (!asksAboutCoverage) {
      return null;
    }

    const lines = [
      "**Supported Admin/Staff Chat Queries:**",
      "- Ticket analytics: status, priority, type, backlog, overdue, due soon, SLA, recurring issues, average resolution time",
      "- Workload analytics: active assignments by staff member and busiest staff members",
      "- Approval workflows: tickets pending secretary review and tickets pending director approval",
      "- Escalations and timelines: escalated tickets, oldest active tickets, recent status transitions",
      "- Department breakdowns: MIS vs ITS counts plus website/software/borrow/network/printer maintenance categories",
      "- Knowledge coverage: knowledge-base article counts, categories, and most-viewed published articles",
      "- Troubleshooting solutions: visibility counts, categories, and recently updated solutions",
      "- User summaries: aggregate user totals and role breakdowns",
    ];

    if (role === "ADMIN") {
      lines.push(
        "- ADMIN-only user directory lists: regular users, deactivated users, staff accounts, admins, and newest users",
      );
    } else if (STAFF_ROLES.includes(role as any)) {
      lines.push(
        "- Person-level user directory lists stay ADMIN only; staff can still ask for aggregate user counts and role breakdowns",
      );
    }

    lines.push(
      "- Excluded in chat: notifications, chat history, attachments, ticket counters, and migration/internal tables",
    );
    return lines.join("\n");
  }

  private checkDeletionPolicyQuery(
    message: string,
    role: string,
  ): string | null {
    const normalizedMessage = message.toLowerCase();
    const deletionIntent =
      /\b(delete|deletion|deactivate|deactivation|remove|hard delete|permanent)\b/i.test(
        normalizedMessage,
      ) && /\b(user|account|note|article|solution)\b/i.test(normalizedMessage);

    if (!deletionIntent) {
      return null;
    }

    const lines = ["**Deletion Safeguards:**"];
    if (role !== "ADMIN" && /\buser|account\b/i.test(normalizedMessage)) {
      lines.push(
        "- User account management is ADMIN only. Chat can explain the policy, but it will not execute account actions.",
      );
    }
    lines.push(
      "- User accounts cannot be hard-deleted when they still own open tickets or are assigned to active tickets. Deactivation is the safer reversible option.",
    );
    lines.push(
      "- Ticket notes, knowledge-base articles, and troubleshooting solutions are hard-delete actions with audit logging.",
    );
    lines.push(
      "- Chat is read-only for delete, deactivate, restore, and reassign requests. Use the proper admin/staff screens for those actions.",
    );
    return lines.join("\n");
  }

  private getDepartmentScope(
    role: string,
    message: string,
  ): "MIS" | "ITS" | null {
    const normalizedMessage = message.toLowerCase();

    if (/\bmis\b|website|software/i.test(normalizedMessage)) {
      return "MIS";
    }

    if (
      /\bits\b|hardware|printer|network|internet|borrow|maintenance/i.test(
        normalizedMessage,
      )
    ) {
      return "ITS";
    }

    if (role === "MIS_HEAD") {
      return "MIS";
    }

    if (role === "ITS_HEAD") {
      return "ITS";
    }

    return null;
  }

  private extractRequestedLimit(
    message: string,
    fallback = 5,
    max = 10,
  ): number {
    const limitMatch = message.match(/\b(\d{1,2})\b/);
    if (!limitMatch) {
      return fallback;
    }

    const requestedLimit = Number(limitMatch[1]);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      return fallback;
    }

    return Math.min(requestedLimit, max);
  }

  private formatDateOnly(value: Date | string): string {
    return new Date(value).toLocaleDateString();
  }

  private async getActiveWorkloadRows(
    limit: number,
    type?: "MIS" | "ITS" | null,
  ): Promise<
    Array<{ displayName: string; role: string; activeCount: number }>
  > {
    const assignmentCounts = await prisma.ticketAssignment.groupBy({
      by: ["userId"],
      where: {
        ticket: {
          status: { in: [...ACTIVE_TICKET_STATUSES] },
          ...(type ? { type } : {}),
        },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });

    if (assignmentCounts.length === 0) {
      return [];
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: assignmentCounts.map((assignment) => assignment.userId) },
      },
      select: { id: true, name: true, email: true, role: true },
    });

    const usersById = new Map(users.map((user) => [user.id, user]));
    return assignmentCounts.map((assignment) => {
      const user = usersById.get(assignment.userId);
      return {
        displayName: user?.name || user?.email || `User #${assignment.userId}`,
        role: user?.role || "UNKNOWN",
        activeCount: assignment._count.id,
      };
    });
  }

  // ========================================
  // REPORT REQUEST DETECTION
  // ========================================

  private checkReportRequest(message: string, userRole: string): string | null {
    const msg = message.toLowerCase();

    const reportPatterns = [
      /\b(generate|create|make|download|export|give me|produce|prepare)\b.*\b(report|excel|spreadsheet|xlsx|csv)\b/i,
      /\b(report|excel|spreadsheet)\b.*\b(generate|create|download|export)\b/i,
      /\b(ticket|data)\b.*\b(report|export)\b/i,
      /\bexcel\b.*\b(report|spreadsheet|export|download|file)\b/i,
    ];

    const isReportRequest = reportPatterns.some((p) => p.test(msg));
    if (!isReportRequest) return null;

    const allowedRoles = [
      "ADMIN",
      "DEVELOPER",
      "TECHNICAL",
      "MIS_HEAD",
      "ITS_HEAD",
      "DIRECTOR",
      "SECRETARY",
    ];
    if (!allowedRoles.includes(userRole)) {
      return "The user is requesting a report but does NOT have the required role. Only Admin and ICT staff roles can generate reports. Politely inform the user that report generation requires admin or staff privileges.";
    }

    // Detect the type of report requested
    let reportType = "full-report";
    if (/status/i.test(msg)) reportType = "ticket-status";
    else if (/categor|type/i.test(msg)) reportType = "ticket-category";
    else if (/priorit/i.test(msg)) reportType = "ticket-priority";
    else if (/month|trend/i.test(msg)) reportType = "ticket-monthly";
    else if (/summar/i.test(msg)) reportType = "ticket-summary";

    const baseUrl = "/reports/download";
    const downloadUrl = `${baseUrl}?type=${reportType}`;

    return `The user is requesting an Excel report. They have the ${userRole} role and ARE authorized.
Provide a download link in this EXACT markdown format:
[📥 Download ${reportType.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} Report](${downloadUrl})

Available report types and their download links:
- Full Report (all data): [📥 Download Full Report](${baseUrl}?type=full-report)
- Ticket Summary: [📥 Download Summary](${baseUrl}?type=ticket-summary)
- By Status: [📥 Download Status Report](${baseUrl}?type=ticket-status)
- By Category: [📥 Download Category Report](${baseUrl}?type=ticket-category)
- By Priority: [📥 Download Priority Report](${baseUrl}?type=ticket-priority)
- Monthly Trend: [📥 Download Monthly Report](${baseUrl}?type=ticket-monthly)

Tell the user which report type you detected based on their request, and offer the other types too. Remind them they can add date filters (from/to) if needed.`;
  }

  // ========================================
  // SLA CONTEXT (Staff/Admin only)
  // ========================================

  private async getSLAContext(
    message: string,
    role: string,
  ): Promise<string | null> {
    try {
      const now = new Date();
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const departmentScope = this.getDepartmentScope(role, message);
      const slaWhere = departmentScope ? { type: departmentScope } : {};

      const [overdueCount, dueTodayCount, dueSoonCount] = await Promise.all([
        // Overdue: dueDate < now AND not resolved/closed
        prisma.ticket.count({
          where: {
            ...slaWhere,
            dueDate: { lt: now },
            status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
          },
        }),
        // Due today
        prisma.ticket.count({
          where: {
            ...slaWhere,
            dueDate: { gte: now, lte: todayEnd },
            status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
          },
        }),
        // Due within 3 days
        prisma.ticket.count({
          where: {
            ...slaWhere,
            dueDate: {
              gte: now,
              lte: new Date(now.getTime() + 3 * 86400000),
            },
            status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
          },
        }),
      ]);

      if (overdueCount === 0 && dueTodayCount === 0 && dueSoonCount === 0) {
        return null;
      }

      const parts: string[] = [];
      if (departmentScope) {
        parts.push(`Scope: ${departmentScope} tickets only`);
      }
      if (overdueCount > 0)
        parts.push(`⚠️ ${overdueCount} ticket(s) are OVERDUE`);
      if (dueTodayCount > 0)
        parts.push(`🔴 ${dueTodayCount} ticket(s) are due TODAY`);
      if (dueSoonCount > 0)
        parts.push(`🟡 ${dueSoonCount} ticket(s) are due within 3 days`);

      return parts.join("\n");
    } catch (err: any) {
      logger.error("[ChatService] SLA context failed:", err.message);
      return null;
    }
  }

  // ========================================
  // GEMINI CALL
  // ========================================

  private async callGemini(
    history: Array<{ role: string; content: string }>,
    currentMessage: string,
    contextData: string,
  ): Promise<string> {
    if (!this.isAvailable()) {
      return this.fallbackResponse(currentMessage, contextData);
    }

    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({ model: config.gemini.model });

      // Build conversation history for Gemini
      const contents: Content[] = [
        { role: "user", parts: [{ text: CHAT_SYSTEM_PROMPT }] },
        {
          role: "model",
          parts: [
            {
              text: "Understood. I'm ready to help users with ICT support issues. I'll use the provided context data to give accurate answers and guide ticket creation when needed.",
            },
          ],
        },
      ];

      // Add conversation history (last 10 messages for context window)
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        contents.push({
          role: msg.role === "USER" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }

      // Add current message with context
      let prompt = currentMessage;
      if (contextData.trim()) {
        prompt = `CONTEXT DATA (from our internal knowledge base and resolved tickets):\n${contextData}\n\nUSER QUESTION: ${currentMessage}`;
      }

      contents.push({ role: "user", parts: [{ text: prompt }] });

      const result = await model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4096,
          topP: 0.9,
        },
      });

      return result.response.text();
    } catch (err: any) {
      logger.error("[ChatService] Gemini call failed:", err.message);
      return this.fallbackResponse(currentMessage, contextData);
    }
  }

  /**
   * Fallback when Gemini is unavailable — return context data directly
   */
  private fallbackResponse(message: string, contextData: string): string {
    if (contextData.trim()) {
      return `I found some relevant information from our knowledge base:\n\n${contextData}\n\nIf this doesn't resolve your issue, I can help you create a support ticket. Just describe your problem in detail.`;
    }
    return "I couldn't find a specific solution for your issue in our knowledge base. Would you like me to help you create a support ticket? Please describe:\n\n1. What is the problem?\n2. What device or system is affected?\n3. When did it start?\n4. Is it affecting other users?";
  }

  // ========================================
  // TICKET CREATION FROM CHAT
  // ========================================

  async createTicketFromChat(
    sessionId: number,
    userId: number,
    ticketData: {
      title: string;
      description: string;
      type: "MIS" | "ITS";
      priority?: string;
      category?: string;
    },
  ) {
    // Verify session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new Error("Chat session not found");
    }

    // Import ticket service dynamically to avoid circular deps
    const { TicketService } =
      await import("../tickets/services/ticket.service");
    const ticketSvc = new TicketService(prisma);

    let ticket: any;
    if (ticketData.type === "MIS") {
      ticket = await ticketSvc.createMISTicket(
        {
          type: "MIS" as any,
          title: ticketData.title,
          description: ticketData.description,
          priority: (ticketData.priority || "MEDIUM") as any,
          category: (ticketData.category || "SOFTWARE") as any,
          controlNumber: "",
        },
        userId,
      );
    } else {
      ticket = await ticketSvc.createITSTicket(
        {
          type: "ITS" as any,
          title: ticketData.title,
          description: ticketData.description,
          priority: (ticketData.priority || "MEDIUM") as any,
        },
        userId,
      );
    }

    // Update session status
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: "TICKET_CREATED",
        ticketId: ticket.id,
      },
    });

    // Save system message about ticket creation
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "SYSTEM",
        content: `Ticket ${ticket.ticketNumber} has been created successfully.`,
        metadata: JSON.stringify({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        }),
      },
    });

    return ticket;
  }
}

export const chatService = new ChatService();
