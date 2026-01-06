import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { provideAuth0 } from '@auth0/auth0-angular';

bootstrapApplication(App, {
  ...appConfig,
  providers: [
    ...appConfig.providers!,
    provideAuth0({
      domain: 'dev-hte6ekrcmpejgmww.au.auth0.com',
      clientId: '2GiA9yIpYYVOnXMdk4mgbCk2kC6pt8IO',
      authorizationParams: {
        redirect_uri: window.location.origin + '/callback',
        audience: 'https://ictsystem.api',
        scope: 'openid profile email offline_access'
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
      // skipRedirectCallback: true,
    }),
  ]
})
  .catch((err) => console.error(err));
