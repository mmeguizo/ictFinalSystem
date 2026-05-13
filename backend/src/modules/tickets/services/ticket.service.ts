import {
  PrismaClient,
  Priority,
  TicketStatus,
  TicketType,
} from "@prisma/client";
import { TicketRepository, PaginationParams } from "../ticket.repository";
import { AutoAssignmentService } from "./auto-assignment.service";
import { CreateMISTicketDto } from "../dto/create-mis-ticket.dto";
import { CreateITSTicketDto } from "../dto/create-its-ticket.dto";
import { UpdateTicketStatusDto } from "../dto/update-ticket-status.dto";
import { CreateTicketNoteDto } from "../dto/create-ticket-note.dto";
import {
  calculateDueDate,
  calculateEstimatedDuration,
} from "../utils/sla.utils";
import { NotificationService } from "../../notifications/notification.service";
import { pubsub, EVENTS } from "../../../lib/pubsub";

export class TicketService {
  private readonly repository: TicketRepository;
  private readonly autoAssignment: AutoAssignmentService;
  private readonly notificationService: NotificationService;

  constructor(private readonly prisma: PrismaClient) {
    this.repository = new TicketRepository(prisma);
    this.autoAssignment = new AutoAssignmentService(prisma);
    this.notificationService = new NotificationService(prisma);
  }

