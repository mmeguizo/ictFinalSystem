import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable } from 'rxjs';

const GET_SOLUTIONS = gql`
  query GetSolutions($filter: SolutionFilterInput, $page: Int, $pageSize: Int) {
    troubleshootingSolutions(filter: $filter, page: $page, pageSize: $pageSize) {
      items {
        id
        problem
        solution
        category
        tags
        ticketId
        createdAt
        createdBy {
          id
          name
          role
        }
      }
      totalCount
      page
      pageSize
      totalPages
    }
  }
`;

const CREATE_SOLUTION = gql`
  mutation CreateSolution($input: CreateSolutionInput!) {
    createSolution(input: $input) {
      id
      problem
      solution
      category
      tags
      createdAt
    }
  }
`;

const UPDATE_SOLUTION = gql`
  mutation UpdateSolution($id: Int!, $input: UpdateSolutionInput!) {
    updateSolution(id: $id, input: $input) {
      id
      problem
      solution
      category
      tags
    }
  }
`;

const DELETE_SOLUTION = gql`
  mutation DeleteSolution($id: Int!) {
    deleteSolution(id: $id)
  }
`;

export interface Solution {
  id: number;
  problem: string;
  solution: string;
  category: string;
  tags: string | null;
  ticketId: number | null;
  createdAt: string;
  createdBy: { id: number; name: string; role: string };
}

export interface PaginatedSolutions {
  items: Solution[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class SolutionService {
  private readonly apollo = inject(Apollo);

  getSolutions(filter?: any, page = 1, pageSize = 20): Observable<PaginatedSolutions> {
    return this.apollo
      .query<{ troubleshootingSolutions: PaginatedSolutions }>({
        query: GET_SOLUTIONS,
        variables: { filter, page, pageSize },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data!.troubleshootingSolutions));
  }

  createSolution(input: {
    problem: string;
    solution: string;
    category: string;
    tags?: string;
    ticketId?: number;
  }): Observable<Solution> {
    return this.apollo
      .mutate<{ createSolution: Solution }>({
        mutation: CREATE_SOLUTION,
        variables: { input },
      })
      .pipe(
        map((r) => {
          if (!r.data?.createSolution) throw new Error('Failed to create solution');
          return r.data.createSolution;
        }),
      );
  }

  updateSolution(id: number, input: any): Observable<Solution> {
    return this.apollo
      .mutate<{ updateSolution: Solution }>({
        mutation: UPDATE_SOLUTION,
        variables: { id, input },
      })
      .pipe(
        map((r) => {
          if (!r.data?.updateSolution) throw new Error('Failed to update solution');
          return r.data.updateSolution;
        }),
      );
  }

  deleteSolution(id: number): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteSolution: boolean }>({
        mutation: DELETE_SOLUTION,
        variables: { id },
      })
      .pipe(map((r) => !!r.data?.deleteSolution));
  }
}
