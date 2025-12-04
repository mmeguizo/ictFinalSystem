import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
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
import { InMemoryCache } from '@apollo/client/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { NzMessageService } from 'ng-zorro-antd/message';
import { environment } from './core/config/environment';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

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
    // HTTP client with interceptors for auth, error handling, and loading
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor, loadingInterceptor])
    ),
    // Apollo GraphQL client
    provideApollo(() => {
      const httpLink = inject(HttpLink);
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
        redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
        audience: environment.auth0.audience,
        scope: 'openid profile email offline_access',
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
      errorPath: '/login',
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
