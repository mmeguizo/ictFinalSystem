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
    return this.profileForm.dirty || this.avatarPreview() !== null;
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
        roles: ['USER', 'ADMIN', 'ICT_HEAD', 'MIS_HEAD', 'TECHNICIAN_ITS', 'TECHNICIAN_MIS'],
      },
      // {
      //   icon: 'inbox',
      //   label: 'Ticket Queue',
      //   path: '/queue',
      //   roles: ['ADMIN', 'ICT_HEAD', 'MIS_HEAD', 'TECHNICIAN_ITS', 'TECHNICIAN_MIS'],
      // },
      // {
      //   icon: 'bar-chart',
      //   label: 'Reports',
      //   path: '/reports',
      //   roles: ['ADMIN', 'ICT_HEAD', 'MIS_HEAD'],
      // },
      {
        icon: 'setting',
        label: 'Admin Panel',
        path: '/admin',
        roles: ['ADMIN'],
      },
      {
        icon: 'file-text',
        label: 'Tickets',
        path: '/tickets/new',
        roles: ['USER', 'ADMIN'], // admin sees everything; users see their own submit page
      },
      {
        icon: 'home',
        label: 'Welcome',
        path: '/welcome',
        roles: ['USER', 'ADMIN', 'ICT_HEAD', 'MIS_HEAD', 'TECHNICIAN_ITS', 'TECHNICIAN_MIS'],
      },
    ];

    // Filter items based on user role
    return allItems.filter(item => item.roles.includes(user.role));
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

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.authService.initFromStorage(); // safe now
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
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    console.log('onFileSelected called', { hasFiles: !!input.files?.length });

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
        this.api.updateMyProfile(displayName || null, avatarDataUrl || null, token)
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

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');

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
