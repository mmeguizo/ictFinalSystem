import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { icons } from './icons-provider';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache } from '@apollo/client/core';

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
    provideHttpClient(withFetch()),
    provideApollo(() => {
      const httpLink = inject(HttpLink);
      const apiUrl = resolveApiUrl();
      return {
        link: httpLink.create({ uri: apiUrl }),
        cache: new InMemoryCache(),
      };
    }),
  ]
};

function resolveApiUrl(): string {
  const globalApi = (globalThis as any)?.API_URL;
  if (typeof globalApi === 'string' && globalApi.length > 0) {
    return globalApi;
  }
  const envApi = typeof process !== 'undefined' && process?.env ? process.env['API_URL'] ?? process.env['PUBLIC_BASE_URL'] : undefined;
  if (envApi) {
    return envApi;
  }
  return 'http://localhost:4000/';
}
