import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { icons } from './icons-provider';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
  UserOutline,
  LogoutOutline,
  InboxOutline,
  FileTextOutline,
  SyncOutline,
  DashboardOutline,
  HomeOutline,
  SettingOutline,
  MenuFoldOutline,
  MenuUnfoldOutline,
  UploadOutline,
  EyeOutline,
  EyeInvisibleOutline,
  BarChartOutline,
  AlertOutline
} from '@ant-design/icons-angular/icons';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import { provideAuth0, AuthService } from '@auth0/auth0-angular';
import { from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { NzMessageService } from 'ng-zorro-antd/message';
import { environment } from './core/config/environment';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { AuthService as AppAuthService } from './core/services/auth.service';

registerLocaleData(en);



export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideAnimationsAsync(),
    // Initialize auth state from localStorage before app starts (Angular 19+ API)
    provideAppInitializer(() => {
      console.log('[APP_INIT] 🚀 provideAppInitializer callback STARTING');
      const authService = inject(AppAuthService);
      authService.initFromStorage();
      console.log('[APP_INIT] ✅ provideAppInitializer callback COMPLETE');
    }),
    // HTTP client with interceptors for auth, error handling, and loading
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor, loadingInterceptor])
    ),
    // Apollo GraphQL client
    provideApollo(() => {
      const httpLink = inject(HttpLink);

      // Only use auth on the browser, not during SSR
      if (typeof window !== 'undefined') {
        const auth0Service = inject(AuthService); // Auth0's service
        const appAuthService = inject(AppAuthService); // Our custom service

        // Create auth link to add Authorization header
        // Checks local JWT first (email/password login), then falls back to Auth0
        const authLink = setContext(async () => {
          // 1. Check local JWT token first (email/password login)
          const localToken = appAuthService.getToken();
          if (localToken) {
            console.log('[Apollo] Using local JWT token');
            return {
              headers: {
                Authorization: `Bearer ${localToken}`,
              },
            };
          }

          // 2. Fall back to Auth0 token (SSO login)
          try {
            const auth0Token = await auth0Service.getAccessTokenSilently().toPromise();
            if (auth0Token) {
              console.log('[Apollo] Using Auth0 token');
              return {
                headers: {
                  Authorization: `Bearer ${auth0Token}`,
                },
              };
            }
          } catch (error) {
            console.warn('[Apollo] Failed to get Auth0 access token:', error);
          }

          // 3. No token available
          console.log('[Apollo] No auth token available');
          return { headers: {} };
        });

        return {
          link: authLink.concat(httpLink.create({ uri: environment.apiUrl })),
          cache: new InMemoryCache(),
        };
      }

      // Server-side: no auth
      return {
        link: httpLink.create({ uri: environment.apiUrl }),
        cache: new InMemoryCache(),
      };
    }),
    // Auth0 authentication
    provideAuth0({
      domain: environment.auth0.domain,
        clientId: environment.auth0.clientId,
      authorizationParams: {
        // Redirect to /callback after Auth0 login to properly process auth
        redirect_uri: typeof window !== 'undefined' ? `${window.location.origin}/callback` : '',
        audience: environment.auth0.audience,
        scope: 'openid profile email offline_access',
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
      errorPath: '/login',
      // Let Auth0 SDK handle the callback, but we control navigation via appState
      skipRedirectCallback: false,
    }),
    provideNzIcons([
      UserOutline,
      LogoutOutline,
      InboxOutline,
      FileTextOutline,
      SyncOutline,
      DashboardOutline,
      HomeOutline,
      SettingOutline,
      MenuFoldOutline,
      MenuUnfoldOutline,
      UploadOutline,
      AlertOutline
    ])
  ]
};
