import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';

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

  // Primary state
  private readonly _currentUser = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);

  // Public read-only signals
  readonly currentUser = this._currentUser.asReadonly();
  readonly token = this._token.asReadonly();

  // Computed properties
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isAdmin = computed(() => this._currentUser()?.role === 'ADMIN');
  readonly isDeveloper = computed(() => {
    const role = this._currentUser()?.role;
    return role === 'ADMIN' || role === 'DEVELOPER';
  });
  readonly isOfficeHead = computed(() => this._currentUser()?.role === 'OFFICE_HEAD');
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
    const storedUser = this.storage.get<User>('current_user');
    const storedToken = this.storage.get<string>('token');

    if (storedUser) {
      this._currentUser.set(storedUser);
    }
    if (storedToken) {
      this._token.set(storedToken);
    }
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
    this._currentUser.set(null);
    this._token.set(null);
    this.storage.clear();
    this.router.navigate(['/login']);
  }

  /**
   * Clear authentication state without redirect
   */
  clear(): void {
    this._currentUser.set(null);
    this._token.set(null);
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
