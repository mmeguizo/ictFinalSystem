import { Injectable, inject, signal, DestroyRef, NgZone } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Subscription as RxSubscription } from 'rxjs';
import { AuthService } from './auth.service';

// ─── Subscription Queries ──────────────────────────────────

const NOTIFICATION_CREATED_SUBSCRIPTION = gql`
  subscription NotificationCreated($userId: Int!) {
    notificationCreated(userId: $userId) {
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
      metadata
      createdAt
    }
  }
`;

const TICKET_STATUS_CHANGED_SUBSCRIPTION = gql`
  subscription TicketStatusChanged($ticketId: Int) {
    ticketStatusChanged(ticketId: $ticketId) {
      ticketId
      ticketNumber
      title
      oldStatus
      newStatus
      changedBy
      timestamp
    }
  }
`;

const TICKET_CREATED_SUBSCRIPTION = gql`
  subscription TicketCreated {
    ticketCreated {
      ticketId
      ticketNumber
      title
      type
      priority
      createdBy
      timestamp
    }
  }
`;

const TICKET_ASSIGNED_SUBSCRIPTION = gql`
  subscription TicketAssigned($userId: Int!) {
    ticketAssigned(userId: $userId) {
      ticketId
      ticketNumber
      title
      assignedToUserId
      assignedToName
      assignedBy
      timestamp
    }
  }
`;

const TICKET_ASSIGNMENT_ACTIVITY_SUBSCRIPTION = gql`
  subscription TicketAssignmentActivity {
    ticketAssignmentActivity {
      ticketId
      ticketNumber
      title
      assignedToUserId
      assignedToName
      assignedBy
      timestamp
    }
  }
`;

// ─── Types ─────────────────────────────────────────────────

export interface TicketStatusChangedEvent {
  ticketId: number;
  ticketNumber: string;
  title: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  timestamp: string;
}

export interface TicketCreatedEvent {
  ticketId: number;
  ticketNumber: string;
  title: string;
  type: string;
  priority: string;
  createdBy: string;
  timestamp: string;
}

export interface TicketAssignedEvent {
  ticketId: number;
  ticketNumber: string;
  title: string;
  assignedToUserId: number;
  assignedToName: string;
  assignedBy: string;
  timestamp: string;
}

export interface NotificationEvent {
  id: number;
  userId: number;
  ticketId?: number;
  ticket?: { id: number; ticketNumber: string; title: string };
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityFeedItem {
  id: string;
  kind: 'created' | 'assigned' | 'status';
  tagLabel: string;
  tagColor: string;
  headline: string;
  details: string;
  ticketId: number;
  ticketNumber: string;
  timestamp: string;
}

// ─── Service ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly apollo = inject(Apollo);
  private readonly authService = inject(AuthService);
  private readonly ngZone = inject(NgZone);

  // Active subscriptions (for cleanup)
  private subscriptions: RxSubscription[] = [];

  // Signals for real-time events
  readonly lastNotification = signal<NotificationEvent | null>(null);
  readonly lastStatusChange = signal<TicketStatusChangedEvent | null>(null);
  readonly lastTicketCreated = signal<TicketCreatedEvent | null>(null);
  readonly lastAssignment = signal<TicketAssignedEvent | null>(null);
  readonly lastAssignmentActivity = signal<TicketAssignedEvent | null>(null);
  readonly activityFeed = signal<ActivityFeedItem[]>([]);

  // Signal to force-refresh a specific ticket (triggered by notification click)
  readonly forceTicketRefresh = signal<string | null>(null);

  // Connection state
  readonly connected = signal(false);

  /**
   * Trigger a forced refresh of a ticket by its ticketNumber.
   * Used when clicking a notification to ensure the ticket detail page reloads.
   */
  triggerTicketRefresh(ticketNumber: string): void {
    // Set to null first, then set the value to ensure the signal always fires
    this.forceTicketRefresh.set(null);
    this.forceTicketRefresh.set(ticketNumber);
  }

