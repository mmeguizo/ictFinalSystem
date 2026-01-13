import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  Injector,
  PLATFORM_ID,
  computed,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { UserApiService } from '../api/user-api.service';
import { AuthService } from '../core/services/auth.service';
import { RouterModule } from '@angular/router';
import { NotificationBellComponent } from '../shared/components/notification-bell.component';
interface MenuItem {
  icon: string;
  label: string;
  path: string;
  roles: string[];
}

@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    NzIconModule,
    NzLayoutModule,
    NzMenuModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzUploadModule,
    NzDropDownModule,
    ReactiveFormsModule,
    RouterModule,
    NotificationBellComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss'],
})
export class MainLayout {
  isCollapsed = false;
  isProfileOpen = signal(false);
  showPassword = signal(false);
  showConfirm = signal(false);
  avatarUrl = signal<string | null>(null);
  isUploadingAvatar = signal(false);
  avatarPreview = signal<string | null>(null);
  userEmail = signal<string | null>(null);
  private pendingAvatarDataUrl: string | null = null;
  readonly inspectMode = false;
  private readonly defaultAvatar = 'assets/no-photo.png';

  readonly avatarSrc = computed(() => {
    // Preview (just selected, not saved yet)
    const preview = this.avatarPreview();
    if (preview && preview.trim().length) return preview;

    // Explicitly set avatar signal (from API or Auth0)
    const current = this.avatarUrl();
    if (current && current.trim().length) return current;

    // Fallback from loaded user in AuthService
    const userAvatar = normalizeAvatar(this.authService.currentUser()?.avatarUrl);
    if (userAvatar) return userAvatar;

    return this.defaultAvatar;
  });

  readonly hasProfileChanges = computed(() => {
    if (this.passwordsValid()) return true;

    // avatar preview / pending avatar checks (use your existing fields)
    if (typeof (this as any).avatarPreview === 'function' && (this as any).avatarPreview() != null)
      return true;
    if ((this as any).pendingAvatarDataUrl != null) return true;

    // any other form changes
    return this.profileForm.dirty;
    // return this.profileForm.dirty || this.avatarPreview() !== null;
    // return true;
  });

