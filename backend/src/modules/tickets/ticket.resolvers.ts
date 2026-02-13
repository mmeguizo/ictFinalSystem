import { PrismaClient, TicketType } from '@prisma/client';
import { TicketService } from './services/ticket.service';
import { CreateMISTicketDto } from './dto/create-mis-ticket.dto';
import { CreateITSTicketDto } from './dto/create-its-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { CreateTicketNoteDto } from './dto/create-ticket-note.dto';

const prisma = new PrismaClient();
const ticketService = new TicketService(prisma);

export const ticketResolvers = {
  Query: {
    ticket: async (_: any, { id }: { id: number }, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.getTicket(id);
    },

    ticketByNumber: async (_: any, { ticketNumber }: { ticketNumber: string }, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.getTicketByNumber(ticketNumber);
    },

    tickets: async (_: any, { filter }: { filter?: any }, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.getTickets(filter);
    },

    myTickets: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      
      // Office Heads see all tickets of their type that are in work statuses
      if (context.currentUser.role === 'MIS_HEAD') {
        return ticketService.getOfficeHeadTickets(TicketType.MIS);
      }
      if (context.currentUser.role === 'ITS_HEAD') {
        return ticketService.getOfficeHeadTickets(TicketType.ITS);
      }
      
      // Regular staff see only tickets explicitly assigned to them
      return ticketService.getUserTickets(context.currentUser.id);
    },

    myCreatedTickets: async (_: any, __: any, context: any) => {
      // console.log('myCreatedTickets resolver called with context:', context);
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.getUserCreatedTickets(context.currentUser.id);
    },

    ticketsForSecretaryReview: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins, secretaries, and department heads can view tickets for review
      if (!['ADMIN', 'SECRETARY', 'MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Insufficient permissions');
      }
      
      // For department heads, filter by their department type
      if (context.currentUser.role === 'MIS_HEAD') {
        return ticketService.getTicketsForSecretaryReviewByType('MIS');
      }
      if (context.currentUser.role === 'ITS_HEAD') {
        return ticketService.getTicketsForSecretaryReviewByType('ITS');
      }
      
      return ticketService.getTicketsForSecretaryReview();
    },

    ticketsPendingDirectorApproval: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins, directors, and department heads can view director pending approvals
      if (!['ADMIN', 'DIRECTOR', 'MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Insufficient permissions');
      }
      
      // For department heads, filter by their department type
      if (context.currentUser.role === 'MIS_HEAD') {
        return ticketService.getTicketsPendingDirectorApprovalByType('MIS');
      }
      if (context.currentUser.role === 'ITS_HEAD') {
        return ticketService.getTicketsPendingDirectorApprovalByType('ITS');
      }
      
      return ticketService.getTicketsPendingDirectorApproval();
    },

    allSecretaryTickets: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins, directors, secretaries, and department heads can view all tickets for secretary oversight
      if (!['ADMIN', 'DIRECTOR', 'SECRETARY', 'MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Insufficient permissions');
      }
      
      // For department heads, filter by their department type
      // MIS_HEAD only sees MIS tickets, ITS_HEAD only sees ITS tickets
      if (context.currentUser.role === 'MIS_HEAD') {
        return ticketService.getTickets({ type: TicketType.MIS });
      }
      if (context.currentUser.role === 'ITS_HEAD') {
        return ticketService.getTickets({ type: TicketType.ITS });
      }
      
      // Admin, Director, Secretary see all tickets
      return ticketService.getTickets();
    },

    /**
     * Get tickets pending acknowledgment (for Admin/Director)
     * Tickets that heads have scheduled and are awaiting admin acknowledgment
     */
    ticketsPendingAcknowledgment: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins and directors can view pending acknowledgments
      if (!['ADMIN', 'DIRECTOR'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Insufficient permissions');
      }
      return ticketService.getTicketsPendingAcknowledgment();
    },

    ticketAnalytics: async (_: any, { filter }: { filter?: any }, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      
      const filters = filter ? {
        startDate: filter.startDate ? new Date(filter.startDate) : undefined,
        endDate: filter.endDate ? new Date(filter.endDate) : undefined,
      } : undefined;

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
        throw new Error('Unauthorized');
      }
      return ticketService.getSLAMetrics();
    },
  },

  Mutation: {
    createMISTicket: async (_: any, { input }: { input: CreateMISTicketDto }, context: any) => {
        // console.log('createMISTicket called with input:', input);
        // console.log('createMISTicket called with context:', context);
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.createMISTicket(input, context.currentUser.id);
    },

    createITSTicket: async (_: any, { input }: { input: CreateITSTicketDto }, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.createITSTicket(input, context.currentUser.id);
    },

    updateTicketStatus: async (
      _: any,
      { ticketId, input }: { ticketId: number; input: UpdateTicketStatusDto },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      await ticketService.updateStatus(ticketId, context.currentUser.id, input);
      return ticketService.getTicket(ticketId);
    },

    reviewTicketAsSecretary: async (
      _: any,
      { ticketId, comment }: { ticketId: number; comment?: string },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only secretaries, admins, and department heads can review tickets
      if (!['ADMIN', 'SECRETARY', 'MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Only secretaries can review tickets');
      }
      return ticketService.reviewAsSecretary(ticketId, context.currentUser.id, comment);
    },

    /**
     * Reject ticket as secretary
     * Returns ticket to user with notes/reason
     */
    rejectTicketAsSecretary: async (
      _: any,
      { ticketId, reason }: { ticketId: number; reason: string },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Secretaries, directors, and admins can reject tickets
      if (!['ADMIN', 'SECRETARY', 'DIRECTOR'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Only secretaries can reject tickets');
      }
      return ticketService.rejectAsSecretary(ticketId, context.currentUser.id, reason);
    },

    approveTicketAsDirector: async (
      _: any,
      { ticketId, comment }: { ticketId: number; comment?: string },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only directors, admins, and department heads can approve as director
      if (!['ADMIN', 'DIRECTOR', 'MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Only directors can approve tickets');
      }
      return ticketService.approveAsDirector(ticketId, context.currentUser.id, comment);
    },

    /**
     * Disapprove/Reject ticket as director
     * Requires a reason for the rejection
     */
    disapproveTicketAsDirector: async (
      _: any,
      { ticketId, reason }: { ticketId: number; reason: string },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only directors, admins can disapprove
      if (!['ADMIN', 'DIRECTOR'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Only directors can disapprove tickets');
      }
      return ticketService.disapproveAsDirector(ticketId, context.currentUser.id, reason);
    },

    assignTicket: async (
      _: any,
      { ticketId, userId, input }: { ticketId: number; userId: number; input?: { dateToVisit?: string; targetCompletionDate?: string; comment?: string } },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins and department heads can assign tickets
      if (!['ADMIN', 'MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Insufficient permissions');
      }
      // Pass the current user's ID as the assigner for status history tracking
      // Also pass optional schedule dates (dateToVisit, targetCompletionDate) if provided
      await ticketService.assignUser(ticketId, userId, context.currentUser.id, {
        dateToVisit: input?.dateToVisit ? new Date(input.dateToVisit) : undefined,
        targetCompletionDate: input?.targetCompletionDate ? new Date(input.targetCompletionDate) : undefined,
        comment: input?.comment,
      });
      return ticketService.getTicket(ticketId);
    },

    unassignTicket: async (
      _: any,
      { ticketId, userId }: { ticketId: number; userId: number },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins and department heads can unassign tickets
      if (!['ADMIN', 'MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Insufficient permissions');
      }
      await ticketService.unassignUser(ticketId, userId);
      return ticketService.getTicket(ticketId);
    },

    addTicketNote: async (
      _: any,
      { ticketId, input }: { ticketId: number; input: CreateTicketNoteDto },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.addNote(ticketId, context.currentUser.id, input);
    },

    /**
     * Reopen a rejected/cancelled ticket for re-review
     * Only the original creator can reopen
     */
    reopenTicket: async (
      _: any,
      { ticketId, input }: { ticketId: number; input?: { updatedDescription?: string; comment?: string } },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.reopenTicket(
        ticketId,
        context.currentUser.id,
        input?.updatedDescription,
        input?.comment
      );
    },

    // ========================================
    // SCHEDULE WORKFLOW MUTATIONS
    // ========================================

    /**
     * Schedule a visit (for MIS_HEAD/ITS_HEAD)
     * Sets dateToVisit and targetCompletionDate, changes status to PENDING_ACKNOWLEDGMENT
     */
    scheduleVisit: async (
      _: any,
      { ticketId, input }: { ticketId: number; input: { dateToVisit: string; targetCompletionDate: string; comment?: string } },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only department heads can schedule visits
      if (!['MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Only department heads can schedule visits');
      }
      return ticketService.scheduleVisit(
        ticketId,
        context.currentUser.id,
        new Date(input.dateToVisit),
        new Date(input.targetCompletionDate),
        input.comment
      );
    },

    /**
     * Acknowledge schedule (for Admin/Director)
     * Confirms the visit dates, notifies the user
     */
    acknowledgeSchedule: async (
      _: any,
      { ticketId, comment }: { ticketId: number; comment?: string },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins and directors can acknowledge schedules
      if (!['ADMIN', 'DIRECTOR'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Only admin/director can acknowledge schedules');
      }
      return ticketService.acknowledgeSchedule(ticketId, context.currentUser.id, comment);
    },

    /**
     * Reject schedule (for Admin/Director)
     * Returns ticket to ASSIGNED for head to reschedule
     */
    rejectSchedule: async (
      _: any,
      { ticketId, reason }: { ticketId: number; reason: string },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins and directors can reject schedules
      if (!['ADMIN', 'DIRECTOR'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Only admin/director can reject schedules');
      }
      return ticketService.rejectSchedule(ticketId, context.currentUser.id, reason);
    },

    /**
     * Add monitor notes and recommendations (for MIS_HEAD/ITS_HEAD after visit)
     */
    addMonitorAndRecommendations: async (
      _: any,
      { ticketId, input }: { ticketId: number; input: { monitorNotes: string; recommendations: string; comment?: string } },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only department heads can add monitor notes
      if (!['MIS_HEAD', 'ITS_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Only department heads can add monitor notes');
      }
      return ticketService.addMonitorAndRecommendations(
        ticketId,
        context.currentUser.id,
        input.monitorNotes,
        input.recommendations,
        input.comment
      );
    },
  },
};
