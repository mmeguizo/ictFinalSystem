import { solutionService } from "./solution.service";
import { logger } from "../../lib/logger";

const STAFF_ROLES = [
  "ADMIN",
  "DEVELOPER",
  "TECHNICAL",
  "MIS_HEAD",
  "ITS_HEAD",
  "SECRETARY",
  "DIRECTOR",
];

export const solutionResolvers = {
  Query: {
    troubleshootingSolutions: async (
      _: unknown,
      args: {
        filter?: { category?: string; search?: string };
        page?: number;
        pageSize?: number;
      },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      return solutionService.getSolutions(
        args.filter || undefined,
        args.page,
        args.pageSize,
      );
    },

    troubleshootingSolution: async (
      _: unknown,
      { id }: { id: number },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      return solutionService.getSolutionById(id);
    },
  },

  Mutation: {
    createSolution: async (
      _: unknown,
      { input }: { input: any },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      if (!STAFF_ROLES.includes(context.currentUser.role)) {
        throw new Error("Only staff members can create solutions");
      }
      return solutionService.createSolution(context.currentUser.id, input);
    },

    updateSolution: async (
      _: unknown,
      { id, input }: { id: number; input: any },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      const existing = await solutionService.getSolutionById(id);
      if (!existing) throw new Error("Solution not found");
      if (
        existing.createdById !== context.currentUser.id &&
        context.currentUser.role !== "ADMIN"
      ) {
        throw new Error("Only the author or admin can update this solution");
      }
      return solutionService.updateSolution(id, input);
    },

    deleteSolution: async (
      _: unknown,
      { id }: { id: number },
      context: any,
    ) => {
      if (!context.currentUser) throw new Error("Unauthorized");
      const existing = await solutionService.getSolutionById(id);
      if (!existing) throw new Error("Solution not found");
      if (
        existing.createdById !== context.currentUser.id &&
        context.currentUser.role !== "ADMIN"
      ) {
        throw new Error("Only the author or admin can delete this solution");
      }
      return solutionService.deleteSolution(id);
    },
  },
};