  // Compute menu items based on user role
  readonly menuItems = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];

    const allItems: MenuItem[] = [
      {
        icon: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        roles: ['USER', 'ADMIN', 'DEVELOPER', 'TECHNICAL', 'MIS_HEAD', 'ITS_HEAD', 'SECRETARY', 'DIRECTOR'],
      },
      {
        icon: 'setting',
        label: 'Admin Panel',
        path: '/admin',
        roles: ['ADMIN'],
      },
      // Users and Secretary can create tickets
      {
        icon: 'plus-circle',
        label: 'New Ticket',
        path: '/tickets/new',
        roles: ['USER', 'SECRETARY','ADMIN'],
      },
      // Regular users see "My Tickets" - tickets they created
      {
        icon: 'file-text',
        label: 'My Tickets',
        path: '/tickets',
        roles: ['USER'],
      },
      // Department heads see "Assigned Tickets" - tickets to assign to staff
      {
        icon: 'team',
        label: 'Assigned Tickets',
        path: '/tickets',
        roles: ['MIS_HEAD', 'ITS_HEAD'],
      },
      // Staff see "My Work" - tickets assigned to them
      {
        icon: 'tool',
        label: 'My Work',
        path: '/tickets',
        roles: ['DEVELOPER', 'TECHNICAL'],
      },
      // Admin sees all tickets
      {
        icon: 'file-search',
        label: 'All Tickets',
        path: '/tickets',
        roles: ['ADMIN'],
      },
      // Secretary/Director see approval page
      {
        icon: 'audit',
        label: 'Review Queue',
        path: '/tickets/approvals',
        roles: ['SECRETARY', 'DIRECTOR'],
      },
      // Notifications - available to all authenticated users
      {
        icon: 'bell',
        label: 'Notifications',
        path: '/notifications',
        roles: ['USER', 'ADMIN', 'DEVELOPER', 'TECHNICAL', 'MIS_HEAD', 'ITS_HEAD', 'SECRETARY', 'DIRECTOR'],
      },
    ];

    // Filter items based on user role
    return allItems.filter((item) => item.roles.includes(user.role));
  });

  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private readonly api = inject(UserApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  profileForm: FormGroup = this.fb.group({
    displayName: ['', [Validators.maxLength(80)]],
    password: ['', [Validators.minLength(6)]],
    confirm: [''],
  });

  // Add this effect after the other signal declarations (before constructor):
  private readonly syncUserAvatarEffect = effect(() => {
    const user = this.authService.currentUser();
    // Only set if we don’t already have a local avatar and no preview
    if (user && user.avatarUrl && !this.avatarUrl() && !this.avatarPreview()) {
      this.avatarUrl.set(user.avatarUrl);
      this.cdr.markForCheck();
    }
  });

  private readonly passwordsValid = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Auth already initialized via APP_INITIALIZER in app.config.ts
      const auth = this.injector.get(Auth0Service, null as any) as Auth0Service | null;
      if (auth) {
        auth.user$.pipe(takeUntilDestroyed()).subscribe((profile: any) => {
          const tokenAvatar =
            profile && typeof profile.picture === 'string' ? profile.picture.trim() : '';

          const email = profile?.email ?? null;
          if (email) {
            this.userEmail.set(email);
          }

          if (tokenAvatar) {
            this.avatarUrl.set(tokenAvatar);
            this.cdr.markForCheck();
          }
        });
      }
      const storedUser = this.authService.currentUser();
      if (storedUser?.avatarUrl && !this.avatarUrl()) {
        this.avatarUrl.set(storedUser.avatarUrl);
        this.cdr.markForCheck();
      }
      this.loadCurrentUser().catch(() => {});
    }

    const pwCtrl = this.profileForm.get('password');
    const confCtrl = this.profileForm.get('confirm');

    const updatePasswordState = () => {
      const pw = (pwCtrl?.value ?? '').toString().trim();
      const conf = (confCtrl?.value ?? '').toString().trim();

      // both empty -> ensure controls are pristine and no changes flagged
      if (!pw && !conf) {
        this.passwordsValid.set(false);
        if (pwCtrl?.dirty) pwCtrl.markAsPristine();
        if (confCtrl?.dirty) confCtrl.markAsPristine();
        return;
      }

      // both filled and match -> mark dirty and enable Save
      if (pw && conf && pw === conf) {
        this.passwordsValid.set(true);
        if (!pwCtrl?.dirty) pwCtrl?.markAsDirty();
        if (!confCtrl?.dirty) confCtrl?.markAsDirty();
        return;
      }

      // otherwise (one filled or mismatch) -> don't mark as "change" for save
      this.passwordsValid.set(false);
      // keep controls' dirty state as-is (do not mark as dirty)
    };

    pwCtrl?.valueChanges.pipe(takeUntilDestroyed()).subscribe(updatePasswordState);
    confCtrl?.valueChanges.pipe(takeUntilDestroyed()).subscribe(updatePasswordState);
  }

  passwordsMatch(): boolean {
    return this.passwordsValid();
  }
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    // console.log('onFileSelected called', { hasFiles: !!input.files?.length });

    if (!input.files?.length) {
      console.warn('onFileSelected: no files');
      return;
    }

    const file = input.files[0];
    this.readAsDataURL(file)
      .then((dataUrl) => {
        this.pendingAvatarDataUrl = dataUrl;
        this.avatarPreview.set(dataUrl);
        this.profileForm.markAsDirty();
        this.cdr.markForCheck();
      })
      .catch((error) => {
        console.error('Failed to read upload file', error);
        this.message.error('Failed to read image');
      });
  }

  openProfile(): void {
    this.isProfileOpen.set(true);
    this.avatarPreview.set(null);
    this.pendingAvatarDataUrl = null;
    //reset the form first
    // this.profileForm.reset();
    this.loadCurrentUser().catch(() => {});
  }

  closeProfile(): void {
    this.isProfileOpen.set(false);
    this.profileForm.reset();
    this.avatarPreview.set(null);
    this.pendingAvatarDataUrl = null;
  }

  private readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async saveProfile(): Promise<void> {
    if (!this.hasProfileChanges()) {
      this.message.info('No changes to save');
      this.closeProfile();
      return;
    }

     if (this.profileForm.get('password')?.value && !this.passwordsMatch()) {
      // replace with your toast/modal error mechanism
      alert('Passwords do not match.');
      return;
    }

    const { password, confirm, displayName } = this.profileForm.value as {
      displayName?: string;
      password?: string;
      confirm?: string;
    };

    const passwordProvided = Boolean(password && password.length);
    const confirmProvided = Boolean(confirm && confirm.length);

    if (passwordProvided !== confirmProvided) {
      this.message.error('Please fill both password fields.');
      return;
    }

    if (passwordProvided && password && password.length < 6) {
      this.message.error('Password must be at least 6 characters.');
      return;
    }

    if (passwordProvided && password !== confirm) {
      this.message.error('Passwords do not match.');
      return;
    }

    try {
      let token: string | undefined;

      const localToken = localStorage.getItem('auth_token');
      if (localToken) {
        token = localToken;
      } else {
        const auth = this.injector.get(Auth0Service, null as any) as Auth0Service | null;
        if (auth) {
          try {
            token = await firstValueFrom(auth.getAccessTokenSilently());
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            if (errMsg.includes('Missing Refresh Token') || errMsg.includes('login_required')) {
              this.message.error('Session expired. Please log out and log back in.');
              return;
            }
          }
        }
      }

      if (!token) {
        this.message.error('Authentication required. Please log out and log back in.');
        return;
      }

      const avatarDataUrl = this.pendingAvatarDataUrl ?? null;
      const resp = await firstValueFrom(
        this.api.updateMyProfile(displayName || "", avatarDataUrl || "", token)
      );

      const graphQLErrors = (resp as { errors?: readonly { message?: string }[] }).errors;
      if (graphQLErrors?.length) {
        const errMsg = graphQLErrors[0]?.message ?? 'Failed to update profile';
        if (errMsg.includes('Unauthorized')) {
          throw new Error('Session expired. Please log out and log back in.');
        }
        throw new Error(errMsg);
      }

      const updatedUser = resp.data?.updateMyProfile;
      if (updatedUser?.avatarUrl) {
        this.avatarUrl.set(updatedUser.avatarUrl);
        this.avatarPreview.set(null);
        this.pendingAvatarDataUrl = null;
        this.cdr.markForCheck();
      }

      if (password) {
        await firstValueFrom(this.api.setMyPassword(password, token));
      }

      this.message.success('Profile updated');
      this.isProfileOpen.set(false);
      this.profileForm.markAsPristine();
    } catch (err: any) {
      this.message.error(err?.message || 'Failed to update profile');
    }
  }

  private async loadCurrentUser() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    let token: string | undefined;

    const localToken = localStorage.getItem('auth_token');
    if (localToken) {
      token = localToken;

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.email) {
          this.userEmail.set(payload.email);
        }
      } catch (err) {
        console.warn('Failed to decode JWT token', err);
      }
    } else {
      const auth = this.injector.get(Auth0Service, null as any) as Auth0Service | null;
      if (auth) {
        try {
          token = await firstValueFrom(auth.getAccessTokenSilently());
        } catch {}
      }
    }

    try {
      const resp: any = await firstValueFrom(this.api.getMe(token));
      const me = resp?.data?.me;
      if (me) {
        if (me.email) {
          this.userEmail.set(me.email);
        }

        this.profileForm.patchValue({ displayName: me.name ?? '' });
        this.profileForm.markAsPristine();
        const serverAvatar = normalizeAvatar(me.avatarUrl) ?? normalizeAvatar(me.picture);
        if (serverAvatar) {
          this.avatarUrl.set(serverAvatar);
          this.cdr.markForCheck();
        }
      }
    } catch (err) {
      console.error('Failed to load current user:', err);
    }
  }

  handleAvatarError(): boolean {
    if (!this.avatarPreview()) {
      this.avatarUrl.set(null);
    }
    this.cdr.markForCheck();
    return false;
  }

  /**
   * Get human-readable role label for display
   */
  getUserRoleLabel(): string {
    const role = this.authService.currentUser()?.role;
    const roleLabels: Record<string, string> = {
      ADMIN: 'Admin',
      MIS_HEAD: 'MIS Head',
      ITS_HEAD: 'ITS Head',
      DEVELOPER: 'Developer',
      TECHNICAL: 'Technical',
      SECRETARY: 'Secretary',
      DIRECTOR: 'Director',
      USER: 'User',
    };
    return roleLabels[role || ''] || role || 'Guest';
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('token');

    const auth = this.injector.get(Auth0Service, null as any) as Auth0Service | null;
    if (auth) {
      auth.isAuthenticated$.pipe().subscribe((isAuth: boolean) => {
        if (isAuth) {
          auth.logout({ logoutParams: { returnTo: window.location.origin } });
        } else {
          window.location.href = '/login';
        }
      });
    } else {
      window.location.href = '/login';
    }
  }

  onAvatarLoad(): void {
    this.cdr.markForCheck();
  }
}

function normalizeAvatar(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
