import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Server routes configuration
 *
 * All routes use Client-Side Rendering because:
 * - Auth state (localStorage) is only available in the browser
 * - SSR/Prerender would cause login page flash on protected routes
 * - Guards need browser context to work correctly
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
