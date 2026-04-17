import { chatService } from "./chat.service";
import { prisma } from "../../lib/prisma";
import { embeddingService } from "./embedding.service";
import { solutionService } from "../solutions/solution.service";

export const chatResolvers = {
  Query: {
    chatSessions: async (_: any, __: any, ctx: any) => {
      if (!ctx.currentUser) throw new Error("Authentication required");
      return chatService.getSessions(ctx.currentUser.id);
    },

    chatSession: async (_: any, args: { id: number }, ctx: any) => {
      if (!ctx.currentUser) throw new Error("Authentication required");
      return chatService.getSession(args.id, ctx.currentUser.id);
    },
  },

  Mutation: {
    createChatSession: async (_: any, args: { title?: string }, ctx: any) => {
      if (!ctx.currentUser) throw new Error("Authentication required");
      return chatService.createSession(ctx.currentUser.id, args.title);
    },

    sendChatMessage: async (
      _: any,
      args: { sessionId: number; message: string },
      ctx: any,
    ) => {
      if (!ctx.currentUser) throw new Error("Authentication required");
      const { reply, metadata } = await chatService.sendMessage(
        args.sessionId,
        ctx.currentUser.id,
        args.message,
      );

      const session = await chatService.getSession(
        args.sessionId,
        ctx.currentUser.id,
      );

      return { reply, metadata, session };
    },

    createTicketFromChat: async (
      _: any,
      args: {
        input: {
          sessionId: number;
          title: string;
          description: string;
          type: string;
          priority?: string;
        };
      },
      ctx: any,
    ) => {
      if (!ctx.currentUser) throw new Error("Authentication required");
      return chatService.createTicketFromChat(
        args.input.sessionId,
        ctx.currentUser.id,
        {
          title: args.input.title,
          description: args.input.description,
          type: args.input.type as "MIS" | "ITS",
          priority: args.input.priority,
        },
      );
    },

    deleteChatSession: async (_: any, args: { id: number }, ctx: any) => {
      if (!ctx.currentUser) throw new Error("Authentication required");
      return chatService.deleteSession(args.id, ctx.currentUser.id);
    },

    /**
     * Admin-only: backfill embeddings for all solutions + auto-create
     * solutions from resolved tickets that don't have one yet.
     */
    backfillSolutionEmbeddings: async (_: any, __: any, ctx: any) => {
      if (!ctx.currentUser) throw new Error("Authentication required");
      if (ctx.currentUser.role !== "ADMIN") {
        throw new Error("Only admins can trigger backfill");
      }

      // 1. Auto-create solutions from resolved tickets without solutions
      const resolvedTickets = await prisma.ticket.findMany({
        where: {
          status: { in: ["RESOLVED", "CLOSED"] },
          resolution: { not: null },
          troubleshootingSolutions: { none: {} },
        },
        select: { id: true },
      });

      let solutionsCreated = 0;
      for (const t of resolvedTickets) {
        await solutionService.createFromResolvedTicket(
          t.id,
          ctx.currentUser.id,
        );
        solutionsCreated++;
      }

      // 2. Backfill embeddings for solutions missing them
      const { processed, failed } = await embeddingService.backfillEmbeddings();

      return {
        solutionsCreated,
        embeddingsGenerated: processed,
        embeddingsFailed: failed,
      };
    },
  },

  ChatSession: {
    messages: async (parent: any) => {
      if (parent.messages) return parent.messages;
      return prisma.chatMessage.findMany({
        where: { sessionId: parent.id },
        orderBy: { createdAt: "asc" },
      });
    },

    messageCount: (parent: any) => {
      if (parent._count?.messages !== undefined) return parent._count.messages;
      return parent.messages?.length || 0;
    },

    ticket: async (parent: any) => {
      if (!parent.ticketId) return null;
      if (parent.ticket) return parent.ticket;
      return prisma.ticket.findUnique({ where: { id: parent.ticketId } });
    },
  },
};
