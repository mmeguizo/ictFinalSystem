import { PrismaClient, TicketType, Role } from "@prisma/client";

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
  /**
   * Automatically assign ticket based on type, detailed subcategories, keyword analysis, and staff expertise workload.
   * Matches ticket attributes against technical staff's skills and routes to the best person.
   * Falls back to department heads if no technical staff is available.
   * Returns the created assignment with userId.
   */
  async assignTicket(
    ticketId: number,
    ticketType: TicketType,
  ): Promise<{ userId: number }> {
    // Fetch the ticket with its sub-tickets
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        misTicket: true,
        itsTicket: true,
      },
    });

    if (!ticket) {
      throw new Error(`Ticket with ID ${ticketId} not found`);
    }

    const requiredSkills: string[] = [];

    // Map sub-ticket types into specific skills
    if (ticket.type === "MIS" && ticket.misTicket) {
      if (
        ticket.misTicket.category === "WEBSITE" ||
        ticket.misTicket.websiteNewRequest ||
        ticket.misTicket.websiteUpdate
      ) {
        requiredSkills.push("WEBSITE");
      }
      if (
        ticket.misTicket.category === "SOFTWARE" ||
        ticket.misTicket.softwareNewRequest ||
        ticket.misTicket.softwareUpdate ||
        ticket.misTicket.softwareInstall
      ) {
        requiredSkills.push("SOFTWARE");
      }
    } else if (ticket.type === "ITS" && ticket.itsTicket) {
      if (ticket.itsTicket.borrowRequest) {
        requiredSkills.push("BORROW_REQUEST");
      }
      if (ticket.itsTicket.maintenanceDesktopLaptop) {
        requiredSkills.push("MAINTENANCE_DESKTOP_LAPTOP");
      }
      if (ticket.itsTicket.maintenanceInternetNetwork) {
        requiredSkills.push("MAINTENANCE_INTERNET_NETWORK");
      }
      if (ticket.itsTicket.maintenancePrinter) {
        requiredSkills.push("MAINTENANCE_PRINTER");
      }
    }

    // Keyword heuristics scan
    const textToScan = `${ticket.title} ${ticket.description}`.toLowerCase();
    if (
      textToScan.includes("wifi") ||
      textToScan.includes("internet") ||
      textToScan.includes("network") ||
      textToScan.includes("lan") ||
      textToScan.includes("con")
    ) {
      requiredSkills.push("MAINTENANCE_INTERNET_NETWORK");
    }
    if (
      textToScan.includes("printer") ||
      textToScan.includes("printing") ||
      textToScan.includes("toner") ||
      textToScan.includes("ink") ||
      textToScan.includes("paper")
    ) {
      requiredSkills.push("MAINTENANCE_PRINTER");
    }
    if (
      textToScan.includes("laptop") ||
      textToScan.includes("desktop") ||
      textToScan.includes("computer") ||
      textToScan.includes("pc") ||
      textToScan.includes("monitor")
    ) {
      requiredSkills.push("MAINTENANCE_DESKTOP_LAPTOP");
    }
    if (
      textToScan.includes("borrow") ||
      textToScan.includes("request") ||
      textToScan.includes("projector") ||
      textToScan.includes("equip")
    ) {
      if (ticket.type === "ITS") {
        requiredSkills.push("BORROW_REQUEST");
      }
    }
    if (
      textToScan.includes("website") ||
      textToScan.includes("web") ||
      textToScan.includes("domain") ||
      textToScan.includes("portal")
    ) {
      requiredSkills.push("WEBSITE");
    }
    if (
      textToScan.includes("software") ||
      textToScan.includes("system") ||
      textToScan.includes("program") ||
      textToScan.includes("install")
    ) {
      requiredSkills.push("SOFTWARE");
    }

    // De-duplicate required skills
    const uniqueRequiredSkills = Array.from(new Set(requiredSkills));

    // Determine target roles for direct assignment (DEVELOPER or TECHNICAL)
    const targetRole = ticket.type === "MIS" ? Role.DEVELOPER : Role.TECHNICAL;

    // Fetch candidate staff with their skills and current active workload
    const candidateStaff = await this.prisma.user.findMany({
      where: {
        role: targetRole,
        isActive: true,
      },
      include: {
        skills: true,
        assignedTickets: {
          where: {
            ticket: {
              status: {
                notIn: ["RESOLVED", "CLOSED", "CANCELLED"],
              },
            },
          },
        },
      },
    });

    let selectedUser: any = null;

    if (candidateStaff.length > 0) {
      // Score and rank staff based on skills match and active workload
      const scoredStaff = candidateStaff.map((staff) => {
        const staffSkillSet = new Set(
          staff.skills.map((s) => s.skill.toUpperCase()),
        );
        const matchingSkillsCount = uniqueRequiredSkills.filter((reqSkill) =>
          staffSkillSet.has(reqSkill.toUpperCase()),
        ).length;

        return {
          staff,
          matchingSkillsCount,
          workload: staff.assignedTickets.length,
        };
      });

      // Sort:
      // 1. By matching skills (descending)
      // 2. By workload (ascending)
      scoredStaff.sort((a, b) => {
        if (b.matchingSkillsCount !== a.matchingSkillsCount) {
          return b.matchingSkillsCount - a.matchingSkillsCount;
        }
        return a.workload - b.workload;
      });

      selectedUser = scoredStaff[0].staff;
    }

    // Fallback: If no staff of targetRole exists, route to the department head
    if (!selectedUser) {
      const headRole = ticket.type === "MIS" ? Role.MIS_HEAD : Role.ITS_HEAD;
      const eligibleHeads = await this.prisma.user.findMany({
        where: {
          role: headRole,
          isActive: true,
        },
        include: {
          assignedTickets: {
            where: {
              ticket: {
                status: {
                  notIn: ["RESOLVED", "CLOSED", "CANCELLED"],
                },
              },
            },
          },
        },
      });

      if (eligibleHeads.length > 0) {
        eligibleHeads.sort(
          (a, b) => a.assignedTickets.length - b.assignedTickets.length,
        );
        selectedUser = eligibleHeads[0];
      }
    }

    if (!selectedUser) {
      throw new Error(
        `No eligible staff or department heads found to auto-route ticket ID ${ticketId}`,
      );
    }

    // Assign ticket inside a transaction and update status to ASSIGNED
    await this.prisma.$transaction(async (tx) => {
      // Check if already assigned to prevent duplicates
      const existing = await tx.ticketAssignment.findFirst({
        where: {
          ticketId,
          userId: selectedUser.id,
        },
      });

      if (!existing) {
        await tx.ticketAssignment.create({
          data: {
            ticketId,
            userId: selectedUser.id,
          },
        });
      }

      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: "ASSIGNED" },
      });

      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          userId: selectedUser.id,
          fromStatus: ticket.status,
          toStatus: "ASSIGNED",
          comment: `Intelligently routed to ${selectedUser.name} based on expertise and active workload.`,
        },
      });
    });

    return { userId: selectedUser.id };
  }

  /**
   * Manually assign ticket to specific user
   * Used by MIS_HEAD/ITS_HEAD to assign tickets to DEVELOPER/TECHNICAL staff
   */
  async manualAssign(
    ticketId: number,
    userId: number,
    assignedById?: number,
  ): Promise<void> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
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
      throw new Error("User is already assigned to this ticket");
    }

    // Get ticket to check current status
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Create assignment
    await this.prisma.ticketAssignment.create({
      data: {
        ticketId,
        userId,
      },
    });

    // Transition ticket to ASSIGNED if it's in a pre-assignment status
    // and record the status history for SLA tracking
    if (
      ticket.status === "DIRECTOR_APPROVED" ||
      ticket.status === "FOR_REVIEW"
    ) {
      const fromStatus = ticket.status;
      await this.prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: "ASSIGNED" },
        });
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            userId: assignedById || userId,
            fromStatus,
            toStatus: "ASSIGNED",
            comment: "Staff assigned to ticket",
          },
        });
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
        data: { status: "FOR_REVIEW" },
      });
    }
  }

  /**
   * Reassign ticket to different user
   */
  async reassign(
    ticketId: number,
    fromUserId: number,
    toUserId: number,
  ): Promise<void> {
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
