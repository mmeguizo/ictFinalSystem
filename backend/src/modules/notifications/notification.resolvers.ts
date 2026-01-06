import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification.service';

const prisma = new PrismaClient();
const notificationService = new NotificationService(prisma);

export const notificationResolvers = {
  Query: {
    myNotifications: async (
      _: any,
      { unreadOnly, limit }: { unreadOnly?: boolean; limit?: number },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return notificationService.getMyNotifications(
        context.currentUser.id,
        unreadOnly ?? false,
        limit ?? 50
      );
    },

    unreadNotificationCount: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      const unread = await notificationService.getUnreadCount(context.currentUser.id);
      return { unread };
    },
  },

  Mutation: {
    markNotificationAsRead: async (
      _: any,
      { id }: { id: number },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return notificationService.markAsRead(id, context.currentUser.id);
    },

    markAllNotificationsAsRead: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      const count = await notificationService.markAllAsRead(context.currentUser.id);
      return { count };
    },
  },
};
