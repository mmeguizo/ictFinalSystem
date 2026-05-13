import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable } from 'rxjs';

// ========================================
// GraphQL Operations
// ========================================

const GET_CHAT_SESSIONS = gql`
  query GetChatSessions {
    chatSessions {
      id
      title
      status
      ticketId
      messageCount
      createdAt
      updatedAt
    }
  }
`;

const GET_CHAT_SESSION = gql`
  query GetChatSession($id: Int!) {
    chatSession(id: $id) {
      id
      title
      status
      ticketId
      messageCount
      createdAt
      updatedAt
      messages {
        id
        sessionId
        role
        content
        metadata
        createdAt
      }
    }
  }
`;

const CREATE_CHAT_SESSION = gql`
  mutation CreateChatSession($title: String) {
    createChatSession(title: $title) {
      id
      title
      status
      createdAt
      updatedAt
    }
  }
`;

const SEND_CHAT_MESSAGE = gql`
  mutation SendChatMessage($sessionId: Int!, $message: String!) {
    sendChatMessage(sessionId: $sessionId, message: $message) {
      reply
      metadata
      session {
        id
        title
        status
        ticketId
        messageCount
        createdAt
        updatedAt
      }
    }
  }
`;

const CREATE_TICKET_FROM_CHAT = gql`
  mutation CreateTicketFromChat($input: CreateTicketFromChatInput!) {
    createTicketFromChat(input: $input) {
      id
      ticketNumber
      title
      status
      type
      priority
    }
  }
`;

const DELETE_CHAT_SESSION = gql`
  mutation DeleteChatSession($id: Int!) {
    deleteChatSession(id: $id)
  }
`;

// ========================================
// Interfaces
// ========================================

export interface ChatSession {
  id: number;
  title: string;
  status: 'ACTIVE' | 'CLOSED' | 'TICKET_CREATED';
  ticketId: number | null;
  messageCount: number;
  messages?: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  sessionId: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata: string | null;
  createdAt: string;
}

export interface ChatResponse {
  reply: string;
  metadata: string | null;
  session: ChatSession;
}

export interface TicketFromChat {
  id: number;
  ticketNumber: string;
  title: string;
  status: string;
  type: string;
  priority: string;
}

// ========================================
// Service
// ========================================

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly apollo = inject(Apollo);

  getSessions(): Observable<ChatSession[]> {
    return this.apollo
      .query<{ chatSessions: ChatSession[] }>({
        query: GET_CHAT_SESSIONS,
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data!.chatSessions));
  }

  getSession(id: number): Observable<ChatSession> {
    return this.apollo
      .query<{ chatSession: ChatSession }>({
        query: GET_CHAT_SESSION,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data!.chatSession));
  }

  createSession(title?: string): Observable<ChatSession> {
    return this.apollo
      .mutate<{ createChatSession: ChatSession }>({
        mutation: CREATE_CHAT_SESSION,
        variables: { title },
      })
      .pipe(
        map((r) => {
          if (!r.data?.createChatSession) throw new Error('Failed to create chat session');
          return r.data.createChatSession;
        }),
      );
  }

  sendMessage(sessionId: number, message: string): Observable<ChatResponse> {
    return this.apollo
      .mutate<{ sendChatMessage: ChatResponse }>({
        mutation: SEND_CHAT_MESSAGE,
        variables: { sessionId, message },
      })
      .pipe(
        map((r) => {
          if (!r.data?.sendChatMessage) throw new Error('Failed to send message');
          return r.data.sendChatMessage;
        }),
      );
  }

  createTicketFromChat(input: {
    sessionId: number;
    title: string;
    description: string;
    type: string;
    priority?: string;
  }): Observable<TicketFromChat> {
    return this.apollo
      .mutate<{ createTicketFromChat: TicketFromChat }>({
        mutation: CREATE_TICKET_FROM_CHAT,
        variables: { input },
      })
      .pipe(
        map((r) => {
          if (!r.data?.createTicketFromChat) throw new Error('Failed to create ticket from chat');
          return r.data.createTicketFromChat;
        }),
      );
  }

  deleteSession(id: number): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteChatSession: boolean }>({
        mutation: DELETE_CHAT_SESSION,
        variables: { id },
      })
      .pipe(map((r) => !!r.data?.deleteChatSession));
  }
}
