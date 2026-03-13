import { PrismaClient, ArticleStatus } from "@prisma/client";
import { KBRepository, ArticleFilter, PaginationParams } from "./kb.repository";

export class KBService {
  private readonly repo: KBRepository;

  constructor(prisma: PrismaClient) {
    this.repo = new KBRepository(prisma);
  }

  async getArticles(filter?: ArticleFilter, pagination?: PaginationParams) {
    return this.repo.findMany(filter, pagination);
  }

  async getArticle(id: number) {
    const article = await this.repo.findById(id);
    if (!article) throw new Error("Article not found");

    // Increment view count (fire-and-forget)
    this.repo.incrementView(id).catch(() => {});

    return article;
  }

  async createArticle(
    input: {
      title: string;
      content: string;
      category: string;
      tags?: string;
      status?: ArticleStatus;
    },
    userId: number,
  ) {
    return this.repo.create(input, userId);
  }

  async updateArticle(
    id: number,
    input: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string;
      status?: ArticleStatus;
    },
    userId: number,
    userRole: string,
  ) {
    const article = await this.repo.findById(id);
    if (!article) throw new Error("Article not found");

    // Only author or admin can edit
    if (article.createdById !== userId && userRole !== "ADMIN") {
      throw new Error("Not authorized to edit this article");
    }

    return this.repo.update(id, input);
  }

  async deleteArticle(id: number, userId: number, userRole: string) {
    const article = await this.repo.findById(id);
    if (!article) throw new Error("Article not found");

    if (article.createdById !== userId && userRole !== "ADMIN") {
      throw new Error("Not authorized to delete this article");
    }

    return this.repo.delete(id);
  }

  async markHelpful(id: number) {
    return this.repo.incrementHelpful(id);
  }

  async getCategories() {
    return this.repo.getCategories();
  }
}
