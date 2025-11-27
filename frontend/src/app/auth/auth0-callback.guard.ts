import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';

export const auth0CallbackGuard = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const message = inject(NzMessageService);

  // Check for Auth0 error parameters in URL
  const error = route.queryParams['error'];
  const errorDescription = route.queryParams['error_description'];

  if (error) {
    // Display error message as toast
    const displayMessage = errorDescription ||
      'Authentication failed. Please try again.';

    message.error(displayMessage, { nzDuration: 5000 });

    console.error('Auth0 error:', {
      error,
      description: errorDescription,
    });

    // Redirect to login and clear error params
    router.navigate(['/login'], {
      queryParams: {},
      replaceUrl: true
    });

    return false;
  }

  return true;
};
