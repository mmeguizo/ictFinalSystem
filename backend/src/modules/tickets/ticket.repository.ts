import {
  PrismaClient,
  Ticket,
  TicketStatus,
  TicketType,
  Prisma,
} from "@prisma/client";

/**
 * Pagination parameters for list queries
 * Complexity: O(1) for parameter processing
 */
export interface PaginationParams {
  page?: number; // 1-based page number (default: 1)
  pageSize?: number; // Items per page (default: 20, max: 100)
  sortField?: string; // Field to sort by (default: 'createdAt')
  sortOrder?: string; // 'asc' | 'desc' (default: 'desc')
}

/**
 * Paginated response wrapper
 * Contains items + metadata for offset-based pagination
 */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Shared include block for ticket list queries.
 * Extracted to avoid copy-pasting across 15+ methods.
 */
const TICKET_LIST_INCLUDE = {
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
      createdAt: "desc" as const,
    },
  },
  statusHistory: {
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
} satisfies Prisma.TicketInclude;

export class TicketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Normalize pagination parameters with sensible defaults.
   * Clamps pageSize to [1, 100] to prevent unbounded queries.
   * Complexity: O(1)
   */
  private normalizePagination(params?: PaginationParams) {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize || 20));
    const sortField = params?.sortField || "createdAt";
    const sortOrder = (
      params?.sortOrder === "asc" ? "asc" : "desc"
    ) as Prisma.SortOrder;
    const skip = (page - 1) * pageSize;
    return { page, pageSize, sortField, sortOrder, skip };
  }

  /**
   * Build a PaginatedResult from items and total count.
   * Complexity: O(1) — pure arithmetic
   */
  private buildPaginatedResult<T>(
    items: T[],
    totalCount: number,
    page: number,
    pageSize: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(totalCount / pageSize);
    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Generate a unique ticket number
   * Format: TYP-YYYYMMDD-XXX (e.g., MIS-20251209-001)
   */
  async generateTicketNumber(type: TicketType): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `${type}-${dateStr}`;

    // Find the last ticket number for today
    const lastTicket = await this.prisma.ticket.findFirst({
      where: {
        ticketNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        ticketNumber: "desc",
      },
    });

    let sequence = 1;
    if (lastTicket) {
      const lastSequence = parseInt(lastTicket.ticketNumber.split("-")[2]);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, "0")}`;
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
            createdAt: "desc",
          },
        },
        attachments: {
          include: {
            uploadedBy: true,
            deletedBy: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        statusHistory: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "desc",
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
            createdAt: "desc",
          },
        },
        attachments: {
          include: {
            uploadedBy: true,
            deletedBy: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        statusHistory: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
  }

  async findMany(
    filters?: {
      status?: TicketStatus;
      type?: TicketType;
      createdById?: number;
      assignedToUserId?: number;
    },
    pagination?: PaginationParams,
  ) {
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

    const { page, pageSize, sortField, sortOrder, skip } =
      this.normalizePagination(pagination);

    // Execute count and data fetch in parallel — O(log n) with indexes
    const [totalCount, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: TICKET_LIST_INCLUDE,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: pageSize,
      }),
    ]);

    return this.buildPaginatedResult(items, totalCount, page, pageSize);
  }

  /**
   * Find tickets by multiple statuses (e.g., FOR_REVIEW + REVIEWED)
   * Complexity: O(log n) with composite index on (type, status)
   */
  async findManyByStatuses(
    statuses: TicketStatus[],
    pagination?: PaginationParams,
  ) {
    const where: Prisma.TicketWhereInput = {
      status: { in: statuses },
    };

    const { page, pageSize, sortField, sortOrder, skip } =
      this.normalizePagination(pagination);

    const [totalCount, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: TICKET_LIST_INCLUDE,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: pageSize,
      }),
    ]);

    return this.buildPaginatedResult(items, totalCount, page, pageSize);
  }

  /**
   * Find tickets by type and multiple statuses
   * Used for Office Heads to see all tickets of their type in work statuses
   * Complexity: O(log n) with composite index on (type, status)
   */
  async findManyByTypeAndStatuses(
    type: TicketType,
    statuses: TicketStatus[],
    pagination?: PaginationParams,
  ) {
    const where: Prisma.TicketWhereInput = {
      type,
      status: { in: statuses },
    };

    const { page, pageSize, sortField, sortOrder, skip } =
      this.normalizePagination(pagination);

    const [totalCount, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: TICKET_LIST_INCLUDE,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: pageSize,
      }),
    ]);

    return this.buildPaginatedResult(items, totalCount, page, pageSize);
  }
  async updateStatus(
    ticketId: number,
    userId: number,
    status: TicketStatus,
    comment?: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Prevent updating to the same status (avoid duplicate history entries)
    if (ticket.status === status) {
      // console.warn(`Ticket ${ticketId} is already in ${status} status, skipping update`);
      return [ticket];
    }

    const now = new Date();
    const updateData: Prisma.TicketUpdateInput = {
      status,
      updatedAt: now,
    };

    if (status === TicketStatus.RESOLVED) {
      updateData.resolvedAt = now;
      // Calculate actualDuration in hours (from creation to resolution)
      const createdAt = new Date(ticket.createdAt);
      const durationMs = now.getTime() - createdAt.getTime();
      updateData.actualDuration = Math.round(durationMs / (1000 * 60 * 60));
    } else if (status === TicketStatus.CLOSED) {
      updateData.closedAt = now;
      // If ticket was closed without being resolved first, calculate actualDuration
      if (!ticket.resolvedAt && !ticket.actualDuration) {
        const createdAt = new Date(ticket.createdAt);
        const durationMs = now.getTime() - createdAt.getTime();
        updateData.actualDuration = Math.round(durationMs / (1000 * 60 * 60));
      }
    }

    // Generate default comment based on status transition
    const defaultComment = this.getDefaultStatusComment(ticket.status, status);

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
          comment: comment || defaultComment,
        },
      }),
    ]);
  }

  /**
   * Generate default comment for status transitions
   */
  private getDefaultStatusComment(
    fromStatus: TicketStatus,
    toStatus: TicketStatus,
  ): string {
    const transitions: Record<string, string> = {
      "FOR_REVIEW->REVIEWED": "Reviewed by secretary",
      "REVIEWED->DIRECTOR_APPROVED": "Approved by director",
      "DIRECTOR_APPROVED->ASSIGNED": "Assigned to department",
      "ASSIGNED->IN_PROGRESS": "Work started",
      "SCHEDULED->IN_PROGRESS": "Work started",
      "IN_PROGRESS->ON_HOLD": "Work paused",
      "ON_HOLD->IN_PROGRESS": "Work resumed",
      "IN_PROGRESS->RESOLVED": "Issue resolved",
      "RESOLVED->CLOSED": "Ticket closed",
    };

    const key = `${fromStatus}->${toStatus}`;
    return (
      transitions[key] || `Status changed from ${fromStatus} to ${toStatus}`
    );
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

  async addNote(
    ticketId: number,
    userId: number,
    content: string,
    isInternal = false,
  ) {
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
    url: string,
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

    const [statusCounts, typeCounts, priorityCounts, total] = await Promise.all(
      [
        this.prisma.ticket.groupBy({
          by: ["status"],
          where,
          _count: true,
        }),
        this.prisma.ticket.groupBy({
          by: ["type"],
          where,
          _count: true,
        }),
        this.prisma.ticket.groupBy({
          by: ["priority"],
          where,
          _count: true,
        }),
        this.prisma.ticket.count({ where }),
      ],
    );

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

    // Create separate Date objects to avoid mutation
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [overdue, dueToday, dueSoon] = await Promise.all([
      // Overdue tickets
      this.prisma.ticket.count({
        where: {
          dueDate: {
            lt: now,
          },
          status: {
            notIn: [
              TicketStatus.RESOLVED,
              TicketStatus.CLOSED,
              TicketStatus.CANCELLED,
            ],
          },
        },
      }),
      // Due today
      this.prisma.ticket.count({
        where: {
          dueDate: {
            gte: todayStart,
            lt: todayEnd,
          },
          status: {
            notIn: [
              TicketStatus.RESOLVED,
              TicketStatus.CLOSED,
              TicketStatus.CANCELLED,
            ],
          },
        },
      }),
      // Due within 3 days
      this.prisma.ticket.count({
        where: {
          dueDate: {
            gte: now,
            lt: threeDaysLater,
          },
          status: {
            notIn: [
              TicketStatus.RESOLVED,
              TicketStatus.CLOSED,
              TicketStatus.CANCELLED,
            ],
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

  /**
   * Get enhanced SLA metrics including compliance and overdue ticket details
   */
  async getEnhancedSLAMetrics() {
    const now = new Date();

    // Get basic counts
    const basicMetrics = await this.getSLAMetrics();

    // Get resolved tickets for compliance calculation
    const resolvedTickets = await this.prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        resolvedAt: { not: null },
      },
      select: {
        dueDate: true,
        resolvedAt: true,
        actualDuration: true,
      },
    });

    const totalResolved = resolvedTickets.length;
    const resolvedWithinSLA = resolvedTickets.filter(
      (t) => t.dueDate && t.resolvedAt && t.resolvedAt <= t.dueDate,
    ).length;
    const complianceRate =
      totalResolved > 0
        ? Math.round((resolvedWithinSLA / totalResolved) * 100)
        : 100;

    // Calculate average resolution time
    const ticketsWithDuration = resolvedTickets.filter(
      (t) => t.actualDuration !== null,
    );
    const averageResolutionHours =
      ticketsWithDuration.length > 0
        ? Math.round(
            (ticketsWithDuration.reduce(
              (sum, t) => sum + (t.actualDuration || 0),
              0,
            ) /
              ticketsWithDuration.length) *
              10,
          ) / 10
        : null;

    // Get overdue ticket details
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
      },
      include: {
        createdBy: true,
        assignments: { include: { user: true } },
        misTicket: true,
        itsTicket: true,
        notes: { include: { user: true } },
        attachments: { include: { uploadedBy: true, deletedBy: true } },
        statusHistory: {
          include: { user: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return {
      ...basicMetrics,
      complianceRate,
      totalResolved,
      resolvedWithinSLA,
      averageResolutionHours,
      overdueTickets,
    };
  }

  /**
   * Get ticket creation/resolution trends grouped by day
   */
  async getTicketTrends(filters?: { startDate?: Date; endDate?: Date }) {
    // Default to last 30 days if no filter
    const endDate = filters?.endDate || new Date();
    const startDate =
      filters?.startDate ||
      new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all tickets in range
    const tickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    // Group by day
    const createdMap: Record<string, number> = {};
    const resolvedMap: Record<string, number> = {};

    // Initialize all days in range
    const current = new Date(startDate);
    while (current <= endDate) {
      const key = current.toISOString().split("T")[0];
      createdMap[key] = 0;
      resolvedMap[key] = 0;
      current.setDate(current.getDate() + 1);
    }

    // Count tickets per day
    for (const ticket of tickets) {
      const createdDay = ticket.createdAt.toISOString().split("T")[0];
      if (createdMap[createdDay] !== undefined) {
        createdMap[createdDay]++;
      }
      if (ticket.resolvedAt) {
        const resolvedDay = ticket.resolvedAt.toISOString().split("T")[0];
        if (resolvedMap[resolvedDay] !== undefined) {
          resolvedMap[resolvedDay]++;
        }
      }
    }

    return {
      createdPerDay: Object.entries(createdMap).map(([date, count]) => ({
        date,
        count,
      })),
      resolvedPerDay: Object.entries(resolvedMap).map(([date, count]) => ({
        date,
        count,
      })),
    };
  }

  /**
   * Get staff performance metrics
   */
  async getStaffPerformance(filters?: { startDate?: Date; endDate?: Date }) {
    const where: Prisma.TicketWhereInput = {};
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // Get all assignments with ticket data
    const assignments = await this.prisma.ticketAssignment.findMany({
      where: { ticket: where },
      include: {
        user: { select: { id: true, name: true, role: true } },
        ticket: {
          select: {
            status: true,
            dueDate: true,
            resolvedAt: true,
            actualDuration: true,
          },
        },
      },
    });

    // Group by user
    const staffMap = new Map<
      number,
      {
        userId: number;
        name: string;
        role: string;
        totalAssigned: number;
        resolved: Array<{
          dueDate: Date | null;
          resolvedAt: Date | null;
          actualDuration: number | null;
        }>;
      }
    >();

    for (const assignment of assignments) {
      const existing = staffMap.get(assignment.user.id);
      if (existing) {
        existing.totalAssigned++;
        if (
          assignment.ticket.status === TicketStatus.RESOLVED ||
          assignment.ticket.status === TicketStatus.CLOSED
        ) {
          existing.resolved.push({
            dueDate: assignment.ticket.dueDate,
            resolvedAt: assignment.ticket.resolvedAt,
            actualDuration: assignment.ticket.actualDuration,
          });
        }
      } else {
        const resolved =
          assignment.ticket.status === TicketStatus.RESOLVED ||
          assignment.ticket.status === TicketStatus.CLOSED
            ? [
                {
                  dueDate: assignment.ticket.dueDate,
                  resolvedAt: assignment.ticket.resolvedAt,
                  actualDuration: assignment.ticket.actualDuration,
                },
              ]
            : [];
        staffMap.set(assignment.user.id, {
          userId: assignment.user.id,
          name: assignment.user.name ?? "Unknown",
          role: assignment.user.role,
          totalAssigned: 1,
          resolved,
        });
      }
    }

    return Array.from(staffMap.values()).map((staff) => {
      const totalResolved = staff.resolved.length;
      const withDuration = staff.resolved.filter(
        (t) => t.actualDuration !== null,
      );
      const averageResolutionHours =
        withDuration.length > 0
          ? Math.round(
              (withDuration.reduce(
                (sum, t) => sum + (t.actualDuration || 0),
                0,
              ) /
                withDuration.length) *
                10,
            ) / 10
          : null;
      const withinSLA = staff.resolved.filter(
        (t) => t.dueDate && t.resolvedAt && t.resolvedAt <= t.dueDate,
      ).length;
      const slaComplianceRate =
        totalResolved > 0 ? Math.round((withinSLA / totalResolved) * 100) : 100;

      return {
        userId: staff.userId,
        name: staff.name,
        role: staff.role,
        totalAssigned: staff.totalAssigned,
        totalResolved,
        averageResolutionHours,
        slaComplianceRate,
      };
    });
  }

  async generateControlNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // Atomic operation: find the row for this month, increment counter, or create new row
    const row = await this.prisma.ticketCounter.upsert({
      where: {
        year_month: { year, month }, // Composite unique key from your schema
      },
      update: {
        counter: { increment: 1 }, // Increment existing counter
      },
      create: {
        year,
        month,
        counter: 1, // First ticket of the month starts at 1
      },
    });

    // Format: 2025-12-001
    const monthStr = String(month).padStart(2, "0");
    const counterStr = String(row.counter).padStart(3, "0");
    return `${year}-${monthStr}-${counterStr}`;
  }
}
