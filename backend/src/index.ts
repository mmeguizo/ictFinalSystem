import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createContext } from './context';
import { config } from './config';
import { logger } from './lib/logger';
import { formatError } from './lib/errors';
import { baseTypeDefs, baseResolvers } from './common/base-schema';
import { userTypeDefs, userResolvers } from './modules/users';
import { ticketTypeDefs, ticketResolvers } from './modules/tickets';
import { notificationTypeDefs } from './modules/notifications/notification.types';
import { notificationResolvers } from './modules/notifications/notification.resolvers';
import { ticketAttachmentUpload, getAttachmentUrl } from './modules/storage/upload.middleware';
import { prisma } from './lib/prisma';
import { jwtService } from './modules/auth/jwt.service';
import { auth0Service } from './modules/auth/auth0.service';

async function start() {
  // Combine all type definitions and resolvers
  const typeDefs = [baseTypeDefs, userTypeDefs, ticketTypeDefs, notificationTypeDefs];
  const resolvers = [baseResolvers, userResolvers, ticketResolvers, notificationResolvers];

  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const app = express();

  // CORS for frontend dev server
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: true,
    })
  );
  // app.use("/graphql",
  //   cors({
  //     origin: config.cors.origins,
  //     credentials: true,
  //   })
  // );

  // Static uploads (avatars, attachments)
  const uploadsDir = path.resolve(__dirname, '..', 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // ========================================
  // REST endpoint for ticket file uploads
  // POST /upload/ticket-attachments
  // Requires Authorization header (Bearer token)
  // Form field: "files" (multipart, up to 5 files, 50MB each)
  // Query param: ticketId (required)
  // ========================================
  app.post(
    '/upload/ticket-attachments',
    async (req, res, next) => {
      // Authenticate user from Authorization header
      const authHeader = (req.headers.authorization || '').toString();
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Try JWT first, then Auth0
      let userId: number | null = null;

      const jwtUser = await jwtService.verify(token);
      if (jwtUser) {
        const id = parseInt(jwtUser.sub, 10);
        if (!isNaN(id)) userId = id;
      }

      if (!userId) {
        const auth0User = await auth0Service.verifyToken(token);
        if (auth0User?.sub) {
          const dbUser = await prisma.user.findFirst({
            where: { externalId: auth0User.sub },
          });
          if (dbUser) userId = dbUser.id;
        }
      }

      if (!userId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Attach userId to request for use after multer
      (req as any).authenticatedUserId = userId;
      next();
    },
    ticketAttachmentUpload.array('files', 5),
    async (req, res) => {
      try {
        const ticketId = parseInt(req.query.ticketId as string, 10);
        if (isNaN(ticketId)) {
          return res.status(400).json({ error: 'ticketId query parameter is required' });
        }

        // Verify ticket exists
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) {
          return res.status(404).json({ error: 'Ticket not found' });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ error: 'No files uploaded' });
        }

        // Save attachment records to database (with who uploaded)
        const userId = (req as any).authenticatedUserId;
        const attachments = await Promise.all(
          files.map((file) =>
            prisma.ticketAttachment.create({
              data: {
                ticketId,
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                url: getAttachmentUrl(file.filename),
                uploadedById: userId,
              },
              include: {
                uploadedBy: true,
              },
            })
          )
        );

        logger.info(`Uploaded ${attachments.length} attachment(s) for ticket #${ticketId} by user #${(req as any).authenticatedUserId}`);

        res.json({
          success: true,
          attachments: attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            originalName: a.originalName,
            mimeType: a.mimeType,
            size: a.size,
            url: a.url,
            uploadedBy: a.uploadedBy ? { id: a.uploadedBy.id, name: a.uploadedBy.name, role: a.uploadedBy.role } : null,
            isDeleted: a.isDeleted,
            createdAt: a.createdAt.toISOString(),
          })),
        });
      } catch (error: any) {
        logger.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
      }
    }
  );

  // Error handler for multer errors (file too large, wrong type, etc.)
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof Error && err.message) {
      if (err.message.includes('File too large')) {
        return res.status(413).json({ error: 'File too large. Maximum size is 50MB per file.' });
      }
      if (err.message.includes('File type')) {
        return res.status(400).json({ error: err.message });
      }
    }
    next(err);
  });

  const server = new ApolloServer({
    schema,
    context: createContext,
    formatError,
  });

  await server.start();
  server.applyMiddleware({ app, path: '/', bodyParserConfig: { limit: '10mb' } });

  app.listen(config.port, () => {
    const base = `${config.publicBaseUrl}`;
    logger.info(`🚀 GraphQL server running at ${base}/`);
    logger.info(`📁 Serving uploads from ${base}/uploads`);
    logger.info(`🌍 Environment: ${config.nodeEnv}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
