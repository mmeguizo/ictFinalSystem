import { gql } from "apollo-server-express";

export const kbTypeDefs = gql`
  enum ArticleStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
  }

  type KnowledgeArticle {
    id: Int!
    title: String!
    content: String!
    category: String!
    tags: String
    status: ArticleStatus!
    viewCount: Int!
    helpfulCount: Int!
    createdById: Int!
    createdBy: User!
    createdAt: String!
    updatedAt: String!
  }

  type PaginatedArticles {
    items: [KnowledgeArticle!]!
    totalCount: Int!
    page: Int!
    pageSize: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  input CreateArticleInput {
    title: String!
    content: String!
    category: String!
    tags: String
    status: ArticleStatus
  }

  input UpdateArticleInput {
    title: String
    content: String
    category: String
    tags: String
    status: ArticleStatus
  }

  input ArticleFilterInput {
    category: String
    status: ArticleStatus
    search: String
  }

  extend type Query {
    knowledgeArticles(
      filter: ArticleFilterInput
      pagination: PaginationInput
    ): PaginatedArticles!
    knowledgeArticle(id: Int!): KnowledgeArticle
    knowledgeCategories: [String!]!
  }

  extend type Mutation {
    createArticle(input: CreateArticleInput!): KnowledgeArticle!
    updateArticle(id: Int!, input: UpdateArticleInput!): KnowledgeArticle!
    deleteArticle(id: Int!): Boolean!
    markArticleHelpful(id: Int!): KnowledgeArticle!
  }
`;
