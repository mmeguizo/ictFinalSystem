import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable } from 'rxjs';

// GraphQL Mutations
const CREATE_MIS_TICKET = gql`
  mutation CreateMISTicket($input: CreateMISTicketInput!) {
    createMISTicket(input: $input) {
      id
      ticketNumber
      type
      priority
      status
      createdAt
      misTicket {
        category
        websiteNewRequest
        websiteUpdate
        softwareNewRequest
        softwareUpdate
        softwareInstall
      }
    }
  }
`;

const CREATE_ITS_TICKET = gql`
  mutation CreateITSTicket($input: CreateITSTicketInput!) {
    createITSTicket(input: $input) {
      id
      ticketNumber
      type
      priority
      status
      createdAt
    }
  }
`;

const ADD_TICKET_NOTE = gql`
  mutation AddTicketNote($ticketId: Int!, $input: CreateTicketNoteInput!) {
    addTicketNote(ticketId: $ticketId, input: $input) {
      id
      ticketId
      content
      isInternal
      createdAt
      user {
        id
        name
        role
      }
    }
  }
`;

/**
 * Mutation to assign a ticket to a staff member
 * Used by MIS_HEAD/ITS_HEAD to assign tickets to DEVELOPER/TECHNICAL staff
 */
const ASSIGN_TICKET = gql`
  mutation AssignTicket($ticketId: Int!, $userId: Int!) {
    assignTicket(ticketId: $ticketId, userId: $userId) {
      id
      ticketNumber
      status
      assignments {
        user {
          id
          name
          email
          role
        }
        assignedAt
      }
    }
  }
`;

/**
 * Mutation to update ticket status
 * Used by DEVELOPER/TECHNICAL to mark tickets IN_PROGRESS, RESOLVED, etc.
 */
const UPDATE_TICKET_STATUS = gql`
  mutation UpdateTicketStatus($ticketId: Int!, $input: UpdateTicketStatusInput!) {
    updateTicketStatus(ticketId: $ticketId, input: $input) {
      id
      ticketNumber
      status
    }
  }
`;

/**
 * Query to get users by role (for assignment dropdown)
 */
const USERS_BY_ROLE = gql`
  query UsersByRole($role: Role!) {
    usersByRole(role: $role) {
      id
      name
      email
      role
    }
  }
`;

/**
 * Query to get users by multiple roles
 */
const USERS_BY_ROLES = gql`
  query UsersByRoles($roles: [Role!]!) {
    usersByRoles(roles: $roles) {
      id
      name
      email
      role
    }
  }
`;

/**
 * Query to get tickets assigned to the current user (for DEVELOPER/TECHNICAL)
 */
const MY_ASSIGNED_TICKETS = gql`
  query MyTickets {
    myTickets {
      id
      ticketNumber
      type
      title
      description
      status
      priority
      dueDate
      createdAt
      updatedAt
      createdBy {
        id
        name
        email
      }
      assignments {
        user {
          id
          name
          role
        }
        assignedAt
      }
      notes {
        id
        content
        isInternal
        createdAt
        user {
          id
          name
          role
        }
      }
    }
  }
`;

const ALL_TICKETS = gql`
  query AllTickets {
    tickets {
      id
      ticketNumber
      type
      title
      description
      status
      priority
      dueDate
      secretaryReviewedAt
      directorApprovedAt
      createdAt
      updatedAt
      resolvedAt
      closedAt
      createdBy {
        id
        name
        email
      }
      assignments {
        user {
          id
          name
          email
          role
        }
        assignedAt
      }
    }
  }
`;

const MY_CREATED_TICKETS = gql`
  query MyCreatedTickets {
    myCreatedTickets {
      id
      ticketNumber
      type
      title
      description
      status
      priority
      dueDate
      secretaryReviewedAt
      directorApprovedAt
      createdAt
      updatedAt
      resolvedAt
      closedAt
      createdBy {
        id
        name
        email
      }
      assignments {
        user {
          id
          name
          email
          role
        }
        assignedAt
      }
    }
  }
`;

const TICKETS_FOR_SECRETARY_REVIEW = gql`
  query TicketsForSecretaryReview {
    ticketsForSecretaryReview {
      id
      ticketNumber
      type
      title
      description
      status
      priority
      dueDate
      createdAt
      updatedAt
      createdBy {
        id
        name
        email
      }
    }
  }
`;

