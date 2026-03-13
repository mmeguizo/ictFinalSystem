import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { createServer } from "http";
import { WebSocketServer } from "ws";
// graphql-ws uses package.json "exports" which requires moduleResolution >= node16
// Using require() since our tsconfig uses CommonJS module resolution
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useServer } = require("graphql-ws/use/ws") as { useServer: any };
import { ApolloServer } from "apollo-server-express";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createContext } from "./context";
import { config } from "./config";
import { logger } from "./lib/logger";
import { formatError } from "./lib/errors";
import { baseTypeDefs, baseResolvers } from "./common/base-schema";
import { userTypeDefs, userResolvers } from "./modules/users";
import { ticketTypeDefs, ticketResolvers } from "./modules/tickets";
import { notificationTypeDefs } from "./modules/notifications/notification.types";
import { notificationResolvers } from "./modules/notifications/notification.resolvers";
import { kbTypeDefs, kbResolvers } from "./modules/knowledge-base";
import { aiTypeDefs, aiResolvers } from "./modules/ai";
import {
  ticketAttachmentUpload,
  getAttachmentUrl,
} from "./modules/storage/upload.middleware";
import { prisma } from "./lib/prisma";
import { jwtService } from "./modules/auth/jwt.service";
import { auth0Service } from "./modules/auth/auth0.service";
import { NotificationService } from "./modules/notifications/notification.service";
import { SLACronService } from "./lib/sla-cron.service";

async function start() {
  // Combine all type definitions and resolvers
  const typeDefs = [
    baseTypeDefs,
    userTypeDefs,
    ticketTypeDefs,
    notificationTypeDefs,
    kbTypeDefs,
    aiTypeDefs,
  ];
  const resolvers = [
    baseResolvers,
    userResolvers,
    ticketResolvers,
    notificationResolvers,
    kbResolvers,
    aiResolvers,
  ];

  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const app = express();

  // CORS for frontend dev server
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: true,
    }),
  );

  // Security headers — disables X-Powered-By, adds HSTS, XSS filter, etc.
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // allow GraphQL Playground
      contentSecurityPolicy: false, // Apollo Sandbox needs inline scripts
      crossOriginResourcePolicy: { policy: "cross-origin" }, // allow frontend to load images/uploads
    }),
  );

  // Rate limiting — 500 requests per 15-minute window per IP
  // GraphQL apps make multiple queries per page load, so this needs to be generous
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
    skip: (req) => req.path === "/uploads" || req.path.startsWith("/uploads"), // skip static assets
  });
  app.use(apiLimiter);

  // Stricter limit for file uploads — 10 per 15-minute window
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Upload rate limit exceeded, please try again later." },
  });
  app.use("/upload", uploadLimiter);

  // Static uploads (avatars, attachments)
  const uploadsDir = path.resolve(__dirname, "..", "uploads");
  app.use("/uploads", express.static(uploadsDir));

  // ========================================
  // REST endpoint for ticket file uploads
  // POST /upload/ticket-attachments
  // Requires Authorization header (Bearer token)
  // Form field: "files" (multipart, up to 5 files, 50MB each)
  // Query param: ticketId (required)
  // ========================================
  app.post(
    "/upload/ticket-attachments",
    async (req, res, next) => {
      // Authenticate user from Authorization header
      const authHeader = (req.headers.authorization || "").toString();
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

      if (!token) {
        return res.status(401).json({ error: "Authentication required" });
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
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Attach userId to request for use after multer
      (req as any).authenticatedUserId = userId;
      next();
    },
    ticketAttachmentUpload.array("files", 5),
    async (req, res) => {
      try {
        const ticketId = parseInt(req.query.ticketId as string, 10);
        if (isNaN(ticketId)) {
          return res
            .status(400)
            .json({ error: "ticketId query parameter is required" });
        }

        // Verify ticket exists
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
        });
        if (!ticket) {
          return res.status(404).json({ error: "Ticket not found" });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ error: "No files uploaded" });
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
            }),
          ),
        );

        logger.info(
          `Uploaded ${attachments.length} attachment(s) for ticket #${ticketId} by user #${(req as any).authenticatedUserId}`,
        );

        // Send notifications about file upload to relevant users
        try {
          const uploader = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          const notificationService = new NotificationService(prisma);
          await notificationService.notifyAttachmentUploaded(
            ticketId,
            ticket.ticketNumber,
            ticket.title,
            userId,
            uploader?.name || "Someone",
            attachments.length,
          );
        } catch (notifErr) {
          logger.error("Failed to send attachment notification:", notifErr);
        }

        res.json({
          success: true,
          attachments: attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            originalName: a.originalName,
            mimeType: a.mimeType,
            size: a.size,
            url: a.url,
            uploadedBy: a.uploadedBy
              ? {
                  id: a.uploadedBy.id,
                  name: a.uploadedBy.name,
                  role: a.uploadedBy.role,
                }
              : null,
            isDeleted: a.isDeleted,
            createdAt: a.createdAt.toISOString(),
          })),
        });
      } catch (error: any) {
        logger.error("Upload error:", error);
        res.status(500).json({ error: error.message || "Upload failed" });
      }
    },
  );

  // Error handler for multer errors (file too large, wrong type, etc.)
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (err instanceof Error && err.message) {
        if (err.message.includes("File too large")) {
          return res
            .status(413)
            .json({ error: "File too large. Maximum size is 50MB per file." });
        }
        if (err.message.includes("File type")) {
          return res.status(400).json({ error: err.message });
        }
      }
      next(err);
    },
  );

  const server = new ApolloServer({
    schema,
    context: createContext,
    formatError,
  });

  await server.start();
  server.applyMiddleware({
    app,
    path: "/",
    bodyParserConfig: { limit: "10mb" },
  });

  // ========================================
  // HTTP + WebSocket server for real-time subscriptions
  // HTTP handles normal GraphQL queries/mutations
  // WebSocket handles subscriptions (live updates)
  // ========================================
  const httpServer = createServer(app);

  // WebSocket server — listens on the same port at /graphql path
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  // Attach graphql-ws to handle subscription protocol
  useServer(
    {
      schema,
      onConnect: (ctx: any) => {
        logger.info(
          `🔌 WebSocket client connected (params: ${JSON.stringify(ctx.connectionParams || {})})`,
        );
      },
      onDisconnect: () => {
        logger.info("🔌 WebSocket client disconnected");
      },
      onSubscribe: (_ctx: any, msg: any) => {
        logger.info(
          `📡 Subscription started: ${msg.payload?.operationName || msg.id}`,
        );
      },
    },
    wsServer,
  );

  httpServer.listen(config.port, () => {
    const base = `${config.publicBaseUrl}`;
    logger.info(`🚀 GraphQL server running at ${base}/`);
    logger.info(
      `🔌 WebSocket subscriptions at ws://localhost:${config.port}/graphql`,
    );
    logger.info(`📁 Serving uploads from ${base}/uploads`);
    logger.info(`🌍 Environment: ${config.nodeEnv}`);

    // Start SLA breach cron job
    const slaCron = new SLACronService(prisma);
    slaCron.start();
  });
}

start().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
