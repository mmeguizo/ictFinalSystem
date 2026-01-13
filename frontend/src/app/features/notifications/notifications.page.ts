import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { TicketNotificationService, TicketNotification } from '../../core/services/ticket-notification.service';

// Local type definition to avoid import issues
type NotificationType =
  | 'TICKET_CREATED'
  | 'TICKET_REVIEWED'
  | 'TICKET_REJECTED'
  | 'TICKET_APPROVED'
  | 'TICKET_DISAPPROVED'
  | 'TICKET_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'NOTE_ADDED';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzListModule,
    NzAvatarModule,
    NzBadgeModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzEmptyModule,
    NzSpinModule,
    NzTagModule,
    NzToolTipModule,
    NzDividerModule,
    NzPaginationModule,
    NzSegmentedModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-card nzTitle="Notifications" [nzExtra]="extraTpl">
      <ng-template #extraTpl>
        <div class="header-actions">
          @if (notificationService.hasUnread()) {
            <button nz-button nzType="primary" nzGhost (click)="markAllAsRead()">
              <i nz-icon nzType="check-circle"></i>
              Mark All as Read
            </button>
          }
        </div>
      </ng-template>

      <!-- Filters -->
      <div class="filters-section">
        <div class="filter-row">
          <nz-input-group [nzPrefix]="prefixIcon" class="search-input">
            <input
              nz-input
              placeholder="Search notifications..."
              [(ngModel)]="searchText"
              (ngModelChange)="onSearchChange()"
            />
          </nz-input-group>
          <ng-template #prefixIcon>
            <i nz-icon nzType="search"></i>
          </ng-template>

          <nz-select
            [(ngModel)]="selectedType"
            (ngModelChange)="onFilterChange()"
            nzPlaceHolder="Filter by type"
            nzAllowClear
            style="width: 200px;"
          >
            @for (type of notificationTypes; track type.value) {
              <nz-option [nzValue]="type.value" [nzLabel]="type.label"></nz-option>
            }
          </nz-select>

          <nz-segmented
            [(ngModel)]="readFilter"
            [nzOptions]="readFilterOptions"
            (ngModelChange)="onFilterChange()"
          ></nz-segmented>
        </div>
      </div>

      <nz-divider></nz-divider>

      <!-- Notifications List -->
      <nz-spin [nzSpinning]="notificationService.loading()">
        @if (filteredNotifications().length === 0) {
          <nz-empty
            nzNotFoundImage="simple"
            [nzNotFoundContent]="emptyText()"
          ></nz-empty>
        } @else {
          <nz-list nzItemLayout="horizontal" nzSize="large">
            @for (notification of paginatedNotifications(); track notification.id) {
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
                      nzSize="large"
                    ></nz-avatar>
                  </nz-list-item-meta-avatar>
                  <nz-list-item-meta-title>
                    <div class="notification-title-row">
                      <span class="notification-title">{{ notification.title }}</span>
                      @if (!notification.isRead) {
                        <nz-badge nzStatus="processing" nzText="New"></nz-badge>
                      }
                    </div>
                  </nz-list-item-meta-title>
                  <nz-list-item-meta-description>
                    <div class="notification-message">{{ notification.message }}</div>
                    <div class="notification-meta">
                      <nz-tag [nzColor]="getTypeColor(notification.type)">
                        {{ getTypeLabel(notification.type) }}
                      </nz-tag>
                      @if (notification.ticket) {
                        <span class="ticket-ref">
                          <i nz-icon nzType="file-text"></i>
                          {{ notification.ticket.ticketNumber }}
                        </span>
                      }
                      <span class="notification-time">
                        <i nz-icon nzType="clock-circle"></i>
                        {{ notification.createdAt | date: 'short' }}
                      </span>
                    </div>
                  </nz-list-item-meta-description>
                </nz-list-item-meta>
                <ul nz-list-item-actions>
                  @if (!notification.isRead) {
                    <nz-list-item-action>
                      <button
                        nz-button
                        nzType="text"
                        nz-tooltip="Mark as read"
                        (click)="markAsRead(notification, $event)"
                      >
                        <i nz-icon nzType="check"></i>
                      </button>
                    </nz-list-item-action>
                  }
                  @if (notification.ticket) {
                    <nz-list-item-action>
                      <button
                        nz-button
                        nzType="text"
                        nz-tooltip="View Ticket"
                        (click)="viewTicket(notification, $event)"
                      >
                        <i nz-icon nzType="eye"></i>
                      </button>
                    </nz-list-item-action>
                  }
                </ul>
              </nz-list-item>
            }
          </nz-list>

          <!-- Pagination -->
          <div class="pagination-container">
            <nz-pagination
              [(nzPageIndex)]="currentPage"
              [(nzPageSize)]="pageSize"
              [nzTotal]="filteredNotifications().length"
              [nzPageSizeOptions]="[10, 20, 50]"
              nzShowSizeChanger
              nzShowQuickJumper
              (nzPageIndexChange)="onPageChange()"
              (nzPageSizeChange)="onPageChange()"
            ></nz-pagination>
          </div>
        }
      </nz-spin>
    </nz-card>
  `,
  styles: [`
    :host {
      display: block;
      padding: 24px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .filters-section {
      margin-bottom: 16px;
    }

    .filter-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-input {
      flex: 1;
      min-width: 250px;
      max-width: 400px;
    }

    .notification-item {
      cursor: pointer;
      transition: all 0.2s ease;
      border-radius: 8px;
      margin-bottom: 8px;
      border: 1px solid #f0f0f0;
    }

    .notification-item:hover {
      background-color: #fafafa;
      transform: translateX(4px);
    }

    .notification-item.unread {
      background-color: #e6f7ff;
      border-left: 4px solid #1890ff;
    }

    .notification-item.unread:hover {
      background-color: #bae7ff;
    }

    .notification-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .notification-title {
      font-weight: 600;
      font-size: 15px;
    }

    .notification-message {
      color: #595959;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .notification-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .ticket-ref {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #1890ff;
      font-size: 13px;
    }

    .notification-time {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #8c8c8c;
      font-size: 13px;
    }

    .pagination-container {
      display: flex;
      justify-content: center;
      margin-top: 24px;
    }

    ::ng-deep .ant-list-item-meta {
      align-items: flex-start !important;
    }
  `],
})
export class NotificationsPage implements OnInit {
  readonly notificationService = inject(TicketNotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Search and filters
  searchText = '';
  selectedType: NotificationType | null = null;
  readFilter: 'all' | 'unread' | 'read' = 'all';

  // Pagination
  currentPage = 1;
  pageSize = 10;

  // Filter options
  readFilterOptions = ['All', 'Unread', 'Read'];

  notificationTypes = [
    { value: 'TICKET_CREATED', label: 'Ticket Created' },
    { value: 'TICKET_REVIEWED', label: 'Ticket Reviewed' },
    { value: 'TICKET_REJECTED', label: 'Ticket Rejected' },
    { value: 'TICKET_APPROVED', label: 'Ticket Endorsed' },
    { value: 'TICKET_DISAPPROVED', label: 'Ticket Disapproved' },
    { value: 'TICKET_ASSIGNED', label: 'Ticket Assigned' },
    { value: 'STATUS_CHANGED', label: 'Status Changed' },
    { value: 'NOTE_ADDED', label: 'Note Added' },
  ];

  // Computed filtered notifications
  filteredNotifications = computed(() => {
    let notifications = this.notificationService.notifications();

    // Apply search filter
    if (this.searchText.trim()) {
      const search = this.searchText.toLowerCase();
      notifications = notifications.filter(n =>
        n.title.toLowerCase().includes(search) ||
        n.message.toLowerCase().includes(search) ||
        n.ticket?.ticketNumber?.toLowerCase().includes(search) ||
        n.ticket?.title?.toLowerCase().includes(search)
      );
    }

    // Apply type filter
    if (this.selectedType) {
      notifications = notifications.filter(n => n.type === this.selectedType);
    }

    // Apply read filter
    const readIndex = this.readFilterOptions.indexOf(
      typeof this.readFilter === 'string' ? this.readFilter.charAt(0).toUpperCase() + this.readFilter.slice(1) : 'All'
    );
    if (readIndex === 1) { // Unread
      notifications = notifications.filter(n => !n.isRead);
    } else if (readIndex === 2) { // Read
      notifications = notifications.filter(n => n.isRead);
    }

    return notifications;
  });

  // Paginated notifications
  paginatedNotifications = computed(() => {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredNotifications().slice(start, start + this.pageSize);
  });

  // Empty state text
  emptyText = computed(() => {
    if (this.searchText || this.selectedType || this.readFilter !== 'all') {
      return 'No notifications match your filters';
    }
    return 'No notifications yet';
  });

  ngOnInit(): void {
    // Load all notifications
    this.notificationService.getMyNotifications(false, 500).subscribe();

    // Set up auto-refresh polling every 30 seconds for notifications
    interval(30000) // 30000ms = 30 seconds
      .pipe(
        switchMap(() => this.notificationService.getMyNotifications(false, 500)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        error: (error) => {
          console.error('Notification polling failed:', error);
        },
      });
  }

  onSearchChange(): void {
    this.currentPage = 1; // Reset to first page on search
  }

  onFilterChange(): void {
    this.currentPage = 1; // Reset to first page on filter change
  }

  onPageChange(): void {
    // Pagination handled by computed
  }

  onNotificationClick(notification: TicketNotification): void {
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe();
    }
    if (notification.ticket?.ticketNumber) {
      this.router.navigate(['/tickets', notification.ticket.ticketNumber]);
    }
  }

  markAsRead(notification: TicketNotification, event: Event): void {
    event.stopPropagation();
    this.notificationService.markAsRead(notification.id).subscribe();
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  viewTicket(notification: TicketNotification, event: Event): void {
    event.stopPropagation();
    if (notification.ticket?.ticketNumber) {
      this.router.navigate(['/tickets', notification.ticket.ticketNumber]);
    }
  }

  getTypeLabel(type: NotificationType): string {
    const found = this.notificationTypes.find(t => t.value === type);
    return found?.label || type;
  }

  getTypeColor(type: NotificationType): string {
    const colors: Record<string, string> = {
      'TICKET_CREATED': 'blue',
      'TICKET_REVIEWED': 'cyan',
      'TICKET_REJECTED': 'red',
      'TICKET_APPROVED': 'green',
      'TICKET_DISAPPROVED': 'orange',
      'TICKET_ASSIGNED': 'purple',
      'STATUS_CHANGED': 'geekblue',
      'NOTE_ADDED': 'gold',
    };
    return colors[type] || 'default';
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
      if (minutes < 60) return `${minutes} min ago`;
      if (hours < 24) return `${hours} hours ago`;
      if (days < 7) return `${days} days ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (error) {
      return 'Invalid date';
    }
  }
}
