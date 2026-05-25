import { TicketType } from "@prisma/client";
import { TicketService } from "./services/ticket.service";
import { CreateMISTicketDto } from "./dto/create-mis-ticket.dto";
import { CreateITSTicketDto } from "./dto/create-its-ticket.dto";
import { UpdateTicketStatusDto } from "./dto/update-ticket-status.dto";
import { CreateTicketNoteDto } from "./dto/create-ticket-note.dto";
import { deleteAttachmentFile } from "../storage/upload.middleware";
import { prisma } from "../../lib/prisma";

const ticketService = new TicketService(prisma);

const FULL_TICKET_LIST_ROLES = [
  "ADMIN",
  "DIRECTOR",
  "SECRETARY",
  "MIS_HEAD",
  "ITS_HEAD",
];

const ANALYTICS_ACCESS_ROLES = [
  "ADMIN",
  "DIRECTOR",
  "SECRETARY",
  "MIS_HEAD",
  "ITS_HEAD",
  "DEVELOPER",
  "TECHNICAL",
];

function getDepartmentScopedType(role: string): TicketType | undefined {
  if (role === "MIS_HEAD") {
    return TicketType.MIS;
  }
  if (role === "ITS_HEAD") {
    return TicketType.ITS;
  }
  return undefined;
}

function buildAnalyticsFilters(filter: any, role: string) {
  const scopedType = getDepartmentScopedType(role);
  return {
    startDate: filter?.startDate ? new Date(filter.startDate) : undefined,
    endDate: filter?.endDate ? new Date(filter.endDate) : undefined,
    ...(scopedType ? { type: scopedType } : {}),
  };
}

