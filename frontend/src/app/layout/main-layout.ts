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
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { UserApiService } from '../api/user-api.service';

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
  // profile modal state
  isProfileOpen = signal(false);
  // password visibility toggles
  showPassword = signal(false);
  showConfirm = signal(false);
  avatarUrl = signal<string | null>(null);
  isUploadingAvatar = signal(false);
  avatarPreview = signal<string | null>(null); // unsaved data URL preview
  private pendingAvatarDataUrl: string | null = null;
  readonly inspectMode = false; // toggle to skip GraphQL calls while inspecting payloads
  private readonly defaultAvatar = 'assets/no-photo.png';
  readonly avatarSrc = computed(() => {
    const preview = this.avatarPreview();
    if (preview && preview.trim().length) return preview;
    const committed = this.avatarUrl();
    if (committed && committed.trim().length) return committed;
    return this.defaultAvatar;
  });
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  // Use Injector to lazily get AuthService at runtime so SSR won't try to instantiate it
  private readonly injector = inject(Injector);
  private readonly api = inject(UserApiService);
  private readonly platformId = inject(PLATFORM_ID);


  constructor() {
    effect(() => {
      // console.log('avatarUrl signal changed', this.avatarUrl());
    });
    if (isPlatformBrowser(this.platformId)) {
      const auth = this.injector.get(AuthService, null as any) as AuthService | null;
      if (auth) {
        auth.user$.pipe(takeUntilDestroyed()).subscribe((profile: any) => {
          const tokenAvatar =
            profile && typeof profile.picture === 'string' ? profile.picture.trim() : '';
          // console.log('Auth user$ emitted profile', { profile });
          if (tokenAvatar) {
            // console.log('Using token picture as avatar (fast fallback)', tokenAvatar);
            this.avatarUrl.set(tokenAvatar);
            this.cdr.markForCheck();
          }
        });
      }
      // Kick off server fetch so we get stored avatar overrides
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
    console.log('File selected:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    this.readAsDataURL(file)
      .then((dataUrl) => {
        console.log('✓ Data URL created! Length:', dataUrl?.length, 'Preview:', dataUrl?.substring(0, 50));
        this.pendingAvatarDataUrl = dataUrl;
        this.avatarPreview.set(dataUrl);
        this.cdr.markForCheck();
        console.log('✓ Preview signal set:', !!this.avatarPreview());
        // console.log('✓ avatarSrc will now return:', this.avatarSrc());
      })
      .catch((error) => {
        console.error('Failed to read upload file', error);
        this.message.error('Failed to read image');
      });
  }

  profileForm: FormGroup = this.fb.group({
    displayName: ['', [Validators.maxLength(80)]],
    password: ['', [Validators.minLength(6)]],
    confirm: [''],
  });

  openProfile(): void {
    this.isProfileOpen.set(true);
    // reset any unsaved preview
    this.avatarPreview.set(null);
    this.pendingAvatarDataUrl = null;
    // load current user to populate fields
    this.loadCurrentUser().catch(() => {});
  }

  closeProfile(): void {
    this.isProfileOpen.set(false);
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

      // Check for local token first
      const localToken = localStorage.getItem('auth_token');
      if (localToken) {
        token = localToken;
        console.log('[saveProfile] Using local auth token');
      } else {
        // Try Auth0 token
        const auth = this.injector.get(AuthService, null as any) as AuthService | null;
        console.log('[saveProfile] No local token, trying Auth0');
        if (auth) {
          try {
            token = await firstValueFrom(auth.getAccessTokenSilently());
            console.log('[saveProfile] Auth0 token retrieved successfully');
          } catch (err: any) {
            console.error('[saveProfile] Failed to get Auth0 token:', err);
            const errMsg = err?.message || String(err);
            if (errMsg.includes('Missing Refresh Token') || errMsg.includes('login_required')) {
              this.message.error('Session expired. Please log out and log back in.');
              return;
            }
          }
        }
      }
      const avatarDataUrl = this.pendingAvatarDataUrl ?? null;
      const avatarLogValue = avatarDataUrl ?? this.avatarPreview() ?? this.avatarUrl();
      const payloadPreview = {
        name: displayName || null,
          avatarBytes: avatarLogValue?.length ?? 0,
          hasAvatar: Boolean(avatarLogValue),
          avatarDataUrl: avatarLogValue,
        password,
        confirm,
        hasToken: Boolean(token),
      };
      console.log('saveProfile -> pending GraphQL payload', payloadPreview);
      if (this.inspectMode) {
        this.message.info('Inspect mode: payload logged, GraphQL request skipped.');
        return;
      }

      if (!token) {
        this.message.error('Authentication required. Please log out and log back in.');
        return;
      }

      // Use pending Data URL if a new avatar was selected, else pass null (no change)
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
        // clear preview state after commit
        this.avatarPreview.set(null);
        this.pendingAvatarDataUrl = null;
        this.cdr.markForCheck();
      }
      // Then set password if provided
      if (password) {
        await firstValueFrom(this.api.setMyPassword(password, token));
      }
      this.message.success('Profile updated');
      this.isProfileOpen.set(false);
    } catch (err: any) {
      this.message.error(err?.message || 'Failed to update profile');
    }
  }

  private async loadCurrentUser() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    let token: string | undefined;

    // Try local token first
    const localToken = localStorage.getItem('auth_token');
    if (localToken) {
      token = localToken;
      console.log('Using local auth token');
    } else {
      // Fall back to Auth0 token
      const auth = this.injector.get(AuthService, null as any) as AuthService | null;
      if (auth) {
        try {
          token = await firstValueFrom(auth.getAccessTokenSilently());
          console.log('Using Auth0 token');
        } catch {}
      }
    }

    try {
      const resp: any = await firstValueFrom(this.api.getMe(token));
      const me = resp?.data?.me;
      if (me) {
        this.profileForm.patchValue({ displayName: me.name ?? '' });
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
    console.warn('Avatar image failed to load', { attempted: this.avatarUrl(), preview: this.avatarPreview() });
    // If preview exists leave it; otherwise clear committed avatar
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

    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');

    // Check if user is logged in via Auth0
    const auth = this.injector.get(AuthService, null as any) as AuthService | null;
    if (auth) {
      auth.isAuthenticated$.pipe().subscribe((isAuth) => {
        if (isAuth) {
          // Auth0 logout
          auth.logout({ logoutParams: { returnTo: window.location.origin } });
        } else {
          // Local logout - just redirect to login
          window.location.href = '/login';
        }
      });
    } else {
      // No Auth0, just redirect
      window.location.href = '/login';
    }
  }
}

function normalizeAvatar(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
