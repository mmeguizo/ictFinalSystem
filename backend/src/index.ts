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

  // Static uploads (avatars)
  const uploadsDir = path.resolve(__dirname, '..', 'uploads');
  app.use('/uploads', express.static(uploadsDir));

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
