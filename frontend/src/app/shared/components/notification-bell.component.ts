import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule, NzDropdownMenuComponent } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { TicketNotificationService, TicketNotification } from '../../core/services/ticket-notification.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [
    CommonModule,
    NzBadgeModule,
    NzButtonModule,
    NzDropDownModule,
    NzIconModule,
    NzListModule,
    NzEmptyModule,
    NzSpinModule,
    NzDividerModule,
    NzAvatarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-badge [nzCount]="notificationService.unreadCount()" [nzOverflowCount]="99" nzSize="small">
      <button
        nz-button
        nzType="text"
        nz-dropdown
        [nzDropdownMenu]="notificationMenu"
        nzTrigger="click"
        nzPlacement="bottomRight"
        [(nzVisible)]="dropdownVisible"
        (nzVisibleChange)="onDropdownVisibleChange($event)"
        class="bell-button"
      >
        <i
          nz-icon
          nzType="bell"
          nzTheme="outline"
          class="notification-icon"
          [class.shake]="notificationService.hasUnread()"
        ></i>
      </button>
    </nz-badge>

    <nz-dropdown-menu #notificationMenu="nzDropdownMenu">
      <div class="notification-dropdown">
        <div class="notification-header">
          <span class="title">Notifications</span>
          @if (notificationService.hasUnread()) {
            <button nz-button nzType="link" nzSize="small" (click)="markAllRead()">
              Mark all read
            </button>
          }
        </div>

        <nz-divider style="margin: 0;"></nz-divider>

        <div class="notification-content">
          <nz-spin [nzSpinning]="notificationService.loading()">
            @if (notificationService.notifications().length === 0) {
              <nz-empty
                nzNotFoundImage="simple"
                nzNotFoundContent="No notifications"
                class="empty-state"
              ></nz-empty>
            } @else {
              <nz-list nzItemLayout="horizontal">
                @for (notification of notificationService.notifications().slice(0, 10); track notification.id) {
                  <nz-list-item
                    class="notification-item"
                    [class.unread]="!notification.isRead"
                    (click)="onNotificationClick(notification)"
                  >
                    <nz-list-item-meta>
                      <nz-list-item-meta-avatar>
                        <nz-avatar
                          [nzIcon]="notificationService.getNotificationIcon(notification.type)"
                          [ngStyle]="{ 'background-color': notificationService.getNotificationColor(notification.type) }"
                        ></nz-avatar>
                      </nz-list-item-meta-avatar>
                      <nz-list-item-meta-title>
                        {{ notification.title }}
                      </nz-list-item-meta-title>
                      <nz-list-item-meta-description>
                        <div class="notification-message">{{ notification.message }}</div>
                        <div class="notification-time">{{ notification.createdAt | date: 'short' }}</div>
                        <!-- <div class="notification-time">{{ formatTime(notification.createdAt) }}</div> -->
                      </nz-list-item-meta-description>
                    </nz-list-item-meta>
                  </nz-list-item>
                }
              </nz-list>
            }
          </nz-spin>
        </div>

        @if (notificationService.notifications().length > 0) {
          <nz-divider style="margin: 0;"></nz-divider>
          <div class="notification-footer">
            <button nz-button nzType="link" nzBlock (click)="viewAll()">
              View All Notifications
            </button>
          </div>
        }
      </div>
    </nz-dropdown-menu>
  `,
  styles: [`
    .bell-button {
      position: relative;
    }

    .notification-icon {
      font-size: 20px;
      color: #595959;
      transition: color 0.3s;
    }

    .notification-icon.shake {
      animation: bell-shake 2s ease-in-out infinite;
      color: #1890ff;
    }

    @keyframes bell-shake {
      0%, 100% {
        transform: rotate(0deg);
      }
      5%, 15% {
        transform: rotate(-15deg);
      }
      10%, 20% {
        transform: rotate(15deg);
      }
      25% {
        transform: rotate(0deg);
      }
    }

    .notification-dropdown {
      width: 360px;
      background: white;
      box-shadow: 0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08);
      border-radius: 4px;
    }

    .notification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
    }

    .notification-header .title {
      font-weight: 600;
      font-size: 16px;
    }

    .notification-content {
      max-height: 400px;
      overflow-y: auto;
    }

    .notification-item {
      cursor: pointer;
      transition: background-color 0.2s;
      padding: 12px 16px !important;
    }

    .notification-item:hover {
      background-color: #f5f5f5;
    }

    .notification-item.unread {
      background-color: #e6f7ff;
    }

    .notification-item.unread:hover {
      background-color: #bae7ff;
    }

    .notification-message {
      font-size: 13px;
      color: #595959;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 280px;
    }

    .notification-time {
      font-size: 12px;
      color: #8c8c8c;
      margin-top: 4px;
    }

    .notification-footer {
      padding: 8px 16px;
    }

    .empty-state {
      padding: 24px 0;
    }

    ::ng-deep .ant-list-item-meta-title {
      font-weight: 500;
      margin-bottom: 4px !important;
    }
  `],
})
export class NotificationBellComponent implements OnInit {
  readonly notificationService = inject(TicketNotificationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  dropdownVisible = false;

  ngOnInit(): void {
    // Load notifications on init if logged in
    if (this.authService.isAuthenticated()) {
      // Initial load of both count and notifications
      this.notificationService.getUnreadCount().subscribe();
      this.notificationService.getMyNotifications().subscribe();

      // Set up auto-refresh polling every 30 seconds for notifications
      // This ensures users get timely notification updates
      interval(30000) // 30000ms = 30 seconds
        .pipe(
          filter(() => this.authService.isAuthenticated()),
          switchMap(() => this.notificationService.getUnreadCount()),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          error: (error) => {
            console.error('Notification polling failed:', error);
          },
        });
    }
  }

  onDropdownVisibleChange(visible: boolean): void {
    if (visible) {
      // Load/refresh notifications when dropdown opens
      this.notificationService.getMyNotifications().subscribe();
    }
  }

  onNotificationClick(notification: TicketNotification): void {
    // Mark as read
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe();
    }

    // Navigate to ticket if available
    if (notification.ticket?.ticketNumber) {
      this.router.navigate(['/tickets', notification.ticket.ticketNumber]);
    }
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  viewAll(): void {
    // Close the dropdown
    this.dropdownVisible = false;
    // Navigate to notifications page
    this.router.navigate(['/notifications']);
  }

  formatTime(dateString: string): string {
    if (!dateString) return 'Unknown';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';

      const now = new Date();
      const diff = now.getTime() - date.getTime();

      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return 'Invalid date';
    }
  }
}
