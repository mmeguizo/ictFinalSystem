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

const CHAT_SYSTEM_PROMPT = `You are an AI support assistant for the CHMSU ICT Department help desk.
Your role is to help users resolve their ICT issues by providing step-by-step troubleshooting guidance.

IMPORTANT RULES:
1. ALWAYS try to answer from the provided CONTEXT DATA first (knowledge base articles, resolved tickets, troubleshooting solutions).
2. If you find a relevant solution in the context, provide clear step-by-step instructions.
3. If you cannot find a solution in the context, use your general ICT knowledge to help.
4. If the issue seems complex or requires physical intervention, suggest creating a support ticket.
5. Be friendly, professional, and concise.
6. When suggesting ticket creation, ask the user to describe their problem in detail so you can help fill out the ticket.
7. Never make up specific ticket numbers or staff names.
8. Format responses with markdown for readability (bullet points, numbered steps, bold for emphasis).

WHEN ASKED ABOUT TICKET STATUS:
- If ticket data is provided in context, report the status accurately.
- Include: ticket number, current status, assigned staff (if any), and any recent updates.

WHEN ASKED ABOUT ANALYTICS OR STATISTICS:
- If analytics data is provided in context, present it clearly with formatting.
- Use tables, bullet points, or numbered lists for readability.
- You can report: tickets per day/week/month, tickets by status/category/priority, most common issues, resolution times, and staff workload.
- Be accurate — only report numbers from the data provided.

WHEN GUIDING TICKET CREATION:
- Ask for: What is the problem? What device/system is affected? When did it start? Is it affecting others?
- Once you have enough info, respond with a JSON block wrapped in \`\`\`ticket-data tags:
\`\`\`ticket-data
{"title": "...", "description": "...", "type": "MIS or ITS", "priority": "LOW/MEDIUM/HIGH/CRITICAL"}
\`\`\`

CATEGORIES:
- MIS (Management Information Systems): Website issues, software problems
- ITS (Information Technology Services): Hardware, network, printer, device borrowing`;

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
    // 1. Verify session ownership
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 20 },
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

    // 3b. Check if this is an analytics/statistics query
    const analyticsContext = await this.checkAnalyticsQuery(userMessage);

    // 4. Search for relevant context (RAG — fulltext + vector)
    const ragContext = await this.retrieveContext(userMessage);

    // 5. Build context string
    let contextStr = "";

    if (ticketContext) {
      contextStr += "\n--- TICKET STATUS DATA ---\n" + ticketContext + "\n";
    }

    if (analyticsContext) {
      contextStr += "\n--- ANALYTICS DATA ---\n" + analyticsContext + "\n";
    }

    if (ragContext.kbArticles.length > 0) {
      contextStr += "\n--- KNOWLEDGE BASE ARTICLES ---\n";
      for (const article of ragContext.kbArticles) {
        contextStr += `Title: ${article.title}\nCategory: ${article.category}\nContent: ${article.content.substring(0, 500)}\n\n`;
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
    const keywords = query
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .map((k) => k.replace(/[^a-zA-Z0-9]/g, ""))
      .filter(Boolean)
      .slice(0, 10);

    const [kbArticles, resolvedTickets, fulltextSolutions, vectorSolutions] =
      await Promise.all([
        this.searchKBArticles(keywords),
        this.searchResolvedTickets(keywords),
        solutionService.searchForContext(query, 3),
        embeddingService.searchSimilarSolutions(query, 3, 0.45),
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

    const searchTerms = keywords.map((k) => `+${k}`).join(" ");

    try {
      return await prisma.$queryRaw<any[]>`
        SELECT id, title, content, category
        FROM KnowledgeArticle
        WHERE status = 'PUBLISHED'
          AND MATCH(title, content) AGAINST(${searchTerms} IN BOOLEAN MODE)
        ORDER BY MATCH(title, content) AGAINST(${searchTerms} IN BOOLEAN MODE) DESC
        LIMIT 3
      `;
    } catch {
      // Fallback to LIKE search
      return prisma.knowledgeArticle.findMany({
        where: {
          status: "PUBLISHED",
          OR: keywords.slice(0, 3).map((kw) => ({
            OR: [{ title: { contains: kw } }, { content: { contains: kw } }],
          })),
        },
        select: { id: true, title: true, content: true, category: true },
        take: 3,
      });
    }
  }

  private async searchResolvedTickets(keywords: string[]): Promise<any[]> {
    if (keywords.length === 0) return [];

    const searchTerms = keywords.map((k) => `+${k}`).join(" ");

    try {
      return await prisma.$queryRaw<any[]>`
        SELECT id, title, description, resolution
        FROM Ticket
        WHERE status IN ('RESOLVED', 'CLOSED')
          AND resolution IS NOT NULL
          AND MATCH(title, description) AGAINST(${searchTerms} IN BOOLEAN MODE)
        ORDER BY MATCH(title, description) AGAINST(${searchTerms} IN BOOLEAN MODE) DESC
        LIMIT 3
      `;
    } catch {
      return prisma.ticket.findMany({
        where: {
          status: { in: ["RESOLVED", "CLOSED"] },
          resolution: { not: null },
          OR: keywords.slice(0, 3).map((kw) => ({
            OR: [
              { title: { contains: kw } },
              { description: { contains: kw } },
            ],
          })),
        },
        select: { id: true, title: true, description: true, resolution: true },
        take: 3,
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

      return results.length > 0 ? results.join("\n") : null;
    } catch (err: any) {
      logger.error("[ChatService] Analytics query failed:", err.message);
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
          temperature: 0.7,
          maxOutputTokens: 1024,
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
