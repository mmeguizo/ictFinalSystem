import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { take } from 'rxjs';
import { UserApiService } from '../api/user-api.service';
import { UserService } from '../core/services/user.service';

function mapRoleToRoute(role: unknown): string {
  const r = typeof role === 'string' ? role.toUpperCase() : '';
  switch (r) {
    case 'ADMIN':
      return '/admin';
    case 'ICT_HEAD':
    case 'MIS_HEAD':
      return '/reports';
    case 'TECHNICIAN_ITS':
    case 'TECHNICIAN_MIS':
      return '/queue';
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
export class AuthCallbackComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth0 = inject(AuthService);
  private readonly message = inject(NzMessageService);
 private readonly userService = inject(UserService);
 private readonly userApi = inject(UserApiService);
  ngOnInit(): void {
    // 1. Check for Auth0 errors first
    this.auth0.error$.pipe(take(1)).subscribe(error => {
      if (error) {
        console.error('Auth callback error', error);
        this.message.error('Authentication failed. Please try again.');
        setTimeout(() => {
          this.router.navigateByUrl('/login');
        }, 1500);
      }
    });

    // 2. When authenticated, load user and route by role
    this.auth0.isAuthenticated$.pipe(take(1)).subscribe(isAuth => {
      if (isAuth) {
        this.loadUserAndRoute();
      } else {
        setTimeout(() => {
          this.router.navigateByUrl('/login');
        }, 250);
      }
    });
  }

  private loadUserAndRoute(): void {
    // Auth0 authenticated, now fetch user from backend
    this.auth0.getAccessTokenSilently().pipe(take(1)).subscribe({
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
    // This assumes you have a UserApiService
    // const userApi = inject(UserApiService);

    this.userApi.getMe(token).pipe(take(1)).subscribe({
      next: (response: any) => {
        const user = response?.data?.me;

        if (user && user.role) {
          this.userService.setUser({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatarUrl: user.avatarUrl,
          }, true); // persist to localStorage

          const target = mapRoleToRoute(user.role);
          this.message.success('Login successful!');
          setTimeout(() => this.router.navigateByUrl(target), 200);
        } else {
          console.warn('User response missing role');
          this.userService.setUser(null);
          this.router.navigateByUrl('/dashboard');
        }
      },
      error: (err) => {
        console.error('Failed to fetch user from backend', err);
        this.message.error('Failed to load user profile. Please try again.');
        setTimeout(() => {
          this.router.navigateByUrl('/login');
        }, 1500);
      },
    });
  }


}
