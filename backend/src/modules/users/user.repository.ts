import { User, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';

export class UserRepository {
  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByExternalId(externalId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { externalId } });
  }

  async findAll(): Promise<User[]> {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    email: string;
    name?: string | null;
    password?: string | null;
    role?: Role;
    externalId?: string;
    picture?: string | null;
    avatarUrl?: string | null;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase().trim(),
      },
    });
  }

  async update(
    id: number,
    data: Partial<{
      email: string;
      name: string | null;
      password: string | null;
      role: Role;
      picture: string | null;
      avatarUrl: string | null;
      lastLoginAt: Date;
    }>
  ): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async upsertByExternalId(
    externalId: string,
    createData: {
      email: string;
      name?: string | null;
      picture?: string | null;
      avatarUrl?: string | null;
    },
    updateData: Partial<{
      email: string;
      name: string | null;
      picture: string | null;
      avatarUrl: string | null;
      lastLoginAt: Date;
    }>
  ): Promise<{ user: User; created: boolean }> {
    const existing = await this.findByExternalId(externalId);

    const user = await prisma.user.upsert({
      where: { externalId },
      create: {
        externalId,
        ...createData,
        email: createData.email.toLowerCase().trim(),
        lastLoginAt: new Date(),
      },
      update: {
        ...updateData,
        lastLoginAt: new Date(),
      },
    });

    return { user, created: !existing };
  }

  async delete(id: number): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }
}

export const userRepository = new UserRepository();
