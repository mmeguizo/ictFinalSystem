import { PrismaClient, TicketType, Role } from '@prisma/client';

/**
 * Auto-assignment service to intelligently route tickets to appropriate staff
 * 
 * Routing Logic:
 * - MIS tickets → MIS_HEAD (who then assigns to DEVELOPERs)
 * - ITS tickets → ITS_HEAD (who then assigns to TECHNICAL staff)
 */
export class AutoAssignmentService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Automatically assign ticket based on type and current workload
   * Routes MIS tickets to MIS_HEAD and ITS tickets to ITS_HEAD
   * Returns the created assignment with userId
   */
  async assignTicket(ticketId: number, ticketType: TicketType): Promise<{ userId: number }> {
    // Get the appropriate head role for the ticket type
    const targetRole = this.getHeadRoleForTicketType(ticketType);

    // Get the head for the matching department
    const eligibleUsers = await this.prisma.user.findMany({
      where: {
        role: targetRole,
      },
      include: {
        assignedTickets: {
          where: {
            ticket: {
              status: {
                notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'],
              },
            },
          },
        },
      },
    });

    if (eligibleUsers.length === 0) {
      throw new Error(`No ${targetRole} found for ticket type ${ticketType}`);
    }

    // Find user with least workload (in case there are multiple)
    const selectedUser = this.selectUserByWorkload(eligibleUsers);

    // Assign the ticket
    const assignment = await this.prisma.ticketAssignment.create({
      data: {
        ticketId,
        userId: selectedUser.id,
      },
    });

    // Update ticket status to ASSIGNED
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'ASSIGNED' },
    });

    return { userId: assignment.userId };
  }

  /**
   * Get the head role that handles specific ticket types
   * MIS tickets → MIS_HEAD
   * ITS tickets → ITS_HEAD
   */
  private getHeadRoleForTicketType(ticketType: TicketType): Role {
    switch (ticketType) {
      case TicketType.MIS:
        return Role.MIS_HEAD;
      case TicketType.ITS:
        return Role.ITS_HEAD;
      default:
        // Default to MIS_HEAD for unknown types
        return Role.MIS_HEAD;
    }
  }

  /**
   * Select user with lowest current workload
   */
  private selectUserByWorkload(
    users: Array<{ id: number; assignedTickets: any[] }>
  ): { id: number } {
    // Sort by number of active assignments (ascending)
    const sortedUsers = users.sort(
      (a, b) => a.assignedTickets.length - b.assignedTickets.length
    );

    return sortedUsers[0];
  }

  /**
   * Manually assign ticket to specific user
   * Used by MIS_HEAD/ITS_HEAD to assign tickets to DEVELOPER/TECHNICAL staff
   */
  async manualAssign(ticketId: number, userId: number, assignedById?: number): Promise<void> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already assigned
    const existingAssignment = await this.prisma.ticketAssignment.findUnique({
      where: {
        ticketId_userId: {
          ticketId,
          userId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error('User is already assigned to this ticket');
    }

    // Get ticket to check current status
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Create assignment
    await this.prisma.ticketAssignment.create({
      data: {
        ticketId,
        userId,
      },
    });

    // Note: We don't create a status history entry for assignments anymore
    // because it creates confusing "ASSIGNED -> ASSIGNED" entries.
    // Assignment information is already tracked in the TicketAssignment table.

    // Update ticket status if it's still for review (legacy behavior)
    if (ticket.status === 'FOR_REVIEW') {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'ASSIGNED' },
      });
    }
  }

  /**
   * Remove user assignment from ticket
   */
  async unassign(ticketId: number, userId: number): Promise<void> {
    await this.prisma.ticketAssignment.deleteMany({
      where: {
        ticketId,
        userId,
      },
    });

    // Check if ticket has no more assignments
    const remainingAssignments = await this.prisma.ticketAssignment.count({
      where: { ticketId },
    });

    if (remainingAssignments === 0) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'FOR_REVIEW' },
      });
    }
  }

  /**
   * Reassign ticket to different user
   */
  async reassign(ticketId: number, fromUserId: number, toUserId: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.ticketAssignment.deleteMany({
        where: {
          ticketId,
          userId: fromUserId,
        },
      }),
      this.prisma.ticketAssignment.create({
        data: {
          ticketId,
          userId: toUserId,
        },
      }),
    ]);
  }
}
