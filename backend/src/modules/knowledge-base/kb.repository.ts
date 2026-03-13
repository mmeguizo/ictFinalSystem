import { PrismaClient, Prisma, ArticleStatus } from "@prisma/client";

export interface ArticleFilter {
  category?: string;
  status?: ArticleStatus;
  search?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: string;
}

const ARTICLE_INCLUDE = {
  createdBy: true,
} satisfies Prisma.KnowledgeArticleInclude;

export class KBRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private normalizePagination(params?: PaginationParams) {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 20));
    const sortField = params?.sortField || "createdAt";
    const sortOrder = (
      params?.sortOrder === "asc" ? "asc" : "desc"
    ) as Prisma.SortOrder;
    const skip = (page - 1) * pageSize;
    return { page, pageSize, sortField, sortOrder, skip };
  }

  async findMany(filter?: ArticleFilter, pagination?: PaginationParams) {
    const { page, pageSize, sortField, sortOrder, skip } =
      this.normalizePagination(pagination);

    const where: Prisma.KnowledgeArticleWhereInput = {};

    if (filter?.category) {
      where.category = filter.category;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.search) {
      where.OR = [
        { title: { contains: filter.search } },
        { content: { contains: filter.search } },
        { tags: { contains: filter.search } },
      ];
    }

    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.knowledgeArticle.findMany({
        where,
        include: ARTICLE_INCLUDE,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: pageSize,
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);
    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async findById(id: number) {
    return this.prisma.knowledgeArticle.findUnique({
      where: { id },
      include: ARTICLE_INCLUDE,
    });
  }

  async create(
    data: {
      title: string;
      content: string;
      category: string;
      tags?: string;
      status?: ArticleStatus;
    },
    createdById: number,
  ) {
    return this.prisma.knowledgeArticle.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags,
        status: data.status || "DRAFT",
        createdById,
      },
      include: ARTICLE_INCLUDE,
    });
  }

  async update(
    id: number,
    data: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string;
      status?: ArticleStatus;
    },
  ) {
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data,
      include: ARTICLE_INCLUDE,
    });
  }

  async delete(id: number) {
    await this.prisma.knowledgeArticle.delete({ where: { id } });
    return true;
  }

  async incrementView(id: number) {
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      include: ARTICLE_INCLUDE,
    });
  }

  async incrementHelpful(id: number) {
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
      include: ARTICLE_INCLUDE,
    });
  }

  async getCategories() {
    const results = await this.prisma.knowledgeArticle.findMany({
      where: { status: "PUBLISHED" },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    return results.map((r) => r.category);
  }
}
