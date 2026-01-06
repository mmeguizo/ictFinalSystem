import { PrismaClient, NotificationType, Notification } from '@prisma/client';

export class NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new notification
   */
  async create(data: {
    userId: number;
    ticketId?: number;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        ticketId: data.ticketId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata,
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Get notifications for a user
   */
  async findByUserId(
    userId: number,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<Notification[]> {
    const { unreadOnly = false, limit = 50, offset = 0 } = options || {};

    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Count unread notifications for a user
   */
  async countUnread(userId: number): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: number, userId: number): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async deleteOld(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });
    return result.count;
  }

  /**
   * Create notifications for multiple users (bulk)
   */
  async createMany(
    notifications: Array<{
      userId: number;
      ticketId?: number;
      type: NotificationType;
      title: string;
      message: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<number> {
    const result = await this.prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        ticketId: n.ticketId,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
      })),
    });
    return result.count;
  }
}
