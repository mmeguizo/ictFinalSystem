# Copilot instructions for this repo


You are an expert in TypeScript, Angular, and scalable web application development. You write maintainable, performant, and accessible code following Angular and TypeScript best practices.

If any terminal command needs to be run (installs, builds, restarts, etc.), describe the command instead of executing it—the user will run console steps manually.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### When To Move From Signals To NgRx/NGXS

- **Growing global state surface:** multiple unrelated features need to read/write the same data (user, perms, settings, caches).
- **Complex async flows / side effects:** you have many coordinated server calls, retries, debouncing, or long-running background processes that are hard to test or reason about as local effects.
- **Optimistic updates & conflict resolution:** UI needs optimistic updates with rollback or complex merge/conflict handling across clients.
- **Performance with many components:** many components subscribe to the same changing state and you need fine-grained memoization, selectors, or normalized entities to avoid re-renders.
- **Team scale & consistency:** multiple engineers need a predictable pattern for actions, reducers/effects, and time-travel debugging (DevTools) helps onboard and debug.

### Migration Checklist (incremental)

1. **Evaluate and plan:** identify 2–3 core state domains to migrate first (for example: `auth`, `entities/tickets`, `ui/preferences`). Keep scope small.
2. **Define contracts:** for each domain, design the public shape (state interface), the actions that will be dispatched, and the selectors consumers will use.
3. **Introduce store module:** add a lightweight NgRx/NGXS store module and wire DevTools in development only. Keep it feature-lazy where possible.
4. **Create adapters & selectors:** for entity-like data use NgRx Entity adapters, create selectors for derived data to replace `computed()` in many places.
5. **Move side-effects:** implement `Effects` (NgRx) or `Actions/Services` (NGXS) for async flows. Keep HTTP services (API clients) as single-responsibility services and call them from effects.
6. **Facade layer:** create a small facade service per domain that exposes observables/selectors and dispatch methods — this keeps components free of store details and eases testing.
7. **Incremental switch:** update a few small components to read from the facade/selectors instead of signals; keep component-local signals for ephemeral UI-only state.
8. **Tests & contracts:** add unit tests for reducers, effects, and facades. Add integration smoke tests for major flows.
9. **Performance verification:** measure bundle size and runtime perf; lazy-load large slices and ensure selectors are memoized and return stable references.
10. **Deprecate signals slowly:** once a domain is fully migrated, remove duplicated signals for that domain and update docs.

### Practical Tips

- Keep using signals for purely local UI state (form inputs, open/closed toggles, ephemeral previews). Use the store for authoritative, shared application state.
- Use typed actions and feature-scoped state to limit cognitive load.
- Prefer a facade layer — it decouples components from store implementation details and makes future migrations easier.
- Start small: migrating a single feature end-to-end is more valuable than a big-bang rewrite.


## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection


This is an Angular 20 app using standalone APIs and Angular SSR with an Express server. Use these notes to make correct, repo‑specific changes fast.

## Architecture overview
- Bootstrapping
  - Browser: `src/main.ts` bootstraps `App` with `appConfig`.
  - Server: `src/main.server.ts` exports the SSR bootstrap for the CLI/Node engine.
- SSR server
  - `src/server.ts` creates an Express app, serves static files from `dist/ictsystem/browser`, and delegates all routes to Angular via `AngularNodeAppEngine`.
  - Exports `reqHandler` for CLI/build integration. When run as main, listens on `PORT` (default 4000).
- Providers/config
  - `src/app/app.config.ts`: `provideRouter(routes)`, `provideClientHydration(withEventReplay())`, `provideZoneChangeDetection({ eventCoalescing: true })`, `provideBrowserGlobalErrorListeners()`.
  - `src/app/app.config.server.ts`: merges client config with `provideServerRendering(withRoutes(serverRoutes))`.
  - `src/app/app.routes.server.ts`: sets `RenderMode.Prerender` for `**` by default.
