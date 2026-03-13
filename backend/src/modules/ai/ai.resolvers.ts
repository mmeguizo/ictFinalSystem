import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { geminiService } from "./gemini.service";

export const aiResolvers = {
  Query: {
    smartSuggestions: async (
      _: unknown,
      { title, description }: { title: string; description: string },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");

      const aiAvailable = geminiService.isAvailable();
      let analysis = null;
      let keywords: string[] = [];

      // Run AI analysis if available
      if (aiAvailable && (title.trim() || description.trim())) {
        try {
          analysis = await geminiService.analyzeTicket(title, description);
          keywords = analysis.keywords;
        } catch (err: any) {
          logger.error("[AI] Gemini analysis failed:", err.message);
          // Continue without AI — degrade gracefully
        }
      }

      // If AI didn't produce keywords, extract basic ones from the text
      if (keywords.length === 0) {
        keywords = extractBasicKeywords(title + " " + description);
      }

      // Search for similar tickets using keywords
      const similarTickets = await findSimilarTickets(keywords, 5);

      // Search for related KB articles using keywords
      const relatedArticles = await findRelatedArticles(keywords, 5);

      return {
        analysis,
        similarTickets,
        relatedArticles,
        aiAvailable,
      };
    },

    analyzeTicket: async (
      _: unknown,
      { title, description }: { title: string; description: string },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");

      if (!geminiService.isAvailable()) {
        throw new Error(
          "AI analysis is not available — GEMINI_API_KEY not configured",
        );
      }

      return geminiService.analyzeTicket(title, description);
    },
  },
};

/**
 * Find similar tickets using fulltext search on title+description.
 * Searches resolved/closed tickets first (more useful), then open ones.
 */
async function findSimilarTickets(keywords: string[], limit: number) {
  if (keywords.length === 0) return [];

  // Build fulltext search string: use boolean mode with OR
  const searchTerms = keywords
    .map((k) => k.replace(/[^a-zA-Z0-9\s]/g, "").trim())
    .filter((k) => k.length >= 2)
    .map((k) => `+${k}`)
    .join(" ");

  if (!searchTerms) return [];

  try {
    // Use MySQL fulltext search through raw query for best results
    const tickets = await prisma.$queryRaw<any[]>`
      SELECT id, ticketNumber, title, status, priority, type, createdAt, resolvedAt,
             MATCH(title, description) AGAINST(${searchTerms} IN BOOLEAN MODE) AS relevance
      FROM Ticket
      WHERE MATCH(title, description) AGAINST(${searchTerms} IN BOOLEAN MODE)
      ORDER BY
        CASE WHEN status IN ('RESOLVED', 'CLOSED') THEN 0 ELSE 1 END,
        relevance DESC
      LIMIT ${limit}
    `;

    return tickets.map((t: any) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
      type: t.type,
      createdAt: t.createdAt,
      resolvedAt: t.resolvedAt,
    }));
  } catch (err: any) {
    logger.error("[AI] Fulltext search failed:", err.message);
    // Fallback: simple LIKE search on title
    return fallbackSimilarSearch(keywords, limit);
  }
}

/**
 * Fallback search using LIKE queries when fulltext fails
 */
async function fallbackSimilarSearch(keywords: string[], limit: number) {
  const orConditions = keywords
    .filter((k) => k.length >= 2)
    .slice(0, 5)
    .map((keyword) => ({
      OR: [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
      ],
    }));

  if (orConditions.length === 0) return [];

  return prisma.ticket.findMany({
    where: { OR: orConditions },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      type: true,
      createdAt: true,
      resolvedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Find related Knowledge Base articles using text search
 */
async function findRelatedArticles(keywords: string[], limit: number) {
  if (keywords.length === 0) return [];

  const searchTerms = keywords
    .map((k) => k.replace(/[^a-zA-Z0-9\s]/g, "").trim())
    .filter((k) => k.length >= 2)
    .map((k) => `+${k}`)
    .join(" ");

  if (!searchTerms) return [];

  try {
    // Use MySQL fulltext on KnowledgeArticle
    const articles = await prisma.$queryRaw<any[]>`
      SELECT id, title, content, category, tags, status, viewCount, helpfulCount,
             createdById, createdAt, updatedAt,
             MATCH(title, content) AGAINST(${searchTerms} IN BOOLEAN MODE) AS relevance
      FROM KnowledgeArticle
      WHERE status = 'PUBLISHED'
        AND MATCH(title, content) AGAINST(${searchTerms} IN BOOLEAN MODE)
      ORDER BY relevance DESC
      LIMIT ${limit}
    `;

    return articles.map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category,
      tags: a.tags,
      status: a.status,
      viewCount: a.viewCount,
      helpfulCount: a.helpfulCount,
      createdById: a.createdById,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  } catch (err: any) {
    logger.error("[AI] KB fulltext search failed:", err.message);
    return [];
  }
}

/**
 * Extract basic keywords from text without AI.
 * Removes stop words and returns the most meaningful terms.
 */
function extractBasicKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
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
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "out",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "because",
    "but",
    "and",
    "or",
    "if",
    "while",
    "about",
    "up",
    "down",
    "it",
    "its",
    "my",
    "your",
    "his",
    "her",
    "our",
    "their",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "we",
    "you",
    "he",
    "she",
    "they",
    "them",
    "what",
    "which",
    "who",
    "whom",
    "am",
    "please",
    "help",
    "need",
    "want",
    "also",
    "get",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  // Return unique keywords, max 8
  return [...new Set(words)].slice(0, 8);
}
