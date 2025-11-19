import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzButtonModule } from 'ng-zorro-antd/button';

@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.page.html',
  styleUrls: ['./auth-callback.page.scss'],
  imports: [CommonModule, NzCardModule, NzSpinModule, NzResultModule, NzButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackComponent {
  processing = true;
  message: string | null = null;
  created: boolean | null = null;
  error: string | null = null;
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  constructor() {
    // Only in browser: process the redirect callback and show a friendly result
    if (typeof window !== 'undefined') {
      const auth = this.injector.get(AuthService, null);
      // Wait for auth SDK to report state, then try to get token and upsert user
      auth?.isAuthenticated$.subscribe(async () => {
        try {
          const token = await firstValueFrom(auth.getAccessTokenSilently());
          await this.upsertUserOnBackend(token);
        } catch (e) {
          console.error('Auth callback error', e);
          this.error = 'Authentication failed. Please try signing in again.';
        } finally {
          this.processing = false;
        }
      });
    }
  }

  // Called by the UI button when the user is ready to continue
  continueToApp(): void {
    this.router.navigateByUrl('/welcome');
  }

  backToLogin(): void {
    this.router.navigateByUrl('/login');
  }

  private async upsertUserOnBackend(token: string): Promise<void> {
    try {
      const res = await fetch('http://localhost:4000/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: 'mutation { upsertMe { created user { id } } }' }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Backend upsert failed:', res.status, text);
        this.error = 'Sign-in failed (backend error)';
        return;
      }
      const json = await res.json();
      console.log('Backend upsert response:', json);
      if (json?.errors) {
        console.error('GraphQL errors:', json.errors);
        this.error = 'Sign-in encountered an error.';
        return;
      }
      const created = json?.data?.upsertMe?.created;
      this.created = typeof created === 'boolean' ? created : null;
      if (this.created === true) {
        this.message = 'Account created on first login';
      } else if (this.created === false) {
        this.message = 'Welcome back';
      } else {
        this.message = 'Sign-in completed';
      }
    } catch (err) {
      console.error('Backend upsert error', err);
      this.error = 'Sign-in failed (network error)';
    }
  }
}
