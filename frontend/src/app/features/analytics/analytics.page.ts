import { Component, ChangeDetectionStrategy, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  TicketService,
  TicketAnalytics,
  SLAMetrics,
  StatusCount,
  TypeCount,
  PriorityCount,
} from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-analytics',
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzStatisticModule,
    NzGridModule,
    NzIconModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    NzDatePickerModule,
    NzButtonModule,
    NzDividerModule,
    NzEmptyModule,
    NzProgressModule,
    NzAlertModule,
    NzToolTipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
})
export class AnalyticsPage implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly analytics = signal<TicketAnalytics | null>(null);
  readonly slaMetrics = signal<SLAMetrics | null>(null);
  readonly dateRange = signal<[Date, Date] | null>(null);

  // Computed analytics values
  readonly total = computed(() => this.analytics()?.total ?? 0);

  readonly byStatus = computed(() => this.analytics()?.byStatus ?? []);
  readonly byType = computed(() => this.analytics()?.byType ?? []);
  readonly byPriority = computed(() => this.analytics()?.byPriority ?? []);

  readonly overdue = computed(() => this.slaMetrics()?.overdue ?? 0);
  readonly dueToday = computed(() => this.slaMetrics()?.dueToday ?? 0);
  readonly dueSoon = computed(() => this.slaMetrics()?.dueSoon ?? 0);

  // Computed: resolved + closed count from analytics
  readonly resolvedCount = computed(() => {
    const statuses = this.byStatus();
    const resolved = statuses.find(s => s.status === 'RESOLVED')?.count ?? 0;
    const closed = statuses.find(s => s.status === 'CLOSED')?.count ?? 0;
    return resolved + closed;
  });

  // Computed: open/active tickets
  readonly openCount = computed(() => {
    const total = this.total();
    const resolved = this.byStatus().find(s => s.status === 'RESOLVED')?.count ?? 0;
    const closed = this.byStatus().find(s => s.status === 'CLOSED')?.count ?? 0;
    const cancelled = this.byStatus().find(s => s.status === 'CANCELLED')?.count ?? 0;
    return total - resolved - closed - cancelled;
  });

  // Computed: SLA compliance percentage
  readonly slaCompliancePercent = computed(() => {
    const total = this.total();
    if (total === 0) return 100;
    const overdue = this.overdue();
    return Math.round(((total - overdue) / total) * 100);
  });

  // Computed: max count for progress bar scaling (status breakdown)
  readonly maxStatusCount = computed(() => {
    const statuses = this.byStatus();
    return statuses.length > 0 ? Math.max(...statuses.map(s => s.count)) : 1;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    const filter = this.buildFilter();

    forkJoin({
      analytics: this.ticketService.getTicketAnalytics(filter),
      sla: this.ticketService.getSLAMetrics(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ analytics, sla }) => {
          this.analytics.set(analytics);
          this.slaMetrics.set(sla);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Failed to load analytics:', error);
          this.loading.set(false);
        },
      });
  }

  onDateRangeChange(dates: [Date, Date] | null): void {
    this.dateRange.set(dates);
    this.loadData();
  }

  clearDateRange(): void {
    this.dateRange.set(null);
    this.loadData();
  }

  private buildFilter(): { startDate?: string; endDate?: string } | undefined {
    const range = this.dateRange();
    if (!range || !range[0] || !range[1]) return undefined;

    return {
      startDate: range[0].toISOString(),
      endDate: range[1].toISOString(),
    };
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      FOR_REVIEW: 'gold',
      REVIEWED: 'blue',
      DIRECTOR_APPROVED: 'cyan',
      ASSIGNED: 'purple',
      PENDING_ACKNOWLEDGMENT: 'geekblue',
      SCHEDULED: 'magenta',
      IN_PROGRESS: 'processing',
      ON_HOLD: 'warning',
      RESOLVED: 'success',
      CLOSED: 'default',
      CANCELLED: 'error',
    };
    return colorMap[status] || 'default';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }

  getPriorityColor(priority: string): string {
    const colorMap: Record<string, string> = {
      LOW: 'default',
      MEDIUM: 'blue',
      HIGH: 'orange',
      CRITICAL: 'red',
    };
    return colorMap[priority] || 'default';
  }

  getTypeColor(type: string): string {
    return type === 'MIS' ? 'blue' : 'green';
  }

  getStatusPercent(count: number): number {
    const max = this.maxStatusCount();
    return max > 0 ? Math.round((count / max) * 100) : 0;
  }
}
