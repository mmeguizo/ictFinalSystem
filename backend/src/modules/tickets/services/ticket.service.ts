import { PrismaClient, Priority, TicketStatus, TicketType } from '@prisma/client';
import { TicketRepository } from '../ticket.repository';
import { AutoAssignmentService } from './auto-assignment.service';
import { CreateMISTicketDto } from '../dto/create-mis-ticket.dto';
import { CreateITSTicketDto } from '../dto/create-its-ticket.dto';
import { UpdateTicketStatusDto } from '../dto/update-ticket-status.dto';
import { CreateTicketNoteDto } from '../dto/create-ticket-note.dto';
import { calculateDueDate, calculateEstimatedDuration } from '../utils/sla.utils';
import { NotificationService } from '../../notifications/notification.service';

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
    const ticketNumber = await this.repository.generateTicketNumber(TicketType.MIS);
    const controlNumber = await this.repository.generateControlNumber();
    const priority = dto.priority || Priority.MEDIUM;
    const dueDate = calculateDueDate(priority);
    const estimatedDuration =
      dto.estimatedDuration || calculateEstimatedDuration(TicketType.MIS, priority);

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
        creator?.name || 'Unknown User'
      );
    } catch (err) {
      console.error('Failed to send new ticket notification:', err);
    }

    // Ticket starts in FOR_REVIEW status for secretary review
    // Auto-assignment happens after director approval (in approveAsDirector)
    return this.repository.findById(ticket.id);
  }

  /**
   * Create a new ITS ticket
   */
  async createITSTicket(dto: CreateITSTicketDto, createdById: number) {
    const ticketNumber = await this.repository.generateTicketNumber(TicketType.ITS);
    const priority = dto.priority || Priority.MEDIUM;
    const dueDate = calculateDueDate(priority);
    const estimatedDuration =
      dto.estimatedDuration || calculateEstimatedDuration(TicketType.ITS, priority);

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
        creator?.name || 'Unknown User'
      );
    } catch (err) {
      console.error('Failed to send new ticket notification:', err);
    }

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
      throw new Error('Ticket not found');
    }
    return ticket;
  }

  /**
   * Get ticket by ticket number
   */
  async getTicketByNumber(ticketNumber: string) {
    const ticket = await this.repository.findByTicketNumber(ticketNumber);
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    return ticket;
  }

  /**
   * Get tickets with optional filters
   */
  async getTickets(filters?: {
    status?: TicketStatus;
    type?: TicketType;
    createdById?: number;
    assignedToUserId?: number;
  }) {
    return this.repository.findMany(filters);
  }

  /**
   * Update ticket status
   * Notifies ticket creator when status changes (e.g., developer starts/resolves)
   */
  async updateStatus(ticketId: number, userId: number, dto: UpdateTicketStatusDto) {
    // Get ticket and user info before update for notification
    const ticket = await this.repository.findById(ticketId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const fromStatus = ticket.status;
    const result = await this.repository.updateStatus(ticketId, userId, dto.status, dto.comment);

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
          user?.name || 'Staff'
        );
      } catch (err) {
        console.error('Failed to send status change notification:', err);
      }
    }

    return result;
  }

  /**
   * Assign user to ticket
   * @param ticketId - The ticket to assign
   * @param userId - The user being assigned to the ticket
   * @param assignedById - The user performing the assignment (e.g., MIS_HEAD)
   * Notifies the assigned user about the new assignment
   */
  async assignUser(ticketId: number, userId: number, assignedById?: number) {
    // Get ticket and assigner info for notification
    const ticket = await this.repository.findById(ticketId);
    const assigner = assignedById
      ? await this.prisma.user.findUnique({
          where: { id: assignedById },
          select: { name: true },
        })
      : null;

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const result = await this.autoAssignment.manualAssign(ticketId, userId, assignedById);

    // Notify the assigned user
    try {
      await this.notificationService.notifyTicketAssigned(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        userId,
        assigner?.name || 'Department Head'
      );
    } catch (err) {
      console.error('Failed to send assignment notification:', err);
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
      throw new Error('Ticket not found');
    }

    const result = await this.repository.addNote(ticketId, userId, dto.content, dto.isInternal || false);

    // Send notifications
    try {
      if (dto.isInternal) {
        // Internal note: notify other assigned staff (not the author)
        const otherAssignees = ticket.assignments?.filter(a => a.user.id !== userId) || [];
        for (const assignee of otherAssignees) {
          await this.notificationService.notifyNoteAdded(
            ticketId,
            ticket.ticketNumber,
            ticket.title,
            assignee.user.id,
            author?.name || 'Staff',
            true
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
              author?.name || 'User',
              false
            );
          }
        } else {
          // Staff added a public comment - notify ticket creator
          await this.notificationService.notifyNoteAdded(
            ticketId,
            ticket.ticketNumber,
            ticket.title,
            ticket.createdById,
            author?.name || 'Staff',
            false
          );
        }
      }
    } catch (err) {
      console.error('Failed to send note notification:', err);
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
   * Get user's assigned tickets
   */
  async getUserTickets(userId: number) {
    return this.repository.findMany({ assignedToUserId: userId });
  }

  /**
   * Get user's created tickets
   */
  async getUserCreatedTickets(userId: number) {
    return this.repository.findMany({ createdById: userId });
  }

  /**
   * Get tickets for secretary review (FOR_REVIEW status)
   */
  async getTicketsForSecretaryReview() {
    return this.repository.findMany({ status: TicketStatus.FOR_REVIEW });
  }

  /**
   * Get tickets pending director approval (REVIEWED status)
   */
  async getTicketsPendingDirectorApproval() {
    return this.repository.findMany({ status: TicketStatus.REVIEWED });
  }

  /**
   * Get all secretary-related tickets (FOR_REVIEW + REVIEWED + CANCELLED)
   * For admin/director/secretary oversight to see pending, reviewed and rejected tickets
   */
  async getAllSecretaryTickets() {
    return this.repository.findManyByStatuses([TicketStatus.FOR_REVIEW, TicketStatus.REVIEWED, TicketStatus.CANCELLED]);
  }

  /**
   * Review ticket as secretary (mark as reviewed for director approval)
   */
  async reviewAsSecretary(ticketId: number, secretaryId: number, comment?: string) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status !== TicketStatus.FOR_REVIEW) {
      throw new Error('Ticket must be in FOR_REVIEW status for secretary review');
    }

    // Get secretary name for notification
    const secretary = await this.prisma.user.findUnique({
      where: { id: secretaryId },
      select: { name: true },
    });

    // Add status history BEFORE updating (so fromStatus is captured correctly)
    await this.prisma.ticketStatusHistory.create({
      data: {
        ticketId,
        userId: secretaryId,
        fromStatus: ticket.status, // FOR_REVIEW
        toStatus: TicketStatus.REVIEWED,
        comment: comment || 'Reviewed by secretary',
      },
    });

    // Update ticket with secretary review
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.REVIEWED,
        secretaryReviewedById: secretaryId,
        secretaryReviewedAt: new Date(),
      },
    });

    // Send notifications
    try {
      // Notify ticket creator
      await this.notificationService.notifyTicketReviewed(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        secretary?.name || 'Secretary'
      );
      // Notify directors that ticket is ready for approval
      await this.notificationService.notifyTicketReadyForDirectorApproval(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        secretary?.name || 'Secretary'
      );
    } catch (err) {
      console.error('Failed to send review notifications:', err);
    }

    return this.repository.findById(ticketId);
  }

  /**
   * Reject ticket as secretary (return to user with notes)
   * Moves ticket to CANCELLED status with reason/notes visible to user
   */
  async rejectAsSecretary(ticketId: number, secretaryId: number, reason: string) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status !== TicketStatus.FOR_REVIEW) {
      throw new Error('Ticket must be in FOR_REVIEW status for secretary rejection');
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('Rejection reason/notes are required');
    }

    // Get secretary name for notification
    const secretary = await this.prisma.user.findUnique({
      where: { id: secretaryId },
      select: { name: true },
    });

    // Add status history with rejection reason (visible to user)
    await this.prisma.ticketStatusHistory.create({
      data: {
        ticketId,
        userId: secretaryId,
        fromStatus: ticket.status, // FOR_REVIEW
        toStatus: TicketStatus.CANCELLED,
        comment: `Rejected by secretary: ${reason}`,
      },
    });

    // Update ticket status to CANCELLED
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CANCELLED,
        secretaryReviewedById: secretaryId,
        secretaryReviewedAt: new Date(),
      },
    });

    // Send notification to ticket creator
    try {
      await this.notificationService.notifyTicketRejected(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        secretary?.name || 'Secretary',
        reason
      );
    } catch (err) {
      console.error('Failed to send rejection notification:', err);
    }

    return this.repository.findById(ticketId);
  }

  /**
   * Approve ticket as director
   */
  async approveAsDirector(ticketId: number, directorId: number, comment?: string) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status !== TicketStatus.REVIEWED) {
      throw new Error('Ticket must be reviewed by secretary first');
    }

    // Get director name for notification
    const director = await this.prisma.user.findUnique({
      where: { id: directorId },
      select: { name: true },
    });

    // Add status history BEFORE updating (so fromStatus is captured correctly)
    await this.prisma.ticketStatusHistory.create({
      data: {
        ticketId,
        userId: directorId,
        fromStatus: ticket.status, // REVIEWED
        toStatus: TicketStatus.DIRECTOR_APPROVED,
        comment: comment || 'Approved by director',
      },
    });

    // Update ticket with director approval
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.DIRECTOR_APPROVED,
        directorApprovedById: directorId,
        directorApprovedAt: new Date(),
      },
    });

    // Send notification to ticket creator
    try {
      await this.notificationService.notifyTicketApproved(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        director?.name || 'Director'
      );
    } catch (err) {
      console.error('Failed to send approval notification:', err);
    }

    // Auto-assign to appropriate team after director approval
    try {
      const assignment = await this.autoAssignment.assignTicket(ticketId, ticket.type);
      
      // Add status history for auto-assignment transition
      await this.prisma.ticketStatusHistory.create({
        data: {
          ticketId,
          userId: directorId, // System action triggered by director
          fromStatus: TicketStatus.DIRECTOR_APPROVED,
          toStatus: TicketStatus.ASSIGNED,
          comment: `Auto-assigned to ${ticket.type === 'MIS' ? 'MIS' : 'ITS'} department head`,
        },
      });

      // Update status to ASSIGNED after assignment
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.ASSIGNED },
      });

      // Notify the assigned office head
      if (assignment?.userId) {
        await this.notificationService.notifyTicketAssigned(
          ticketId,
          ticket.ticketNumber,
          ticket.title,
          assignment.userId,
          'System (Auto-Assignment)'
        );
      }
    } catch (error) {
      console.error('Failed to auto-assign ticket after director approval:', error);
    }

    return this.repository.findById(ticketId);
  }

  /**
   * Disapprove/Reject ticket as director
   * Moves ticket to CANCELLED status with reason
   */
  async disapproveAsDirector(ticketId: number, directorId: number, reason: string) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status !== TicketStatus.REVIEWED) {
      throw new Error('Ticket must be reviewed by secretary first');
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('Disapproval reason is required');
    }

    // Get director name for notification
    const director = await this.prisma.user.findUnique({
      where: { id: directorId },
      select: { name: true },
    });

    // Add status history with disapproval reason
    await this.prisma.ticketStatusHistory.create({
      data: {
        ticketId,
        userId: directorId,
        fromStatus: ticket.status, // REVIEWED
        toStatus: TicketStatus.CANCELLED,
        comment: `Disapproved by director: ${reason}`,
      },
    });

    // Update ticket status to CANCELLED
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CANCELLED,
        directorApprovedById: directorId, // Track who made the decision
        directorApprovedAt: new Date(),   // Track when decision was made
      },
    });

    // Send notification to ticket creator
    try {
      await this.notificationService.notifyTicketDisapproved(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        ticket.createdById,
        director?.name || 'Director',
        reason
      );
    } catch (err) {
      console.error('Failed to send disapproval notification:', err);
    }

    return this.repository.findById(ticketId);
  }

  /**
   * Reopen a rejected/cancelled ticket for re-review
   * User can update the ticket details and resubmit
   */
  async reopenTicket(ticketId: number, userId: number, updatedDescription?: string, comment?: string) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Only CANCELLED tickets can be reopened
    if (ticket.status !== TicketStatus.CANCELLED) {
      throw new Error('Only cancelled/rejected tickets can be reopened');
    }

    // Only the original creator can reopen the ticket
    if (ticket.createdById !== userId) {
      throw new Error('Only the ticket creator can reopen this ticket');
    }

    // Get user name for notification
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Add status history for reopen
    await this.prisma.ticketStatusHistory.create({
      data: {
        ticketId,
        userId,
        fromStatus: TicketStatus.CANCELLED,
        toStatus: TicketStatus.FOR_REVIEW,
        comment: comment || 'Ticket reopened for re-review',
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

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
    });

    // Add a note about the reopen if comment provided
    if (comment && comment.trim().length > 0) {
      await this.prisma.ticketNote.create({
        data: {
          ticketId,
          userId,
          content: `Ticket reopened: ${comment.trim()}`,
          isInternal: false,
        },
      });
    }

    // Notify secretaries about reopened ticket
    try {
      await this.notificationService.notifyNewTicketForReview(
        ticketId,
        ticket.ticketNumber,
        ticket.title,
        user?.name || 'User'
      );
    } catch (err) {
      console.error('Failed to send reopen notification:', err);
    }

    return this.repository.findById(ticketId);
  }


  /**
 * Generate control number using atomic upsert (safe from race conditions)
 */




}