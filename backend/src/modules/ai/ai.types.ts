import { gql } from "apollo-server-express";

export const aiTypeDefs = gql`
  """
  Structured AI analysis of a support ticket
  """
  type TicketAIAnalysis {
    cleanTicket: String!
    summary: String!
    category: String!
    priority: String!
    possibleRootCause: String!
    suggestedSolutions: [String!]!
    keywords: [String!]!
  }

  """
  A similar ticket found by keyword/content matching
  """
  type SimilarTicket {
    id: Int!
    ticketNumber: String!
    title: String!
    status: TicketStatus!
    priority: Priority!
    type: TicketType!
    createdAt: DateTime!
    resolvedAt: DateTime
  }

  """
  Combined smart suggestion result for ticket creation
  """
  type SmartSuggestions {
    analysis: TicketAIAnalysis
    similarTickets: [SimilarTicket!]!
    relatedArticles: [KnowledgeArticle!]!
    aiAvailable: Boolean!
  }

  extend type Query {
    """
    Analyze a ticket description using AI and find similar tickets/articles.
    Used during ticket creation to provide smart suggestions.
    """
    smartSuggestions(title: String!, description: String!): SmartSuggestions!

    """
    Analyze a ticket description using Gemini AI (standalone).
    Returns structured analysis with category, priority, solutions, etc.
    """
    analyzeTicket(title: String!, description: String!): TicketAIAnalysis
  }
`;
