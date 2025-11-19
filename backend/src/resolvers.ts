import argon2 from 'argon2';
import { SignJWT } from 'jose';
import { saveAvatarFromDataUrl } from './avatar-storage';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const resolvers = {
  User: {
    avatarUrl: (user: any) => user.avatarUrl ?? user.picture ?? null,
  },
  Query: {
    me: async (_parent: any, _args: any, ctx: any) => {
      console.log('Query.me');
      if (!ctx.currentUser) return null;
      return ctx.prisma.user.findUnique({ where: { id: ctx.currentUser.id } });
    },
    users: async (_parent: any, _args: any, ctx: any) => {
      console.log('Query.users called');
      return ctx.prisma.user.findMany();
    },
    user: async (_parent: any, args: { id: number }, ctx: any) => {
      console.log('Query.user', args.id);
      return ctx.prisma.user.findUnique({ where: { id: args.id } });
    },
  },
  Mutation: {
    createUser: async (
      _parent: any,
      args: { input: { email: string; name?: string; password?: string | null; role?: string | null } },
      ctx: any
    ) => {
      console.log('Mutation.createUser', args.input.email);
      const { email, name, password, role } = args.input;
      return ctx.prisma.user.create({
        data: {
          email,
          name: name ?? null,
          // store null for social accounts; you can hash later when setting local passwords
          password: password ?? null,
          // prisma will validate enum; passing undefined keeps default
          ...(role ? { role } : {}),
        },
      });
    },
    upsertMe: async (_parent: any, _args: any, ctx: any) => {
      console.log('Mutation.upsertMe');
      if (!ctx.currentUser) throw new Error('Unauthorized');
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.currentUser.id } });
      if (!user) throw new Error('User not found');
      const created = Boolean((ctx.currentUser as any).wasCreated);
      return { user, created };
    },
    setUserRole: async (_p: any, args: { id: number; role: string }, ctx: any) => {
      console.log('Mutation.setUserRole', args.id, args.role);
      return ctx.prisma.user.update({ where: { id: args.id }, data: { role: args.role } });
    },
    setLocalPassword: async (_p: any, args: { id: number; password: string }, ctx: any) => {
      console.log('Mutation.setLocalPassword', args.id);
      const hash = await argon2.hash(args.password);
      return ctx.prisma.user.update({ where: { id: args.id }, data: { password: hash } });
    },
    updateMyProfile: async (
      _p: any,
      args: { input: { name?: string | null; avatarDataUrl?: string | null } },
      ctx: any
    ) => {
      if (!ctx.currentUser) throw new Error('Unauthorized');
      console.log('Mutation.updateMyProfile for user', ctx.currentUser.id, {
        hasName: !!args.input.name,
        hasAvatar: !!args.input.avatarDataUrl,
        avatarSize: args.input.avatarDataUrl?.length || 0,
      });

      const data: any = {};
      if (typeof args.input.name !== 'undefined') {
        data.name = args.input.name;
        console.log('  → Updating name to:', args.input.name);
      }

      if (args.input.avatarDataUrl) {
        console.log('  → Processing avatar Data URL...');
        const savedUrl = saveAvatarFromDataUrl(args.input.avatarDataUrl);
        data.avatarUrl = savedUrl;
        data.picture = savedUrl;
        console.log('  → Avatar saved to:', savedUrl);
      }

      const updatedUser = await ctx.prisma.user.update({ where: { id: ctx.currentUser.id }, data });
      console.log('  ✓ Profile updated successfully');
      return updatedUser;
    },
    setMyPassword: async (_p: any, args: { password: string }, ctx: any) => {
      if (!ctx.currentUser) throw new Error('Unauthorized');
      console.log('Mutation.setMyPassword for user', ctx.currentUser.id);
      const hash = await argon2.hash(args.password);
      const updatedUser = await ctx.prisma.user.update({ where: { id: ctx.currentUser.id }, data: { password: hash } });
      console.log('  ✓ Password updated successfully');
      return updatedUser;
    },
    login: async (_p: any, args: { email: string; password: string }, ctx: any) => {
      console.log('Mutation.login attempt for email:', args.email);
      
      const user = await ctx.prisma.user.findUnique({ 
        where: { email: args.email.toLowerCase().trim() } 
      });
      
      if (!user) {
        console.log('  ✗ User not found');
        throw new Error('Invalid email or password');
      }
      
      if (!user.password) {
        console.log('  ✗ User has no password set (SSO-only account)');
        throw new Error('This account uses SSO login. Please sign in with CHMSU SSO.');
      }
      
      const valid = await argon2.verify(user.password, args.password);
      if (!valid) {
        console.log('  ✗ Invalid password');
        throw new Error('Invalid email or password');
      }
      
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      
      const token = await new SignJWT({ 
        sub: String(user.id), 
        email: user.email, 
        role: user.role 
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRES_IN)
        .sign(JWT_SECRET);
      
      console.log('  ✓ Login successful, token generated');
      return { token, user };
    },
  },
};