const ALL_SECRETARY_TICKETS = gql`
  query AllSecretaryTickets {
    allSecretaryTickets {
      id
      ticketNumber
      type
      title
      description
      status
      priority
      dueDate
      secretaryReviewedAt
      secretaryReviewedById
      directorApprovedAt
      directorApprovedById
      createdAt
      updatedAt
      createdBy {
        id
        name
        email
      }
      assignments {
        user {
          id
          name
          email
          role
        }
        assignedAt
      }
    }
  }
`;

const TICKETS_PENDING_DIRECTOR_APPROVAL = gql`
  query TicketsPendingDirectorApproval {
    ticketsPendingDirectorApproval {
      id
      ticketNumber
      type
      title
      description
      status
      priority
      dueDate
      secretaryReviewedAt
      createdAt
      updatedAt
      createdBy {
        id
        name
        email
      }
    }
  }
`;

const REVIEW_TICKET_AS_SECRETARY = gql`
  mutation ReviewTicketAsSecretary($ticketId: Int!, $comment: String) {
    reviewTicketAsSecretary(ticketId: $ticketId, comment: $comment) {
      id
      ticketNumber
      status
      secretaryReviewedAt
      secretaryReviewedById
    }
  }
`;

/**
 * Mutation to reject a ticket as secretary
 * Returns ticket to user with notes/reason
 */
const REJECT_TICKET_AS_SECRETARY = gql`
  mutation RejectTicketAsSecretary($ticketId: Int!, $reason: String!) {
    rejectTicketAsSecretary(ticketId: $ticketId, reason: $reason) {
      id
      ticketNumber
      status
    }
  }
`;

const APPROVE_TICKET_AS_DIRECTOR = gql`
  mutation ApproveTicketAsDirector($ticketId: Int!, $comment: String) {
    approveTicketAsDirector(ticketId: $ticketId, comment: $comment) {
      id
      ticketNumber
      status
      directorApprovedAt
      directorApprovedById
    }
  }
`;

/**
 * Mutation to disapprove/reject a ticket as director
 * Requires a reason for the rejection
 */
const DISAPPROVE_TICKET_AS_DIRECTOR = gql`
  mutation DisapproveTicketAsDirector($ticketId: Int!, $reason: String!) {
    disapproveTicketAsDirector(ticketId: $ticketId, reason: $reason) {
      id
      ticketNumber
      status
    }
  }
`;

/**
 * Mutation to reopen a cancelled/rejected ticket
 * Only the original creator can reopen
 */
const REOPEN_TICKET = gql`
  mutation ReopenTicket($ticketId: Int!, $input: ReopenTicketInput) {
    reopenTicket(ticketId: $ticketId, input: $input) {
      id
      ticketNumber
      status
    }
  }
`;

/**
 * Mutation for heads to schedule a visit
 * Sets dateToVisit and targetCompletionDate
 */
const SCHEDULE_VISIT = gql`
  mutation ScheduleVisit($ticketId: Int!, $input: ScheduleVisitInput!) {
    scheduleVisit(ticketId: $ticketId, input: $input) {
      id
      ticketNumber
      status
      dateToVisit
      targetCompletionDate
    }
  }
`;

/**
 * Mutation for admin to acknowledge a schedule
 */
const ACKNOWLEDGE_SCHEDULE = gql`
  mutation AcknowledgeSchedule($ticketId: Int!, $comment: String) {
    acknowledgeSchedule(ticketId: $ticketId, comment: $comment) {
      id
      ticketNumber
      status
    }
  }
`;

/**
 * Mutation for admin to reject a schedule
 */
const REJECT_SCHEDULE = gql`
  mutation RejectSchedule($ticketId: Int!, $reason: String!) {
    rejectSchedule(ticketId: $ticketId, reason: $reason) {
      id
      ticketNumber
      status
    }
  }
`;

/**
 * Mutation for heads to add monitor notes and recommendations
 */
const ADD_MONITOR_AND_RECOMMENDATIONS = gql`
  mutation AddMonitorAndRecommendations($ticketId: Int!, $input: AddMonitorInput!) {
    addMonitorAndRecommendations(ticketId: $ticketId, input: $input) {
      id
      ticketNumber
      status
      monitorNotes
      recommendations
    }
  }
`;

/**
 * Query for admin to get tickets pending acknowledgment
 */
