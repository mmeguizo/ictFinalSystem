import { NotificationService } from "./notification.service";
import { pubsub, EVENTS } from "../../lib/pubsub";
import { withFilter } from "graphql-subscriptions";
import { prisma } from "../../lib/prisma";

const notificationService = new NotificationService(prisma);

export const notificationResolvers = {
  Query: {
    myNotifications: async (
      _: any,
      { unreadOnly, limit }: { unreadOnly?: boolean; limit?: number },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return notificationService.getMyNotifications(
        context.currentUser.id,
        unreadOnly ?? false,
        limit ?? 50,
      );
    },

    unreadNotificationCount: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      const unread = await notificationService.getUnreadCount(
        context.currentUser.id,
      );
      return { unread };
    },
  },

  Mutation: {
    markNotificationAsRead: async (
      _: any,
      { id }: { id: number },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return notificationService.markAsRead(id, context.currentUser.id);
    },

    markAllNotificationsAsRead: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      const count = await notificationService.markAllAsRead(
        context.currentUser.id,
      );
      return { count };
    },
  },

  // ─── Real-time subscriptions ─────────────────────────────
  Subscription: {
    /**
     * ticketStatusChanged — fires whenever any ticket's status changes.
     * If the client passes ticketId, only events for that ticket are sent.
     */
    ticketStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([EVENTS.TICKET_STATUS_CHANGED]),
        (payload: any, variables: any) => {
          // If client specified a ticketId, filter to that ticket only
          if (variables.ticketId) {
            return payload.ticketStatusChanged.ticketId === variables.ticketId;
          }
          return true; // No filter — send all status changes
        },
      ),
    },

    /**
     * ticketCreated — fires whenever a new ticket is created.
     * Useful for secretary dashboard / admin to see new requests arrive.
     */
    ticketCreated: {
      subscribe: () => pubsub.asyncIterableIterator([EVENTS.TICKET_CREATED]),
    },

    /**
     * ticketAssigned — fires when a ticket is assigned to someone.
     * Filtered by userId so each user only gets their own assignments.
     */
    ticketAssigned: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([EVENTS.TICKET_ASSIGNED]),
        (payload: any, variables: any) => {
          return payload.ticketAssigned.assignedToUserId === variables.userId;
        },
      ),
    },

    /**
     * notificationCreated — fires when a new notification is created for a user.
     * Filtered by userId so each user only gets their own notifications.
     * This replaces the 30-second polling in the notification bell.
     */
    notificationCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([EVENTS.NOTIFICATION_CREATED]),
        (payload: any, variables: any) => {
          return payload.notificationCreated.userId === variables.userId;
        },
      ),
    },
  },
};
