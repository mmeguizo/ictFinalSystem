# ICTSystem Backend (GraphQL + MySQL)

This is a minimal, easy-to-debug GraphQL backend using TypeScript, Prisma and Apollo Server, intended for local development with MySQL.

Quick start (Windows cmd.exe):

1. Start a local MySQL using Docker Compose (from backend folder):

   docker compose up -d

2. Copy `.env.example` to `.env` and edit if needed:

   copy .env.example .env

3. Install dependencies:

   npm install


4. Generate Prisma client and run initial migration (for updates to `prisma/schema.prisma` run migrate then generate):

   npx prisma migrate dev --name init
   npx prisma generate

5. (Optional) Seed the database with example users:

   npm run seed

Database workflow (when you change `prisma/schema.prisma`)

Always run these three commands from the `backend` folder (Windows cmd.exe):

```cmd
npx prisma migrate dev --name <meaningful_name>
npx prisma generate
npm run seed
```

- `migrate dev` applies the schema changes locally and updates the migrations folder.
- `prisma generate` regenerates the Prisma client used by the app.
- `npm run seed` populates example users and backfills `avatarUrl` from provider pictures. The seed script is resilient to older databases that don't yet have `avatarUrl`.

If you prefer using the package.json scripts already included, you can run:

```cmd
npm run prisma:migrate
npm run prisma:generate
npm run seed
```

6. Start the dev server (auto-restarts on code change):

   npm run dev

Server will be available at http://localhost:4000 (Apollo Server default). Adminer UI is at http://localhost:8080.

Server will be available at http://localhost:4000/graphql. Adminer UI is at http://localhost:8080.

Notes:
- This scaffold uses Prisma for schema + DB client. Adjust `prisma/schema.prisma` to add models.
- Keep code simple and split: small files, clear responsibilities (context, schema, resolvers).

## Profile updates and avatars

- `updateMyProfile(input: { name?: String, avatarDataUrl?: String })` lets the current user update display name and upload an avatar.
   - Provide `avatarDataUrl` as a Data URL (e.g. `data:image/png;base64,...`). The server decodes and stores it under `uploads/avatars/<uuid>.<ext>` and sets `User.avatarUrl` to a public URL.
   - Set `PUBLIC_BASE_URL` in `.env` (defaults to `http://localhost:4000`) so generated avatar URLs are correct for your environment.
- `setMyPassword(password: String!)` hashes a new password with Argon2 and stores it in `User.password`.
- Admin versions:
   - `setLocalPassword(id: Int!, password: String!)` sets another user's password (hashed).

Static files are served from `/uploads`. For local dev, avatars will be accessible at `http://localhost:4000/uploads/avatars/<file>`.

## Migrations

When schema changes (e.g., added `User.avatarUrl`), run:

```
npx prisma migrate dev --name add_user_avatar_url
npx prisma generate

## Frontend fetching (recommended)

This backend exposes a GraphQL API intended to be consumed by the Angular frontend. For best results in the frontend we recommend using Apollo Angular (the official Angular integration maintained by The Guild). Apollo Angular integrates well with Angular's HttpClient, RxJS and SSR patterns and makes it easy to add an auth link or intercept headers for access tokens.

- Getting started guide: https://the-guild.dev/graphql/apollo-angular/docs/get-started
- Key benefits:
   - Automatic integration with Angular DI and lifecycle
   - Easy to add an auth link to attach access tokens
   - Works well with SSR and zone.js

If you prefer lightweight alternatives, `graphql-request` is an option, but for Angular apps Apollo Angular provides better DX, type-safety (with codegen), and long-term maintainability.
```
