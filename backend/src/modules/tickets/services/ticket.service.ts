import { PrismaClient, Priority, TicketStatus, TicketType } from '@prisma/client';
import { TicketRepository } from '../ticket.repository';
import { AutoAssignmentService } from './auto-assignment.service';
import { CreateMISTicketDto } from '../dto/create-mis-ticket.dto';
import { CreateITSTicketDto } from '../dto/create-its-ticket.dto';
import { UpdateTicketStatusDto } from '../dto/update-ticket-status.dto';
import { CreateTicketNoteDto } from '../dto/create-ticket-note.dto';
import { calculateDueDate, calculateEstimatedDuration } from '../utils/sla.utils';

export class TicketService {
  private readonly repository: TicketRepository;
  private readonly autoAssignment: AutoAssignmentService;

  constructor(private readonly prisma: PrismaClient) {
    this.repository = new TicketRepository(prisma);
    this.autoAssignment = new AutoAssignmentService(prisma);
  }

  /**
   * Create a new MIS ticket
   */
  async createMISTicket(dto: CreateMISTicketDto, createdById: number) {
    const ticketNumber = await this.repository.generateTicketNumber(TicketType.MIS);
    const priority = dto.priority || Priority.MEDIUM;
    const dueDate = calculateDueDate(priority);
    const estimatedDuration =
      dto.estimatedDuration || calculateEstimatedDuration(TicketType.MIS, priority);

    // Create ticket with MIS-specific data
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
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

    // Auto-assign ticket
    try {
      await this.autoAssignment.assignTicket(ticket.id, TicketType.MIS);
    } catch (error) {
      console.error('Failed to auto-assign ticket:', error);
      // Continue even if auto-assignment fails
    }

    // Fetch updated ticket with assignments
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

    // Auto-assign ticket
    try {
      await this.autoAssignment.assignTicket(ticket.id, TicketType.ITS);
    } catch (error) {
      console.error('Failed to auto-assign ticket:', error);
      // Continue even if auto-assignment fails
    }

    // Fetch updated ticket with assignments
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
   */
  async updateStatus(ticketId: number, userId: number, dto: UpdateTicketStatusDto) {
    return this.repository.updateStatus(ticketId, userId, dto.status, dto.comment);
  }

  /**
   * Assign user to ticket
   */
  async assignUser(ticketId: number, userId: number) {
    return this.autoAssignment.manualAssign(ticketId, userId);
  }

  /**
   * Unassign user from ticket
   */
  async unassignUser(ticketId: number, userId: number) {
    return this.autoAssignment.unassign(ticketId, userId);
  }

  /**
   * Add note to ticket
   */
  async addNote(ticketId: number, userId: number, dto: CreateTicketNoteDto) {
    return this.repository.addNote(ticketId, userId, dto.content, dto.isInternal || false);
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
   * Get tickets pending secretary approval (PENDING status)
   */
  async getTicketsPendingSecretaryApproval() {
    return this.repository.findMany({ status: TicketStatus.PENDING });
  }

  /**
   * Get tickets pending director approval (SECRETARY_APPROVED status)
   */
  async getTicketsPendingDirectorApproval() {
    return this.repository.findMany({ status: TicketStatus.SECRETARY_APPROVED });
  }

  /**
   * Get all secretary-related tickets (PENDING + SECRETARY_APPROVED)
   * For admin/director oversight to see which tickets are waiting vs approved
   */
  async getAllSecretaryTickets() {
    return this.repository.findManyByStatuses([TicketStatus.PENDING, TicketStatus.SECRETARY_APPROVED]);
  }

  /**
   * Approve ticket as secretary
   */
  async approveAsSecretary(ticketId: number, secretaryId: number, comment?: string) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status !== TicketStatus.PENDING) {
      throw new Error('Ticket must be in PENDING status for secretary approval');
    }

    // Update ticket with secretary approval
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.SECRETARY_APPROVED,
        secretaryApprovedById: secretaryId,
        secretaryApprovedAt: new Date(),
      },
    });

    // Add status history
    await this.repository.updateStatus(
      ticketId,
      secretaryId,
      TicketStatus.SECRETARY_APPROVED,
      comment || 'Approved by secretary'
    );

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

    if (ticket.status !== TicketStatus.SECRETARY_APPROVED) {
      throw new Error('Ticket must be approved by secretary first');
    }

    // Update ticket with director approval
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.DIRECTOR_APPROVED,
        directorApprovedById: directorId,
        directorApprovedAt: new Date(),
      },
    });

    // Add status history
    await this.repository.updateStatus(
      ticketId,
      directorId,
      TicketStatus.DIRECTOR_APPROVED,
      comment || 'Approved by director'
    );

    // Auto-assign to appropriate team after director approval
    try {
      await this.autoAssignment.assignTicket(ticketId, ticket.type);
      
      // Update status to ASSIGNED after assignment
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.ASSIGNED },
      });
    } catch (error) {
      console.error('Failed to auto-assign ticket after director approval:', error);
    }

    return this.repository.findById(ticketId);
  }
}