- App shell
  - `src/app/app.ts` is a standalone component that imports `RouterOutlet` and uses a `signal` for the title. Template and styles live in `src/app/app.html` and `src/app/app.scss`.

## Conventions and patterns
- Standalone by default: No NgModules. Add components and routes via providers and `provideRouter`.
- Routing lives in `src/app/app.routes.ts` (currently empty `Routes = []`). Put new feature routes here.
- Assets are served from the top‑level `public/` directory (project‑specific). Place images/static files there.
- Styles use SCSS; global styles in `src/styles.scss`. Component styles use `styleUrl`.
- Strict TypeScript is enabled (`tsconfig.json` has `"strict": true` and strict Angular template checks). Avoid `any`.
- Formatting: Prettier is configured in `package.json` (`singleQuote: true`, `printWidth: 100`, Angular parser for HTML).

## Common workflows
- Dev server (client with hydration): run `ng serve` (or `npm start`) and open http://localhost:4200/.
- Build (SSR outputMode): `ng build` produces `dist/ictsystem/browser` and `dist/ictsystem/server`.
- Run SSR Node server (after build): `npm run serve:ssr:ictsystem` -> serves on http://localhost:4000/.
- Unit tests: `ng test` (Karma, Jasmine). Spec files are under `src/**/*.spec.ts`.

## How to add a feature route
1. Create a standalone component under `src/app/<feature>/`.
2. Register a lazy route in `src/app/app.routes.ts`:
   - Example:
     - Path: `reports`
     - Lazy component: `ReportsPage` in `src/app/reports/reports.page.ts`
   - Add to `routes`:
     ```ts
     export const routes: Routes = [
       {
         path: 'reports',
         loadComponent: () => import('./reports/reports.page').then(m => m.ReportsPage),
       },
     ];
     ```
3. If the route requires a different render mode on the server, extend `serverRoutes` in `app.routes.server.ts` accordingly.

## File map (quick reference)
- `src/main.ts` – browser bootstrap.
- `src/main.server.ts` – SSR bootstrap for the Angular engine.
- `src/server.ts` – Express server + SSR request handling.
- `src/app/app.ts` – root component (uses `RouterOutlet`).
- `src/app/app.routes.ts` – browser routes (add feature routes here).
- `src/app/app.config.ts` – browser providers (router, hydration, zone options, error listeners).
- `src/app/app.config.server.ts` – server providers (SSR, server routes).
- `public/` – static assets copied to build output.

## Things to keep in mind when editing
- Keep components standalone and import dependencies via the `imports` array.
- Respect SSR: avoid direct `window`/`document` access in server code paths; prefer Angular platform APIs or guard with platform checks.
- Client hydration is enabled; avoid patterns that break hydration (e.g., DOM writes in constructors).
- The production build uses budgets in `angular.json`; large bundles will fail CI locally. Prefer lazy routes for sizable features.

- Keep changes simple and easy to debug: when adding code prefer clear, small functions, short methods, and explicit comments explaining non-obvious steps. Avoid clever one-liners. If implementing a feature, split it into logical pieces (validate -> update state -> navigate) and add a short comment for each piece so it's easy to step through in the debugger.

## External docs and planned integrations
- UI components (ng-zorro-antd): https://ng.ant.design/components/overview/en
  - Not yet added. When introducing, prefer standalone components and lazy-load heavier features.
- Auth (Auth0 for Angular SPA):
  - Quickstart: https://auth0.com/docs/quickstart/spa/angular/interactive
  - Library: https://github.com/auth0/auth0-angular
  - Not yet installed. When integrating, keep config in environment/providers (no secrets in repo), use the library’s HttpInterceptor for token injection, and guard any browser-only usage for SSR.

If anything above is unclear or you spot a pattern that differs from these notes, call it out and I’ll refine this file.

You have a freedom to adjust your answers to best fit what is best practice for fixing the issue described in the user question. 
just make sure the code is easy to read and maintain. i dont want clever or complex code.


