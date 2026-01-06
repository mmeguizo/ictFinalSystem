import { gql } from 'apollo-server-express';
import { JSONResolver } from 'graphql-scalars';

// Base schema with Query and Mutation types
export const baseTypeDefs = gql`
  # Custom scalar for JSON data
  scalar JSON

  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }
`;

// Base resolvers with JSON scalar
export const baseResolvers = {
  JSON: JSONResolver,
};
