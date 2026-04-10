import { gql } from "apollo-server-express";

export const ticketTypeDefs = gql`
  enum TicketType {
    MIS
    ITS
  }

  enum TicketStatus {
    FOR_REVIEW
    REVIEWED
    DIRECTOR_APPROVED
    ASSIGNED
    PENDING
    IN_PROGRESS
    ON_HOLD
    RESOLVED
    CLOSED
    CANCELLED
  }

  enum Priority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum MISCategory {
    WEBSITE
    SOFTWARE
  }

  type Ticket {
    id: Int!
    ticketNumber: String!
    controlNumber: String!
    type: TicketType!
    title: String!
    description: String!
    status: TicketStatus!
    priority: Priority!
    dueDate: String
    estimatedDuration: Int
    actualDuration: Int
    secretaryReviewedById: Int
    secretaryReviewedAt: String
    directorApprovedById: Int
    directorApprovedAt: String
    # Head workflow
    assignedDeveloperName: String
    dateToVisit: String
    targetCompletionDate: String
    resolution: String
    dateFinished: String
    # Escalation
    escalatedAt: String
    escalationLevel: Int!
    # Satisfaction survey
    satisfactionRating: Int
    satisfactionComment: String
    createdBy: User!
    createdById: Int!
    misTicket: MISTicket
    itsTicket: ITSTicket
    assignments: [TicketAssignment!]!
    notes: [TicketNote!]!
    attachments: [TicketAttachment!]!
    statusHistory: [TicketStatusHistory!]!
    createdAt: String!
    updatedAt: String!
    resolvedAt: String
    closedAt: String
  }

  type MISTicket {
    id: Int!
    ticketId: Int!
    category: MISCategory!
    websiteNewRequest: Boolean!
    websiteUpdate: Boolean!
    softwareNewRequest: Boolean!
    softwareUpdate: Boolean!
    softwareInstall: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type ITSTicket {
    id: Int!
    ticketId: Int!
    borrowRequest: Boolean!
    borrowDetails: String
    maintenanceDesktopLaptop: Boolean!
    maintenanceInternetNetwork: Boolean!
    maintenancePrinter: Boolean!
    maintenanceDetails: String
    createdAt: String!
    updatedAt: String!
  }

  type TicketAssignment {
    id: Int!
    ticketId: Int!
    userId: Int!
    user: User!
    assignedAt: String!
  }

  type TicketNote {
    id: Int!
    ticketId: Int!
    userId: Int!
    user: User!
    content: String!
    isInternal: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type TicketAttachment {
    id: Int!
    ticketId: Int!
    filename: String!
    originalName: String!
    mimeType: String!
    size: Int!
    url: String!
    uploadedBy: User
    isDeleted: Boolean!
    deletedAt: String
    deletedBy: User
    createdAt: String!
  }

  type TicketStatusHistory {
    id: Int!
    ticketId: Int!
    userId: Int!
    user: User!
    fromStatus: TicketStatus
    toStatus: TicketStatus!
    comment: String
    createdAt: String!
  }

  type TicketAnalytics {
    total: Int!
    byStatus: [StatusCount!]!
    byType: [TypeCount!]!
    byPriority: [PriorityCount!]!
  }

  type StatusCount {
    status: TicketStatus!
    count: Int!
  }

  type TypeCount {
    type: TicketType!
    count: Int!
  }

  type PriorityCount {
    priority: Priority!
    count: Int!
  }

  type SLAMetrics {
    overdue: Int!
    dueToday: Int!
    dueSoon: Int!
    complianceRate: Float!
    totalResolved: Int!
    resolvedWithinSLA: Int!
    averageResolutionHours: Float
    overdueTickets: [Ticket!]!
  }

  type TicketTrendPoint {
    date: String!
    count: Int!
  }

  type StaffPerformance {
    userId: Int!
    name: String!
    role: String!
    totalAssigned: Int!
    totalResolved: Int!
    averageResolutionHours: Float
    slaComplianceRate: Float!
  }

  type TicketTrends {
    createdPerDay: [TicketTrendPoint!]!
    resolvedPerDay: [TicketTrendPoint!]!
  }

  input CreateMISTicketInput {
    title: String!
    description: String!
    priority: Priority
    category: MISCategory!
    websiteNewRequest: Boolean
    websiteUpdate: Boolean
    softwareNewRequest: Boolean
    softwareUpdate: Boolean
    softwareInstall: Boolean
    estimatedDuration: Int
  }

  input CreateITSTicketInput {
    title: String!
    description: String!
    priority: Priority
    borrowRequest: Boolean
    borrowDetails: String
    maintenanceDesktopLaptop: Boolean
    maintenanceInternetNetwork: Boolean
    maintenancePrinter: Boolean
    maintenanceDetails: String
    estimatedDuration: Int
  }

  input UpdateTicketStatusInput {
    status: TicketStatus!
    comment: String
    targetCompletionDate: String
  }

  # Input for assigning a ticket with optional schedule dates
  # Note: userId is passed as a separate parameter, not in this input
  input AssignTicketInput {
    dateToVisit: String
    targetCompletionDate: String
    comment: String
  }

  input CreateTicketNoteInput {
    content: String!
    isInternal: Boolean
  }

  input ReopenTicketInput {
    updatedDescription: String
    comment: String
  }

  # Input for head to acknowledge ticket and assign developer
  input AcknowledgeAndAssignInput {
    assignedDeveloperName: String!
    assignToUserId: Int
    dateToVisit: String
    targetCompletionDate: String
    comment: String
  }

  # Input for head to update ticket resolution
  input UpdateResolutionInput {
    resolution: String!
    dateFinished: String
    status: TicketStatus
    comment: String
  }

  input SubmitSatisfactionInput {
    rating: Int!
    comment: String
  }

  input TicketFilterInput {
    status: TicketStatus
    type: TicketType
    createdById: Int
    assignedToUserId: Int
  }

  input PaginationInput {
    page: Int
    pageSize: Int
    sortField: String
    sortOrder: String
  }

  type PaginatedTickets {
    items: [Ticket!]!
    totalCount: Int!
    page: Int!
    pageSize: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  input AnalyticsFilterInput {
    startDate: String
    endDate: String
  }

  extend type Query {
    ticket(id: Int!): Ticket
    ticketByNumber(ticketNumber: String!): Ticket
    tickets(
      filter: TicketFilterInput
      pagination: PaginationInput
    ): PaginatedTickets!
    myTickets(pagination: PaginationInput): PaginatedTickets!
    myCreatedTickets(pagination: PaginationInput): PaginatedTickets!
    ticketsForSecretaryReview: [Ticket!]!
    ticketsPendingDirectorApproval: [Ticket!]!
    officeHeadTickets(type: TicketType!): PaginatedTickets!
    allSecretaryTickets(pagination: PaginationInput): PaginatedTickets!
    ticketAnalytics(filter: AnalyticsFilterInput): TicketAnalytics!
    slaMetrics: SLAMetrics!
    ticketTrends(filter: AnalyticsFilterInput): TicketTrends!
    staffPerformance(filter: AnalyticsFilterInput): [StaffPerformance!]!
  }

  extend type Mutation {
    createMISTicket(input: CreateMISTicketInput!): Ticket!
    createITSTicket(input: CreateITSTicketInput!): Ticket!
    updateTicketStatus(ticketId: Int!, input: UpdateTicketStatusInput!): Ticket!
    reviewTicketAsSecretary(ticketId: Int!, comment: String): Ticket!
    rejectTicketAsSecretary(ticketId: Int!, reason: String!): Ticket!
    approveTicketAsDirector(ticketId: Int!, comment: String): Ticket!
    disapproveTicketAsDirector(ticketId: Int!, reason: String!): Ticket!
    assignTicket(
      ticketId: Int!
      userId: Int!
      input: AssignTicketInput
    ): Ticket!
    unassignTicket(ticketId: Int!, userId: Int!): Ticket!
    addTicketNote(ticketId: Int!, input: CreateTicketNoteInput!): TicketNote!
    reopenTicket(ticketId: Int!, input: ReopenTicketInput): Ticket!
    # Head workflow: acknowledge ticket and assign developer name
    acknowledgeAndAssignDeveloper(
      ticketId: Int!
      input: AcknowledgeAndAssignInput!
    ): Ticket!
    # Head workflow: update resolution after work is done
    updateResolution(ticketId: Int!, input: UpdateResolutionInput!): Ticket!
    # Attachment management
    deleteTicketAttachment(attachmentId: Int!): Boolean!
    # Satisfaction survey
    submitSatisfaction(ticketId: Int!, input: SubmitSatisfactionInput!): Ticket!
  }
`;