const TICKETS_PENDING_ACKNOWLEDGMENT = gql`
  query TicketsPendingAcknowledgment {
    ticketsPendingAcknowledgment {
      id
      ticketNumber
      type
      title
      status
      priority
      dateToVisit
      targetCompletionDate
      createdAt
      createdBy {
        id
        name
        email
      }
      assignments {
        user {
          id
          name
          role
        }
      }
    }
  }
`;

const TICKET_BY_NUMBER = gql`
  query TicketByNumber($ticketNumber: String!) {
    ticketByNumber(ticketNumber: $ticketNumber) {
      id
      ticketNumber
      controlNumber
      type
      title
      description
      status
      priority
      dueDate
      estimatedDuration
      actualDuration
      secretaryReviewedById
      secretaryReviewedAt
      directorApprovedById
      directorApprovedAt
      dateToVisit
      targetCompletionDate
      headScheduledById
      headScheduledAt
      adminAcknowledgedById
      adminAcknowledgedAt
      monitorNotes
      recommendations
      monitoredById
      monitoredAt
      createdAt
      updatedAt
      resolvedAt
      closedAt
      createdBy {
        id
        name
        email
        role
      }
      misTicket {
        category
        websiteNewRequest
        websiteUpdate
        softwareNewRequest
        softwareUpdate
        softwareInstall
      }
      itsTicket {
        borrowRequest
        borrowDetails
        maintenanceDesktopLaptop
        maintenanceInternetNetwork
        maintenancePrinter
        maintenanceDetails
      }
      assignments {
        user {
          id
          name
          email
          role
        }
        assignedAt
      }
      notes {
        id
        content
        isInternal
        createdAt
        user {
          id
          name
          role
        }
      }
      statusHistory {
        id
        fromStatus
        toStatus
        comment
        createdAt
        user {
          id
          name
          role
        }
      }
    }
  }
`;




// Type definitions matching backend GraphQL schema
export interface CreateMISTicketInput {
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'WEBSITE' | 'SOFTWARE';
  websiteNewRequest?: boolean;
  websiteUpdate?: boolean;
  softwareNewRequest?: boolean;
  softwareUpdate?: boolean;
  softwareInstall?: boolean;
  estimatedDuration?: number;
}

export interface CreateITSTicketInput {
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  borrowRequest?: boolean;
  borrowDetails?: string;
  maintenanceDesktopLaptop?: boolean;
  maintenanceInternetNetwork?: boolean;
  maintenancePrinter?: boolean;
  maintenanceDetails?: string;
  estimatedDuration?: number;
}

export interface CreateTicketNoteInput {
  content: string;
  isInternal?: boolean;
}

export interface TicketNote {
  id: number;
  ticketId: number;
  content: string;
  isInternal: boolean;
  createdAt: string;
  user: {
    id: number;
    name: string;
    role: string;
  };
}

export interface TicketResponse {
  id: string;
  ticketNumber: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  controlNumber?: string;
  type: 'MIS' | 'ITS';
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate?: string;
  secretaryReviewedAt?: string;
  directorApprovedAt?: string;
  // Schedule workflow fields
  dateToVisit?: string;
  targetCompletionDate?: string;
  headScheduledAt?: string;
  adminAcknowledgedAt?: string;
  // Monitor fields
  monitorNotes?: string;
  recommendations?: string;
  monitoredAt?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  createdBy: {
    id: number;
    name: string;
    email: string;
  };
  assignments: Array<{
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
    };
    assignedAt: string;
  }>;
}

