import { ChangeDetectionStrategy, Component, Injector, inject, signal, OnInit, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormControl, FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NgOptimizedImage } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { AuthApiService } from '../api/auth-api.service';
import { firstValueFrom } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
// Add to existing imports (around line 17)
import { AuthService as AppAuthService } from '../core/services/auth.service';
type LoginForm = FormGroup<{
  email: FormControl<string>;
  password: FormControl<string>;
}>;


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
  selector: 'app-login',
  imports: [ReactiveFormsModule, NzCardModule, NzFormModule, NzInputModule, NzButtonModule, NzAlertModule, NzDividerModule, NzSpinModule, NzIconModule, NzGridModule, NzTypographyModule, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrls: ['./login.style.scss'],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly authApi = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly appAuthService = inject(AppAuthService);

  constructor() {
    // console.log('[LOGIN] 🔐 LoginPage constructor');
    // console.log('[LOGIN] initialized:', this.appAuthService.initialized(), 'isAuthenticated:', this.appAuthService.isAuthenticated());
  }

  // Show loading spinner while auth is initializing or if already authenticated (redirect pending)
  readonly isCheckingAuth = computed(() => {
    const initialized = this.appAuthService.initialized();
    const isAuth = this.appAuthService.isAuthenticated();
    const result = !initialized || isAuth;
    // console.log('[LOGIN] 📋 isCheckingAuth computed:', { initialized, isAuth, showLoading: result });
    return result;
  });

  readonly form: LoginForm = this.fb.group({
    email: this.fb.control('', { validators: [Validators.required, Validators.email] }),
    password: this.fb.control('', { validators: [Validators.required, Validators.minLength(6)] }),
  });

   ngOnInit(): void {
    // Check for Auth0 errors in URL on page load
    this.checkAuth0Errors();
  }


  readonly busy = signal(false);
  readonly ssoBusy = signal(false);
  readonly error = signal<string | null>(null);
  readonly loggedIn = signal(false);

  get emailInvalid(): boolean {
    const c = this.form.controls.email;
    return c.touched && c.invalid;
  }

  get passwordInvalid(): boolean {
    const c = this.form.controls.password;
    return c.touched && c.invalid;
  }

  get submitDisabled(): boolean {
    return this.busy() || this.ssoBusy() || this.form.invalid;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.busy.set(true);

    try {
      const { email, password } = this.form.getRawValue();
      const result = await firstValueFrom(this.authApi.login(email, password));

      const graphQLErrors = (result as any).errors;
      if (graphQLErrors?.length) {
        const errMsg = graphQLErrors[0].message || 'Login failed';
        this.error.set(errMsg);
        return;
      }

      if (result.data?.login) {
        const { token, user } = result.data.login;

      // ✅ Update AuthService signals (this makes guards work)
      this.appAuthService.setAuth(user, token);


        localStorage.setItem('auth_token', token);
        localStorage.setItem('current_user', JSON.stringify(user));
        // console.log('✓ Local login successful:', user.email);
        this.loggedIn.set(true);
        this.busy.set(false);

        // Navigate after a brief delay to ensure state updates
        setTimeout(() => {
          const route = mapRoleToRoute(user.role);
          // console.log(`Navigating to ${route}...`);
          this.router.navigateByUrl(route).then(
            (success) => {}, // console.log('Navigation success:', success),
            (error) => console.error('Navigation error:', error)
          );
        }, 100);
        return;
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errMsg = err?.message || err?.graphQLErrors?.[0]?.message || 'Login failed. Please try again.';
      this.error.set(errMsg);
      this.busy.set(false);
    }
  }

    private checkAuth0Errors(): void {
    const error = this.route.snapshot.queryParams['error'];
    const errorDescription = this.route.snapshot.queryParams['error_description'];

    if (error) {
      // Display error as toast
      const displayMessage = errorDescription ||
        'Authentication failed. Please try again.';

      this.message.error(displayMessage, { nzDuration: 5000 });

      // Also set in the error signal for display in template
      this.error.set(displayMessage);

      console.error('Auth0 error:', {
        error,
        description: errorDescription,
      });

      // Clear error params from URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }
  }


  // Start Auth0 login redirect flow
  loginWithAuth0(): void {
    if (typeof window === 'undefined') return;
    this.error.set(null);
    this.ssoBusy.set(true);

    const auth = this.injector.get(AuthService, null);
    if (auth) {
      // Set target to /callback so Auth0 SDK stays on callback page after processing
      // Our callback component will then fetch user and navigate to the correct route
      auth.loginWithRedirect({
        appState: { target: '/callback' },
      });
    }
  }
}
