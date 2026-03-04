import cron from "node-cron";
import {
  PrismaClient,
  TicketStatus,
  NotificationType,
  Role,
} from "@prisma/client";
import { NotificationService } from "../modules/notifications/notification.service";
import { logger } from "./logger";
import { pubsub, EVENTS } from "./pubsub";

/**
 * SLA Breach Cron Job Service
 * Runs every 5 minutes to check for overdue tickets and send notifications.
 * Also handles escalation (increase escalation level if still overdue after notification).
 *
 * Complexity: O(k) where k = number of overdue tickets (typically small subset)
 * Notifications are batched with createMany to minimize database round-trips.
 */
export class SLACronService {
  private notificationService: NotificationService;

  constructor(private readonly prisma: PrismaClient) {
    this.notificationService = new NotificationService(prisma);
  }

  /**
   * Start the SLA breach check cron job
   * Runs every 5 minutes
   */
  start() {
    logger.info(
      "⏰ SLA Cron Job started — checking for overdue tickets every 5 minutes",
    );

    // Run every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      try {
        await this.checkSLABreaches();
      } catch (err) {
        logger.error("SLA cron job error:", err);
      }
    });

    // Also run immediately on startup
    this.checkSLABreaches().catch((err) => {
      logger.error("Initial SLA check error:", err);
    });
  }

  /**
   * Check for overdue tickets and create notifications
   * Batches all notification inserts and escalation updates per level.
   */
  private async checkSLABreaches() {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Find overdue tickets that haven't been escalated recently (within last 30 min)
    const overdueTickets = await this.prisma.ticket.findMany({
      where: {
        dueDate: { lt: now },
        status: {
          notIn: [
            TicketStatus.RESOLVED,
            TicketStatus.CLOSED,
            TicketStatus.CANCELLED,
          ],
        },
        OR: [{ escalatedAt: null }, { escalatedAt: { lt: thirtyMinutesAgo } }],
      },
      include: {
        createdBy: true,
        assignments: { include: { user: true } },
      },
    });

    if (overdueTickets.length === 0) return;

    logger.info(
      `⚠️ SLA Check: Found ${overdueTickets.length} overdue ticket(s)`,
    );

    // Separate tickets by escalation level
    const level0Tickets = overdueTickets.filter((t) => t.escalationLevel === 0);
    const level1Tickets = overdueTickets.filter((t) => t.escalationLevel === 1);

    // Process level 0 → 1 escalations (batch)
    if (level0Tickets.length > 0) {
      await this.batchEscalateLevel1(level0Tickets, now);
    }

    // Process level 1 → 2 escalations (batch)
    if (level1Tickets.length > 0) {
      await this.batchEscalateLevel2(level1Tickets, now);
    }
  }

  /**
   * Batch process Level 0 → 1 escalation:
   * Notify assigned staff + department heads, update escalation level.
   * Uses createMany for O(1) database round-trip instead of O(n).
   */
  private async batchEscalateLevel1(tickets: any[], now: Date) {
    // Pre-fetch all department heads (MIS + ITS) in a single query
    const heads = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.MIS_HEAD, Role.ITS_HEAD] },
        isActive: true,
      },
      select: { id: true, role: true },
    });

    const misHeadIds = heads
      .filter((h) => h.role === Role.MIS_HEAD)
      .map((h) => h.id);
    const itsHeadIds = heads
      .filter((h) => h.role === Role.ITS_HEAD)
      .map((h) => h.id);

    // Build all notification records
    const notificationData: Array<{
      userId: number;
      ticketId: number;
      type: NotificationType;
      title: string;
      message: string;
      metadata: any;
    }> = [];

    for (const ticket of tickets) {
      const hoursOverdue = Math.round(
        (now.getTime() - new Date(ticket.dueDate).getTime()) / (1000 * 60 * 60),
      );

      const recipientIds = new Set<number>();

      // Add assigned staff
      for (const assignment of ticket.assignments) {
        recipientIds.add(assignment.userId);
      }

      // Add relevant department heads
      const headIds = ticket.type === "MIS" ? misHeadIds : itsHeadIds;
      for (const headId of headIds) {
        recipientIds.add(headId);
      }

      for (const userId of recipientIds) {
        notificationData.push({
          userId,
          ticketId: ticket.id,
          type: NotificationType.SLA_BREACH,
          title: "SLA Breach Warning",
          message: `Ticket "${ticket.title}" (${ticket.ticketNumber}) is ${hoursOverdue}h overdue. Please take immediate action.`,
          metadata: { hoursOverdue, escalationLevel: 1 },
        });
      }
    }

    // Atomic: batch create all notifications + update all ticket escalation levels
    await this.prisma.$transaction(async (tx) => {
      if (notificationData.length > 0) {
        await tx.notification.createMany({ data: notificationData });
      }

      // Batch update escalation level for all level-0 tickets
      await tx.ticket.updateMany({
        where: { id: { in: tickets.map((t: any) => t.id) } },
        data: { escalatedAt: now, escalationLevel: 1 },
      });
    });

    // Publish real-time events (outside transaction — fire-and-forget)
    try {
      const createdNotifications = await this.prisma.notification.findMany({
        where: {
          ticketId: { in: tickets.map((t: any) => t.id) },
          type: NotificationType.SLA_BREACH,
          createdAt: { gte: new Date(now.getTime() - 5000) },
        },
        include: { ticket: true },
        orderBy: { createdAt: "desc" },
        take: notificationData.length,
      });

      for (const notification of createdNotifications) {
        pubsub.publish(EVENTS.NOTIFICATION_CREATED, {
          notificationCreated: notification,
        });
      }
    } catch (err) {
      logger.error("Failed to publish SLA breach notifications:", err);
    }

    logger.info(
      `📢 SLA Level 1: ${tickets.length} ticket(s) escalated, ${notificationData.length} notification(s) sent`,
    );
  }

  /**
   * Batch process Level 1 → 2 escalation:
   * Notify admins + directors, update escalation level.
   * Uses createMany for O(1) database round-trip instead of O(n).
   */
  private async batchEscalateLevel2(tickets: any[], now: Date) {
    // Pre-fetch all admins and directors in a single query
    const adminsAndDirectors = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.DIRECTOR] },
        isActive: true,
      },
      select: { id: true },
    });

    // Build all notification records
    const notificationData: Array<{
      userId: number;
      ticketId: number;
      type: NotificationType;
      title: string;
      message: string;
      metadata: any;
    }> = [];

    for (const ticket of tickets) {
      const hoursOverdue = Math.round(
        (now.getTime() - new Date(ticket.dueDate).getTime()) / (1000 * 60 * 60),
      );

      for (const user of adminsAndDirectors) {
        notificationData.push({
          userId: user.id,
          ticketId: ticket.id,
          type: NotificationType.TICKET_ESCALATED,
          title: "Ticket Escalated — SLA Breach",
          message: `Ticket "${ticket.title}" (${ticket.ticketNumber}) has been escalated. It is ${hoursOverdue}h overdue and requires management attention.`,
          metadata: { hoursOverdue, escalationLevel: 2 },
        });
      }
    }

    // Atomic: batch create all notifications + update all ticket escalation levels
    await this.prisma.$transaction(async (tx) => {
      if (notificationData.length > 0) {
        await tx.notification.createMany({ data: notificationData });
      }

      await tx.ticket.updateMany({
        where: { id: { in: tickets.map((t: any) => t.id) } },
        data: { escalatedAt: now, escalationLevel: 2 },
      });
    });

    // Publish real-time events (outside transaction)
    try {
      const createdNotifications = await this.prisma.notification.findMany({
        where: {
          ticketId: { in: tickets.map((t: any) => t.id) },
          type: NotificationType.TICKET_ESCALATED,
          createdAt: { gte: new Date(now.getTime() - 5000) },
        },
        include: { ticket: true },
        orderBy: { createdAt: "desc" },
        take: notificationData.length,
      });

      for (const notification of createdNotifications) {
        pubsub.publish(EVENTS.NOTIFICATION_CREATED, {
          notificationCreated: notification,
        });
      }
    } catch (err) {
      logger.error("Failed to publish escalation notifications:", err);
    }

    logger.info(
      `🚨 SLA Level 2: ${tickets.length} ticket(s) escalated to admin/director, ${notificationData.length} notification(s) sent`,
    );
  }
}
