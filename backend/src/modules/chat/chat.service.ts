import { GoogleGenerativeAI, Content } from "@google/generative-ai";
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
- ADMIN: Full access — analytics, reports, all features. Can ask for any data.
- ICT_STAFF / SUPERVISOR: Can access analytics and reports. Cannot perform admin-level mutations.
- USER (regular user): Can ONLY ask about troubleshooting, knowledge base solutions, their own ticket status, and create new tickets. Do NOT provide analytics, statistics, reports, or staff-level features to regular users. If they ask for analytics, politely explain that feature is available to ICT staff only.
- If an ACCESS LEVEL restriction notice is in the context, strictly follow it.

CONTEXT DATA RULES:
1. ALWAYS check the provided CONTEXT DATA first (knowledge base articles, resolved tickets, troubleshooting solutions). This is your PRIMARY source of truth.
2. When context data is provided, you MUST use it. Synthesize and present the information clearly — do not ignore it.
3. When referencing a Knowledge Base article, include a clickable link: [KB: Article Title](kb:ARTICLE_ID) — replace ARTICLE_ID with the actual numeric ID.
4. When multiple context sources are relevant, combine them into a comprehensive answer.
5. If NO relevant context is provided, use your general ICT knowledge confidently. Note: "Based on general ICT best practices:" before the answer.
6. For issues requiring physical intervention (hardware failure, cable issues), suggest creating a support ticket.

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

    // 3b. Role-gated: Analytics queries only for staff/admin
    const userRole = session.user?.role || "USER";
    const staffRoles = ["ADMIN", "ICT_STAFF", "SUPERVISOR"];
    const isStaffOrAdmin = staffRoles.includes(userRole);

    const analyticsContext = isStaffOrAdmin
      ? await this.checkAnalyticsQuery(userMessage)
      : null;

    // 3c. Report generation (already role-checked internally, but skip entirely for regular users)
    const reportContext = isStaffOrAdmin
      ? this.checkReportRequest(userMessage, userRole)
      : null;

    // 3d. SLA context for staff/admin — proactive SLA awareness
    const slaContext = isStaffOrAdmin
      ? await this.getSLAContext()
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

    if (reportContext) {
      contextStr += "\n--- REPORT GENERATION ---\n" + reportContext + "\n";
    }

    if (slaContext) {
      contextStr += "\n--- SLA WARNINGS ---\n" + slaContext + "\n";
    }

    // For regular users, add a role restriction notice so the AI doesn't offer staff features
    if (!isStaffOrAdmin) {
      contextStr += "\n--- ACCESS LEVEL ---\nThis user has a regular USER role. Do NOT offer analytics, statistics, reports, or any admin/staff features. Only help with troubleshooting, knowledge base lookups, checking their own ticket status, and creating new tickets.\n";
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
        contextStr += `Issue: ${ticket.title}\nDescription: ${ticket.description?.substring(0, 300) || "N/A"}\nResolution: ${ticket.resolution || "Resolved"}\n\n`;
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
        SELECT id, title, description, resolution
        FROM Ticket
        WHERE status IN ('RESOLVED', 'CLOSED')
          AND resolution IS NOT NULL
          AND MATCH(title, description) AGAINST(${searchTerms} IN BOOLEAN MODE)
        ORDER BY MATCH(title, description) AGAINST(${searchTerms} IN BOOLEAN MODE) DESC
        LIMIT 5
      `;
    } catch {
      return prisma.ticket.findMany({
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
        select: { id: true, title: true, description: true, resolution: true },
        take: 5,
      });
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

  private async checkAnalyticsQuery(message: string): Promise<string | null> {
    const msg = message.toLowerCase();

    // Detect analytics/statistics questions
    const analyticsPatterns = [
      /how many\s+(ticket|request|issue)/i,
      /ticket.*(stat|analytic|report|count|total|summary)/i,
      /(stat|analytic|report|summary|dashboard|overview).*(ticket|request|issue)/i,
      /most\s+(common|frequent|painful|problematic|recurring)/i,
      /ticket.*(per|by)\s+(day|week|month|category|status|priority|type)/i,
      /(average|mean|median).*(resolution|response|time)/i,
      /\b(workload|performance|productivity)\b/i,
      /(busiest|peak|slowest)\s*(day|time|period|month)/i,
      /\b(sla|overdue|due|deadline|compliance|breach)\b/i,
      /\b(unresolved|pending|backlog)\b.*\b(ticket|request)\b/i,
    ];

    const isAnalytics = analyticsPatterns.some((p) => p.test(msg));
    if (!isAnalytics) return null;

    try {
      const results: string[] = [];

      // Overall ticket counts by status
      const statusCounts = await prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      });
      if (statusCounts.length > 0) {
        results.push("**Tickets by Status:**");
        const total = statusCounts.reduce((sum, s) => sum + s._count.id, 0);
        results.push(`Total tickets: ${total}`);
        for (const s of statusCounts) {
          results.push(`- ${s.status}: ${s._count.id}`);
        }
      }

      // Tickets by category (type)
      const typeCounts = await prisma.ticket.groupBy({
        by: ["type"],
        _count: { id: true },
      });
      if (typeCounts.length > 0) {
        results.push("\n**Tickets by Type:**");
        for (const t of typeCounts) {
          results.push(`- ${t.type}: ${t._count.id}`);
        }
      }

      // Tickets by priority
      const priorityCounts = await prisma.ticket.groupBy({
        by: ["priority"],
        _count: { id: true },
      });
      if (priorityCounts.length > 0) {
        results.push("\n**Tickets by Priority:**");
        for (const p of priorityCounts) {
          results.push(`- ${p.priority}: ${p._count.id}`);
        }
      }

      // Tickets created today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = await prisma.ticket.count({
        where: { createdAt: { gte: todayStart } },
      });
      results.push(`\n**Today's tickets**: ${todayCount}`);

      // Tickets this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekCount = await prisma.ticket.count({
        where: { createdAt: { gte: weekStart } },
      });
      results.push(`**This week's tickets**: ${weekCount}`);

      // Tickets this month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthCount = await prisma.ticket.count({
        where: { createdAt: { gte: monthStart } },
      });
      results.push(`**This month's tickets**: ${monthCount}`);

      // Most common ticket titles (recurring issues)
      const commonIssues = await prisma.$queryRaw<
        Array<{ title: string; count: bigint }>
      >`
        SELECT title, COUNT(*) as count
        FROM Ticket
        GROUP BY title
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 5
      `;
      if (commonIssues.length > 0) {
        results.push("\n**Most Recurring Issues:**");
        for (const issue of commonIssues) {
          results.push(`- "${issue.title}" — ${issue.count} tickets`);
        }
      }

      // Average resolution time (for resolved tickets)
      const avgResolution = await prisma.$queryRaw<
        Array<{ avg_hours: number | null }>
      >`
        SELECT AVG(TIMESTAMPDIFF(HOUR, createdAt, resolvedAt)) as avg_hours
        FROM Ticket
        WHERE resolvedAt IS NOT NULL
      `;
      if (avgResolution[0]?.avg_hours) {
        const hours = Math.round(avgResolution[0].avg_hours);
        results.push(
          `\n**Average Resolution Time**: ${hours >= 24 ? `${Math.round(hours / 24)} days` : `${hours} hours`}`,
        );
      }

      // Unresolved tickets older than 7 days (painful tickets)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const overdue = await prisma.ticket.findMany({
        where: {
          status: {
            notIn: ["RESOLVED", "CLOSED", "CANCELLED"],
          },
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
      if (overdue.length > 0) {
        results.push("\n**Overdue Tickets (>7 days unresolved):**");
        for (const t of overdue) {
          const daysOld = Math.round(
            (Date.now() - new Date(t.createdAt).getTime()) / 86400000,
          );
          results.push(
            `- ${t.ticketNumber}: ${t.title} — ${t.status} — ${t.priority} — ${daysOld} days old`,
          );
        }
      }

      // Staff workload — tickets assigned per staff member
      const workload = await prisma.$queryRaw<
        Array<{ name: string; role: string; count: bigint }>
      >`
        SELECT u.name, u.role, COUNT(ta.id) as count
        FROM TicketAssignment ta
        JOIN User u ON ta.userId = u.id
        JOIN Ticket t ON ta.ticketId = t.id
        WHERE t.status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')
        GROUP BY u.id, u.name, u.role
        ORDER BY count DESC
        LIMIT 10
      `;
      if (workload.length > 0) {
        results.push("\n**Current Staff Workload (active tickets):**");
        for (const w of workload) {
          results.push(`- ${w.name} (${w.role}): ${w.count} active ticket(s)`);
        }
      }

      // SLA compliance — tickets with dueDate
      const slaTotal = await prisma.ticket.count({
        where: { dueDate: { not: null } },
      });
      const slaMet = await prisma.ticket.count({
        where: {
          dueDate: { not: null },
          status: { in: ["RESOLVED", "CLOSED"] },
          resolvedAt: { not: null },
        },
      });
      if (slaTotal > 0) {
        const complianceRate =
          slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : 0;
        results.push(
          `\n**SLA Compliance**: ${slaMet}/${slaTotal} tickets resolved within SLA (${complianceRate}%)`,
        );
      }

      return results.length > 0 ? results.join("\n") : null;
    } catch (err: any) {
      logger.error("[ChatService] Analytics query failed:", err.message);
      return null;
    }
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
      /\bexcel\b/i,
    ];

    const isReportRequest = reportPatterns.some((p) => p.test(msg));
    if (!isReportRequest) return null;

    const allowedRoles = ["ADMIN", "ICT_STAFF", "SUPERVISOR"];
    if (!allowedRoles.includes(userRole)) {
      return "The user is requesting a report but does NOT have the required role. Only Admin, ICT Staff, and Supervisor roles can generate reports. Politely inform the user that report generation requires admin or staff privileges.";
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

  private async getSLAContext(): Promise<string | null> {
    try {
      const now = new Date();
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const [overdueCount, dueTodayCount, dueSoonCount] = await Promise.all([
        // Overdue: dueDate < now AND not resolved/closed
        prisma.ticket.count({
          where: {
            dueDate: { lt: now },
            status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
          },
        }),
        // Due today
        prisma.ticket.count({
          where: {
            dueDate: { gte: now, lte: todayEnd },
            status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
          },
        }),
        // Due within 3 days
        prisma.ticket.count({
          where: {
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
          category: "SOFTWARE" as any,
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
