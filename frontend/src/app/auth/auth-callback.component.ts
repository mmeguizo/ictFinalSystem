import { Component, OnInit, inject, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { take, filter, switchMap, catchError, of, timeout, Subscription } from 'rxjs';
import { UserApiService } from '../api/user-api.service';
import { AuthService } from '../core/services/auth.service';

function mapRoleToRoute(role: unknown): string {
  const r = typeof role === 'string' ? role.toUpperCase() : '';
  switch (r) {
    case 'ADMIN':
      return '/admin';
    case 'MIS_HEAD':
    case 'ITS_HEAD':
    case 'DEVELOPER':
    case 'TECHNICAL':
      return '/tickets'; // Department heads and staff go to tickets
    case 'SECRETARY':
    case 'DIRECTOR':
      return '/tickets/approvals'; // Approvers go to approval page
    case 'USER':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}

@Component({
  selector: 'app-auth-callback',
  imports: [NzSpinModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="callback-loading">
      <nz-spin nzSimple [nzSize]="'large'"></nz-spin>
      <p>Processing authentication...</p>
    </div>
  `,
  styles: [`
    .callback-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 16px;
    }
  `],
})
export class AuthCallbackComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth0Service);
  private readonly message = inject(NzMessageService);
  private readonly authService = inject(AuthService);
  private readonly userApi = inject(UserApiService);
  private subscription?: Subscription;

  ngOnInit(): void {
    // console.log('[CALLBACK] 🔄 Auth callback component initialized');

    // Auth0 SDK handles the redirect callback automatically (skipRedirectCallback: false)
    // and navigates to appState.target which is '/callback'
    // Now we wait for Auth0 to finish loading and check authentication
    this.subscription = this.auth.isLoading$.pipe(
      filter(isLoading => {
        // console.log('[CALLBACK] ⏳ Auth0 isLoading:', isLoading);
        return !isLoading;
      }),
      take(1),
      switchMap(() => this.auth.isAuthenticated$.pipe(take(1)))
    ).subscribe(isAuth => {
      // console.log('[CALLBACK] 🔐 Auth0 finished loading, isAuthenticated:', isAuth);
      if (isAuth) {
        this.loadUserAndRoute();
      } else {
        // Check for error in URL
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        if (error) {
          console.error('[CALLBACK] ❌ Auth0 error:', error, params.get('error_description'));
          this.message.error(params.get('error_description') || 'Authentication failed.');
        } else {
          // console.log('[CALLBACK] ❌ Not authenticated');
          this.message.error('Authentication failed. Please try again.');
        }
        setTimeout(() => this.router.navigateByUrl('/login'), 1500);
      }
    });

    // Also listen for Auth0 errors
    this.auth.error$.pipe(take(1)).subscribe(error => {
      if (error) {
        console.error('[CALLBACK] ❌ Auth0 error$:', error);
        this.message.error('Authentication failed. Please try again.');
        setTimeout(() => this.router.navigateByUrl('/login'), 1500);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private loadUserAndRoute(): void {
    // Auth0 authenticated, now fetch user from backend
    this.auth.getAccessTokenSilently().pipe(take(1)).subscribe({
      next: (token: string) => {
        this.fetchUserFromBackend(token);
      },
      error: (err) => {
        console.error('Failed to get Auth0 token', err);
        this.message.error('Failed to retrieve user. Please try again.');
        setTimeout(() => {
          this.router.navigateByUrl('/login');
        }, 1500);
      },
    });
  }

  private fetchUserFromBackend(token: string): void {
    // Call your backend's getMe query to fetch user with role
    // console.log('[CALLBACK] 📡 Fetching user from backend...');

    this.userApi.getMe(token).pipe(take(1)).subscribe({
      next: (response: any) => {
        const user = response?.data?.me;
        // console.log('[CALLBACK] 👤 User response:', user);

        if (user && user.role) {
          // Set BOTH user AND token to ensure isAuthenticated = true
          this.authService.setAuth(
            {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              avatarUrl: user.avatarUrl,
            },
            token
          );
          // console.log('[CALLBACK] ✅ Auth state set, isAuthenticated:', this.authService.isAuthenticated());

          const target = mapRoleToRoute(user.role);
          this.message.success('Login successful!');
          // console.log('[CALLBACK] 🚀 Navigating to:', target);
          // Navigate immediately - no need for setTimeout since state is already set
          this.router.navigateByUrl(target);
        } else {
          console.warn('[CALLBACK] ⚠️ User response missing role');
          this.authService.clear();
          this.router.navigateByUrl('/dashboard');
        }
      },
      error: (err) => {
        console.error('[CALLBACK] ❌ Failed to fetch user from backend', err);
        this.message.error('Failed to load user profile. Please try again.');
        setTimeout(() => {
          this.router.navigateByUrl('/login');
        }, 1500);
      },
    });
  }


}
