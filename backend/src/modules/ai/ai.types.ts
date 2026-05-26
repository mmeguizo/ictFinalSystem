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
    createdAt: String!
    resolvedAt: String
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

  """
  Structured data parsed from a natural language ticket description
  """
  type ParsedTicketResult {
    department: TicketType!
    title: String!
    category: String
    priority: Priority!
    details: String!
    mrn: String
    maintenanceDesktopLaptop: Boolean
    maintenanceInternetNetwork: Boolean
    maintenancePrinter: Boolean
    maintenanceDetails: String
    borrowRequest: Boolean
    borrowDetails: String
    websiteNewRequest: Boolean
    websiteUpdate: Boolean
    softwareNewRequest: Boolean
    softwareUpdate: Boolean
    softwareInstall: Boolean
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

    """
    Parse a casual natural language input into structured drafting fields for form pre-population.
    """
    parseNaturalLanguageTicket(input: String!): ParsedTicketResult!
  }
`;
