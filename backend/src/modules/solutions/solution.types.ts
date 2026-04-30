import { gql } from "apollo-server-express";

export const solutionTypeDefs = gql`
  type TroubleshootingSolution {
    id: Int!
    problem: String!
    solution: String!
    category: String!
    tags: String
    ticketId: Int
    createdById: Int!
    createdBy: User!
    createdAt: String!
    updatedAt: String!
  }

  type PaginatedSolutions {
    items: [TroubleshootingSolution!]!
    totalCount: Int!
    page: Int!
    pageSize: Int!
    totalPages: Int!
  }

  input CreateSolutionInput {
    problem: String!
    solution: String!
    category: String!
    tags: String
    ticketId: Int
  }

  input UpdateSolutionInput {
    problem: String
    solution: String
    category: String
    tags: String
  }

  input SolutionFilterInput {
    category: String
    search: String
  }

  extend type Query {
    """
    List troubleshooting solutions with optional filters
    """
    troubleshootingSolutions(
      filter: SolutionFilterInput
      page: Int
      pageSize: Int
    ): PaginatedSolutions!

    """
    Get a single solution by ID
    """
    troubleshootingSolution(id: Int!): TroubleshootingSolution
  }

  extend type Mutation {
    """
    Create a new troubleshooting solution (staff only)
    """
    createSolution(input: CreateSolutionInput!): TroubleshootingSolution!

    """
    Update an existing solution (author or admin only)
    """
    updateSolution(
      id: Int!
      input: UpdateSolutionInput!
    ): TroubleshootingSolution!

    """
    Delete a solution (author or admin only)
    """
    deleteSolution(id: Int!): Boolean!
  }
`;
