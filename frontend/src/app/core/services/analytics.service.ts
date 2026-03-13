import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable } from 'rxjs';

// ========================================
// GraphQL Queries
// ========================================

const TICKET_ANALYTICS = gql`
  query TicketAnalytics($filter: AnalyticsFilterInput) {
    ticketAnalytics(filter: $filter) {
      total
      byStatus {
        status
        count
      }
      byType {
        type
        count
      }
      byPriority {
        priority
        count
      }
    }
  }
`;

const SLA_METRICS = gql`
  query SLAMetrics {
    slaMetrics {
      overdue
      dueToday
      dueSoon
      complianceRate
      totalResolved
      resolvedWithinSLA
      averageResolutionHours
      overdueTickets {
        id
        ticketNumber
        title
        type
        priority
        status
        dueDate
        createdAt
        createdBy {
          name
        }
        assignments {
          user {
            name
          }
        }
      }
    }
  }
`;

const TICKET_TRENDS = gql`
  query TicketTrends($filter: AnalyticsFilterInput) {
    ticketTrends(filter: $filter) {
      createdPerDay {
        date
        count
      }
      resolvedPerDay {
        date
        count
      }
    }
  }
`;

const STAFF_PERFORMANCE = gql`
  query StaffPerformance($filter: AnalyticsFilterInput) {
    staffPerformance(filter: $filter) {
      userId
      name
      role
      totalAssigned
      totalResolved
      averageResolutionHours
      slaComplianceRate
    }
  }
`;

// ========================================
// Interfaces
// ========================================

export interface StatusCount {
  status: string;
  count: number;
}

export interface TypeCount {
  type: string;
  count: number;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

export interface TicketAnalytics {
  total: number;
  byStatus: StatusCount[];
  byType: TypeCount[];
  byPriority: PriorityCount[];
}

export interface OverdueTicket {
  id: number;
  ticketNumber: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  createdAt: string;
  createdBy: { name: string };
  assignments: Array<{ user: { name: string } }>;
}

export interface SLAMetrics {
  overdue: number;
  dueToday: number;
  dueSoon: number;
  complianceRate: number;
  totalResolved: number;
  resolvedWithinSLA: number;
  averageResolutionHours: number | null;
  overdueTickets: OverdueTicket[];
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface TicketTrends {
  createdPerDay: TrendPoint[];
  resolvedPerDay: TrendPoint[];
}

export interface StaffPerformance {
  userId: number;
  name: string;
  role: string;
  totalAssigned: number;
  totalResolved: number;
  averageResolutionHours: number | null;
  slaComplianceRate: number;
}

export interface AnalyticsFilter {
  startDate?: string;
  endDate?: string;
}

// ========================================
// Service
// ========================================

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly apollo = inject(Apollo);

  getTicketAnalytics(filter?: AnalyticsFilter): Observable<TicketAnalytics> {
    return this.apollo
      .query<{ ticketAnalytics: TicketAnalytics }>({
        query: TICKET_ANALYTICS,
        variables: { filter: filter || null },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data!.ticketAnalytics));
  }

  getSLAMetrics(): Observable<SLAMetrics> {
    return this.apollo
      .query<{ slaMetrics: SLAMetrics }>({
        query: SLA_METRICS,
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data!.slaMetrics));
  }

  getTicketTrends(filter?: AnalyticsFilter): Observable<TicketTrends> {
    return this.apollo
      .query<{ ticketTrends: TicketTrends }>({
        query: TICKET_TRENDS,
        variables: { filter: filter || null },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data!.ticketTrends));
  }

  getStaffPerformance(filter?: AnalyticsFilter): Observable<StaffPerformance[]> {
    return this.apollo
      .query<{ staffPerformance: StaffPerformance[] }>({
        query: STAFF_PERFORMANCE,
        variables: { filter: filter || null },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data!.staffPerformance));
  }
}
