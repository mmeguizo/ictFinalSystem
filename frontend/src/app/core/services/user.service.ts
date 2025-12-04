import { Injectable, Inject, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  currentUser = signal<User | null>(null);
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    // DO NOT call localStorage here; SSR will crash.
  }

  initFromStorage(): void {
    if (!this.isBrowser) return;
    const stored = localStorage.getItem('current_user');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.role) {
        this.currentUser.set(parsed);
      }
    } catch (err) {
      console.warn('[UserService] Failed to parse current_user', err);
    }
  }

  setUser(user: User | null, persist = false): void {
    this.currentUser.set(user);
    if (persist && this.isBrowser && user) {
      localStorage.setItem('current_user', JSON.stringify(user));
    }
  }

  clear(): void {
    this.currentUser.set(null);
    if (this.isBrowser) {
      localStorage.removeItem('current_user');
    }
  }
}
