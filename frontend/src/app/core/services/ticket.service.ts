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
      secretaryApprovedAt
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

const TICKET_BY_NUMBER = gql`
  query TicketByNumber($ticketNumber: String!) {
    ticketByNumber(ticketNumber: $ticketNumber) {
      id
      ticketNumber
      type
      title
      description
      status
      priority
      dueDate
      estimatedDuration
      actualDuration
      secretaryApprovedById
      secretaryApprovedAt
      directorApprovedById
      directorApprovedAt
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
  type: 'MIS' | 'ITS';
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate?: string;
  secretaryApprovedAt?: string;
  directorApprovedAt?: string;
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
  secretaryApprovedById?: number;
  directorApprovedById?: number;
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
}
