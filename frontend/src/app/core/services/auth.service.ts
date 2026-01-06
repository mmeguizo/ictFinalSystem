import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { Apollo } from 'apollo-angular';

/**
 * User model interface
 */
export interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  avatarUrl?: string | null;
  picture?: string | null;
}

/**
 * Auth Service
 * Manages authentication state with signals
 * Handles user data, tokens, and authorization
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);
  private apollo: Apollo | null = null;

  // Lazy inject Apollo to avoid circular dependency
  private getApollo(): Apollo | null {
    if (!this.apollo) {
      try {
        this.apollo = inject(Apollo);
      } catch (e) {
        // Apollo might not be available during SSR or early initialization
        console.warn('[AuthService] Apollo not available:', e);
      }
    }
    return this.apollo;
  }

  // Primary state
  private readonly _currentUser = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _initialized = signal<boolean>(false);

  // Public read-only signals
  readonly currentUser = this._currentUser.asReadonly();
  readonly token = this._token.asReadonly();
  readonly initialized = this._initialized.asReadonly();

  // Computed properties
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isAdmin = computed(() => this._currentUser()?.role === 'ADMIN');
  readonly isDeveloper = computed(() => {
    const role = this._currentUser()?.role;
    return role === 'ADMIN' || role === 'DEVELOPER';
  });

  readonly isTechnical = computed(() => {
    const role = this._currentUser()?.role;
    return role === 'ADMIN' || role === 'TECHNICAL';
  });

  readonly isSecretary = computed(() => this._currentUser()?.role === 'SECRETARY');
  readonly isDirector = computed(() => this._currentUser()?.role === 'DIRECTOR');
  readonly isUser = computed(() => this._currentUser()?.role === 'USER');

  // Department heads
  readonly isMISHead = computed(() => this._currentUser()?.role === 'MIS_HEAD');
  readonly isITSHead = computed(() => this._currentUser()?.role === 'ITS_HEAD');
  readonly isOfficeHead = computed(() => {
    const role = this._currentUser()?.role;
    return role === 'MIS_HEAD' || role === 'ITS_HEAD';
  });

  readonly userName = computed(() => this._currentUser()?.name || 'Guest');
  readonly userEmail = computed(() => this._currentUser()?.email || '');
  readonly userAvatar = computed(() => {
    const user = this._currentUser();
    return user?.avatarUrl || user?.picture || null;
  });

  constructor() {
    // Effect to sync user to storage
    effect(() => {
      const user = this._currentUser();
      if (user) {
        this.storage.set('current_user', user);
      } else {
        this.storage.remove('current_user');
      }
    });

    // Effect to sync token to storage
    effect(() => {
      const token = this._token();
      if (token) {
        this.storage.set('token', token);
      } else {
        this.storage.remove('token');
      }
    });
  }

  /**
   * Initialize auth state from storage (call on app init)
   */
  initFromStorage(): void {
    console.log('[AUTH] 1️⃣ initFromStorage() called');
    const storedUser = this.storage.get<User>('current_user');
    const storedToken = this.storage.get<string>('token');
    console.log('[AUTH] 2️⃣ Storage values:', { hasUser: !!storedUser, hasToken: !!storedToken });

    if (storedUser) {
      this._currentUser.set(storedUser);
      console.log('[AUTH] 3️⃣ User restored:', storedUser.email);
    }
    if (storedToken) {
      this._token.set(storedToken);
      console.log('[AUTH] 4️⃣ Token restored');
    }

    // Mark as initialized
    this._initialized.set(true);
    console.log('[AUTH] 5️⃣ Initialized set to TRUE, isAuthenticated:', this.isAuthenticated());
  }

  /**
   * Set current user
   */
  setUser(user: User | null): void {
    this._currentUser.set(user);
  }

  /**
   * Set authentication token
   */
  setToken(token: string | null): void {
    this._token.set(token);
  }

  /**
   * Set both user and token (typical after login)
   */
  setAuth(user: User, token: string): void {
    this._currentUser.set(user);
    this._token.set(token);
    this._initialized.set(true); // Mark as initialized on login
  }

  /**
   * Update current user data (e.g., after profile update)
   */
  updateUser(updates: Partial<User>): void {
    const current = this._currentUser();
    if (current) {
      this._currentUser.set({ ...current, ...updates });
    }
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    return this._currentUser()?.role === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: string[]): boolean {
    const userRole = this._currentUser()?.role;
    return userRole ? roles.includes(userRole) : false;
  }

  /**
   * Clear authentication state and redirect to login
   */
  logout(): void {
    console.log('[AuthService] Logging out user...');
    this._currentUser.set(null);
    this._token.set(null);
    this.storage.clear();

    // Clear Apollo cache to prevent stale authenticated requests
    try {
      const apollo = this.getApollo();
      if (apollo) {
        apollo.client.stop(); // Stop all active queries
        apollo.client.clearStore().catch(err => {
          console.warn('[AuthService] Error clearing Apollo store:', err);
        });
      }
    } catch (e) {
      console.warn('[AuthService] Failed to clear Apollo cache:', e);
    }

    // Keep initialized true to prevent flash
    this.router.navigate(['/login']);
  }

  /**
   * Clear authentication state without redirect
   */
  clear(): void {
    this._currentUser.set(null);
    this._token.set(null);
    // Keep initialized true to prevent flash
    this.storage.remove('current_user');
    this.storage.remove('token');
  }

  /**
   * Get token for API requests (used by interceptor)
   */
  getToken(): string | null {
    return this._token();
  }
}
