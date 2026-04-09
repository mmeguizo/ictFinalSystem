import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables } from 'chart.js';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { ChartConfiguration, ChartData } from 'chart.js';
import {
  AnalyticsService,
  TicketAnalytics,
  SLAMetrics,
  TicketTrends,
  StaffPerformance,
  AnalyticsFilter,
  OverdueTicket,
} from '../../core/services/analytics.service';
import { ExportService } from '../../core/services/export.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { forkJoin } from 'rxjs';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BaseChartDirective,
    NzCardModule,
    NzGridModule,
    NzStatisticModule,
    NzIconModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    NzDatePickerModule,
    NzButtonModule,
    NzDividerModule,
    NzProgressModule,
    NzAlertModule,
    NzTabsModule,
    NzEmptyModule,
    NzToolTipModule,
    NzBadgeModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
})
export class AnalyticsPage implements OnInit {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly exportService = inject(ExportService);
  private readonly message = inject(NzMessageService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading = signal(true);
  readonly isBrowser = isPlatformBrowser(this.platformId);

  // Date range filter — default to last 5 days
  readonly dateRange = signal<[Date, Date] | null>([
    new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    new Date(),
  ]);

  // Data signals
  readonly analytics = signal<TicketAnalytics | null>(null);
  readonly slaMetrics = signal<SLAMetrics | null>(null);
  readonly trends = signal<TicketTrends | null>(null);
  readonly staffPerformance = signal<StaffPerformance[]>([]);

  // ========================================
  // COMPUTED CHART DATA
  // ========================================

  /** Status pie chart */
  readonly statusChartData = computed<ChartData<'doughnut'>>(() => {
    const data = this.analytics();
    if (!data) return { labels: [], datasets: [{ data: [] }] };
    return {
      labels: data.byStatus.map((s) => this.formatStatus(s.status)),
      datasets: [
        {
          data: data.byStatus.map((s) => s.count),
          backgroundColor: data.byStatus.map((s) => this.getStatusChartColor(s.status)),
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  });

  readonly statusChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { padding: 12, usePointStyle: true } },
      title: { display: true, text: 'Tickets by Status', font: { size: 14 } },
    },
  };

  /** Type pie chart */
  readonly typeChartData = computed<ChartData<'doughnut'>>(() => {
    const data = this.analytics();
    if (!data) return { labels: [], datasets: [{ data: [] }] };
    return {
      labels: data.byType.map((t) => t.type),
      datasets: [
        {
          data: data.byType.map((t) => t.count),
          backgroundColor: ['#1890ff', '#52c41a'],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  });

  readonly typeChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { padding: 12, usePointStyle: true } },
      title: { display: true, text: 'Tickets by Department', font: { size: 14 } },
    },
  };

  /** Priority bar chart */
  readonly priorityChartData = computed<ChartData<'bar'>>(() => {
    const data = this.analytics();
    if (!data) return { labels: [], datasets: [{ data: [] }] };
    const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const sorted = [...data.byPriority].sort(
      (a, b) => order.indexOf(a.priority) - order.indexOf(b.priority),
    );
    return {
      labels: sorted.map((p) => p.priority),
      datasets: [
        {
          label: 'Tickets',
          data: sorted.map((p) => p.count),
          backgroundColor: sorted.map((p) => this.getPriorityChartColor(p.priority)),
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  });

  readonly priorityChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Tickets by Priority', font: { size: 14 } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  /** Trends line chart */
  readonly trendsChartData = computed<ChartData<'line'>>(() => {
    const data = this.trends();
    if (!data) return { labels: [], datasets: [] };
    return {
      labels: data.createdPerDay.map((d) => {
        const date = new Date(d.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          label: 'Created',
          data: data.createdPerDay.map((d) => d.count),
          borderColor: '#1890ff',
          backgroundColor: 'rgba(24, 144, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: 'Resolved',
          data: data.resolvedPerDay.map((d) => d.count),
          borderColor: '#52c41a',
          backgroundColor: 'rgba(82, 196, 26, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
      ],
    };
  });

  readonly trendsChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Ticket Trends (Created vs Resolved)', font: { size: 14 } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  /** Staff workload bar chart */
  readonly staffChartData = computed<ChartData<'bar'>>(() => {
    const staff = this.staffPerformance();
    if (!staff.length) return { labels: [], datasets: [] };
    const sorted = [...staff].sort((a, b) => b.totalAssigned - a.totalAssigned);
    return {
      labels: sorted.map((s) => s.name),
      datasets: [
        {
          label: 'Assigned',
          data: sorted.map((s) => s.totalAssigned),
          backgroundColor: 'rgba(24, 144, 255, 0.7)',
          borderRadius: 4,
        },
        {
          label: 'Resolved',
          data: sorted.map((s) => s.totalResolved),
          backgroundColor: 'rgba(82, 196, 26, 0.7)',
          borderRadius: 4,
        },
      ],
    };
  });

  readonly staffChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Staff Workload', font: { size: 14 } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  /** SLA compliance gauge data */
  readonly slaCompliancePercent = computed(() => this.slaMetrics()?.complianceRate ?? 0);
  readonly slaComplianceColor = computed(() => {
    const rate = this.slaCompliancePercent();
    if (rate >= 90) return '#52c41a';
    if (rate >= 70) return '#faad14';
    return '#ff4d4f';
  });

  ngOnInit(): void {
    this.loadAllData();
  }

  /** Build filter from date range */
  private getFilter(): AnalyticsFilter | undefined {
    const range = this.dateRange();
    if (!range) return undefined;
    return {
      startDate: range[0].toISOString(),
      endDate: range[1].toISOString(),
    };
  }

  /** Load all analytics data */
  loadAllData(): void {
    this.loading.set(true);
    const filter = this.getFilter();

    forkJoin({
      analytics: this.analyticsService.getTicketAnalytics(filter),
      sla: this.analyticsService.getSLAMetrics(),
      trends: this.analyticsService.getTicketTrends(filter),
      staff: this.analyticsService.getStaffPerformance(filter),
    }).subscribe({
      next: ({ analytics, sla, trends, staff }) => {
        this.analytics.set(analytics);
        this.slaMetrics.set(sla);
        this.trends.set(trends);
        this.staffPerformance.set(staff);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load analytics:', err);
        this.loading.set(false);
      },
    });
  }

  /** Date range changed */
  onDateRangeChange(dates: [Date, Date] | null): void {
    this.dateRange.set(dates);
    this.loadAllData();
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ');
  }

  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      FOR_REVIEW: 'gold',
      REVIEWED: 'blue',
      DIRECTOR_APPROVED: 'cyan',
      ASSIGNED: 'purple',
      PENDING: 'orange',
      IN_PROGRESS: 'processing',
      ON_HOLD: 'warning',
      RESOLVED: 'success',
      CLOSED: 'default',
      CANCELLED: 'error',
    };
    return colorMap[status] || 'default';
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

  getOverdueHours(dueDate: string): number {
    const diff = new Date().getTime() - new Date(dueDate).getTime();
    return Math.round(diff / (1000 * 60 * 60));
  }

  getStatusChartColor(status: string): string {
    const colorMap: Record<string, string> = {
      FOR_REVIEW: '#faad14',
      REVIEWED: '#1890ff',
      DIRECTOR_APPROVED: '#13c2c2',
      ASSIGNED: '#722ed1',
      PENDING: '#fa8c16',
      IN_PROGRESS: '#1890ff',
      ON_HOLD: '#fa8c16',
      RESOLVED: '#52c41a',
      CLOSED: '#8c8c8c',
      CANCELLED: '#ff4d4f',
    };
    return colorMap[status] || '#d9d9d9';
  }

  private getPriorityChartColor(priority: string): string {
    const colorMap: Record<string, string> = {
      LOW: '#8c8c8c',
      MEDIUM: '#1890ff',
      HIGH: '#fa8c16',
      CRITICAL: '#ff4d4f',
    };
    return colorMap[priority] || '#d9d9d9';
  }

  // ========================================
  // EXPORT METHODS
  // ========================================

  exportPDF(): void {
    try {
      this.exportService.exportAnalyticsPDF(
        this.analytics(),
        this.slaMetrics(),
        this.trends(),
        this.staffPerformance(),
      );
      this.message.success('PDF report downloaded successfully');
    } catch (err) {
      console.error('PDF export failed:', err);
      this.message.error('Failed to generate PDF report');
    }
  }

  exportExcel(): void {
    try {
      this.exportService.exportAnalyticsExcel(
        this.analytics(),
        this.slaMetrics(),
        this.trends(),
        this.staffPerformance(),
      );
      this.message.success('Excel report downloaded successfully');
    } catch (err) {
      console.error('Excel export failed:', err);
      this.message.error('Failed to generate Excel report');
    }
  }
}
