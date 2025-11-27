import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { take } from 'rxjs';

@Component({
  selector: 'app-auth-callback',
  template: `
    <div class="callback-loading">
      <nz-spin nzSimple [nzSize]="'large'"></nz-spin>
      <p>Processing authentication...</p>
    </div>
  `,
  styles: [
    `
      .callback-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        gap: 16px;
      }
    `,
  ],
  imports: [NzSpinModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth0 = inject(AuthService);
  private readonly message = inject(NzMessageService);

  ngOnInit(): void {
    console.log('Auth callback component initialized');

    // Listen for Auth0 errors
    this.auth0.error$.pipe(take(1)).subscribe((error) => {
      if (error) {
        console.error('Auth callback error', error.message);

        // Handle missing refresh token error
        if (error.message?.includes('Missing Refresh Token')) {
          this.message.error('Session expired. Please clear your browser cache and log in again.', {
            nzDuration: 6000,
          });
          // Clear Auth0 cache
          this.clearAuth0Cache();
        } else {
          this.message.error(error.message || 'Authentication failed. Please try again.', { nzDuration: 5000 });
        }

        // Redirect to login after short delay
        setTimeout(() => {
          this.router.navigateByUrl('/login');
        }, 2000);
      }
    });

    // Check if authenticated successfully
    this.auth0.isAuthenticated$.pipe(take(1)).subscribe((isAuth) => {
      if (isAuth) {
        console.log('✓ Auth0 authentication successful');
        this.message.success('Login successful!');

        // Redirect to welcome page
        setTimeout(() => {
          this.router.navigateByUrl('/dashboard');
        }, 500);
      }
    });
  }

  private clearAuth0Cache(): void {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith('@@auth0spajs@@')) {
        localStorage.removeItem(key);
      }
    });
    console.log('✓ Auth0 cache cleared');
  }
}
