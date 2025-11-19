import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  enum Role {
    ADMIN
    DEVELOPER
    OFFICE_HEAD
    USER
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
  }

  type Query {
    me: User
    users: [User!]!
    user(id: Int!): User
  }

  input CreateUserInput {
    email: String!
    name: String
    password: String
    role: Role
  }

  input UpdateProfileInput {
    name: String
    # Data URL like data:image/png;base64,iVBORw0...; if provided we will store an avatar file and set avatarUrl
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

  type Mutation {
    createUser(input: CreateUserInput!): User!
    upsertMe: UpsertMePayload!
    setUserRole(id: Int!, role: Role!): User!
    # Admin only: set password for a user by id
    setLocalPassword(id: Int!, password: String!): User!
    # Current user updates their profile (name/avatar)
    updateMyProfile(input: UpdateProfileInput!): User!
    # Current user sets their password (hashed server-side)
    setMyPassword(password: String!): User!
    # Local login: authenticate with email/password, returns JWT token
    login(email: String!, password: String!): LoginPayload!
  }
`;
