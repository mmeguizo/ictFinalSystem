import { User, Role } from '@prisma/client';
import argon2 from 'argon2';
import { UserRepository, userRepository } from './user.repository';
import { StorageService, storageService } from '../storage/storage.service';
import { JWTService, jwtService } from '../auth/jwt.service';
import {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../../lib/errors';
import { logger } from '../../lib/logger';
import {
  createUserSchema,
  updateProfileSchema,
  setPasswordSchema,
  loginSchema,
  type CreateUserInput,
  type UpdateProfileInput,
  type SetPasswordInput,
  type LoginInput,
} from './user.validators';

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly storage: StorageService,
    private readonly jwt: JWTService
  ) {}

  async getById(id: number): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  async getAll(): Promise<User[]> {
    logger.info('Fetching all users');
    return this.userRepo.findAll();
  }

  async create(input: CreateUserInput): Promise<User> {
    const validation = createUserSchema.safeParse(input);
    if (!validation.success) {
      throw new ValidationError('Invalid user data', validation.error.format());
    }

    const { email, name, password, role } = validation.data;

    // Check if user already exists
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    logger.info(`Creating new user: ${email}`);

    return this.userRepo.create({
      email,
      name: name ?? null,
      password: password ?? null,
      role: role as Role | undefined,
    });
  }

  async updateProfile(userId: number, input: UpdateProfileInput): Promise<User> {
    console.log('UpdateProfile Input:', input);
    const validation = updateProfileSchema.safeParse(input);
    console.log('Validation Result:', validation);
    if (!validation.success) {
      throw new ValidationError('Invalid profile data', validation.error.format());
    }

    const data: any = {};

    if (typeof input.name !== 'undefined') {
      data.name = input.name;
    }

    if (input.avatarDataUrl) {
      logger.debug(`Processing avatar for user ${userId}`);
      const avatarUrl = await this.storage.saveAvatarFromDataUrl(input.avatarDataUrl);
      data.avatarUrl = avatarUrl;
      data.picture = avatarUrl;
      logger.info(`Avatar saved for user ${userId}`);
    }

    return this.userRepo.update(userId, data);
  }

  async setPassword(userId: number, input: SetPasswordInput): Promise<User> {
    const validation = setPasswordSchema.safeParse(input);
    if (!validation.success) {
      throw new ValidationError('Invalid password', validation.error.format());
    }

    logger.info(`Setting password for user ${userId}`);
    const hashedPassword = await argon2.hash(input.password);

    return this.userRepo.update(userId, { password: hashedPassword });
  }

  async setUserRole(userId: number, role: Role): Promise<User> {
    logger.info(`Setting role ${role} for user ${userId}`);
    return this.userRepo.update(userId, { role });
  }

  /**
   * Get all users with a specific role
   * Used for assignment dropdowns (e.g., get all DEVELOPERs)
   */
  async getByRole(role: Role): Promise<User[]> {
    logger.info(`Fetching users with role: ${role}`);
    return this.userRepo.findByRole(role);
  }

  /**
   * Get all users with any of the specified roles
   * Used for getting staff from multiple categories
   */
  async getByRoles(roles: Role[]): Promise<User[]> {
    logger.info(`Fetching users with roles: ${roles.join(', ')}`);
    return this.userRepo.findByRoles(roles);
  }

  async login(input: LoginInput): Promise<{ token: string; user: User }> {
    const validation = loginSchema.safeParse(input);
    if (!validation.success) {
      throw new ValidationError('Invalid login credentials', validation.error.format());
    }

    const { email, password } = validation.data;

    logger.info(`Login attempt for: ${email}`);

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      logger.warn(`Login failed: user not found - ${email}`);
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.password) {
      logger.warn(`Login failed: no password set - ${email}`);
      throw new UnauthorizedError('This account uses SSO login. Please sign in with CHMSU SSO.');
    }

    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      logger.warn(`Login failed: invalid password - ${email}`);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const token = await this.jwt.sign(user.id, user.email, user.role);

    logger.info(`Login successful for user ${user.id}`);
    return { token, user };
  }

  async upsertFromAuth0(
    externalId: string,
    email: string,
    name?: string | null,
    picture?: string | null
  ): Promise<{ user: User; created: boolean }> {
    logger.info(`Upserting user from Auth0: ${externalId}`);

    // Download avatar if it's a remote URL
    let avatarUrl: string | null = null;
    const existing = await this.userRepo.findByExternalId(externalId);
    
    if (!existing?.avatarUrl && picture && this.isHttpUrl(picture)) {
      avatarUrl = await this.storage.saveAvatarFromRemoteUrl(picture);
    }

    return this.userRepo.upsertByExternalId(
      externalId,
      {
        email,
        name: name ?? null,
        picture: picture ?? null,
        avatarUrl: avatarUrl ?? picture ?? null,
      },
      {
        email,
        name: name ?? null,
        picture: picture ?? null,
        ...(avatarUrl ? { avatarUrl } : {}),
      }
    );
  }

  private isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }
}

export const userService = new UserService(userRepository, storageService, jwtService);
