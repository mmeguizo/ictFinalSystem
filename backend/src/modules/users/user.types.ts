import { gql } from 'apollo-server-express';

export const userTypeDefs = gql`
  enum Role {
    ADMIN
    DEVELOPER
    TECHNICAL
    MIS_HEAD
    ITS_HEAD
    USER
    SECRETARY
    DIRECTOR
  }

  type User {
    id: Int!
    email: String!
    name: String
    role: Role!
    createdAt: String!
    updatedAt: String!
    picture: String
    avatarUrl: String
    lastLoginAt: String
    isActive: Boolean!
  }

  input CreateUserInput {
    email: String!
    name: String
    password: String
    role: Role!
  }

  input UpdateProfileInput {
    name: String
    avatarDataUrl: String
  }

  type UpsertMePayload {
    user: User!
    created: Boolean!
  }

  type LoginPayload {
    token: String!
    user: User!
  }

  extend type Query {
    me: User
    users: [User!]!
    user(id: Int!): User
    usersByRole(role: Role!): [User!]!
    usersByRoles(roles: [Role!]!): [User!]!
  }

  extend type Mutation {
    createUser(input: CreateUserInput!): User!
    upsertMe: UpsertMePayload!
    setUserRole(id: Int!, role: Role!): User!
    setLocalPassword(id: Int!, password: String!): User!
    updateMyProfile(input: UpdateProfileInput!): User!
    setMyPassword(password: String!): User!
    login(email: String!, password: String!): LoginPayload!
  }
`;