export interface TicketDetail extends TicketListItem {
  estimatedDuration?: number;
  actualDuration?: number;
  secretaryReviewedById?: number;
  directorApprovedById?: number;
  headScheduledById?: number;
  adminAcknowledgedById?: number;
  monitoredById?: number;
  misTicket?: {
    category: string;
    websiteNewRequest: boolean;
    websiteUpdate: boolean;
    softwareNewRequest: boolean;
    softwareUpdate: boolean;
    softwareInstall: boolean;
  };
  itsTicket?: {
    borrowRequest: boolean;
    borrowDetails?: string;
    maintenanceDesktopLaptop: boolean;
    maintenanceInternetNetwork: boolean;
    maintenancePrinter: boolean;
    maintenanceDetails?: string;
  };
  notes: Array<{
    id: number;
    content: string;
    isInternal: boolean;
    createdAt: string;
    user: {
      id: number;
      name: string;
      role: string;
    };
  }>;
  statusHistory: Array<{
    id: number;
    fromStatus?: string;
    toStatus: string;
    comment?: string;
    createdAt: string;
    user: {
      id: number;
      name: string;
      role: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class TicketService {
  private readonly apollo = inject(Apollo);

  createMISTicket(input: CreateMISTicketInput): Observable<TicketResponse> {
    return this.apollo
      .mutate<{ createMISTicket: TicketResponse }>({
        mutation: CREATE_MIS_TICKET,
        variables: { input },
      })
      .pipe(
        map((result) => {
          if (!result.data?.createMISTicket) {
            throw new Error('Failed to create MIS ticket');
          }
          return result.data.createMISTicket;
        })
      );
  }

  createITSTicket(input: CreateITSTicketInput): Observable<TicketResponse> {
    return this.apollo
      .mutate<{ createITSTicket: TicketResponse }>({
        mutation: CREATE_ITS_TICKET,
        variables: { input },
      })
      .pipe(
        map((result) => {
          if (!result.data?.createITSTicket) {
            throw new Error('Failed to create ITS ticket');
          }
          return result.data.createITSTicket;
        })
      );
  }

  getMyCreatedTickets(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ myCreatedTickets: TicketListItem[] }>({
        query: MY_CREATED_TICKETS,
        fetchPolicy: 'network-only', // Always fetch fresh data
      })
      .pipe(
        map((result) => {
          if (!result.data?.myCreatedTickets) {
            throw new Error('Failed to fetch tickets');
          }
          return result.data.myCreatedTickets;
        })
      );
  }

  /**
   * Get all tickets in the system (for admin/office head)
   */
  getAllTickets(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ tickets: TicketListItem[] }>({
        query: ALL_TICKETS,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.tickets) {
            throw new Error('Failed to fetch all tickets');
          }
          return result.data.tickets;
        })
      );
  }

  getTicketByNumber(ticketNumber: string): Observable<TicketDetail> {
    return this.apollo
      .query<{ ticketByNumber: TicketDetail }>({
        query: TICKET_BY_NUMBER,
        variables: { ticketNumber },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.ticketByNumber) {
            throw new Error('Ticket not found');
          }
          return result.data.ticketByNumber;
        })
      );
  }

  addTicketNote(
    ticketId: number,
    input: CreateTicketNoteInput
  ): Observable<TicketNote> {
    return this.apollo
      .mutate<{ addTicketNote: TicketNote }>({
        mutation: ADD_TICKET_NOTE,
        variables: { ticketId, input },
      })
      .pipe(
        map((result) => {
          if (!result.data?.addTicketNote) {
            throw new Error('Failed to add note');
          }
          return result.data.addTicketNote;
        })
      );
  }

  /**
   * Get tickets for secretary review (FOR_REVIEW status)
   */
  getTicketsForSecretaryReview(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ ticketsForSecretaryReview: TicketListItem[] }>({
        query: TICKETS_FOR_SECRETARY_REVIEW,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.ticketsForSecretaryReview) {
            throw new Error('Failed to fetch tickets for secretary review');
          }
          return result.data.ticketsForSecretaryReview;
        })
      );
  }

  /**
   * Get all secretary-related tickets (FOR_REVIEW + REVIEWED)
   * For admin/director oversight
   */
  getAllSecretaryTickets(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ allSecretaryTickets: TicketListItem[] }>({
        query: ALL_SECRETARY_TICKETS,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.allSecretaryTickets) {
            throw new Error('Failed to fetch all secretary tickets');
          }
          return result.data.allSecretaryTickets;
        })
      );
  }

  /**
   * Get tickets pending director approval (REVIEWED status)
   */
  getTicketsPendingDirectorApproval(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ ticketsPendingDirectorApproval: TicketListItem[] }>({
        query: TICKETS_PENDING_DIRECTOR_APPROVAL,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.ticketsPendingDirectorApproval) {
            throw new Error('Failed to fetch tickets pending director approval');
          }
          return result.data.ticketsPendingDirectorApproval;
        })
      );
  }

  /**
   * Review ticket as secretary
   */
  reviewAsSecretary(ticketId: number, comment?: string): Observable<{ id: number; status: string }> {
    return this.apollo
      .mutate<{ reviewTicketAsSecretary: { id: number; ticketNumber: string; status: string } }>({
        mutation: REVIEW_TICKET_AS_SECRETARY,
        variables: { ticketId, comment },
      })
      .pipe(
        map((result) => {
          if (!result.data?.reviewTicketAsSecretary) {
            throw new Error('Failed to review ticket');
          }
          return result.data.reviewTicketAsSecretary;
        })
      );
  }

  /**
   * Reject ticket as secretary
   * Returns ticket to user with notes/reason visible to user
   */
  rejectAsSecretary(ticketId: number, reason: string): Observable<{ id: number; status: string }> {
    return this.apollo
      .mutate<{ rejectTicketAsSecretary: { id: number; ticketNumber: string; status: string } }>({
        mutation: REJECT_TICKET_AS_SECRETARY,
        variables: { ticketId, reason },
      })
      .pipe(
        map((result) => {
          if (!result.data?.rejectTicketAsSecretary) {
            throw new Error('Failed to reject ticket');
          }
          return result.data.rejectTicketAsSecretary;
        })
      );
  }

  /**
   * Approve ticket as director
   */
  approveAsDirector(ticketId: number, comment?: string): Observable<{ id: number; status: string }> {
    return this.apollo
      .mutate<{ approveTicketAsDirector: { id: number; ticketNumber: string; status: string } }>({
        mutation: APPROVE_TICKET_AS_DIRECTOR,
        variables: { ticketId, comment },
      })
      .pipe(
        map((result) => {
          if (!result.data?.approveTicketAsDirector) {
            throw new Error('Failed to approve ticket');
          }
          return result.data.approveTicketAsDirector;
        })
      );
  }

  /**
   * Disapprove/Reject ticket as director
   * Requires a reason for the rejection
   */
  disapproveAsDirector(ticketId: number, reason: string): Observable<{ id: number; status: string }> {
    return this.apollo
      .mutate<{ disapproveTicketAsDirector: { id: number; ticketNumber: string; status: string } }>({
        mutation: DISAPPROVE_TICKET_AS_DIRECTOR,
        variables: { ticketId, reason },
      })
      .pipe(
        map((result) => {
          if (!result.data?.disapproveTicketAsDirector) {
            throw new Error('Failed to disapprove ticket');
          }
          return result.data.disapproveTicketAsDirector;
        })
      );
  }

  /**
   * Reopen a cancelled/rejected ticket for re-review
   * Only the original creator can reopen the ticket
   */
  reopenTicket(
    ticketId: number,
    input?: { updatedDescription?: string; comment?: string }
  ): Observable<{ id: number; status: string }> {
    return this.apollo
      .mutate<{ reopenTicket: { id: number; ticketNumber: string; status: string } }>({
        mutation: REOPEN_TICKET,
        variables: { ticketId, input },
      })
      .pipe(
        map((result) => {
          if (!result.data?.reopenTicket) {
            throw new Error('Failed to reopen ticket');
          }
          return result.data.reopenTicket;
        })
      );
  }

  // ========================================
  // ASSIGNMENT & STATUS METHODS
  // Used by MIS_HEAD/ITS_HEAD and DEVELOPER/TECHNICAL
  // ========================================

  /**
   * Assign a ticket to a staff member
   * Used by MIS_HEAD to assign to DEVELOPER, ITS_HEAD to assign to TECHNICAL
   */
  assignTicketToUser(ticketId: number, userId: number): Observable<TicketListItem> {
    return this.apollo
      .mutate<{ assignTicket: TicketListItem }>({
        mutation: ASSIGN_TICKET,
        variables: { ticketId, userId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.assignTicket) {
            throw new Error('Failed to assign ticket');
          }
          return result.data.assignTicket;
        })
      );
  }

  /**
   * Update ticket status
   * Used by DEVELOPER/TECHNICAL to mark IN_PROGRESS, ON_HOLD, RESOLVED
   */
  updateStatus(ticketId: number, status: string, comment?: string): Observable<{ id: number; status: string }> {
    return this.apollo
      .mutate<{ updateTicketStatus: { id: number; ticketNumber: string; status: string } }>({
        mutation: UPDATE_TICKET_STATUS,
        variables: { ticketId, input: { status, comment } },
      })
      .pipe(
        map((result) => {
          if (!result.data?.updateTicketStatus) {
            throw new Error('Failed to update ticket status');
          }
          return result.data.updateTicketStatus;
        })
      );
  }

  /**
   * Get users by a specific role (for assignment dropdown)
   * e.g., getDevelopersList() for MIS_HEAD
   */
  getUsersByRole(role: string): Observable<{ id: number; name: string; email: string; role: string }[]> {
    return this.apollo
      .query<{ usersByRole: { id: number; name: string; email: string; role: string }[] }>({
        query: USERS_BY_ROLE,
        variables: { role },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.usersByRole) {
            throw new Error('Failed to fetch users');
          }
          return result.data.usersByRole;
        })
      );
  }

  /**
   * Get users by multiple roles
   */
  getUsersByRoles(roles: string[]): Observable<{ id: number; name: string; email: string; role: string }[]> {
    return this.apollo
      .query<{ usersByRoles: { id: number; name: string; email: string; role: string }[] }>({
        query: USERS_BY_ROLES,
        variables: { roles },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.usersByRoles) {
            throw new Error('Failed to fetch users');
          }
          return result.data.usersByRoles;
        })
      );
  }

  /**
   * Get tickets assigned to the current user
   * Used by DEVELOPER/TECHNICAL to see their work queue
   */
  getMyAssignedTickets(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ myTickets: TicketListItem[] }>({
        query: MY_ASSIGNED_TICKETS,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.myTickets) {
            throw new Error('Failed to fetch assigned tickets');
          }
          return result.data.myTickets;
        })
      );
  }

  // ========================================
  // SCHEDULE WORKFLOW METHODS
  // ========================================

  /**
   * Get tickets pending acknowledgment (for Admin/Director)
   */
  getTicketsPendingAcknowledgment(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ ticketsPendingAcknowledgment: TicketListItem[] }>({
        query: TICKETS_PENDING_ACKNOWLEDGMENT,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.ticketsPendingAcknowledgment) {
            throw new Error('Failed to fetch pending acknowledgment tickets');
          }
          return result.data.ticketsPendingAcknowledgment;
        })
      );
  }

  /**
   * Schedule a visit (for MIS_HEAD/ITS_HEAD)
   * Sets dateToVisit and targetCompletionDate
   */
  scheduleVisit(
    ticketId: number,
    dateToVisit: string,
    targetCompletionDate: string,
    comment?: string
  ): Observable<{ id: number; ticketNumber: string; status: string }> {
    return this.apollo
      .mutate<{ scheduleVisit: { id: number; ticketNumber: string; status: string } }>({
        mutation: SCHEDULE_VISIT,
        variables: {
          ticketId,
          input: { dateToVisit, targetCompletionDate, comment },
        },
      })
      .pipe(
        map((result) => {
          if (!result.data?.scheduleVisit) {
            throw new Error('Failed to schedule visit');
          }
          return result.data.scheduleVisit;
        })
      );
  }

  /**
   * Acknowledge schedule (for Admin/Director)
   */
  acknowledgeSchedule(
    ticketId: number,
    comment?: string
  ): Observable<{ id: number; ticketNumber: string; status: string }> {
    return this.apollo
      .mutate<{ acknowledgeSchedule: { id: number; ticketNumber: string; status: string } }>({
        mutation: ACKNOWLEDGE_SCHEDULE,
        variables: { ticketId, comment },
      })
      .pipe(
        map((result) => {
          if (!result.data?.acknowledgeSchedule) {
            throw new Error('Failed to acknowledge schedule');
          }
          return result.data.acknowledgeSchedule;
        })
      );
  }

  /**
   * Reject schedule (for Admin/Director)
   */
  rejectSchedule(
    ticketId: number,
    reason: string
  ): Observable<{ id: number; ticketNumber: string; status: string }> {
    return this.apollo
      .mutate<{ rejectSchedule: { id: number; ticketNumber: string; status: string } }>({
        mutation: REJECT_SCHEDULE,
        variables: { ticketId, reason },
      })
      .pipe(
        map((result) => {
          if (!result.data?.rejectSchedule) {
            throw new Error('Failed to reject schedule');
          }
          return result.data.rejectSchedule;
        })
      );
  }

  /**
   * Add monitor notes and recommendations (for MIS_HEAD/ITS_HEAD after visit)
   */
  addMonitorAndRecommendations(
    ticketId: number,
    monitorNotes: string,
    recommendations: string,
    comment?: string
  ): Observable<{ id: number; ticketNumber: string; status: string }> {
    return this.apollo
      .mutate<{ addMonitorAndRecommendations: { id: number; ticketNumber: string; status: string } }>({
        mutation: ADD_MONITOR_AND_RECOMMENDATIONS,
        variables: {
          ticketId,
          input: { monitorNotes, recommendations, comment },
        },
      })
      .pipe(
        map((result) => {
          if (!result.data?.addMonitorAndRecommendations) {
            throw new Error('Failed to add monitor notes');
          }
          return result.data.addMonitorAndRecommendations;
        })
      );
  }
}
