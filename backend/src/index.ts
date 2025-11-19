import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';
import { createContext } from './context';

async function start() {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const app = express();

  // CORS for frontend dev server
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4200'],
      credentials: true,
    })
  );

  // Static uploads (avatars)
  const uploadsDir = path.resolve(__dirname, '..', 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  const server = new ApolloServer({ schema, context: createContext });
  await server.start();
  server.applyMiddleware({ app, path: '/', bodyParserConfig: { limit: '10mb' } });

  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    const base = `http://localhost:${port}`;
    console.log(`GraphQL server running at ${base}/`);
    console.log(`Serving uploads from ${base}/uploads`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
