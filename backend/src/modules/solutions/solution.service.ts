import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { embeddingService } from "../chat/embedding.service";

export class SolutionService {
  /**
   * List solutions with optional filters, pagination, and full-text search
   */
  async getSolutions(
    filter?: { category?: string; search?: string },
    page = 1,
    pageSize = 20,
  ) {
    const where: any = {};

    if (filter?.category) {
      where.category = filter.category;
    }

    if (filter?.search) {
      where.OR = [
        { problem: { contains: filter.search } },
        { solution: { contains: filter.search } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      prisma.troubleshootingSolution.findMany({
        where,
        include: { createdBy: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.troubleshootingSolution.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);
    return { items, totalCount, page, pageSize, totalPages };
  }

  /**
   * Get a single solution by ID
   */
  async getSolutionById(id: number) {
    return prisma.troubleshootingSolution.findUnique({
      where: { id },
      include: { createdBy: true },
    });
  }

  /**
   * Create a new solution (staff only)
   */
  async createSolution(
    userId: number,
    input: {
      problem: string;
      solution: string;
      category: string;
      tags?: string;
      ticketId?: number;
    },
  ) {
    const record = await prisma.troubleshootingSolution.create({
      data: {
        problem: input.problem,
        solution: input.solution,
        category: input.category,
        tags: input.tags || null,
        ticketId: input.ticketId || null,
        createdById: userId,
      },
      include: { createdBy: true },
    });

    // Generate embedding asynchronously (don't block the response)
    embeddingService.embedSolution(record.id).catch((err) => {
      logger.error(
        `[SolutionService] Embedding failed for #${record.id}:`,
        err.message,
      );
    });

    return record;
  }

  /**
   * Update an existing solution
   */
  async updateSolution(
    id: number,
    input: {
      problem?: string;
      solution?: string;
      category?: string;
      tags?: string;
    },
  ) {
    const record = await prisma.troubleshootingSolution.update({
      where: { id },
      data: input,
      include: { createdBy: true },
    });

    // Re-generate embedding if content changed
    if (input.problem || input.solution) {
      embeddingService.embedSolution(record.id).catch((err) => {
        logger.error(
          `[SolutionService] Re-embedding failed for #${record.id}:`,
          err.message,
        );
      });
    }

    return record;
  }

  /**
   * Delete a solution
   */
  async deleteSolution(id: number) {
    await prisma.troubleshootingSolution.delete({ where: { id } });
    return true;
  }

  /**
   * Full-text search solutions for AI context retrieval
   */
  async searchForContext(query: string, limit = 5): Promise<any[]> {
    // Extract meaningful keywords, filter stop words
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
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "my",
      "your",
      "what",
      "which",
      "who",
      "how",
      "when",
      "where",
      "why",
      "not",
      "no",
      "but",
      "and",
      "or",
      "if",
      "then",
      "so",
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
      "please",
      "know",
      "check",
      "tell",
      "show",
      "many",
      "much",
      "any",
    ]);

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .map((k) => k.replace(/[^a-zA-Z0-9]/g, ""))
      .filter((w) => w.length >= 3 && !stopWords.has(w))
      .slice(0, 8);

    if (keywords.length === 0) return [];

    // Use OR-based search (natural language mode) for better recall
    const searchTerms = keywords.join(" ");

    try {
      return await prisma.$queryRaw<any[]>`
        SELECT id, problem, solution, category, tags
        FROM TroubleshootingSolution
        WHERE MATCH(problem, solution) AGAINST(${searchTerms} IN BOOLEAN MODE)
        ORDER BY MATCH(problem, solution) AGAINST(${searchTerms} IN BOOLEAN MODE) DESC
        LIMIT ${limit}
      `;
    } catch (err: any) {
      logger.error("[Solutions] Fulltext search failed:", err.message);
      // Fallback to LIKE
      return prisma.troubleshootingSolution.findMany({
        where: {
          OR: keywords.slice(0, 5).map((kw) => ({
            OR: [{ problem: { contains: kw } }, { solution: { contains: kw } }],
          })),
        },
        select: {
          id: true,
          problem: true,
          solution: true,
          category: true,
          tags: true,
        },
        take: limit,
      });
    }
  }

  /**
   * Auto-create a TroubleshootingSolution from a resolved ticket.
   * Called by ticket.service when a resolution is saved.
   * Skips if a solution already exists for this ticketId.
   */
  async createFromResolvedTicket(
    ticketId: number,
    resolvedById: number,
    visibility: string = "INTERNAL",
  ): Promise<void> {
    try {
      // Skip if solution already exists for this ticket
      const existing = await prisma.troubleshootingSolution.findFirst({
        where: { ticketId },
      });
      if (existing) {
        logger.info(
          `[SolutionService] Solution already exists for ticket #${ticketId}, skipping`,
        );
        return;
      }

      // Fetch ticket with notes for rich context
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          misTicket: true,
          notes: {
            where: { isInternal: false },
            orderBy: { createdAt: "asc" },
            include: { user: { select: { name: true } } },
          },
        },
      });

      if (!ticket || !ticket.resolution) return;

      // Build the problem description from ticket data
      const problem = [ticket.title, ticket.description]
        .filter(Boolean)
        .join("\n\n");

      // Build the solution from resolution + relevant notes
      const notesText = ticket.notes
        .map((n: any) => `${n.user.name}: ${n.content}`)
        .join("\n");

      const solution = [
        ticket.resolution,
        notesText ? `\nAdditional Notes:\n${notesText}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      // Determine category from ticket type / MIS category
      const category =
        ticket.misTicket?.category ||
        this.inferCategory(ticket.title, ticket.description || "");

      // Auto-generate tags from title keywords
      const tags = ticket.title
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
        .map((w: string) => w.toLowerCase())
        .slice(0, 5)
        .join(",");

      const record = await prisma.troubleshootingSolution.create({
        data: {
          problem,
          solution,
          category,
          tags: tags || null,
          visibility: visibility === "PUBLIC" ? "PUBLIC" : "INTERNAL",
          ticketId,
          createdById: resolvedById,
        },
      });

      // Generate embedding asynchronously
      embeddingService.embedSolution(record.id).catch((err) => {
        logger.error(
          `[SolutionService] Embedding failed for auto-solution #${record.id}:`,
          err.message,
        );
      });

      logger.info(
        `[SolutionService] Auto-created solution #${record.id} from ticket #${ticketId}`,
      );
    } catch (err: any) {
      logger.error(
        `[SolutionService] Failed to create solution from ticket #${ticketId}:`,
        err.message,
      );
    }
  }

  /**
   * Infer category from ticket title/description when no MIS category exists.
   */
  private inferCategory(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    if (/network|wifi|internet|lan|connection|dns/.test(text)) return "NETWORK";
    if (/printer|print|toner|paper/.test(text)) return "PRINTER";
    if (/account|password|login|access|credential/.test(text)) return "ACCOUNT";
    if (/hardware|monitor|keyboard|mouse|laptop|pc|computer/.test(text))
      return "HARDWARE";
    if (/virus|malware|security|threat|hack/.test(text)) return "SECURITY";
    if (/software|install|update|app|system|website/.test(text))
      return "SOFTWARE";
    return "OTHER";
  }
}

export const solutionService = new SolutionService();
