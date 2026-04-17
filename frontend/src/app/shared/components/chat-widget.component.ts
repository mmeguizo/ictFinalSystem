import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ChatService, ChatSession, ChatMessage } from '../../core/services/chat.service';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzDrawerModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    NzEmptyModule,
    NzBadgeModule,
    NzToolTipModule,
    NzPopconfirmModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Floating Chat Button -->
    <button
      class="chat-fab"
      nz-button
      nzType="primary"
      nzShape="circle"
      nzSize="large"
      nz-tooltip
      nzTooltipTitle="AI Support Chat"
      (click)="toggleDrawer()"
    >
      <span nz-icon [nzType]="isOpen() ? 'close' : 'message'" nzTheme="outline"></span>
    </button>

    <!-- Chat Drawer -->
    <nz-drawer
      [nzVisible]="isOpen()"
      [nzWidth]="420"
      nzPlacement="right"
      [nzClosable]="false"
      [nzMask]="true"
      [nzMaskClosable]="true"
      [nzMaskStyle]="{ background: 'transparent' }"
      (nzOnClose)="isOpen.set(false)"
      nzWrapClassName="chat-drawer-wrapper"
    >
      <ng-container *nzDrawerContent>
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-header-left">
            @if (activeSession()) {
              <button nz-button nzType="text" nzSize="small" (click)="backToSessions()">
                <span nz-icon nzType="arrow-left"></span>
              </button>
              <span class="chat-header-title">{{ activeSession()!.title }}</span>
            } @else {
              <span nz-icon nzType="robot" nzTheme="outline" class="header-icon"></span>
              <span class="chat-header-title">ICT AI Assistant</span>
            }
          </div>
          <div class="chat-header-actions">
            @if (!activeSession()) {
              <button nz-button nzType="primary" nzSize="small" (click)="startNewChat()">
                <span nz-icon nzType="plus"></span> New Chat
              </button>
            }
            <button nz-button nzType="text" nzSize="small" (click)="isOpen.set(false)">
              <span nz-icon nzType="close"></span>
            </button>
          </div>
        </div>

        <!-- Session List View -->
        @if (!activeSession()) {
          <div class="chat-session-list">
            @if (loadingSessions()) {
              <div class="chat-loading"><nz-spin nzSimple></nz-spin></div>
            } @else if (sessions().length === 0) {
              <div class="chat-empty">
                <nz-empty nzNotFoundImage="simple" [nzNotFoundContent]="'No conversations yet'">
                </nz-empty>
                <button nz-button nzType="primary" (click)="startNewChat()" class="start-btn">
                  <span nz-icon nzType="message"></span> Start a conversation
                </button>
              </div>
            } @else {
              @for (s of sessions(); track s.id) {
                <div class="session-item" (click)="openSession(s)">
                  <div class="session-info">
                    <span class="session-title">{{ s.title }}</span>
                    <span class="session-meta">
                      {{ s.messageCount }} messages · {{ formatDate(s.updatedAt) }}
                    </span>
                  </div>
                  <div class="session-actions">
                    @if (s.status === 'TICKET_CREATED') {
                      <span
                        nz-icon
                        nzType="check-circle"
                        nzTheme="twotone"
                        [nzTwotoneColor]="'#52c41a'"
                        nz-tooltip
                        nzTooltipTitle="Ticket created"
                      ></span>
                    }
                    <button
                      nz-button
                      nzType="text"
                      nzSize="small"
                      nzDanger
                      nz-popconfirm
                      nzPopconfirmTitle="Delete this conversation?"
                      (nzOnConfirm)="deleteSession(s.id)"
                      (click)="$event.stopPropagation()"
                    >
                      <span nz-icon nzType="delete"></span>
                    </button>
                  </div>
                </div>
              }
            }
          </div>
        }

        <!-- Active Chat View -->
        @if (activeSession()) {
          <div class="chat-messages" #messagesContainer>
            @if (loadingMessages()) {
              <div class="chat-loading"><nz-spin nzSimple></nz-spin></div>
            } @else {
              @if (messages().length === 0) {
                <div class="chat-welcome">
                  <span nz-icon nzType="robot" nzTheme="outline" class="welcome-icon"></span>
                  <h3>How can I help you?</h3>
                  <p>
                    Ask about any ICT issue — I'll try to find a solution from our knowledge base.
                    If I can't help, I'll create a support ticket for you.
                  </p>
                  <div class="quick-prompts">
                    <button
                      nz-button
                      nzSize="small"
                      (click)="sendQuick('My internet is not working')"
                    >
                      🌐 Internet issues
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      (click)="sendQuick('My printer is not printing')"
                    >
                      🖨️ Printer problems
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      (click)="sendQuick('What is the status of my tickets?')"
                    >
                      📋 Check ticket status
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      (click)="sendQuick('I need software installed')"
                    >
                      💿 Software install
                    </button>
                  </div>
                </div>
              }

              @for (msg of messages(); track msg.id) {
                <div class="message" [class]="'message-' + msg.role.toLowerCase()">
                  @if (msg.role === 'ASSISTANT') {
                    <div class="message-avatar">
                      <span nz-icon nzType="robot" nzTheme="outline"></span>
                    </div>
                  }
                  <div class="message-bubble" [innerHTML]="renderMarkdown(msg.content)"></div>
                  @if (msg.role === 'USER') {
                    <div class="message-avatar user">
                      <span nz-icon nzType="user" nzTheme="outline"></span>
                    </div>
                  }
                </div>

                <!-- Check for ticket-data in assistant message -->
                @if (msg.role === 'ASSISTANT' && hasTicketData(msg.content)) {
                  <div class="ticket-action">
                    <button
                      nz-button
                      nzType="primary"
                      nzSize="small"
                      (click)="createTicketFromMessage(msg.content)"
                      [nzLoading]="creatingTicket()"
                    >
                      <span nz-icon nzType="plus-circle"></span> Create Support Ticket
                    </button>
                  </div>
                }
              }

              @if (sending()) {
                <div class="message message-assistant">
                  <div class="message-avatar">
                    <span nz-icon nzType="robot" nzTheme="outline"></span>
                  </div>
                  <div class="message-bubble typing">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Input Area -->
          <div class="chat-input-area">
            <nz-input-group [nzSuffix]="sendBtn">
              <input
                nz-input
                [(ngModel)]="inputMessage"
                placeholder="Type your message..."
                (keydown.enter)="send()"
                [disabled]="sending()"
              />
            </nz-input-group>
            <ng-template #sendBtn>
              <button
                nz-button
                nzType="text"
                nzSize="small"
                [disabled]="!inputMessage.trim() || sending()"
                (click)="send()"
              >
                <span nz-icon nzType="send" nzTheme="outline"></span>
              </button>
            </ng-template>
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .chat-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 1000;
        width: 56px;
        height: 56px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;

        span[nz-icon] {
          font-size: 24px;
        }
      }

      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
        background: #fafafa;
      }

      .chat-header-left {
        display: flex;
        align-items: center;
        gap: 8px;

        .header-icon {
          font-size: 20px;
          color: #1890ff;
        }
        .chat-header-title {
          font-weight: 600;
          font-size: 15px;
        }
      }

      .chat-header-actions {
        display: flex;
        gap: 4px;
      }

      /* Session list */
      .chat-session-list {
        height: calc(100vh - 57px);
        overflow-y: auto;
        padding: 8px;
      }

      .session-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        margin-bottom: 4px;

        &:hover {
          background: #f5f5f5;
        }
      }

      .session-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }

      .session-title {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .session-meta {
        font-size: 12px;
        color: #8c8c8c;
      }

      .session-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Chat messages */
      .chat-messages {
        height: calc(100vh - 57px - 56px);
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .chat-loading,
      .chat-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 16px;
      }

      .start-btn {
        margin-top: 8px;
      }

      .chat-welcome {
        text-align: center;
        padding: 32px 16px;

        .welcome-icon {
          font-size: 48px;
          color: #1890ff;
          margin-bottom: 16px;
        }
        h3 {
          margin: 8px 0;
        }
        p {
          color: #8c8c8c;
          margin-bottom: 16px;
        }
      }

      .quick-prompts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
      }

      .message {
        display: flex;
        gap: 8px;
        max-width: 100%;

        &.message-user {
          justify-content: flex-end;
        }

        &.message-system {
          justify-content: center;
          .message-bubble {
            background: #fffbe6;
            border: 1px solid #ffe58f;
            color: #614700;
            font-size: 13px;
            max-width: 90%;
          }
        }
      }

      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #e6f7ff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        span[nz-icon] {
          font-size: 16px;
          color: #1890ff;
        }

        &.user {
          background: #f6ffed;
          span[nz-icon] {
            color: #52c41a;
          }
        }
      }

      .message-bubble {
        padding: 10px 14px;
        border-radius: 12px;
        line-height: 1.5;
        word-break: break-word;
        max-width: 80%;
      }

      .message-user .message-bubble {
        background: #1890ff;
        color: white;
        border-bottom-right-radius: 4px;
      }

      .message-assistant .message-bubble {
        background: #f0f0f0;
        color: #262626;
        border-bottom-left-radius: 4px;

        :host ::ng-deep {
          p {
            margin: 0 0 8px;
            &:last-child {
              margin: 0;
            }
          }
          ul,
          ol {
            margin: 4px 0;
            padding-left: 20px;
          }
          code {
            background: #e8e8e8;
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 13px;
          }
          pre {
            background: #262626;
            color: #e8e8e8;
            padding: 8px 12px;
            border-radius: 6px;
            overflow-x: auto;
          }
          strong {
            font-weight: 600;
          }
        }
      }

      .typing {
        display: flex;
        gap: 4px;
        padding: 12px 16px;

        .dot {
          width: 8px;
          height: 8px;
          background: #8c8c8c;
          border-radius: 50%;
          animation: typing 1.4s infinite;

          &:nth-child(2) {
            animation-delay: 0.2s;
          }
          &:nth-child(3) {
            animation-delay: 0.4s;
          }
        }
      }

      @keyframes typing {
        0%,
        60%,
        100% {
          transform: translateY(0);
          opacity: 0.4;
        }
        30% {
          transform: translateY(-6px);
          opacity: 1;
        }
      }

      .ticket-action {
        display: flex;
        justify-content: center;
        margin: 4px 0;
      }

      /* Input area */
      .chat-input-area {
        padding: 12px 16px;
        border-top: 1px solid #f0f0f0;
        background: #fafafa;
      }
    `,
  ],
})
export class ChatWidgetComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  private readonly chatService = inject(ChatService);
  private readonly message = inject(NzMessageService);
  private shouldScroll = false;

  // State
  readonly isOpen = signal(false);
  readonly sessions = signal<ChatSession[]>([]);
  readonly activeSession = signal<ChatSession | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly loadingSessions = signal(false);
  readonly loadingMessages = signal(false);
  readonly sending = signal(false);
  readonly creatingTicket = signal(false);

  inputMessage = '';

  toggleDrawer() {
    const open = !this.isOpen();
    this.isOpen.set(open);
    if (open && this.sessions().length === 0) {
      this.loadSessions();
    }
  }

  loadSessions() {
    this.loadingSessions.set(true);
    this.chatService.getSessions().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loadingSessions.set(false);
      },
      error: () => {
        this.message.error('Failed to load chat sessions');
        this.loadingSessions.set(false);
      },
    });
  }

  startNewChat() {
    this.chatService.createSession().subscribe({
      next: (session) => {
        this.sessions.update((s) => [session, ...s]);
        this.activeSession.set(session);
        this.messages.set([]);
      },
      error: () => this.message.error('Failed to start new chat'),
    });
  }

  openSession(session: ChatSession) {
    this.activeSession.set(session);
    this.loadingMessages.set(true);
    this.chatService.getSession(session.id).subscribe({
      next: (full) => {
        this.messages.set(full.messages || []);
        this.loadingMessages.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.message.error('Failed to load chat');
        this.loadingMessages.set(false);
      },
    });
  }

  backToSessions() {
    this.activeSession.set(null);
    this.messages.set([]);
    this.loadSessions();
  }

  send() {
    const text = this.inputMessage.trim();
    if (!text || this.sending()) return;

    const session = this.activeSession();
    if (!session) return;

    // Optimistically add user message
    const tempMsg: ChatMessage = {
      id: Date.now(),
      sessionId: session.id,
      role: 'USER',
      content: text,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    this.messages.update((m) => [...m, tempMsg]);
    this.inputMessage = '';
    this.sending.set(true);
    this.scrollToBottom();

    this.chatService.sendMessage(session.id, text).subscribe({
      next: (response) => {
        // Add assistant reply
        const assistantMsg: ChatMessage = {
          id: Date.now() + 1,
          sessionId: session.id,
          role: 'ASSISTANT',
          content: response.reply,
          metadata: response.metadata,
          createdAt: new Date().toISOString(),
        };
        this.messages.update((m) => [...m, assistantMsg]);

        // Update session info
        if (response.session) {
          this.activeSession.set(response.session);
        }
        this.sending.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.message.error('Failed to get AI response');
        this.sending.set(false);
      },
    });
  }

  sendQuick(text: string) {
    this.inputMessage = text;
    this.send();
  }

  deleteSession(id: number) {
    this.chatService.deleteSession(id).subscribe({
      next: () => {
        this.sessions.update((s) => s.filter((x) => x.id !== id));
        this.message.success('Chat deleted');
      },
      error: () => this.message.error('Failed to delete chat'),
    });
  }

  hasTicketData(content: string): boolean {
    return content.includes('```ticket-data');
  }

  createTicketFromMessage(content: string) {
    const match = content.match(/```ticket-data\s*([\s\S]*?)```/);
    if (!match) return;

    let ticketData: any;
    try {
      ticketData = JSON.parse(match[1].trim());
    } catch {
      this.message.error('Could not parse ticket data');
      return;
    }

    const session = this.activeSession();
    if (!session) return;

    this.creatingTicket.set(true);
    this.chatService
      .createTicketFromChat({
        sessionId: session.id,
        title: ticketData.title,
        description: ticketData.description,
        type: ticketData.type || 'ITS',
        priority: ticketData.priority,
      })
      .subscribe({
        next: (ticket) => {
          this.message.success(`Ticket ${ticket.ticketNumber} created!`);
          this.creatingTicket.set(false);

          // Add system message
          const sysMsg: ChatMessage = {
            id: Date.now(),
            sessionId: session.id,
            role: 'SYSTEM',
            content: `✅ Ticket **${ticket.ticketNumber}** has been created. You can track its status anytime by asking me.`,
            metadata: null,
            createdAt: new Date().toISOString(),
          };
          this.messages.update((m) => [...m, sysMsg]);
          this.activeSession.update((s) =>
            s ? { ...s, status: 'TICKET_CREATED', ticketId: ticket.id } : s,
          );
          this.scrollToBottom();
        },
        error: () => {
          this.message.error('Failed to create ticket');
          this.creatingTicket.set(false);
        },
      });
  }

  renderMarkdown(content: string): string {
    // Simple markdown rendering — bold, code, lists, links
    let html = content
      // Remove ticket-data blocks from display
      .replace(/```ticket-data[\s\S]*?```/g, '')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Numbered lists
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      // Bullet lists
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      // Paragraphs (double newline)
      .replace(/\n\n/g, '</p><p>')
      // Single newlines
      .replace(/\n/g, '<br>');
    // Wrap in paragraph
    if (!html.startsWith('<')) html = '<p>' + html + '</p>';
    return html;
  }

  formatDate(dateStr: string): string {
    const date = /^\d+$/.test(dateStr) ? new Date(parseInt(dateStr, 10)) : new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      const el = this.messagesContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
        this.shouldScroll = false;
      }
    }
  }

  private scrollToBottom() {
    this.shouldScroll = true;
  }
}
