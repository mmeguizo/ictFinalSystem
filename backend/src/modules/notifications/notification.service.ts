import { PrismaClient, NotificationType, Role } from '@prisma/client';
import { NotificationRepository } from './notification.repository';
import { pubsub, EVENTS } from '../../lib/pubsub';

export class NotificationService {
  private repository: NotificationRepository;

  constructor(private prisma: PrismaClient) {
    this.repository = new NotificationRepository(prisma);
  }

  // ========================================
  // HELPER: publish notification via WebSocket
  // ========================================
  private publishNotification(notification: any) {
    pubsub.publish(EVENTS.NOTIFICATION_CREATED, {
      notificationCreated: notification,
    });
  }

  private publishNotificationsForUsers(userIds: number[], ticketId: number, type: NotificationType, title: string, message: string, metadata?: Record<string, any>) {
    // For bulk-created notifications, publish individual events per user
    for (const userId of userIds) {
      pubsub.publish(EVENTS.NOTIFICATION_CREATED, {
        notificationCreated: {
          userId,
          ticketId,
          type,
          title,
          message,
          isRead: false,
          metadata,
          createdAt: new Date().toISOString(),
        },
      });
    }
  }

  // ========================================
  // QUERY METHODS
  // ========================================

  /**
   * Get notifications for current user
   */
  async getMyNotifications(userId: number, unreadOnly = false, limit = 50) {
    return this.repository.findByUserId(userId, { unreadOnly, limit });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: number): Promise<number> {
    return this.repository.countUnread(userId);
  }

  // ========================================
  // MUTATION METHODS
  // ========================================

  /**
   * Mark single notification as read
   */
  async markAsRead(notificationId: number, userId: number) {
    return this.repository.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: number): Promise<number> {
    return this.repository.markAllAsRead(userId);
  }

  // ========================================
  // NOTIFICATION TRIGGERS
  // These are called from ticket service when events occur
  // ========================================

