import { gql } from 'apollo-server-express';

// Base schema with Query and Mutation types
export const baseTypeDefs = gql`
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }
`;
