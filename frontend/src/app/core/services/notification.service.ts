import { Injectable, inject } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';

/**
 * Notification Service
 * Wrapper around NzMessageService for consistent messaging
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly message = inject(NzMessageService);

  success(content: string, duration: number = 3000): void {
    this.message.success(content, { nzDuration: duration });
  }

  error(content: string, duration: number = 5000): void {
    this.message.error(content, { nzDuration: duration });
  }

  warning(content: string, duration: number = 4000): void {
    this.message.warning(content, { nzDuration: duration });
  }

  info(content: string, duration: number = 3000): void {
    this.message.info(content, { nzDuration: duration });
  }

  loading(content: string): void {
    this.message.loading(content, { nzDuration: 0 });
  }

  remove(): void {
    this.message.remove();
  }
}
