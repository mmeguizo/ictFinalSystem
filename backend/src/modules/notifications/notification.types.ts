import { gql } from "apollo-server-express";

export const notificationTypeDefs = gql`
  enum NotificationType {
    TICKET_CREATED
    TICKET_REVIEWED
    TICKET_REJECTED
    TICKET_APPROVED
    TICKET_DISAPPROVED
    TICKET_ASSIGNED
    STATUS_CHANGED
    NOTE_ADDED
    ATTACHMENT_ADDED
    SLA_BREACH
    TICKET_ESCALATED
  }

  type NotificationTicket {
    id: Int!
    ticketNumber: String!
    title: String!
  }

  type Notification {
    id: Int!
    userId: Int!
    ticketId: Int
    ticket: NotificationTicket
    type: NotificationType!
    title: String!
    message: String!
    isRead: Boolean!
    readAt: String
    metadata: JSON
    createdAt: String!
  }

  type NotificationCount {
    unread: Int!
  }

  type MarkAllReadResult {
    count: Int!
  }

  # ─── Real-time subscription payloads ──────────────────────

  """
  Fired when a ticket's status changes (e.g. FOR_REVIEW → ASSIGNED)
  """
  type TicketStatusChangedPayload {
    ticketId: Int!
    ticketNumber: String!
    title: String!
    oldStatus: TicketStatus!
    newStatus: TicketStatus!
    changedBy: String!
    timestamp: String!
  }

  """
  Fired when a brand-new ticket is created
  """
  type TicketCreatedPayload {
    ticketId: Int!
    ticketNumber: String!
    title: String!
    type: TicketType!
    priority: Priority!
    createdBy: String!
    timestamp: String!
  }

  """
  Fired when a ticket is assigned to someone
  """
  type TicketAssignedPayload {
    ticketId: Int!
    ticketNumber: String!
    title: String!
    assignedToUserId: Int!
    assignedToName: String!
    assignedBy: String!
    timestamp: String!
  }

  extend type Query {
    myNotifications(unreadOnly: Boolean, limit: Int): [Notification!]!
    unreadNotificationCount: NotificationCount!
  }

  extend type Mutation {
    markNotificationAsRead(id: Int!): Notification!
    markAllNotificationsAsRead: MarkAllReadResult!
  }

  extend type Subscription {
    """
    Listen for any ticket status change (optionally filter by ticketId)
    """
    ticketStatusChanged(ticketId: Int): TicketStatusChangedPayload!

    """
    Listen for newly created tickets (useful for secretary/dashboard)
    """
    ticketCreated: TicketCreatedPayload!

    """
    Listen for ticket assignments to a specific user
    """
    ticketAssigned(userId: Int!): TicketAssignedPayload!

    """
    Listen for new notifications for the current user
    """
    notificationCreated(userId: Int!): Notification!
  }
`;
