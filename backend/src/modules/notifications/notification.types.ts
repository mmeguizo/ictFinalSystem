import { gql } from 'apollo-server-express';

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

  extend type Query {
    myNotifications(unreadOnly: Boolean, limit: Int): [Notification!]!
    unreadNotificationCount: NotificationCount!
  }

  extend type Mutation {
    markNotificationAsRead(id: Int!): Notification!
    markAllNotificationsAsRead: MarkAllReadResult!
  }
`;