  /**
   * Start all real-time subscriptions for the current user.
   * Call this once after login.
   */
  startListening(): void {
    // Must be in browser and have a user
    if (typeof window === 'undefined') return;
    const user = this.authService.currentUser();
    if (!user) return;

    // Don't double-subscribe
    this.stopListening();

    console.log('[Realtime] Starting WebSocket subscriptions for user', user.id);
    this.connected.set(true);

    // 1. Notification subscription (per-user)
    this.subscriptions.push(
      this.apollo
        .subscribe<{ notificationCreated: NotificationEvent }>({
          query: NOTIFICATION_CREATED_SUBSCRIPTION,
          variables: { userId: user.id },
        })
        .subscribe({
          next: ({ data }) => {
            if (data?.notificationCreated) {
              this.ngZone.run(() => {
                this.lastNotification.set(data!.notificationCreated);
              });
            }
          },
          error: (err) => console.error('[Realtime] notificationCreated error:', err),
        }),
    );

    // 2. Ticket status changes (all tickets)
    this.subscriptions.push(
      this.apollo
        .subscribe<{ ticketStatusChanged: TicketStatusChangedEvent }>({
          query: TICKET_STATUS_CHANGED_SUBSCRIPTION,
        })
        .subscribe({
          next: ({ data }) => {
            if (data?.ticketStatusChanged) {
              this.ngZone.run(() => {
                this.lastStatusChange.set(data!.ticketStatusChanged);
                this.pushActivity(this.buildStatusActivity(data!.ticketStatusChanged));
              });
            }
          },
          error: (err) => console.error('[Realtime] ticketStatusChanged error:', err),
        }),
    );

    // 3. New ticket created (useful for secretary/admin dashboards)
    this.subscriptions.push(
      this.apollo
        .subscribe<{ ticketCreated: TicketCreatedEvent }>({
          query: TICKET_CREATED_SUBSCRIPTION,
        })
        .subscribe({
          next: ({ data }) => {
            if (data?.ticketCreated) {
              this.ngZone.run(() => {
                this.lastTicketCreated.set(data!.ticketCreated);
                this.pushActivity(this.buildCreatedActivity(data!.ticketCreated));
              });
            }
          },
          error: (err) => console.error('[Realtime] ticketCreated error:', err),
        }),
    );

    // 4. Global assignment activity for shared dashboards
    this.subscriptions.push(
      this.apollo
        .subscribe<{ ticketAssignmentActivity: TicketAssignedEvent }>({
          query: TICKET_ASSIGNMENT_ACTIVITY_SUBSCRIPTION,
        })
        .subscribe({
          next: ({ data }) => {
            if (data?.ticketAssignmentActivity) {
              this.ngZone.run(() => {
                this.lastAssignmentActivity.set(data.ticketAssignmentActivity);
                this.pushActivity(this.buildAssignmentActivity(data.ticketAssignmentActivity));
              });
            }
          },
          error: (err) => console.error('[Realtime] ticketAssignmentActivity error:', err),
        }),
    );

    // 5. Ticket assigned to this user
    this.subscriptions.push(
      this.apollo
        .subscribe<{ ticketAssigned: TicketAssignedEvent }>({
          query: TICKET_ASSIGNED_SUBSCRIPTION,
          variables: { userId: user.id },
        })
        .subscribe({
          next: ({ data }) => {
            if (data?.ticketAssigned) {
              this.ngZone.run(() => {
                this.lastAssignment.set(data!.ticketAssigned);
              });
            }
          },
          error: (err) => console.error('[Realtime] ticketAssigned error:', err),
        }),
    );
  }

  /**
   * Stop all active subscriptions.
   * Call this on logout.
   */
  stopListening(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.subscriptions = [];
    this.connected.set(false);
    console.log('[Realtime] WebSocket subscriptions stopped');
  }

  private pushActivity(item: ActivityFeedItem | null): void {
    if (!item) return;

    this.activityFeed.update((entries) => {
      const nextEntries = [item, ...entries.filter((entry) => entry.id !== item.id)];
      nextEntries.sort(
        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      );
      return nextEntries.slice(0, 20);
    });
  }

  private buildCreatedActivity(event: TicketCreatedEvent): ActivityFeedItem {
    return {
      id: `created:${event.ticketId}:${event.timestamp}`,
      kind: 'created',
      tagLabel: 'Created',
      tagColor: 'blue',
      headline: `${event.createdBy} created a new ticket`,
      details: `${event.title} - ${event.type} - ${event.priority} priority`,
      ticketId: event.ticketId,
      ticketNumber: event.ticketNumber,
      timestamp: event.timestamp,
    };
  }

  private buildAssignmentActivity(event: TicketAssignedEvent): ActivityFeedItem {
    return {
      id: `assigned:${event.ticketId}:${event.timestamp}`,
      kind: 'assigned',
      tagLabel: 'Assigned',
      tagColor: 'purple',
      headline: `${event.assignedBy} assigned the ticket to ${event.assignedToName}`,
      details: event.title,
      ticketId: event.ticketId,
      ticketNumber: event.ticketNumber,
      timestamp: event.timestamp,
    };
  }

  private buildStatusActivity(event: TicketStatusChangedEvent): ActivityFeedItem | null {
    if (event.newStatus === 'ASSIGNED') {
      return null;
    }

    return {
      id: `status:${event.ticketId}:${event.timestamp}:${event.newStatus}`,
      kind: 'status',
      tagLabel: 'Status',
      tagColor: this.getStatusActivityColor(event.newStatus),
      headline: `${event.changedBy} moved the ticket to ${this.formatStatus(event.newStatus)}`,
      details: `${event.title} - was ${this.formatStatus(event.oldStatus)}`,
      ticketId: event.ticketId,
      ticketNumber: event.ticketNumber,
      timestamp: event.timestamp,
    };
  }

  private getStatusActivityColor(status: string): string {
    const colorMap: Record<string, string> = {
      FOR_REVIEW: 'gold',
      REVIEWED: 'blue',
      DIRECTOR_APPROVED: 'cyan',
      IN_PROGRESS: 'processing',
      ON_HOLD: 'warning',
      RESOLVED: 'success',
      CLOSED: 'default',
      CANCELLED: 'error',
    };

    return colorMap[status] ?? 'default';
  }

  private formatStatus(status: string): string {
    return status.replace(/_/g, ' ');
  }
}
