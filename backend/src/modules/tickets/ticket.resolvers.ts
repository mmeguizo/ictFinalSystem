import { PrismaClient } from '@prisma/client';
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
      return ticketService.getUserTickets(context.currentUser.id);
    },

    myCreatedTickets: async (_: any, __: any, context: any) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      return ticketService.getUserCreatedTickets(context.currentUser.id);
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
        console.log('createMISTicket called with input:', input);
        console.log('createMISTicket called with context:', context);
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

    approveTicketAsSecretary: async (
      _: any,
      { ticketId, comment }: { ticketId: number; comment?: string },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only secretaries can approve as secretary
      if (context.currentUser.role !== 'ADMIN' && context.currentUser.role !== 'OFFICE_HEAD') {
        throw new Error('Forbidden: Only secretaries can approve tickets');
      }
      return ticketService.approveAsSecretary(ticketId, context.currentUser.id, comment);
    },

    approveTicketAsDirector: async (
      _: any,
      { ticketId, comment }: { ticketId: number; comment?: string },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only directors/office heads can approve as director
      if (context.currentUser.role !== 'ADMIN' && context.currentUser.role !== 'OFFICE_HEAD') {
        throw new Error('Forbidden: Only directors can approve tickets');
      }
      return ticketService.approveAsDirector(ticketId, context.currentUser.id, comment);
    },

    assignTicket: async (
      _: any,
      { ticketId, userId }: { ticketId: number; userId: number },
      context: any
    ) => {
      if (!context.currentUser) {
        throw new Error('Unauthorized');
      }
      // Only admins and office heads can assign tickets
      if (!['ADMIN', 'OFFICE_HEAD'].includes(context.currentUser.role)) {
        throw new Error('Forbidden: Insufficient permissions');
      }
      await ticketService.assignUser(ticketId, userId);
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
      // Only admins and office heads can unassign tickets
      if (!['ADMIN', 'OFFICE_HEAD'].includes(context.currentUser.role)) {
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
  },
};
