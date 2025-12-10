import { PrismaClient, Ticket, TicketStatus, TicketType, Prisma } from '@prisma/client';

export class TicketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generate a unique ticket number
   * Format: TYP-YYYYMMDD-XXX (e.g., MIS-20251209-001)
   */
  async generateTicketNumber(type: TicketType): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `${type}-${dateStr}`;

    // Find the last ticket number for today
    const lastTicket = await this.prisma.ticket.findFirst({
      where: {
        ticketNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        ticketNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(lastTicket.ticketNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  async create(data: Prisma.TicketCreateInput): Promise<Ticket> {
    return this.prisma.ticket.create({
      data,
      include: {
        createdBy: true,
        misTicket: true,
        itsTicket: true,
        assignments: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findById(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: true,
        misTicket: true,
        itsTicket: true,
        assignments: {
          include: {
            user: true,
          },
        },
        notes: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        attachments: true,
        statusHistory: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async findByTicketNumber(ticketNumber: string) {
    return this.prisma.ticket.findUnique({
      where: { ticketNumber },
      include: {
        createdBy: true,
        misTicket: true,
        itsTicket: true,
        assignments: {
          include: {
            user: true,
          },
        },
        notes: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        statusHistory: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async findMany(filters?: {
    status?: TicketStatus;
    type?: TicketType;
    createdById?: number;
    assignedToUserId?: number;
  }) {
    const where: Prisma.TicketWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.createdById) {
      where.createdById = filters.createdById;
    }

    if (filters?.assignedToUserId) {
      where.assignments = {
        some: {
          userId: filters.assignedToUserId,
        },
      };
    }

    return this.prisma.ticket.findMany({
      where,
      include: {
        createdBy: true,
        misTicket: true,
        itsTicket: true,
        assignments: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateStatus(
    ticketId: number,
    userId: number,
    status: TicketStatus,
    comment?: string
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const now = new Date();
    const updateData: Prisma.TicketUpdateInput = {
      status,
      updatedAt: now,
    };

    if (status === TicketStatus.RESOLVED) {
      updateData.resolvedAt = now;
    } else if (status === TicketStatus.CLOSED) {
      updateData.closedAt = now;
    }

    // Update ticket and create history entry in a transaction
    return this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: updateData,
      }),
      this.prisma.ticketStatusHistory.create({
        data: {
          ticketId,
          userId,
          fromStatus: ticket.status,
          toStatus: status,
          comment,
        },
      }),
    ]);
  }

  async assignUser(ticketId: number, userId: number) {
    return this.prisma.ticketAssignment.create({
      data: {
        ticketId,
        userId,
      },
    });
  }

  async unassignUser(ticketId: number, userId: number) {
    return this.prisma.ticketAssignment.deleteMany({
      where: {
        ticketId,
        userId,
      },
    });
  }

  async addNote(ticketId: number, userId: number, content: string, isInternal = false) {
    return this.prisma.ticketNote.create({
      data: {
        ticketId,
        userId,
        content,
        isInternal,
      },
      include: {
        user: true,
      },
    });
  }

  async addAttachment(
    ticketId: number,
    filename: string,
    originalName: string,
    mimeType: string,
    size: number,
    url: string
  ) {
    return this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        filename,
        originalName,
        mimeType,
        size,
        url,
      },
    });
  }

  /**
   * Get analytics data for dashboard
   */
  async getAnalytics(filters?: { startDate?: Date; endDate?: Date }) {
    const where: Prisma.TicketWhereInput = {};

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [statusCounts, typeCounts, priorityCounts, total] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.ticket.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      total,
      byStatus: statusCounts,
      byType: typeCounts,
      byPriority: priorityCounts,
    };
  }

  /**
   * Get SLA compliance metrics
   */
  async getSLAMetrics() {
    const now = new Date();

    const [overdue, dueToday, dueSoon] = await Promise.all([
      // Overdue tickets
      this.prisma.ticket.count({
        where: {
          dueDate: {
            lt: now,
          },
          status: {
            notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED],
          },
        },
      }),
      // Due today
      this.prisma.ticket.count({
        where: {
          dueDate: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
            lt: new Date(now.setHours(23, 59, 59, 999)),
          },
          status: {
            notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED],
          },
        },
      }),
      // Due within 3 days
      this.prisma.ticket.count({
        where: {
          dueDate: {
            gte: now,
            lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          },
          status: {
            notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED],
          },
        },
      }),
    ]);

    return {
      overdue,
      dueToday,
      dueSoon,
    };
  }
}
