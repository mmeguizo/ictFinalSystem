import { gql } from "apollo-server-express";

export const chatTypeDefs = gql`
  enum ChatSessionStatus {
    ACTIVE
    CLOSED
    TICKET_CREATED
  }

  enum ChatMessageRole {
    USER
    ASSISTANT
    SYSTEM
  }

  type ChatSession {
    id: Int!
    userId: Int!
    title: String!
    status: ChatSessionStatus!
    ticketId: Int
    ticket: Ticket
    messages: [ChatMessage!]!
    messageCount: Int
    createdAt: String!
    updatedAt: String!
  }

  type ChatMessage {
    id: Int!
    sessionId: Int!
    role: ChatMessageRole!
    content: String!
    metadata: String
    createdAt: String!
  }

  type ChatResponse {
    reply: String!
    metadata: String
    session: ChatSession!
  }

  input CreateTicketFromChatInput {
    sessionId: Int!
    title: String!
    description: String!
    type: String!
    priority: String
  }

  type BackfillResult {
    solutionsCreated: Int!
    embeddingsGenerated: Int!
    embeddingsFailed: Int!
  }

  extend type Query {
    chatSessions: [ChatSession!]!
    chatSession(id: Int!): ChatSession
  }

  extend type Mutation {
    createChatSession(title: String): ChatSession!
    sendChatMessage(sessionId: Int!, message: String!): ChatResponse!
    createTicketFromChat(input: CreateTicketFromChatInput!): Ticket!
    deleteChatSession(id: Int!): Boolean!
    backfillSolutionEmbeddings: BackfillResult!
  }
`;
