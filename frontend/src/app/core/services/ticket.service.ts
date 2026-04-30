import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable, filter } from 'rxjs';
import { AuthService } from './auth.service';

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
 * Now also supports optional schedule dates (dateToVisit, targetCompletionDate)
 */
const ASSIGN_TICKET = gql`
  mutation AssignTicket($ticketId: Int!, $userId: Int!, $input: AssignTicketInput) {
    assignTicket(ticketId: $ticketId, userId: $userId, input: $input) {
      id
      ticketNumber
      status
      dateToVisit
      targetCompletionDate
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
 * Also supports optional targetCompletionDate update
 */
const UPDATE_TICKET_STATUS = gql`
  mutation UpdateTicketStatus($ticketId: Int!, $input: UpdateTicketStatusInput!) {
    updateTicketStatus(ticketId: $ticketId, input: $input) {
      id
      ticketNumber
      status
      targetCompletionDate
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
  query MyTickets($pagination: PaginationInput) {
    myTickets(pagination: $pagination) {
      items {
        id
        ticketNumber
        type
        title
        description
        status
        priority
        dueDate
        dateToVisit
        targetCompletionDate
        assignedDeveloperName
        resolution
        dateFinished
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
      totalCount
      page
      pageSize
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
`;

const ALL_TICKETS = gql`
  query AllTickets($pagination: PaginationInput) {
    tickets(pagination: $pagination) {
      items {
        id
        ticketNumber
        type
        title
        description
        status
        priority
        dueDate
        dateToVisit
        targetCompletionDate
        secretaryReviewedAt
        directorApprovedAt
        assignedDeveloperName
        resolution
        dateFinished
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
      totalCount
      page
      pageSize
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
`;

const MY_CREATED_TICKETS = gql`
  query MyCreatedTickets($pagination: PaginationInput) {
    myCreatedTickets(pagination: $pagination) {
      items {
        id
        ticketNumber
        type
        title
        description
        status
        priority
        dueDate
        dateToVisit
        targetCompletionDate
        secretaryReviewedAt
        directorApprovedAt
        assignedDeveloperName
        resolution
        dateFinished
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
      totalCount
      page
      pageSize
      totalPages
      hasNextPage
      hasPreviousPage
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
  query AllSecretaryTickets($pagination: PaginationInput) {
    allSecretaryTickets(pagination: $pagination) {
      items {
        id
        ticketNumber
        type
        title
        description
        status
        priority
        dueDate
        dateToVisit
        targetCompletionDate
        secretaryReviewedAt
        secretaryReviewedById
        directorApprovedAt
        directorApprovedById
        assignedDeveloperName
        resolution
        dateFinished
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
      totalCount
      page
      pageSize
      totalPages
      hasNextPage
      hasPreviousPage
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
 * Mutation for head to acknowledge ticket and assign developer
 */
const ACKNOWLEDGE_AND_ASSIGN_DEVELOPER = gql`
  mutation AcknowledgeAndAssignDeveloper($ticketId: Int!, $input: AcknowledgeAndAssignInput!) {
    acknowledgeAndAssignDeveloper(ticketId: $ticketId, input: $input) {
      id
      ticketNumber
      status
      assignedDeveloperName
      dateToVisit
      targetCompletionDate
    }
  }
`;

/**
 * Mutation for head to update resolution
 */
const UPDATE_RESOLUTION = gql`
  mutation UpdateResolution($ticketId: Int!, $input: UpdateResolutionInput!) {
    updateResolution(ticketId: $ticketId, input: $input) {
      id
      ticketNumber
      status
      resolution
      dateFinished
    }
  }
`;

/**
 * Query for office head tickets by type
 */
const OFFICE_HEAD_TICKETS = gql`
  query OfficeHeadTickets($type: TicketType!) {
    officeHeadTickets(type: $type) {
      items {
        id
        ticketNumber
        type
        title
        status
        priority
        assignedDeveloperName
        dateToVisit
        targetCompletionDate
        resolution
        dateFinished
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
      totalCount
      page
      pageSize
      totalPages
      hasNextPage
      hasPreviousPage
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
      assignedDeveloperName
      resolution
      dateFinished
      escalatedAt
      escalationLevel
      satisfactionRating
      satisfactionComment
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
      attachments {
        id
        ticketId
        filename
        originalName
        mimeType
        size
        url
        uploadedBy {
          id
          name
          role
        }
        isDeleted
        deletedAt
        deletedBy {
          id
          name
          role
        }
        createdAt
      }
    }
  }
`;

const DELETE_TICKET_ATTACHMENT = gql`
  mutation DeleteTicketAttachment($attachmentId: Int!) {
    deleteTicketAttachment(attachmentId: $attachmentId)
  }
`;

const SUBMIT_SATISFACTION = gql`
  mutation SubmitSatisfaction($ticketId: Int!, $input: SubmitSatisfactionInput!) {
    submitSatisfaction(ticketId: $ticketId, input: $input) {
      id
      satisfactionRating
      satisfactionComment
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

export interface TicketAttachment {
  id: number;
  ticketId: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy?: {
    id: number;
    name: string;
    role: string;
  };
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: {
    id: number;
    name: string;
    role: string;
  };
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
  // Simplified workflow fields
  dateToVisit?: string;
  targetCompletionDate?: string;
  assignedDeveloperName?: string;
  resolution?: string;
  dateFinished?: string;
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
  // Notes from users/staff
  notes?: Array<{
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
  // Status change history with comments
  statusHistory?: Array<{
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

/**
 * Paginated response from the backend.
 * Matches the PaginatedTickets GraphQL type.
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Pagination parameters for list queries.
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: string;
}

export interface TicketDetail extends TicketListItem {
  estimatedDuration?: number;
  actualDuration?: number;
  secretaryReviewedById?: number;
  directorApprovedById?: number;
  escalatedAt?: string;
  escalationLevel?: number;
  satisfactionRating?: number;
  satisfactionComment?: string;
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
  attachments: TicketAttachment[];
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
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  /** Base URL for REST API (derived from GraphQL URL) */
  private get apiBaseUrl(): string {
    // GraphQL URL is like http://localhost:4000/graphql, we need http://localhost:4000
    const graphqlUrl = 'http://localhost:4000'; // same origin as backend
    return graphqlUrl;
  }

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
        }),
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
        }),
      );
  }

  getMyCreatedTickets(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ myCreatedTickets: PaginatedResponse<TicketListItem> }>({
        query: MY_CREATED_TICKETS,
        variables: { pagination: { page: 1, pageSize: 100 } },
        fetchPolicy: 'network-only', // Always fetch fresh data
      })
      .pipe(
        map((result) => {
          if (!result.data?.myCreatedTickets) {
            throw new Error('Failed to fetch tickets');
          }
          return result.data.myCreatedTickets.items;
        }),
      );
  }

  /**
   * Get all tickets in the system (for admin/office head)
   */
  getAllTickets(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ tickets: PaginatedResponse<TicketListItem> }>({
        query: ALL_TICKETS,
        variables: { pagination: { page: 1, pageSize: 100 } },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.tickets) {
            throw new Error('Failed to fetch all tickets');
          }
          return result.data.tickets.items;
        }),
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
        }),
      );
  }

  addTicketNote(ticketId: number, input: CreateTicketNoteInput): Observable<TicketNote> {
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
        }),
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
        }),
      );
  }

  /**
   * Get all secretary-related tickets (FOR_REVIEW + REVIEWED)
   * For admin/director oversight
   */
  getAllSecretaryTickets(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ allSecretaryTickets: PaginatedResponse<TicketListItem> }>({
        query: ALL_SECRETARY_TICKETS,
        variables: { pagination: { page: 1, pageSize: 100 } },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.allSecretaryTickets) {
            throw new Error('Failed to fetch all secretary tickets');
          }
          return result.data.allSecretaryTickets.items;
        }),
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
        }),
      );
  }

  /**
   * Review ticket as secretary
   */
  reviewAsSecretary(
    ticketId: number,
    comment?: string,
  ): Observable<{ id: number; status: string }> {
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
        }),
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
        }),
      );
  }

  /**
   * Approve ticket as director
   */
  approveAsDirector(
    ticketId: number,
    comment?: string,
  ): Observable<{ id: number; status: string }> {
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
        }),
      );
  }

  /**
   * Disapprove/Reject ticket as director
   * Requires a reason for the rejection
   */
  disapproveAsDirector(
    ticketId: number,
    reason: string,
  ): Observable<{ id: number; status: string }> {
    return this.apollo
      .mutate<{ disapproveTicketAsDirector: { id: number; ticketNumber: string; status: string } }>(
        {
          mutation: DISAPPROVE_TICKET_AS_DIRECTOR,
          variables: { ticketId, reason },
        },
      )
      .pipe(
        map((result) => {
          if (!result.data?.disapproveTicketAsDirector) {
            throw new Error('Failed to disapprove ticket');
          }
          return result.data.disapproveTicketAsDirector;
        }),
      );
  }

  /**
   * Reopen a cancelled/rejected ticket for re-review
   * Only the original creator can reopen the ticket
   */
  reopenTicket(
    ticketId: number,
    input?: { updatedDescription?: string; comment?: string },
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
        }),
      );
  }

  // ========================================
  // ASSIGNMENT & STATUS METHODS
  // Used by MIS_HEAD/ITS_HEAD and DEVELOPER/TECHNICAL
  // ========================================

  /**
   * Assign a ticket to a staff member
   * Used by MIS_HEAD to assign to DEVELOPER, ITS_HEAD to assign to TECHNICAL
   * @param ticketId - The ticket to assign
   * @param userId - The staff member to assign to
   * @param options - Optional: dateToVisit, targetCompletionDate, comment (not required)
   */
  assignTicketToUser(
    ticketId: number,
    userId: number,
    options?: { dateToVisit?: string; targetCompletionDate?: string; comment?: string },
  ): Observable<TicketListItem> {
    // Build the input object only if options are provided (dateToVisit, targetCompletionDate, comment)
    // Note: userId is passed as a separate parameter, not inside input
    const input = options
      ? {
          dateToVisit: options.dateToVisit || undefined,
          targetCompletionDate: options.targetCompletionDate || undefined,
          comment: options.comment || undefined,
        }
      : undefined;

    return this.apollo
      .mutate<{ assignTicket: TicketListItem }>({
        mutation: ASSIGN_TICKET,
        variables: { ticketId, userId, input },
      })
      .pipe(
        map((result) => {
          if (!result.data?.assignTicket) {
            throw new Error('Failed to assign ticket');
          }
          return result.data.assignTicket;
        }),
      );
  }

  /**
   * Update ticket status
   * Used by DEVELOPER/TECHNICAL to mark IN_PROGRESS, ON_HOLD, RESOLVED
   * @param ticketId - The ticket to update
   * @param status - The new status
   * @param comment - Optional comment about the status change
   * @param targetCompletionDate - Optional: developer can update the target completion date
   */
  updateStatus(
    ticketId: number,
    status: string,
    comment?: string,
    targetCompletionDate?: string,
  ): Observable<{ id: number; status: string }> {
    // Build input - only include targetCompletionDate if provided
    const input: any = { status, comment };
    if (targetCompletionDate) {
      input.targetCompletionDate = targetCompletionDate;
    }

    return this.apollo
      .mutate<{ updateTicketStatus: { id: number; ticketNumber: string; status: string } }>({
        mutation: UPDATE_TICKET_STATUS,
        variables: { ticketId, input },
      })
      .pipe(
        map((result) => {
          if (!result.data?.updateTicketStatus) {
            throw new Error('Failed to update ticket status');
          }
          return result.data.updateTicketStatus;
        }),
      );
  }

  /**
   * Get users by a specific role (for assignment dropdown)
   * e.g., getDevelopersList() for MIS_HEAD
   */
  getUsersByRole(
    role: string,
  ): Observable<{ id: number; name: string; email: string; role: string }[]> {
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
        }),
      );
  }

  /**
   * Get users by multiple roles
   */
  getUsersByRoles(
    roles: string[],
  ): Observable<{ id: number; name: string; email: string; role: string }[]> {
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
        }),
      );
  }

  /**
   * Get tickets assigned to the current user
   * Used by DEVELOPER/TECHNICAL to see their work queue
   */
  getMyAssignedTickets(): Observable<TicketListItem[]> {
    return this.apollo
      .query<{ myTickets: PaginatedResponse<TicketListItem> }>({
        query: MY_ASSIGNED_TICKETS,
        variables: { pagination: { page: 1, pageSize: 100 } },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.myTickets) {
            throw new Error('Failed to fetch assigned tickets');
          }
          return result.data.myTickets.items;
        }),
      );
  }

  // ========================================
  // HEAD WORKFLOW METHODS (Simplified)
  // ========================================

  /**
   * Head acknowledges ticket and assigns developer name
   * Transitions: ASSIGNED → PENDING
   */
  acknowledgeAndAssignDeveloper(
    ticketId: number,
    input: {
      assignedDeveloperName: string;
      assignToUserId?: number;
      dateToVisit?: string;
      targetCompletionDate?: string;
      comment?: string;
    },
  ): Observable<{
    id: number;
    ticketNumber: string;
    status: string;
    assignedDeveloperName: string;
  }> {
    return this.apollo
      .mutate<{
        acknowledgeAndAssignDeveloper: {
          id: number;
          ticketNumber: string;
          status: string;
          assignedDeveloperName: string;
        };
      }>({
        mutation: ACKNOWLEDGE_AND_ASSIGN_DEVELOPER,
        variables: {
          ticketId,
          input,
        },
      })
      .pipe(
        map((result) => {
          if (!result.data?.acknowledgeAndAssignDeveloper) {
            throw new Error('Failed to acknowledge and assign developer');
          }
          return result.data.acknowledgeAndAssignDeveloper;
        }),
      );
  }

  /**
   * Head updates resolution after developer finishes work
   */
  updateResolution(
    ticketId: number,
    input: {
      resolution: string;
      dateFinished?: string;
      status?: string;
      comment?: string;
      solutionVisibility?: string;
    },
  ): Observable<{ id: number; ticketNumber: string; status: string }> {
    return this.apollo
      .mutate<{
        updateResolution: { id: number; ticketNumber: string; status: string };
      }>({
        mutation: UPDATE_RESOLUTION,
        variables: {
          ticketId,
          input,
        },
      })
      .pipe(
        map((result) => {
          if (!result.data?.updateResolution) {
            throw new Error('Failed to update resolution');
          }
          return result.data.updateResolution;
        }),
      );
  }

  /**
   * Get office head tickets by type
   */
  getOfficeHeadTickets(type: 'MIS' | 'ITS'): Observable<any> {
    return this.apollo
      .query<{ officeHeadTickets: any }>({
        query: OFFICE_HEAD_TICKETS,
        variables: { type },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.officeHeadTickets) {
            throw new Error('Failed to fetch office head tickets');
          }
          return result.data.officeHeadTickets;
        }),
      );
  }

  // ========================================
  // ATTACHMENT METHODS
  // ========================================

  /**
   * Upload files as attachments to a ticket
   * Uses REST endpoint since GraphQL doesn't handle multipart uploads well
   * @param ticketId - ID of the ticket to attach files to
   * @param files - FileList or File array to upload
   * @param onProgress - Optional callback for upload progress (0-100)
   * @returns Observable with the created attachment records
   */
  uploadAttachments(
    ticketId: number,
    files: File[],
    onProgress?: (percent: number) => void,
  ): Observable<{ success: boolean; attachments: TicketAttachment[] }> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const token = this.authService.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http
      .post<{
        success: boolean;
        attachments: TicketAttachment[];
      }>(`${this.apiBaseUrl}/upload/ticket-attachments?ticketId=${ticketId}`, formData, {
        headers,
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        map((event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const percent = Math.round((event.loaded / event.total) * 100);
            if (onProgress) onProgress(percent);
            // Return null for progress events (will be filtered out)
            return null as any;
          }
          if (event.type === HttpEventType.Response) {
            if (onProgress) onProgress(100);
            return event.body as { success: boolean; attachments: TicketAttachment[] };
          }
          return null as any;
        }),
        // Filter out null progress events, only emit the final response
        filter(
          (result): result is { success: boolean; attachments: TicketAttachment[] } =>
            result !== null,
        ),
      );
  }

  /**
   * Delete a ticket attachment
   * @param attachmentId - ID of the attachment to delete
   */
  deleteAttachment(attachmentId: number): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteTicketAttachment: boolean }>({
        mutation: DELETE_TICKET_ATTACHMENT,
        variables: { attachmentId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.deleteTicketAttachment) {
            throw new Error('Failed to delete attachment');
          }
          return result.data.deleteTicketAttachment;
        }),
      );
  }

  /**
   * Submit satisfaction survey for a resolved/closed ticket
   */
  submitSatisfaction(ticketId: number, rating: number, comment?: string): Observable<any> {
    return this.apollo
      .mutate<{ submitSatisfaction: any }>({
        mutation: SUBMIT_SATISFACTION,
        variables: { ticketId, input: { rating, comment: comment || null } },
      })
      .pipe(
        map((result) => {
          if (!result.data?.submitSatisfaction) {
            throw new Error('Failed to submit satisfaction survey');
          }
          return result.data.submitSatisfaction;
        }),
      );
  }
}
