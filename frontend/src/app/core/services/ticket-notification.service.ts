import { Injectable, inject, signal, computed } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable, tap } from 'rxjs';

// GraphQL Queries
const GET_MY_NOTIFICATIONS = gql`
  query MyNotifications($unreadOnly: Boolean, $limit: Int) {
    myNotifications(unreadOnly: $unreadOnly, limit: $limit) {
      id
      userId
      ticketId
      ticket {
        id
        ticketNumber
        title
      }
      type
      title
      message
      isRead
      readAt
      metadata
      createdAt
    }
  }
`;

const GET_UNREAD_COUNT = gql`
  query UnreadNotificationCount {
    unreadNotificationCount {
      unread
    }
  }
`;

const MARK_AS_READ = gql`
  mutation MarkNotificationAsRead($id: Int!) {
    markNotificationAsRead(id: $id) {
      id
      isRead
      readAt
    }
  }
`;

const MARK_ALL_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead {
      count
    }
  }
`;

// Types
export type NotificationType =
  | 'TICKET_CREATED'
  | 'TICKET_REVIEWED'
  | 'TICKET_REJECTED'
  | 'TICKET_APPROVED'
  | 'TICKET_DISAPPROVED'
  | 'TICKET_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'NOTE_ADDED';

export interface NotificationTicket {
  id: number;
  ticketNumber: string;
  title: string;
}

export interface TicketNotification {
  id: number;
  userId: number;
  ticketId?: number;
  ticket?: NotificationTicket;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class TicketNotificationService {
  private readonly apollo = inject(Apollo);

  // Reactive state
  readonly notifications = signal<TicketNotification[]>([]);
  readonly unreadCount = signal<number>(0);
  readonly loading = signal<boolean>(false);

  // Computed
  readonly hasUnread = computed(() => this.unreadCount() > 0);
  readonly unreadNotifications = computed(() =>
    this.notifications().filter((n) => !n.isRead)
  );

  /**
   * Fetch notifications for current user
   */
  getMyNotifications(unreadOnly = false, limit = 50): Observable<TicketNotification[]> {
    this.loading.set(true);
    return this.apollo
      .query<{ myNotifications: TicketNotification[] }>({
        query: GET_MY_NOTIFICATIONS,
        variables: { unreadOnly, limit },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.myNotifications) {
            throw new Error('Failed to load notifications');
          }
          // console.log(result.data.myNotifications);
          return result.data.myNotifications;
        }),
        tap((notifications) => {
          this.notifications.set(notifications);
          this.loading.set(false);
        })
      );
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(): Observable<number> {
    return this.apollo
      .query<{ unreadNotificationCount: { unread: number } }>({
        query: GET_UNREAD_COUNT,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.unreadNotificationCount) {
            throw new Error('Failed to load notification count');
          }
          return result.data.unreadNotificationCount.unread;
        }),
        tap((count) => this.unreadCount.set(count))
      );
  }

  /**
   * Mark a single notification as read
   */
  markAsRead(id: number): Observable<TicketNotification> {
    return this.apollo
      .mutate<{ markNotificationAsRead: TicketNotification }>({
        mutation: MARK_AS_READ,
        variables: { id },
      })
      .pipe(
        map((result) => {
          if (!result.data?.markNotificationAsRead) {
            throw new Error('Failed to mark notification as read');
          }
          // Update local state
          this.notifications.update((notifications) =>
            notifications.map((n) =>
              n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
            )
          );
          this.unreadCount.update((count) => Math.max(0, count - 1));
          return result.data.markNotificationAsRead;
        })
      );
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Observable<number> {
    return this.apollo
      .mutate<{ markAllNotificationsAsRead: { count: number } }>({
        mutation: MARK_ALL_AS_READ,
      })
      .pipe(
        map((result) => {
          if (!result.data?.markAllNotificationsAsRead) {
            throw new Error('Failed to mark all notifications as read');
          }
          // Update local state
          this.notifications.update((notifications) =>
            notifications.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
          );
          this.unreadCount.set(0);
          return result.data.markAllNotificationsAsRead.count;
        })
      );
  }

  /**
   * Refresh notifications and count
   */
  refresh(): void {
    this.getUnreadCount().subscribe();
    this.getMyNotifications().subscribe();
  }

  /**
   * Get icon for notification type
   */
  getNotificationIcon(type: string): string {
    switch (type) {
      case 'TICKET_CREATED':
        return 'file-add';
      case 'TICKET_REVIEWED':
        return 'eye';
      case 'TICKET_REJECTED':
        return 'close-circle';
      case 'TICKET_APPROVED':
        return 'check-circle';
      case 'TICKET_DISAPPROVED':
        return 'exclamation-circle';
      case 'TICKET_ASSIGNED':
        return 'user-add';
      case 'STATUS_CHANGED':
        return 'sync';
      case 'NOTE_ADDED':
        return 'message';
      default:
        return 'bell';
    }
  }

  /**
   * Get color for notification type
   */
  getNotificationColor(type: string): string {
    switch (type) {
      case 'TICKET_REJECTED':
      case 'TICKET_DISAPPROVED':
        return '#ff4d4f'; // red
      case 'TICKET_APPROVED':
        return '#52c41a'; // green
      case 'TICKET_ASSIGNED':
        return '#1890ff'; // blue
      case 'STATUS_CHANGED':
        return '#722ed1'; // purple
      default:
        return '#faad14'; // gold
    }
  }
}
