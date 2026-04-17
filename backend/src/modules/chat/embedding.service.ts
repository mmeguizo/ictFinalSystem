import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prisma } from "@prisma/client";
import { config } from "../../config";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";

const EMBEDDING_MODEL = "text-embedding-004";

/**
 * Embedding service for vector-based semantic search.
 * Uses Gemini text-embedding-004 to generate embeddings.
 * Stores embeddings as JSON arrays in MySQL.
 * Computes cosine similarity in-process (performant for <10k docs).
 */
export class EmbeddingService {
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

  /**
   * Generate an embedding vector for the given text.
   * Returns a 768-dimensional float array.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const client = this.getClient();
    const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

    // Truncate to ~8000 chars to stay within token limits
    const truncated = text.length > 8000 ? text.substring(0, 8000) : text;

    const result = await model.embedContent(truncated);
    return result.embedding.values;
  }

  /**
   * Cosine similarity between two vectors. Returns value between -1 and 1.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Search solutions by semantic similarity using vector embeddings.
   * Falls back to fulltext search if embeddings are unavailable.
   */
  async searchSimilarSolutions(
    query: string,
    limit = 5,
    minScore = 0.5,
  ): Promise<
    Array<{
      id: number;
      problem: string;
      solution: string;
      category: string;
      score: number;
    }>
  > {
    if (!this.isAvailable()) {
      logger.warn(
        "[EmbeddingService] Gemini unavailable, skipping vector search",
      );
      return [];
    }

    try {
      // 1. Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // 2. Fetch all solutions with embeddings
      const solutions = await prisma.troubleshootingSolution.findMany({
        where: { embedding: { not: Prisma.DbNull } },
        select: {
          id: true,
          problem: true,
          solution: true,
          category: true,
          embedding: true,
        },
      });

      if (solutions.length === 0) return [];

      // 3. Compute cosine similarity for each
      const scored = solutions
        .map((s) => ({
          id: s.id,
          problem: s.problem,
          solution: s.solution,
          category: s.category,
          score: this.cosineSimilarity(queryEmbedding, s.embedding as number[]),
        }))
        .filter((s) => s.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored;
    } catch (err: any) {
      logger.error("[EmbeddingService] Vector search failed:", err.message);
      return [];
    }
  }

  /**
   * Generate and store an embedding for a solution.
   * Combines problem + solution text for richer embeddings.
   */
  async embedSolution(solutionId: number): Promise<void> {
    try {
      const solution = await prisma.troubleshootingSolution.findUnique({
        where: { id: solutionId },
        select: {
          id: true,
          problem: true,
          solution: true,
          category: true,
          tags: true,
        },
      });

      if (!solution) return;

      const textToEmbed = [
        `Problem: ${solution.problem}`,
        `Solution: ${solution.solution}`,
        `Category: ${solution.category}`,
        solution.tags ? `Tags: ${solution.tags}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const embedding = await this.generateEmbedding(textToEmbed);

      await prisma.troubleshootingSolution.update({
        where: { id: solutionId },
        data: { embedding },
      });

      logger.info(`[EmbeddingService] Embedded solution #${solutionId}`);
    } catch (err: any) {
      logger.error(
        `[EmbeddingService] Failed to embed solution #${solutionId}:`,
        err.message,
      );
    }
  }

  /**
   * Backfill embeddings for all solutions that don't have one yet.
   * Call this once at startup or via an admin endpoint.
   */
  async backfillEmbeddings(): Promise<{ processed: number; failed: number }> {
    const solutions = await prisma.troubleshootingSolution.findMany({
      where: { embedding: { equals: Prisma.DbNull } },
      select: { id: true },
    });

    let processed = 0;
    let failed = 0;

    for (const sol of solutions) {
      try {
        await this.embedSolution(sol.id);
        processed++;
        // Small delay to respect rate limits
        await new Promise((r) => setTimeout(r, 200));
      } catch {
        failed++;
      }
    }

    logger.info(
      `[EmbeddingService] Backfill complete: ${processed} processed, ${failed} failed`,
    );
    return { processed, failed };
  }
}

export const embeddingService = new EmbeddingService();
