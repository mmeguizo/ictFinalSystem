import { User, Role } from '@prisma/client';
import { UserService, userService } from './user.service';
import { JWTService, jwtService } from '../auth/jwt.service';
import { UnauthorizedError } from '../../lib/errors';

interface Context {
  currentUser: User | null;
  userService: UserService;
  jwtService: JWTService;
}

export const userResolvers = {
  User: {
    avatarUrl: (user: User) => user.avatarUrl ?? user.picture ?? null,
  },
  Query: {
    me: async (_: any, __: any, ctx: Context): Promise<User | null> => {
      if (!ctx.currentUser) return null;
      return ctx.userService.getById(ctx.currentUser.id);
    },
    users: async (_: any, __: any, ctx: Context): Promise<User[]> => {
      return ctx.userService.getAll();
    },
    user: async (_: any, args: { id: number }, ctx: Context): Promise<User | null> => {
      console.log('Fetching user with ID:', args.id);
      return ctx.userService.getById(args.id);
    },
    /**
     * Get users by a single role
     * Used for getting specific staff (e.g., all DEVELOPERs for assignment)
     */
    usersByRole: async (_: any, args: { role: Role }, ctx: Context): Promise<User[]> => {
      ctx.jwtService.requireAuth(ctx.currentUser);
      return ctx.userService.getByRole(args.role);
    },
    /**
     * Get users by multiple roles
     * Used for getting staff from multiple categories
     */
    usersByRoles: async (_: any, args: { roles: Role[] }, ctx: Context): Promise<User[]> => {
      ctx.jwtService.requireAuth(ctx.currentUser);
      return ctx.userService.getByRoles(args.roles);
    },
  },
  Mutation: {
    createUser: async (_: any, args: { input: any }, ctx: Context): Promise<User> => {
      return ctx.userService.create(args.input);
    },
    upsertMe: async (_: any, __: any, ctx: Context) => {
      ctx.jwtService.requireAuth(ctx.currentUser);
      
      const user = await ctx.userService.getById(ctx.currentUser!.id);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const created = Boolean((ctx.currentUser as any).wasCreated);
      return { user, created };
    },
    setUserRole: async (_: any, args: { id: number; role: string }, ctx: Context): Promise<User> => {
      ctx.jwtService.requireRole(ctx.currentUser, ['ADMIN']);
      return ctx.userService.setUserRole(args.id, args.role as any);
    },
    setLocalPassword: async (_: any, args: { id: number; password: string }, ctx: Context): Promise<User> => {
      ctx.jwtService.requireRole(ctx.currentUser, ['ADMIN']);
      return ctx.userService.setPassword(args.id, { password: args.password });
    },
    updateMyProfile: async (_: any, args: { input: any }, ctx: Context): Promise<User> => {
      ctx.jwtService.requireAuth(ctx.currentUser);
      return ctx.userService.updateProfile(ctx.currentUser!.id, args.input);
    },
    setMyPassword: async (_: any, args: { password: string }, ctx: Context): Promise<User> => {
      ctx.jwtService.requireAuth(ctx.currentUser);
      return ctx.userService.setPassword(ctx.currentUser!.id, { password: args.password });
    },
    login: async (_: any, args: { email: string; password: string }): Promise<{ token: string; user: User }> => {
      return userService.login(args);
    },
  },
};