  /**
   * Notify user when their ticket is rejected by secretary
   */
  async notifyTicketRejected(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    ticketCreatorId: number,
    rejectorName: string,
    reason: string
  ) {
    const notification = await this.repository.create({
      userId: ticketCreatorId,
      ticketId,
      type: NotificationType.TICKET_REJECTED,
      title: 'Ticket Rejected',
      message: `Your ticket "${ticketTitle}" (${ticketNumber}) was rejected by ${rejectorName}. Reason: ${reason}`,
      metadata: {
        rejectorName,
        reason,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify user when their ticket is disapproved by director
   */
  async notifyTicketDisapproved(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    ticketCreatorId: number,
    directorName: string,
    reason: string
  ) {
    const notification = await this.repository.create({
      userId: ticketCreatorId,
      ticketId,
      type: NotificationType.TICKET_DISAPPROVED,
      title: 'Ticket Disapproved',
      message: `Your ticket "${ticketTitle}" (${ticketNumber}) was disapproved by ${directorName}. Reason: ${reason}`,
      metadata: {
        directorName,
        reason,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify user when their ticket is reviewed by secretary
   */
  async notifyTicketReviewed(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    ticketCreatorId: number,
    reviewerName: string
  ) {
    const notification = await this.repository.create({
      userId: ticketCreatorId,
      ticketId,
      type: NotificationType.TICKET_REVIEWED,
      title: 'Ticket Under Review',
      message: `Your ticket "${ticketTitle}" (${ticketNumber}) has been reviewed and forwarded for director approval.`,
      metadata: {
        reviewerName,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify user when their ticket is approved by director
   */
  async notifyTicketApproved(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    ticketCreatorId: number,
    approverName: string
  ) {
    const notification = await this.repository.create({
      userId: ticketCreatorId,
      ticketId,
      type: NotificationType.TICKET_APPROVED,
      title: 'Ticket Endorsed',
      message: `Your ticket "${ticketTitle}" (${ticketNumber}) has been approved and will be assigned to the appropriate team.`,
      metadata: {
        approverName,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify staff member when ticket is assigned to them
   */
  async notifyTicketAssigned(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    assigneeId: number,
    assignerName: string
  ) {
    const notification = await this.repository.create({
      userId: assigneeId,
      ticketId,
      type: NotificationType.TICKET_ASSIGNED,
      title: 'New Ticket Endorsed',
      message: `You have an endorsed ticket "${ticketTitle}" (${ticketNumber}) by ${assignerName}.`,
      metadata: {
        assignerName,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify ticket creator when status changes
   */
  async notifyStatusChanged(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    ticketCreatorId: number,
    fromStatus: string,
    toStatus: string,
    changerName: string
  ) {
    const notification = await this.repository.create({
      userId: ticketCreatorId,
      ticketId,
      type: NotificationType.STATUS_CHANGED,
      title: 'Ticket Status Updated',
      message: `Your ticket "${ticketTitle}" (${ticketNumber}) status changed from ${fromStatus.replace('_', ' ')} to ${toStatus.replace('_', ' ')}.`,
      metadata: {
        fromStatus,
        toStatus,
        changerName,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify relevant users when a note is added
   * - If internal note: notify assigned staff, admin, secretary
   * - If public note: notify ticket creator
   * - Admin and Secretary always get notified for notes on all tickets
   */
  async notifyNoteAdded(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    recipientId: number,
    authorName: string,
    isInternal: boolean
  ) {
    const notification = await this.repository.create({
      userId: recipientId,
      ticketId,
      type: NotificationType.NOTE_ADDED,
      title: isInternal ? 'Internal Note Added' : 'New Comment on Ticket',
      message: `${authorName} added a ${isInternal ? 'note' : 'comment'} on ticket "${ticketTitle}" (${ticketNumber}).`,
      metadata: {
        authorName,
        isInternal,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify Admin and Secretary about new notes
   * This ensures they stay informed about all ticket activity
   */
  async notifyAdminAndSecretaryNoteAdded(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    authorId: number,
    authorName: string,
    isInternal: boolean
  ) {
    // Find all admins and secretaries except the author
    const adminSecretaries = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.SECRETARY] },
        id: { not: authorId }, // Don't notify the author
      },
      select: { id: true },
    });

    if (adminSecretaries.length === 0) return;

    const result = await this.repository.createMany(
      adminSecretaries.map((user) => ({
        userId: user.id,
        ticketId,
        type: NotificationType.NOTE_ADDED,
        title: isInternal ? 'Internal Note Added' : 'New Comment on Ticket',
        message: `${authorName} added a ${isInternal ? 'note' : 'comment'} on ticket "${ticketTitle}" (${ticketNumber}).`,
        metadata: {
          authorName,
          isInternal,
        },
      }))
    );

    this.publishNotificationsForUsers(
      adminSecretaries.map(u => u.id),
      ticketId,
      NotificationType.NOTE_ADDED,
      isInternal ? 'Internal Note Added' : 'New Comment on Ticket',
      `${authorName} added a ${isInternal ? 'note' : 'comment'} on ticket "${ticketTitle}" (${ticketNumber}).`,
      { authorName, isInternal }
    );

    return result;
  }

  /**
   * Notify secretary when new ticket is created (for review)
   */
  async notifyNewTicketForReview(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    creatorName: string
  ) {
    // Find all secretaries
    const secretaries = await this.prisma.user.findMany({
      where: { role: Role.SECRETARY },
      select: { id: true },
    });

    if (secretaries.length === 0) return;

    const result = await this.repository.createMany(
      secretaries.map((s) => ({
        userId: s.id,
        ticketId,
        type: NotificationType.TICKET_CREATED,
        title: 'New Ticket for Review',
        message: `New ticket "${ticketTitle}" (${ticketNumber}) submitted by ${creatorName} requires your review.`,
        metadata: {
          creatorName,
        },
      }))
    );

    this.publishNotificationsForUsers(
      secretaries.map(s => s.id),
      ticketId,
      NotificationType.TICKET_CREATED,
      'New Ticket for Review',
      `New ticket "${ticketTitle}" (${ticketNumber}) submitted by ${creatorName} requires your review.`,
      { creatorName }
    );

    return result;
  }

  /**
   * Notify director when ticket is ready for approval
   */
  async notifyTicketReadyForDirectorApproval(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    reviewerName: string
  ) {
    // Find all directors and admins
    const approvers = await this.prisma.user.findMany({
      where: { role: { in: [Role.DIRECTOR, Role.ADMIN] } },
      select: { id: true },
    });

    if (approvers.length === 0) return;

    const result = await this.repository.createMany(
      approvers.map((a) => ({
        userId: a.id,
        ticketId,
        type: NotificationType.TICKET_REVIEWED,
        title: 'Ticket Ready for Endorsement',
        message: `Ticket "${ticketTitle}" (${ticketNumber}) has been reviewed by ${reviewerName} and requires your endorsement.`,
        metadata: {
          reviewerName,
        },
      }))
    );

    this.publishNotificationsForUsers(
      approvers.map(a => a.id),
      ticketId,
      NotificationType.TICKET_REVIEWED,
      'Ticket Ready for Endorsement',
      `Ticket "${ticketTitle}" (${ticketNumber}) has been reviewed by ${reviewerName} and requires your endorsement.`,
      { reviewerName }
    );

    return result;
  }

  // ========================================
  // SCHEDULE WORKFLOW NOTIFICATIONS
  // ========================================

  /**
   * Notify admin/director when head has scheduled a visit
   * Called when MIS_HEAD/ITS_HEAD sets dateToVisit and targetCompletionDate
   */
  async notifyAdminScheduleSet(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    headName: string,
    dateToVisit: Date,
    targetCompletionDate: Date
  ) {
    // Find all admins and directors
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.DIRECTOR] } },
      select: { id: true },
    });

    if (admins.length === 0) return;

    const visitDateStr = dateToVisit.toLocaleDateString();
    const completionDateStr = targetCompletionDate.toLocaleDateString();

    const result = await this.repository.createMany(
      admins.map((a) => ({
        userId: a.id,
        ticketId,
        type: NotificationType.STATUS_CHANGED,
        title: 'Visit Schedule Requires Acknowledgment',
        message: `${headName} has scheduled a visit for ticket "${ticketTitle}" (${ticketNumber}). Visit: ${visitDateStr}, Target Completion: ${completionDateStr}. Please acknowledge.`,
        metadata: {
          headName,
          dateToVisit: visitDateStr,
          targetCompletionDate: completionDateStr,
        },
      }))
    );

    this.publishNotificationsForUsers(
      admins.map(a => a.id),
      ticketId,
      NotificationType.STATUS_CHANGED,
      'Visit Schedule Requires Acknowledgment',
      `${headName} has scheduled a visit for ticket "${ticketTitle}" (${ticketNumber}). Visit: ${visitDateStr}, Target Completion: ${completionDateStr}. Please acknowledge.`,
      { headName, dateToVisit: visitDateStr, targetCompletionDate: completionDateStr }
    );

    return result;
  }

  /**
   * Notify user when their visit has been scheduled
   * Called after admin acknowledges the schedule
   */
  async notifyUserVisitScheduled(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    userId: number,
    dateToVisit: Date,
    targetCompletionDate: Date,
    officeName: string
  ) {
    const visitDateStr = dateToVisit.toLocaleDateString();
    const completionDateStr = targetCompletionDate.toLocaleDateString();

    const notification = await this.repository.create({
      userId,
      ticketId,
      type: NotificationType.STATUS_CHANGED,
      title: 'Visit Scheduled',
      message: `Your ticket "${ticketTitle}" (${ticketNumber}) has been scheduled. Please visit the ${officeName} on ${visitDateStr}. Target completion: ${completionDateStr}.`,
      metadata: {
        dateToVisit: visitDateStr,
        targetCompletionDate: completionDateStr,
        officeName,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify head when admin rejects their schedule
   */
  async notifyHeadScheduleRejected(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    headId: number,
    reason: string
  ) {
    const notification = await this.repository.create({
      userId: headId,
      ticketId,
      type: NotificationType.STATUS_CHANGED,
      title: 'Schedule Rejected',
      message: `Your schedule for ticket "${ticketTitle}" (${ticketNumber}) was rejected. Reason: ${reason}. Please reschedule.`,
      metadata: {
        reason,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  /**
   * Notify user when head adds monitor notes after visit
   */
  async notifyUserMonitorUpdate(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    userId: number,
    headName: string
  ) {
    const notification = await this.repository.create({
      userId,
      ticketId,
      type: NotificationType.STATUS_CHANGED,
      title: 'Monitor Notes Added',
      message: `${headName} has added monitoring notes and recommendations to your ticket "${ticketTitle}" (${ticketNumber}).`,
      metadata: {
        headName,
      },
    });
    this.publishNotification(notification);
    return notification;
  }

  // ========================================
  // ATTACHMENT NOTIFICATIONS
  // ========================================

  /**
   * Notify relevant users when a file is uploaded to a ticket
   * - Notify ticket creator (if uploader is not the creator)
   * - Notify assigned staff (if uploader is not the assignee)
   * - Notify Admin and Secretary
   */
  async notifyAttachmentUploaded(
    ticketId: number,
    ticketNumber: string,
    ticketTitle: string,
    uploaderId: number,
    uploaderName: string,
    fileCount: number
  ) {
    const fileText = fileCount === 1 ? '1 file' : `${fileCount} files`;

    // Find ticket to get creator and assignments
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        assignments: { select: { userId: true } },
      },
    });

    if (!ticket) return;

    const recipientIds = new Set<number>();

    // Notify ticket creator (if not the uploader)
    if (ticket.createdById !== uploaderId) {
      recipientIds.add(ticket.createdById);
    }

    // Notify assigned staff (if not the uploader)
    for (const a of ticket.assignments || []) {
      if (a.userId !== uploaderId) {
        recipientIds.add(a.userId);
      }
    }

    // Notify Admin and Secretary
    const adminSecretaries = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.SECRETARY] },
        id: { not: uploaderId },
      },
      select: { id: true },
    });
    for (const u of adminSecretaries) {
      recipientIds.add(u.id);
    }

    if (recipientIds.size === 0) return;

    // Create individual notifications so each gets a real-time push
    for (const userId of recipientIds) {
      const notification = await this.repository.create({
        userId,
        ticketId,
        type: NotificationType.ATTACHMENT_ADDED,
        title: 'File Attached',
        message: `${uploaderName} uploaded ${fileText} to ticket "${ticketTitle}" (${ticketNumber}).`,
        metadata: {
          uploaderName,
          fileCount,
        },
      });
      this.publishNotification(notification);
    }
  }
}
