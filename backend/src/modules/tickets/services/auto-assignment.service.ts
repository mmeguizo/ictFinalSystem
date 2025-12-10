import { PrismaClient, TicketType, Role } from '@prisma/client';

/**
 * Auto-assignment service to intelligently route tickets to appropriate staff
 */
export class AutoAssignmentService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Automatically assign ticket based on type and current workload
   */
  async assignTicket(ticketId: number, ticketType: TicketType): Promise<void> {
    // Determine which roles can handle this ticket type
    const eligibleRoles = this.getEligibleRoles(ticketType);

    // Get users with eligible roles
    const eligibleUsers = await this.prisma.user.findMany({
      where: {
        role: {
          in: eligibleRoles,
        },
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
      throw new Error(`No eligible users found for ticket type ${ticketType}`);
    }

    // Find user with least workload
    const selectedUser = this.selectUserByWorkload(eligibleUsers);

    // Assign the ticket
    await this.prisma.ticketAssignment.create({
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
  }

  /**
   * Get roles that can handle specific ticket types
   */
  private getEligibleRoles(ticketType: TicketType): Role[] {
    switch (ticketType) {
      case TicketType.MIS:
        // MIS tickets go to developers and admins
        return [Role.DEVELOPER, Role.ADMIN];
      case TicketType.ITS:
        // ITS tickets can be handled by office heads and admins
        return [Role.OFFICE_HEAD, Role.ADMIN];
      default:
        return [Role.ADMIN];
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
   */
  async manualAssign(ticketId: number, userId: number): Promise<void> {
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

    // Create assignment
    await this.prisma.ticketAssignment.create({
      data: {
        ticketId,
        userId,
      },
    });

    // Update ticket status if it's still pending
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (ticket?.status === 'PENDING') {
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
        data: { status: 'PENDING' },
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