export const ticketResolvers = {
  Query: {
    ticket: async (_: any, { id }: { id: number }, context: any) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.getAccessibleTicket(
        id,
        context.currentUser.id,
        context.currentUser.role,
      );
    },

    ticketByNumber: async (
      _: any,
      { ticketNumber }: { ticketNumber: string },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.getAccessibleTicketByNumber(
        ticketNumber,
        context.currentUser.id,
        context.currentUser.role,
      );
    },

    tickets: async (
      _: any,
      { filter, pagination }: { filter?: any; pagination?: any },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      if (!FULL_TICKET_LIST_ROLES.includes(context.currentUser.role)) {
        throw new Error("Forbidden: Insufficient permissions");
      }

      const scopedType = getDepartmentScopedType(context.currentUser.role);
      const scopedFilter = scopedType
        ? { ...(filter || {}), type: scopedType }
        : filter;

      return ticketService.getTickets(scopedFilter, pagination);
    },

    myTickets: async (
      _: any,
      { pagination }: { pagination?: any },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }

      // Office Heads see all tickets of their type that are in work statuses
      if (context.currentUser.role === "MIS_HEAD") {
        return ticketService.getOfficeHeadTickets(TicketType.MIS, pagination);
      }
      if (context.currentUser.role === "ITS_HEAD") {
        return ticketService.getOfficeHeadTickets(TicketType.ITS, pagination);
      }

      // Regular staff see only tickets explicitly assigned to them
      return ticketService.getUserTickets(context.currentUser.id, pagination);
    },

    myCreatedTickets: async (
      _: any,
      { pagination }: { pagination?: any },
      context: any,
    ) => {
      // console.log('myCreatedTickets resolver called with context:', context);
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.getUserCreatedTickets(
        context.currentUser.id,
        pagination,
      );
    },

    ticketsForSecretaryReview: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Only admins, secretaries, and department heads can view tickets for review
      if (
        !["ADMIN", "SECRETARY", "MIS_HEAD", "ITS_HEAD"].includes(
          context.currentUser.role,
        )
      ) {
        throw new Error("Forbidden: Insufficient permissions");
      }

      // For department heads, filter by their department type
      if (context.currentUser.role === "MIS_HEAD") {
        return ticketService.getTicketsForSecretaryReviewByType("MIS");
      }
      if (context.currentUser.role === "ITS_HEAD") {
        return ticketService.getTicketsForSecretaryReviewByType("ITS");
      }

      return ticketService.getTicketsForSecretaryReview();
    },

    ticketsPendingDirectorApproval: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Only admins, directors, and department heads can view director pending approvals
      if (
        !["ADMIN", "DIRECTOR", "MIS_HEAD", "ITS_HEAD"].includes(
          context.currentUser.role,
        )
      ) {
        throw new Error("Forbidden: Insufficient permissions");
      }

      // For department heads, filter by their department type
      if (context.currentUser.role === "MIS_HEAD") {
        return ticketService.getTicketsPendingDirectorApprovalByType("MIS");
      }
      if (context.currentUser.role === "ITS_HEAD") {
        return ticketService.getTicketsPendingDirectorApprovalByType("ITS");
      }

      return ticketService.getTicketsPendingDirectorApproval();
    },

    allSecretaryTickets: async (
      _: any,
      { pagination }: { pagination?: any },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Only admins, directors, secretaries, and department heads can view all tickets for secretary oversight
      if (
        !["ADMIN", "DIRECTOR", "SECRETARY", "MIS_HEAD", "ITS_HEAD"].includes(
          context.currentUser.role,
        )
      ) {
        throw new Error("Forbidden: Insufficient permissions");
      }

      // For department heads, filter by their department type
      // MIS_HEAD only sees MIS tickets, ITS_HEAD only sees ITS tickets
      if (context.currentUser.role === "MIS_HEAD") {
        return ticketService.getTickets({ type: TicketType.MIS }, pagination);
      }
      if (context.currentUser.role === "ITS_HEAD") {
        return ticketService.getTickets({ type: TicketType.ITS }, pagination);
      }

      // Admin, Director, Secretary see all tickets
      return ticketService.getTickets(undefined, pagination);
    },

    /**
     * Get tickets for office heads (by type)
     */
    officeHeadTickets: async (
      _: any,
      { type }: { type: string },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      if (
        !["ADMIN", "MIS_HEAD", "ITS_HEAD", "DIRECTOR"].includes(
          context.currentUser.role,
        )
      ) {
        throw new Error("Forbidden: Insufficient permissions");
      }
      const ticketType = type === "MIS" ? TicketType.MIS : TicketType.ITS;
      const scopedType = getDepartmentScopedType(context.currentUser.role);
      if (scopedType && scopedType !== ticketType) {
        throw new Error(
          "Forbidden: Department heads can only request tickets from their own department",
        );
      }
      return ticketService.getOfficeHeadTickets(ticketType);
    },

    ticketAnalytics: async (
      _: any,
      { filter }: { filter?: any },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }

      if (!ANALYTICS_ACCESS_ROLES.includes(context.currentUser.role)) {
        throw new Error("Forbidden: Insufficient permissions");
      }

      const filters = buildAnalyticsFilters(filter, context.currentUser.role);

      const analytics = await ticketService.getAnalytics(filters);

      return {
        total: analytics.total,
        byStatus: analytics.byStatus.map((item: any) => ({
          status: item.status,
          count: item._count,
        })),
        byType: analytics.byType.map((item: any) => ({
          type: item.type,
          count: item._count,
        })),
        byPriority: analytics.byPriority.map((item: any) => ({
          priority: item.priority,
          count: item._count,
        })),
      };
    },

    slaMetrics: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      if (!ANALYTICS_ACCESS_ROLES.includes(context.currentUser.role)) {
        throw new Error("Forbidden: Insufficient permissions");
      }

      const scopedType = getDepartmentScopedType(context.currentUser.role);
      return ticketService.getEnhancedSLAMetrics(
        scopedType ? { type: scopedType } : undefined,
      );
    },

    ticketTrends: async (
      _: any,
      { filter }: { filter?: any },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      if (!ANALYTICS_ACCESS_ROLES.includes(context.currentUser.role)) {
        throw new Error("Forbidden: Insufficient permissions");
      }

      const filters = buildAnalyticsFilters(filter, context.currentUser.role);
      return ticketService.getTicketTrends(filters);
    },

    staffPerformance: async (
      _: any,
      { filter }: { filter?: any },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      if (!ANALYTICS_ACCESS_ROLES.includes(context.currentUser.role)) {
        throw new Error("Forbidden: Insufficient permissions");
      }

      const filters = buildAnalyticsFilters(filter, context.currentUser.role);
      return ticketService.getStaffPerformance(filters);
    },
  },

  Mutation: {
    createMISTicket: async (
      _: any,
      { input }: { input: CreateMISTicketDto },
      context: any,
    ) => {
      // console.log('createMISTicket called with input:', input);
      // console.log('createMISTicket called with context:', context);
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.createMISTicket(input, context.currentUser.id);
    },

    createITSTicket: async (
      _: any,
      { input }: { input: CreateITSTicketDto },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.createITSTicket(input, context.currentUser.id);
    },

    updateTicketStatus: async (
      _: any,
      { ticketId, input }: { ticketId: number; input: UpdateTicketStatusDto },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      await ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
      await ticketService.updateStatus(ticketId, context.currentUser.id, input);
      return ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
    },

    reviewTicketAsSecretary: async (
      _: any,
      { ticketId, comment }: { ticketId: number; comment?: string },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Only secretaries, admins, and department heads can review tickets
      if (
        !["ADMIN", "SECRETARY", "MIS_HEAD", "ITS_HEAD"].includes(
          context.currentUser.role,
        )
      ) {
        throw new Error("Forbidden: Only secretaries can review tickets");
      }
      await ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
      return ticketService.reviewAsSecretary(
        ticketId,
        context.currentUser.id,
        comment,
      );
    },

    /**
     * Reject ticket as secretary
     * Returns ticket to user with notes/reason
     */
    rejectTicketAsSecretary: async (
      _: any,
      { ticketId, reason }: { ticketId: number; reason: string },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Secretaries, directors, and admins can reject tickets
      if (
        !["ADMIN", "SECRETARY", "DIRECTOR"].includes(context.currentUser.role)
      ) {
        throw new Error("Forbidden: Only secretaries can reject tickets");
      }
      return ticketService.rejectAsSecretary(
        ticketId,
        context.currentUser.id,
        reason,
      );
    },

    approveTicketAsDirector: async (
      _: any,
      { ticketId, comment }: { ticketId: number; comment?: string },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Directors, admins, and department heads can approve/endorse
      if (
        !["ADMIN", "DIRECTOR", "MIS_HEAD", "ITS_HEAD"].includes(
          context.currentUser.role,
        )
      ) {
        throw new Error("Forbidden: Only authorized staff can endorse tickets");
      }
      await ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
      return ticketService.approveAsDirector(
        ticketId,
        context.currentUser.id,
        comment,
      );
    },

    /**
     * Disapprove/Reject ticket as director
     * Requires a reason for the rejection
     */
    disapproveTicketAsDirector: async (
      _: any,
      { ticketId, reason }: { ticketId: number; reason: string },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Only directors, admins can disapprove
      if (!["ADMIN", "DIRECTOR"].includes(context.currentUser.role)) {
        throw new Error("Forbidden: Only directors can disapprove tickets");
      }
      return ticketService.disapproveAsDirector(
        ticketId,
        context.currentUser.id,
        reason,
      );
    },

    assignTicket: async (
      _: any,
      {
        ticketId,
        userId,
        input,
      }: {
        ticketId: number;
        userId: number;
        input?: {
          dateToVisit?: string;
          targetCompletionDate?: string;
          comment?: string;
        };
      },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Only department heads (MIS_HEAD, ITS_HEAD) can assign tickets
      if (!["MIS_HEAD", "ITS_HEAD"].includes(context.currentUser.role)) {
        throw new Error("Forbidden: Only department heads can assign tickets");
      }
      await ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
      // Pass the current user's ID as the assigner for status history tracking
      // Also pass optional schedule dates (dateToVisit, targetCompletionDate) if provided
      await ticketService.assignUser(ticketId, userId, context.currentUser.id, {
        dateToVisit: input?.dateToVisit
          ? new Date(input.dateToVisit)
          : undefined,
        targetCompletionDate: input?.targetCompletionDate
          ? new Date(input.targetCompletionDate)
          : undefined,
        comment: input?.comment,
      });
      return ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
    },

    unassignTicket: async (
      _: any,
      { ticketId, userId }: { ticketId: number; userId: number },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      // Only department heads (MIS_HEAD, ITS_HEAD) can unassign tickets
      if (!["MIS_HEAD", "ITS_HEAD"].includes(context.currentUser.role)) {
        throw new Error(
          "Forbidden: Only department heads can unassign tickets",
        );
      }
      await ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
      await ticketService.unassignUser(ticketId, userId);
      return ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
    },

    addTicketNote: async (
      _: any,
      { ticketId, input }: { ticketId: number; input: CreateTicketNoteDto },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      await ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
      return ticketService.addNote(ticketId, context.currentUser.id, input);
    },

    /**
     * Update a ticket note — e.g. mark as internal or fix content.
     * Only staff roles (ADMIN, DEVELOPER, TECHNICAL, MIS_HEAD, ITS_HEAD, DIRECTOR, SECRETARY) allowed.
     */
    updateTicketNote: async (
      _: any,
      {
        noteId,
        input,
      }: { noteId: number; input: { isInternal?: boolean; content?: string } },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.updateNote(
        noteId,
        context.currentUser.id,
        context.currentUser.role,
        input,
      );
    },

    /**
     * Delete a ticket note entirely.
     * Only staff roles (ADMIN, DEVELOPER, TECHNICAL, MIS_HEAD, ITS_HEAD, DIRECTOR, SECRETARY) allowed.
     */
    deleteTicketNote: async (
      _: any,
      { noteId }: { noteId: number },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.deleteNote(
        noteId,
        context.currentUser.id,
        context.currentUser.role,
      );
    },

    /**
     * Reopen a rejected/cancelled ticket for re-review
     * Only the original creator can reopen
     */
    reopenTicket: async (
      _: any,
      {
        ticketId,
        input,
      }: {
        ticketId: number;
        input?: { updatedDescription?: string; comment?: string };
      },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.reopenTicket(
        ticketId,
        context.currentUser.id,
        input?.updatedDescription,
        input?.comment,
      );
    },

    /**
     * Update the description of an open ticket (creator only, non-terminal status)
     */
    updateTicketDescription: async (
      _: any,
      { ticketId, input }: { ticketId: number; input: { description: string } },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.updateTicketDescription(
        ticketId,
        context.currentUser.id,
        input.description,
      );
    },

    // ========================================
    // HEAD WORKFLOW MUTATIONS (Simplified)
    // ========================================

    /**
     * Head acknowledges ticket and assigns developer name
     * ASSIGNED → PENDING
     */
    acknowledgeAndAssignDeveloper: async (
      _: any,
      {
        ticketId,
        input,
      }: {
        ticketId: number;
        input: {
          assignedDeveloperName: string;
          assignToUserId?: number;
          dateToVisit?: string;
          targetCompletionDate?: string;
          comment?: string;
        };
      },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      if (
        !["ADMIN", "MIS_HEAD", "ITS_HEAD"].includes(context.currentUser.role)
      ) {
        throw new Error(
          "Forbidden: Only department heads can acknowledge and assign developers",
        );
      }
      await ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
      return ticketService.acknowledgeAndAssignDeveloper(
        ticketId,
        context.currentUser.id,
        input.assignedDeveloperName,
        {
          assignToUserId: input.assignToUserId,
          dateToVisit: input.dateToVisit
            ? new Date(input.dateToVisit)
            : undefined,
          targetCompletionDate: input.targetCompletionDate
            ? new Date(input.targetCompletionDate)
            : undefined,
          comment: input.comment,
        },
      );
    },

    /**
     * Head updates resolution after developer finishes work
     */
    updateResolution: async (
      _: any,
      {
        ticketId,
        input,
      }: {
        ticketId: number;
        input: {
          resolution: string;
          dateFinished?: string;
          status?: string;
          comment?: string;
          solutionVisibility?: string;
        };
      },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      if (
        !["ADMIN", "MIS_HEAD", "ITS_HEAD"].includes(context.currentUser.role)
      ) {
        throw new Error(
          "Forbidden: Only department heads can update resolutions",
        );
      }
      await ticketService.getAccessibleTicket(
        ticketId,
        context.currentUser.id,
        context.currentUser.role,
      );
      return ticketService.updateResolution(
        ticketId,
        context.currentUser.id,
        input.resolution,
        {
          dateFinished: input.dateFinished
            ? new Date(input.dateFinished)
            : undefined,
          status: input.status as any,
          comment: input.comment,
          solutionVisibility: input.solutionVisibility,
        },
      );
    },

    /**
     * Soft-delete a ticket attachment
     * Marks as deleted instead of removing — keeps a record of who deleted and when
     * Only the ticket creator, assigned staff, department heads, or admin can delete
     */
    deleteTicketAttachment: async (
      _: any,
      { attachmentId }: { attachmentId: number },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }

      // Find the attachment with its ticket
      const attachment = await prisma.ticketAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          ticket: {
            include: {
              assignments: true,
            },
          },
        },
      });

      if (!attachment) {
        throw new Error("Attachment not found");
      }

      if (attachment.isDeleted) {
        throw new Error("Attachment is already deleted");
      }

      // Check permissions: creator, assigned user, department head, or admin
      const userId = context.currentUser.id;
      const userRole = context.currentUser.role;
      const isCreator = attachment.ticket.createdById === userId;
      const isAssigned = attachment.ticket.assignments.some(
        (a: any) => a.userId === userId,
      );
      const isPrivileged = ["ADMIN", "MIS_HEAD", "ITS_HEAD"].includes(userRole);
      const scopedType = getDepartmentScopedType(userRole);

      if (scopedType && attachment.ticket.type !== scopedType) {
        throw new Error(
          "Forbidden: Department heads can only manage attachments for their own department tickets",
        );
      }

      if (!isCreator && !isAssigned && !isPrivileged) {
        throw new Error(
          "Forbidden: You do not have permission to delete this attachment",
        );
      }

      // Soft delete: mark as deleted, keep the record
      await prisma.ticketAttachment.update({
        where: { id: attachmentId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: userId,
        },
      });

      // Delete the actual file from disk to save space
      try {
        deleteAttachmentFile(attachment.filename);
      } catch (e) {
        // File might already be deleted, that's fine
      }

      return true;
    },

    /**
     * Submit satisfaction survey for a resolved/closed ticket
     * Only the ticket creator can submit
     */
    submitSatisfaction: async (
      _: any,
      {
        ticketId,
        input,
      }: { ticketId: number; input: { rating: number; comment?: string } },
      context: any,
    ) => {
      if (!context.currentUser) {
        throw new Error("Unauthorized");
      }
      return ticketService.submitSatisfaction(
        ticketId,
        context.currentUser.id,
        input.rating,
        input.comment,
      );
    },
  },
};
