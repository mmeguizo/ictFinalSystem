import { KBService } from "./kb.service";
import { prisma } from "../../lib/prisma";

const kbService = new KBService(prisma);

export const kbResolvers = {
  Query: {
    knowledgeArticles: async (
      _: any,
      { filter, pagination }: { filter?: any; pagination?: any },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");

      // Non-admin users only see PUBLISHED articles
      const isStaff = ["ADMIN", "MIS_HEAD", "ITS_HEAD", "DIRECTOR"].includes(
        context.currentUser.role,
      );
      if (!isStaff) {
        filter = { ...filter, status: "PUBLISHED" };
      }

      return kbService.getArticles(filter, pagination);
    },

    knowledgeArticle: async (_: any, { id }: { id: number }, context: any) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      return kbService.getArticle(id);
    },

    knowledgeCategories: async (_: any, __: any, context: any) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      return kbService.getCategories();
    },
  },

  Mutation: {
    createArticle: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.currentUser) throw new Error("Unauthorized");

      const allowedRoles = ["ADMIN", "MIS_HEAD", "ITS_HEAD", "DIRECTOR"];
      if (!allowedRoles.includes(context.currentUser.role)) {
        throw new Error("Not authorized to create articles");
      }

      return kbService.createArticle(input, context.currentUser.id);
    },

    updateArticle: async (
      _: any,
      { id, input }: { id: number; input: any },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      return kbService.updateArticle(
        id,
        input,
        context.currentUser.id,
        context.currentUser.role,
      );
    },

    deleteArticle: async (_: any, { id }: { id: number }, context: any) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      return kbService.deleteArticle(
        id,
        context.currentUser.id,
        context.currentUser.role,
      );
    },

    markArticleHelpful: async (
      _: any,
      { id }: { id: number },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      return kbService.markHelpful(id);
    },
  },
};
