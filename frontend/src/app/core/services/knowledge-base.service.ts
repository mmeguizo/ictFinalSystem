import { inject, Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable } from 'rxjs';

export interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  viewCount: number;
  helpfulCount: number;
  createdById: number;
  createdBy: { id: number; name: string; role: string };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedArticles {
  items: KnowledgeArticle[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

const ARTICLE_FIELDS = `
  id
  title
  content
  category
  tags
  status
  viewCount
  helpfulCount
  createdById
  createdBy { id name role }
  createdAt
  updatedAt
`;

const GET_ARTICLES = gql`
  query KnowledgeArticles($filter: ArticleFilterInput, $pagination: PaginationInput) {
    knowledgeArticles(filter: $filter, pagination: $pagination) {
      items { ${ARTICLE_FIELDS} }
      totalCount
      page
      pageSize
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
`;

const GET_ARTICLE = gql`
  query KnowledgeArticle($id: Int!) {
    knowledgeArticle(id: $id) { ${ARTICLE_FIELDS} }
  }
`;

const GET_CATEGORIES = gql`
  query KnowledgeCategories {
    knowledgeCategories
  }
`;

const CREATE_ARTICLE = gql`
  mutation CreateArticle($input: CreateArticleInput!) {
    createArticle(input: $input) { ${ARTICLE_FIELDS} }
  }
`;

const UPDATE_ARTICLE = gql`
  mutation UpdateArticle($id: Int!, $input: UpdateArticleInput!) {
    updateArticle(id: $id, input: $input) { ${ARTICLE_FIELDS} }
  }
`;

const DELETE_ARTICLE = gql`
  mutation DeleteArticle($id: Int!) {
    deleteArticle(id: $id)
  }
`;

const MARK_HELPFUL = gql`
  mutation MarkArticleHelpful($id: Int!) {
    markArticleHelpful(id: $id) { ${ARTICLE_FIELDS} }
  }
`;

@Injectable({ providedIn: 'root' })
export class KnowledgeBaseService {
  private readonly apollo = inject(Apollo);

  getArticles(
    filter?: { category?: string; status?: string; search?: string },
    pagination?: { page?: number; pageSize?: number },
  ): Observable<PaginatedArticles> {
    return this.apollo
      .query<{ knowledgeArticles: PaginatedArticles }>({
        query: GET_ARTICLES,
        variables: { filter, pagination },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data!.knowledgeArticles));
  }

  getArticle(id: number): Observable<KnowledgeArticle> {
    return this.apollo
      .query<{ knowledgeArticle: KnowledgeArticle }>({
        query: GET_ARTICLE,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data!.knowledgeArticle));
  }

  getCategories(): Observable<string[]> {
    return this.apollo
      .query<{ knowledgeCategories: string[] }>({
        query: GET_CATEGORIES,
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data!.knowledgeCategories));
  }

  createArticle(input: {
    title: string;
    content: string;
    category: string;
    tags?: string;
    status?: string;
  }): Observable<KnowledgeArticle> {
    return this.apollo
      .mutate<{ createArticle: KnowledgeArticle }>({
        mutation: CREATE_ARTICLE,
        variables: { input },
      })
      .pipe(map((r) => r.data!.createArticle));
  }

  updateArticle(
    id: number,
    input: { title?: string; content?: string; category?: string; tags?: string; status?: string },
  ): Observable<KnowledgeArticle> {
    return this.apollo
      .mutate<{ updateArticle: KnowledgeArticle }>({
        mutation: UPDATE_ARTICLE,
        variables: { id, input },
      })
      .pipe(map((r) => r.data!.updateArticle));
  }

  deleteArticle(id: number): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteArticle: boolean }>({
        mutation: DELETE_ARTICLE,
        variables: { id },
      })
      .pipe(map((r) => r.data!.deleteArticle));
  }

  markHelpful(id: number): Observable<KnowledgeArticle> {
    return this.apollo
      .mutate<{ markArticleHelpful: KnowledgeArticle }>({
        mutation: MARK_HELPFUL,
        variables: { id },
      })
      .pipe(map((r) => r.data!.markArticleHelpful));
  }
}