  /**
   * Create a new MIS ticket
   */
  async createMISTicket(dto: CreateMISTicketDto, createdById: number) {
    const ticketNumber = await this.repository.generateTicketNumber(
      TicketType.MIS,
    );
    const controlNumber = await this.repository.generateControlNumber();
    const priority = dto.priority || Priority.MEDIUM;
    const dueDate = calculateDueDate(priority);
    const estimatedDuration =
      dto.estimatedDuration ||
      calculateEstimatedDuration(TicketType.MIS, priority);

    // Get creator name for notification
    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { name: true },
    });

    // Create ticket with MIS-specific data
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        controlNumber,
        type: TicketType.MIS,
        title: dto.title,
        description: dto.description,
        priority,
        dueDate,
        estimatedDuration,
        createdById,
        misTicket: {
          create: {
            category: dto.category,
            websiteNewRequest: dto.websiteNewRequest || false,
            websiteUpdate: dto.websiteUpdate || false,
            softwareNewRequest: dto.softwareNewRequest || false,
            softwareUpdate: dto.softwareUpdate || false,
            softwareInstall: dto.softwareInstall || false,
          },
        },
      },
      include: {
        createdBy: true,
        misTicket: true,
      },
    });

    // Notify secretaries about new ticket for review
    try {
      await this.notificationService.notifyNewTicketForReview(
        ticket.id,
        ticketNumber,
        dto.title,
        creator?.name || "Unknown User",
      );
    } catch (err) {
      console.error("Failed to send new ticket notification:", err);
    }

    // Publish real-time event for new MIS ticket
    pubsub.publish(EVENTS.TICKET_CREATED, {
      ticketCreated: {
        ticketId: ticket.id,
        ticketNumber,
        title: dto.title,
        type: "MIS",
        priority,
        createdBy: creator?.name || "Unknown User",
        timestamp: new Date().toISOString(),
      },
    });

    // Ticket starts in FOR_REVIEW status for secretary review
    // Auto-assignment happens after director approval (in approveAsDirector)
    return this.repository.findById(ticket.id);
  }

  /**
   * Create a new ITS ticket
   */
  async createITSTicket(dto: CreateITSTicketDto, createdById: number) {
    const ticketNumber = await this.repository.generateTicketNumber(
      TicketType.ITS,
    );
    const priority = dto.priority || Priority.MEDIUM;
    const dueDate = calculateDueDate(priority);
    const estimatedDuration =
      dto.estimatedDuration ||
      calculateEstimatedDuration(TicketType.ITS, priority);

    // Get creator name for notification
    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { name: true },
    });

    // Create ticket with ITS-specific data
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        type: TicketType.ITS,
        title: dto.title,
        description: dto.description,
        priority,
        dueDate,
        estimatedDuration,
        createdById,
        itsTicket: {
          create: {
            borrowRequest: dto.borrowRequest || false,
            borrowDetails: dto.borrowDetails,
            maintenanceDesktopLaptop: dto.maintenanceDesktopLaptop || false,
            maintenanceInternetNetwork: dto.maintenanceInternetNetwork || false,
            maintenancePrinter: dto.maintenancePrinter || false,
            maintenanceDetails: dto.maintenanceDetails,
          },
        },
      },
      include: {
        createdBy: true,
        itsTicket: true,
      },
    });

    // Notify secretaries about new ticket for review
    try {
      await this.notificationService.notifyNewTicketForReview(
        ticket.id,
        ticketNumber,
        dto.title,
        creator?.name || "Unknown User",
      );
    } catch (err) {
      console.error("Failed to send new ticket notification:", err);
    }

    // Publish real-time event for new ITS ticket
    pubsub.publish(EVENTS.TICKET_CREATED, {
      ticketCreated: {
        ticketId: ticket.id,
        ticketNumber,
        title: dto.title,
        type: "ITS",
        priority,
        createdBy: creator?.name || "Unknown User",
        timestamp: new Date().toISOString(),
      },
    });

    // Ticket starts in FOR_REVIEW status for secretary review
    // Auto-assignment happens after director approval (in approveAsDirector)
    return this.repository.findById(ticket.id);
  }

  /**
   * Get ticket by ID
   */
  async getTicket(id: number) {
    const ticket = await this.repository.findById(id);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    return ticket;
  }

  /**
   * Get ticket by ticket number
   */
  async getTicketByNumber(ticketNumber: string) {
    const ticket = await this.repository.findByTicketNumber(ticketNumber);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    return ticket;
  }

  /**
   * Get tickets with optional filters
   */
  async getTickets(
    filters?: {
      status?: TicketStatus;
      type?: TicketType;
      createdById?: number;
      assignedToUserId?: number;
    },
    pagination?: PaginationParams,
  ) {
    return this.repository.findMany(filters, pagination);
  }

  /**
   * Update ticket status
   * Notifies ticket creator when status changes (e.g., developer starts/resolves)
   * Optionally updates targetCompletionDate if provided (developers can update this)
   */
  async updateStatus(
    ticketId: number,
    userId: number,
    dto: UpdateTicketStatusDto,
  ) {
    // Get ticket and user info before update for notification
    const ticket = await this.repository.findById(ticketId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const fromStatus = ticket.status;
    const result = await this.repository.updateStatus(
      ticketId,
      userId,
      dto.status,
      dto.comment,
    );

    // If developer provided a new targetCompletionDate, update it on the ticket
    if ((dto as any).targetCompletionDate) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          targetCompletionDate: new Date((dto as any).targetCompletionDate),
        },
      });
    }

    // Notify ticket creator about status change (if not updating their own ticket)
    if (ticket.createdById !== userId) {
      try {
        await this.notificationService.notifyStatusChanged(
          ticketId,
          ticket.ticketNumber,
          ticket.title,
          ticket.createdById,
          fromStatus,
          dto.status,
          user?.name || "Staff",
        );
      } catch (err) {
        console.error("Failed to send status change notification:", err);
      }
    }

    // Publish real-time event for status change
    pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
      ticketStatusChanged: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        oldStatus: fromStatus,
        newStatus: dto.status,
        changedBy: user?.name || "Staff",
        timestamp: new Date().toISOString(),
      },
    });

    return result;
  }

  /**
   * Assign user to ticket
   * @param ticketId - The ticket to assign
   * @param userId - The user being assigned to the ticket
   * @param assignedById - The user performing the assignment (e.g., MIS_HEAD)
   * @param options - Optional schedule dates (dateToVisit, targetCompletionDate) and comment
   * Notifies the assigned user about the new assignment
   */
  async assignUser(
    ticketId: number,
    userId: number,
    assignedById?: number,
    options?: {
      dateToVisit?: Date;
      targetCompletionDate?: Date;
      comment?: string;
    },
  ) {
    // Get ticket and assigner info for notification
    const ticket = await this.repository.findById(ticketId);
    const assigner = assignedById
      ? await this.prisma.user.findUnique({
          where: { id: assignedById },
          select: { name: true },
        })
      : null;

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const result = await this.autoAssignment.manualAssign(
      ticketId,
      userId,
      assignedById,
    );

    // If dateToVisit is provided, store it on the ticket
    if (options?.dateToVisit || options?.targetCompletionDate) {
      const updateData: any = {};
      if (options.dateToVisit) {
        updateData.dateToVisit = options.dateToVisit;
      }
      if (options.targetCompletionDate) {
        updateData.targetCompletionDate = options.targetCompletionDate;
      }

      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });
    }

    // Notify the assigned user
    try {
      await this.notificationService.notifyTicketAssigned(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        userId,
        assigner?.name || "Department Head",
      );
    } catch (err) {
      console.error("Failed to send assignment notification:", err);
    }

    // Publish real-time event for assignment
    const assignedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    pubsub.publish(EVENTS.TICKET_ASSIGNED, {
      ticketAssigned: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        assignedToUserId: userId,
        assignedToName: assignedUser?.name || "Unknown",
        assignedBy: assigner?.name || "Department Head",
        timestamp: new Date().toISOString(),
      },
    });

    // Also publish TICKET_STATUS_CHANGED so ALL users (including ticket creator) get real-time updates
    // The TICKET_ASSIGNED event above is per-user (only for the assigned staff)
    const updatedTicket = await this.repository.findById(ticketId);
    if (updatedTicket && updatedTicket.status !== ticket.status) {
      pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
        ticketStatusChanged: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          oldStatus: ticket.status,
          newStatus: updatedTicket.status,
          changedBy: assigner?.name || "Department Head",
          timestamp: new Date().toISOString(),
        },
      });
    }

    return result;
  }

  /**
   * Unassign user from ticket
   */
  async unassignUser(ticketId: number, userId: number) {
    return this.autoAssignment.unassign(ticketId, userId);
  }

  /**
   * Add note to ticket
   * Notifies relevant users:
   * - If internal note: notify other assigned staff
   * - If public note: notify ticket creator (if author is staff) or notify assigned staff (if author is creator)
   */
  async addNote(ticketId: number, userId: number, dto: CreateTicketNoteDto) {
    // Get ticket, author, and assignments for notifications
    const ticket = await this.repository.findById(ticketId);
    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const result = await this.repository.addNote(
      ticketId,
      userId,
      dto.content,
      dto.isInternal || false,
    );

    // Send notifications
    try {
      // Always notify Admin and Secretary about notes (they oversee all tickets)
      await this.notificationService.notifyAdminAndSecretaryNoteAdded(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        userId,
        author?.name || "Staff",
        dto.isInternal || false,
      );

      if (dto.isInternal) {
        // Internal note: notify other assigned staff (not the author)
        const otherAssignees =
          ticket.assignments?.filter((a) => a.user.id !== userId) || [];
        for (const assignee of otherAssignees) {
          await this.notificationService.notifyNoteAdded(
            ticketId,
            ticket.ticketNumber,
            ticket.title,
            assignee.user.id,
            author?.name || "Staff",
            true,
          );
        }
      } else {
        // Public note
        const isAuthorTicketCreator = userId === ticket.createdById;

        if (isAuthorTicketCreator) {
          // Creator added a comment - notify assigned staff
          const assignees = ticket.assignments || [];
          for (const assignee of assignees) {
            await this.notificationService.notifyNoteAdded(
              ticketId,
              ticket.ticketNumber,
              ticket.title,
              assignee.user.id,
              author?.name || "User",
              false,
            );
          }
        } else {
          // Staff added a public comment - notify ticket creator
          await this.notificationService.notifyNoteAdded(
            ticketId,
            ticket.ticketNumber,
            ticket.title,
            ticket.createdById,
            author?.name || "Staff",
            false,
          );
        }
      }
    } catch (err) {
      console.error("Failed to send note notification:", err);
    }

    return result;
  }

  /**
   * Get dashboard analytics
   */
  async getAnalytics(filters?: { startDate?: Date; endDate?: Date }) {
    return this.repository.getAnalytics(filters);
  }

  /**
   * Get SLA metrics
   */
  async getSLAMetrics() {
    return this.repository.getSLAMetrics();
  }

  /**
   * Get enhanced SLA metrics with compliance and overdue details
   */
  async getEnhancedSLAMetrics() {
    return this.repository.getEnhancedSLAMetrics();
  }

  /**
   * Get ticket creation/resolution trends
   */
  async getTicketTrends(filters?: { startDate?: Date; endDate?: Date }) {
    return this.repository.getTicketTrends(filters);
  }

  /**
   * Get staff performance metrics
   */
  async getStaffPerformance(filters?: { startDate?: Date; endDate?: Date }) {
    return this.repository.getStaffPerformance(filters);
  }

  /**
   * Submit satisfaction survey (ticket creator only, resolved/closed tickets only)
   */
  async submitSatisfaction(
    ticketId: number,
    userId: number,
    rating: number,
    comment?: string,
  ) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.createdById !== userId)
      throw new Error(
        "Only the ticket creator can submit a satisfaction survey",
      );
    if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
      throw new Error(
        "Satisfaction survey can only be submitted for resolved or closed tickets",
      );
    }
    if (rating < 1 || rating > 5)
      throw new Error("Rating must be between 1 and 5");
    if (ticket.satisfactionRating)
      throw new Error("Satisfaction survey already submitted");

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        satisfactionRating: rating,
        satisfactionComment: comment || null,
      },
      include: {
        createdBy: true,
        misTicket: true,
        itsTicket: true,
        assignments: { include: { user: true } },
        notes: { include: { user: true } },
        attachments: { include: { uploadedBy: true, deletedBy: true } },
        statusHistory: {
          include: { user: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Get user's assigned tickets
   */
  async getUserTickets(userId: number, pagination?: PaginationParams) {
    return this.repository.findMany({ assignedToUserId: userId }, pagination);
  }

  /**
   * Get tickets for Office Heads (MIS_HEAD or ITS_HEAD)
   * Returns all tickets of their type that are in work statuses
   * (DIRECTOR_APPROVED, ASSIGNED, PENDING, IN_PROGRESS, ON_HOLD, RESOLVED, CLOSED)
   */
  async getOfficeHeadTickets(
    ticketType: TicketType,
    pagination?: PaginationParams,
  ) {
    return this.repository.findManyByTypeAndStatuses(
      ticketType,
      [
        TicketStatus.DIRECTOR_APPROVED,
        TicketStatus.ASSIGNED,
        TicketStatus.PENDING,
        TicketStatus.IN_PROGRESS,
        TicketStatus.ON_HOLD,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED,
      ],
      pagination,
    );
  }

  /**
   * Get user's created tickets
   */
  async getUserCreatedTickets(userId: number, pagination?: PaginationParams) {
    return this.repository.findMany({ createdById: userId }, pagination);
  }

  /**
   * Get tickets for secretary review (FOR_REVIEW status)
   */
  async getTicketsForSecretaryReview() {
    const result = await this.repository.findMany({
      status: TicketStatus.FOR_REVIEW,
    });
    return result.items;
  }

  /**
   * Get tickets for secretary review filtered by type (FOR_REVIEW status)
   * Used by department heads to see only their department's tickets
   */
  async getTicketsForSecretaryReviewByType(type: "MIS" | "ITS") {
    const result = await this.repository.findMany({
      status: TicketStatus.FOR_REVIEW,
      type: type === "MIS" ? TicketType.MIS : TicketType.ITS,
    });
    return result.items;
  }

  /**
   * Get tickets pending director approval (REVIEWED status)
   */
  async getTicketsPendingDirectorApproval() {
    const result = await this.repository.findMany({
      status: TicketStatus.REVIEWED,
    });
    return result.items;
  }

  /**
   * Get tickets pending director approval filtered by type (REVIEWED status)
   * Used by department heads to see only their department's tickets
   */
  async getTicketsPendingDirectorApprovalByType(type: "MIS" | "ITS") {
    const result = await this.repository.findMany({
      status: TicketStatus.REVIEWED,
      type: type === "MIS" ? TicketType.MIS : TicketType.ITS,
    });
    return result.items;
  }

  /**
   * Get all secretary-related tickets (FOR_REVIEW + REVIEWED + CANCELLED)
   * For admin/director/secretary oversight to see pending, reviewed and rejected tickets
   */
  async getAllSecretaryTickets() {
    const result = await this.repository.findManyByStatuses([
      TicketStatus.FOR_REVIEW,
      TicketStatus.REVIEWED,
      TicketStatus.CANCELLED,
    ]);
    return result.items;
  }

  /**
   * Review ticket as secretary (mark as reviewed for director approval)
   */
  async reviewAsSecretary(
    ticketId: number,
    secretaryId: number,
    comment?: string,
  ) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.status !== TicketStatus.FOR_REVIEW) {
      throw new Error(
        "Ticket must be in FOR_REVIEW status for secretary review",
      );
    }

    // Get secretary name for notification
    const secretary = await this.prisma.user.findUnique({
      where: { id: secretaryId },
      select: { name: true },
    });

    // Atomic: status history + ticket update
    await this.prisma.$transaction(async (tx) => {
      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          userId: secretaryId,
          fromStatus: ticket.status, // FOR_REVIEW
          toStatus: TicketStatus.REVIEWED,
          comment: comment || "Reviewed by secretary",
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.REVIEWED,
          secretaryReviewedById: secretaryId,
          secretaryReviewedAt: new Date(),
        },
      });
    });

    // Send notifications
    try {
      // Notify ticket creator
      await this.notificationService.notifyTicketReviewed(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        secretary?.name || "Secretary",
      );
      // Notify directors that ticket is ready for approval
      await this.notificationService.notifyTicketReadyForDirectorApproval(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        secretary?.name || "Secretary",
      );
    } catch (err) {
      console.error("Failed to send review notifications:", err);
    }

    // Publish real-time event for status change
    pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
      ticketStatusChanged: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        oldStatus: TicketStatus.FOR_REVIEW,
        newStatus: TicketStatus.REVIEWED,
        changedBy: secretary?.name || "Secretary",
        timestamp: new Date().toISOString(),
      },
    });

    return this.repository.findById(ticketId);
  }

  /**
   * Reject ticket as secretary (return to user with notes)
   * Moves ticket to CANCELLED status with reason/notes visible to user
   */
  async rejectAsSecretary(
    ticketId: number,
    secretaryId: number,
    reason: string,
  ) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.status !== TicketStatus.FOR_REVIEW) {
      throw new Error(
        "Ticket must be in FOR_REVIEW status for secretary rejection",
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error("Rejection reason/notes are required");
    }

    // Get secretary name for notification
    const secretary = await this.prisma.user.findUnique({
      where: { id: secretaryId },
      select: { name: true },
    });

    // Atomic: status history + ticket update
    await this.prisma.$transaction(async (tx) => {
      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          userId: secretaryId,
          fromStatus: ticket.status, // FOR_REVIEW
          toStatus: TicketStatus.CANCELLED,
          comment: `Rejected by secretary: ${reason}`,
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.CANCELLED,
          secretaryReviewedById: secretaryId,
          secretaryReviewedAt: new Date(),
        },
      });
    });

    // Send notification to ticket creator
    try {
      await this.notificationService.notifyTicketRejected(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        secretary?.name || "Secretary",
        reason,
      );
    } catch (err) {
      console.error("Failed to send rejection notification:", err);
    }

    // Publish real-time event for status change
    pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
      ticketStatusChanged: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        oldStatus: TicketStatus.FOR_REVIEW,
        newStatus: TicketStatus.CANCELLED,
        changedBy: secretary?.name || "Secretary",
        timestamp: new Date().toISOString(),
      },
    });

    return this.repository.findById(ticketId);
  }

  /**
   * Approve ticket as director
   */
  async approveAsDirector(
    ticketId: number,
    directorId: number,
    comment?: string,
  ) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.status !== TicketStatus.REVIEWED) {
      throw new Error("Ticket must be reviewed by secretary first");
    }

    // Get director name for notification
    const director = await this.prisma.user.findUnique({
      where: { id: directorId },
      select: { name: true },
    });

    // Atomic: approval status history + ticket update
    await this.prisma.$transaction(async (tx) => {
      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          userId: directorId,
          fromStatus: ticket.status, // REVIEWED
          toStatus: TicketStatus.DIRECTOR_APPROVED,
          comment: comment || "Approved by director",
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.DIRECTOR_APPROVED,
          directorApprovedById: directorId,
          directorApprovedAt: new Date(),
        },
      });
    });

    // Send notification to ticket creator
    try {
      await this.notificationService.notifyTicketApproved(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        director?.name || "Director",
      );
    } catch (err) {
      console.error("Failed to send approval notification:", err);
    }

    // Publish real-time event for director approval status change
    pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
      ticketStatusChanged: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        oldStatus: TicketStatus.REVIEWED,
        newStatus: TicketStatus.DIRECTOR_APPROVED,
        changedBy: director?.name || "Director",
        timestamp: new Date().toISOString(),
      },
    });

    // Auto-assign to appropriate team after director approval
    try {
      const assignment = await this.autoAssignment.assignTicket(
        ticketId,
        ticket.type,
      );

      // Atomic: assignment status history + ticket status update
      await this.prisma.$transaction(async (tx) => {
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            userId: directorId, // System action triggered by director
            fromStatus: TicketStatus.DIRECTOR_APPROVED,
            toStatus: TicketStatus.ASSIGNED,
            comment: `Auto-assigned to ${ticket.type === "MIS" ? "MIS" : "ITS"} department head`,
          },
        });

        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: TicketStatus.ASSIGNED },
        });
      });

      // Notify the assigned office head
      if (assignment?.userId) {
        await this.notificationService.notifyTicketAssigned(
          ticketId,
          ticket.ticketNumber,
          ticket.title,
          assignment.userId,
          "System (Auto-Assignment)",
        );
      }
    } catch (error) {
      console.error(
        "Failed to auto-assign ticket after director approval:",
        error,
      );
    }

    return this.repository.findById(ticketId);
  }

  /**
   * Disapprove/Reject ticket as director
   * Moves ticket to CANCELLED status with reason
   */
  async disapproveAsDirector(
    ticketId: number,
    directorId: number,
    reason: string,
  ) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.status !== TicketStatus.REVIEWED) {
      throw new Error("Ticket must be reviewed by secretary first");
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error("Disapproval reason is required");
    }

    // Get director name for notification
    const director = await this.prisma.user.findUnique({
      where: { id: directorId },
      select: { name: true },
    });

    // Atomic: status history + ticket update
    await this.prisma.$transaction(async (tx) => {
      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          userId: directorId,
          fromStatus: ticket.status, // REVIEWED
          toStatus: TicketStatus.CANCELLED,
          comment: `Disapproved by director: ${reason}`,
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.CANCELLED,
          directorApprovedById: directorId, // Track who made the decision
          directorApprovedAt: new Date(), // Track when decision was made
        },
      });
    });

    // Send notification to ticket creator
    try {
      await this.notificationService.notifyTicketDisapproved(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        director?.name || "Director",
        reason,
      );
    } catch (err) {
      console.error("Failed to send disapproval notification:", err);
    }

    // Publish real-time event for disapproval
    pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
      ticketStatusChanged: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        oldStatus: TicketStatus.REVIEWED,
        newStatus: TicketStatus.CANCELLED,
        changedBy: director?.name || "Director",
        timestamp: new Date().toISOString(),
      },
    });

    return this.repository.findById(ticketId);
  }

  /**
   * Reopen a rejected/cancelled ticket for re-review
   * User can update the ticket details and resubmit
   */
  async reopenTicket(
    ticketId: number,
    userId: number,
    updatedDescription?: string,
    comment?: string,
  ) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Only CANCELLED tickets can be reopened
    if (ticket.status !== TicketStatus.CANCELLED) {
      throw new Error("Only cancelled/rejected tickets can be reopened");
    }

    // Only the original creator can reopen the ticket
    if (ticket.createdById !== userId) {
      throw new Error("Only the ticket creator can reopen this ticket");
    }

    // Get user name for notification
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Atomic: status history + ticket update + optional note
    await this.prisma.$transaction(async (tx) => {
      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          userId,
          fromStatus: TicketStatus.CANCELLED,
          toStatus: TicketStatus.FOR_REVIEW,
          comment: comment || "Ticket reopened for re-review",
        },
      });

      // Update ticket - reset to FOR_REVIEW, clear previous review data
      const updateData: any = {
        status: TicketStatus.FOR_REVIEW,
        secretaryReviewedById: null,
        secretaryReviewedAt: null,
        directorApprovedById: null,
        directorApprovedAt: null,
      };

      // If user provided updated description, update it
      if (updatedDescription && updatedDescription.trim().length > 0) {
        updateData.description = updatedDescription.trim();
      }

      await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });

      // Add a note about the reopen if comment provided
      if (comment && comment.trim().length > 0) {
        await tx.ticketNote.create({
          data: {
            ticketId,
            userId,
            content: `Ticket reopened: ${comment.trim()}`,
            isInternal: false,
          },
        });
      }
    });

    // Notify secretaries about reopened ticket
    try {
      await this.notificationService.notifyNewTicketForReview(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        user?.name || "User",
      );
    } catch (err) {
      console.error("Failed to send reopen notification:", err);
    }

    // Publish real-time event for reopen status change
    pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
      ticketStatusChanged: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        oldStatus: TicketStatus.CANCELLED,
        newStatus: TicketStatus.FOR_REVIEW,
        changedBy: user?.name || "User",
        timestamp: new Date().toISOString(),
      },
    });

    return this.repository.findById(ticketId);
  }

  // ========================================
  // HEAD WORKFLOW METHODS (Simplified)
  // ========================================

  /**
   * Head acknowledges ticket and assigns a developer name
   * Transitions from ASSIGNED → PENDING (default status while developer works)
   * Head sets: developer name, optional dates, optional notes
   */
  async acknowledgeAndAssignDeveloper(
    ticketId: number,
    headId: number,
    assignedDeveloperName: string,
    options?: {
      assignToUserId?: number;
      dateToVisit?: Date;
      targetCompletionDate?: Date;
      comment?: string;
    },
  ) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.status !== TicketStatus.ASSIGNED) {
      throw new Error(
        "Ticket must be in ASSIGNED status to acknowledge and assign developer",
      );
    }

    if (!assignedDeveloperName || assignedDeveloperName.trim().length === 0) {
      throw new Error("Developer name is required");
    }

    const head = await this.prisma.user.findUnique({
      where: { id: headId },
      select: { name: true, role: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: TicketStatus.PENDING,
        assignedDeveloperName: assignedDeveloperName.trim(),
      };

      if (options?.dateToVisit) {
        updateData.dateToVisit = options.dateToVisit;
      }
      if (options?.targetCompletionDate) {
        updateData.targetCompletionDate = options.targetCompletionDate;
      }

      await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });

      // If a staff member was selected, assign them to the ticket
      if (options?.assignToUserId) {
        // Check if already assigned
        const existingAssignment = await tx.ticketAssignment.findFirst({
          where: { ticketId, userId: options.assignToUserId },
        });
        if (!existingAssignment) {
          await tx.ticketAssignment.create({
            data: {
              ticketId,
              userId: options.assignToUserId,
            },
          });
        }
      }

      const commentText =
        options?.comment ||
        `Acknowledged by ${head?.name || "Head"}, assigned to developer: ${assignedDeveloperName.trim()}`;

      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          userId: headId,
          fromStatus: TicketStatus.ASSIGNED,
          toStatus: TicketStatus.PENDING,
          comment: commentText,
        },
      });

      // Add internal note with assignment details
      let noteContent = `Developer assigned: **${assignedDeveloperName.trim()}**`;
      if (options?.dateToVisit) {
        noteContent += `\nVisit date: ${options.dateToVisit.toLocaleDateString()}`;
      }
      if (options?.targetCompletionDate) {
        noteContent += `\nTarget completion: ${options.targetCompletionDate.toLocaleDateString()}`;
      }
      if (options?.comment) {
        noteContent += `\nNotes: ${options.comment}`;
      }

      await tx.ticketNote.create({
        data: {
          ticketId,
          userId: headId,
          content: noteContent,
          isInternal: true,
        },
      });
    });

    // Notify ticket creator that their ticket is being worked on
    try {
      await this.notificationService.notifyStatusChanged(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        TicketStatus.ASSIGNED,
        TicketStatus.PENDING,
        head?.name || "Department Head",
      );
    } catch (err) {
      console.error("Failed to send acknowledge notification:", err);
    }

    pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
      ticketStatusChanged: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        oldStatus: TicketStatus.ASSIGNED,
        newStatus: TicketStatus.PENDING,
        changedBy: head?.name || "Department Head",
        timestamp: new Date().toISOString(),
      },
    });

    return this.repository.findById(ticketId);
  }

  /**
   * Head updates resolution after developer hands back finished work
   * Sets resolution text, dateFinished, and optionally updates status
   */
  async updateResolution(
    ticketId: number,
    headId: number,
    resolution: string,
    options?: {
      dateFinished?: Date;
      status?: TicketStatus;
      comment?: string;
      solutionVisibility?: string;
    },
  ) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Allow resolution update on active tickets
    const allowedStatuses: string[] = [
      TicketStatus.PENDING,
      TicketStatus.IN_PROGRESS,
      TicketStatus.ON_HOLD,
      TicketStatus.RESOLVED,
    ];
    if (!allowedStatuses.includes(ticket.status)) {
      throw new Error(
        "Ticket must be in PENDING, IN_PROGRESS, ON_HOLD, or RESOLVED status to update resolution",
      );
    }

    if (!resolution || resolution.trim().length === 0) {
      throw new Error("Resolution text is required");
    }

    const head = await this.prisma.user.findUnique({
      where: { id: headId },
      select: { name: true },
    });

    const newStatus = options?.status || TicketStatus.RESOLVED;
    const dateFinished = options?.dateFinished || new Date();

    await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        resolution: resolution.trim(),
        dateFinished,
      };

      // Update status if it's changing
      if (newStatus !== ticket.status) {
        updateData.status = newStatus;
        if (newStatus === TicketStatus.RESOLVED) {
          updateData.resolvedAt = new Date();
        }
        if (newStatus === TicketStatus.CLOSED) {
          updateData.closedAt = new Date();
        }
      }

      await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
      });

      if (newStatus !== ticket.status) {
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            userId: headId,
            fromStatus: ticket.status as TicketStatus,
            toStatus: newStatus,
            comment:
              options?.comment ||
              `Resolution added: ${resolution.trim().substring(0, 100)}...`,
          },
        });
      }

      // Add public note with the resolution visible to user
      await tx.ticketNote.create({
        data: {
          ticketId,
          userId: headId,
          content: `**Resolution:**\n${resolution.trim()}${options?.comment ? `\n\n**Notes:** ${options.comment}` : ""}`,
          isInternal: false,
        },
      });
    });

    // Notify user about resolution
    if (ticket.createdById !== headId) {
      try {
        await this.notificationService.notifyStatusChanged(
          ticketId,
          ticket.ticketNumber,
          ticket.title,
          ticket.createdById,
          ticket.status as TicketStatus,
          newStatus,
          head?.name || "Department Head",
        );
      } catch (err) {
        console.error("Failed to send resolution notification:", err);
      }
    }

    if (newStatus !== ticket.status) {
      pubsub.publish(EVENTS.TICKET_STATUS_CHANGED, {
        ticketStatusChanged: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          oldStatus: ticket.status,
          newStatus,
          changedBy: head?.name || "Department Head",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Auto-save resolution as a TroubleshootingSolution for future AI retrieval
    if (
      newStatus === TicketStatus.RESOLVED ||
      newStatus === TicketStatus.CLOSED
    ) {
      const solutionVisibility = options?.solutionVisibility || "INTERNAL";
      import("../../solutions/solution.service")
        .then(({ solutionService }) =>
          solutionService.createFromResolvedTicket(
            ticketId,
            headId,
            solutionVisibility,
          ),
        )
        .catch((err) => console.error("Failed to auto-create solution:", err));
    }

    return this.repository.findById(ticketId);
  }

  /**
   * Generate control number using atomic upsert (safe from race conditions)
   */
}
