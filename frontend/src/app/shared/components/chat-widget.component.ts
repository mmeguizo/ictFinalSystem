import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  inject,
  signal,
  computed,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../core/config/environment';

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
    <!-- Floating AI Chat Button — Redesigned -->
    <div class="chat-fab-wrapper" (click)="toggleDrawer()">
      <div class="chat-fab" [class.active]="isOpen()">
        <div class="fab-icon">
          <span nz-icon [nzType]="isOpen() ? 'close' : 'robot'" nzTheme="outline"></span>
        </div>
        <span class="fab-label" [class.hidden]="isOpen()">AI Assistant</span>
      </div>
      <div class="fab-pulse" [class.hidden]="isOpen()"></div>
    </div>

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
        <!-- Header — Gradient branded -->
        <div class="chat-header">
          <div class="chat-header-left">
            @if (activeSession()) {
              <button
                nz-button
                nzType="text"
                nzSize="small"
                class="back-btn"
                (click)="backToSessions()"
              >
                <span nz-icon nzType="arrow-left"></span>
              </button>
              <span class="chat-header-title">{{ activeSession()!.title }}</span>
            } @else {
              <div class="header-brand">
                <div class="brand-icon">
                  <span nz-icon nzType="robot" nzTheme="outline"></span>
                </div>
                <div class="brand-text">
                  <span class="chat-header-title">ICT AI Assistant</span>
                  <span class="header-subtitle">Powered by Gemini</span>
                </div>
              </div>
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
                  <div class="welcome-hero">
                    <div class="welcome-icon-wrapper">
                      <span nz-icon nzType="robot" nzTheme="outline" class="welcome-icon"></span>
                    </div>
                    <h3>Hi! I'm your ICT AI Assistant</h3>
                    <p>
                      @if (isStaffOrAdmin()) {
                        I can help you check analytics, generate reports, monitor SLA compliance,
                        troubleshoot issues, and search our knowledge base.
                      } @else {
                        I can troubleshoot your issues, look up solutions from our knowledge base,
                        or help you create a support ticket.
                      }
                    </p>
                  </div>
                  <div class="quick-categories">
                    <p class="quick-label">Common issues I can help with:</p>
                    <div class="quick-prompts">
                      <button class="quick-btn" (click)="sendQuick('My internet is not working')">
                        <span class="quick-emoji">🌐</span>
                        <span class="quick-text">Internet / Network</span>
                      </button>
                      <button class="quick-btn" (click)="sendQuick('My printer is not printing')">
                        <span class="quick-emoji">🖨️</span>
                        <span class="quick-text">Printer Issues</span>
                      </button>
                      <button
                        class="quick-btn"
                        (click)="sendQuick('I need software installed or updated')"
                      >
                        <span class="quick-emoji">💻</span>
                        <span class="quick-text">Software / Apps</span>
                      </button>
                      <button
                        class="quick-btn"
                        (click)="sendQuick('I have a problem with my account or password')"
                      >
                        <span class="quick-emoji">🔐</span>
                        <span class="quick-text">Account / Password</span>
                      </button>
                      <button
                        class="quick-btn"
                        (click)="sendQuick('What is the status of my tickets?')"
                      >
                        <span class="quick-emoji">📋</span>
                        <span class="quick-text">Check Ticket Status</span>
                      </button>
                      @if (isStaffOrAdmin()) {
                        <button
                          class="quick-btn"
                          (click)="sendQuick('Show me the ICT statistics and analytics')"
                        >
                          <span class="quick-emoji">📊</span>
                          <span class="quick-text">ICT Analytics</span>
                        </button>
                        <button
                          class="quick-btn"
                          (click)="sendQuick('Generate a full Excel report of all tickets')"
                        >
                          <span class="quick-emoji">📥</span>
                          <span class="quick-text">Download Report</span>
                        </button>
                        <button
                          class="quick-btn"
                          (click)="sendQuick('Show me overdue tickets and SLA warnings')"
                        >
                          <span class="quick-emoji">⚠️</span>
                          <span class="quick-text">SLA Warnings</span>
                        </button>
                      } @else {
                        <button
                          class="quick-btn"
                          (click)="sendQuick('I want to create a support ticket')"
                        >
                          <span class="quick-emoji">🎫</span>
                          <span class="quick-text">Create Ticket</span>
                        </button>
                      }
                    </div>
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
                  <div
                    class="message-bubble"
                    [innerHTML]="renderMarkdown(msg.content)"
                    (click)="onMessageClick($event)"
                  ></div>
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

      /* ── Floating AI Button (Redesigned) ──────────── */
      .chat-fab-wrapper {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 1000;
        cursor: pointer;
      }

      .chat-fab {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50px;
        color: #fff;
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        z-index: 2;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(102, 126, 234, 0.5);
        }

        &.active {
          padding: 12px;
          border-radius: 50%;
        }
      }

      .fab-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .fab-label {
        font-weight: 600;
        font-size: 14px;
        white-space: nowrap;
        transition: all 0.3s;
        &.hidden {
          display: none;
        }
      }

      .fab-pulse {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        border-radius: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        animation: fab-ping 2s cubic-bezier(0, 0, 0.2, 1) 3;
        z-index: 1;
        &.hidden {
          display: none;
        }
      }

      @keyframes fab-ping {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.5;
        }
        75%,
        100% {
          transform: translate(-50%, -50%) scale(1.6);
          opacity: 0;
        }
      }

      /* ── Header ─────────────────────────────────────── */
      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid #f0f0f0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
      }

      .chat-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }

      .back-btn {
        color: #fff !important;
      }

      .header-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .brand-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
      }

      .chat-header-title {
        font-weight: 600;
        font-size: 15px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .header-subtitle {
        font-size: 11px;
        opacity: 0.8;
      }

      .chat-header-actions {
        display: flex;
        gap: 4px;

        button {
          color: #fff !important;
        }
      }

      /* ── Session list ─────────────────────────────── */
      .chat-session-list {
        height: calc(100vh - 65px);
        overflow-y: auto;
        padding: 8px;
      }

      .session-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        border-radius: 10px;
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

      /* ── Chat messages ────────────────────────────── */
      .chat-messages {
        height: calc(100vh - 65px - 56px);
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #fafbfc;
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

      /* ── Welcome Screen ───────────────────────────── */
      .chat-welcome {
        padding: 24px 8px;
      }

      .welcome-hero {
        text-align: center;
        margin-bottom: 28px;
      }

      .welcome-icon-wrapper {
        width: 64px;
        height: 64px;
        border-radius: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        animation: float 3s ease-in-out infinite;
      }

      .welcome-icon {
        font-size: 32px;
        color: #fff;
      }

      @keyframes float {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-6px);
        }
      }

      .chat-welcome h3 {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a2e;
        margin: 0 0 6px;
      }

      .chat-welcome .welcome-hero p {
        font-size: 13px;
        color: #8c8c8c;
        line-height: 1.6;
        margin: 0;
      }

      .quick-categories {
        .quick-label {
          font-size: 12px;
          font-weight: 600;
          color: #8c8c8c;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
      }

      .quick-prompts {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .quick-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        background: #fff;
        border: 1px solid #e8e8e8;
        border-radius: 12px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;

        &:hover {
          border-color: #667eea;
          background: #f8f7ff;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
        }
      }

      .quick-emoji {
        font-size: 20px;
        flex-shrink: 0;
      }

      .quick-text {
        font-size: 12px;
        font-weight: 500;
        color: #333;
        line-height: 1.3;
      }

      /* ── Messages ─────────────────────────────────── */
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
        border-radius: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        span[nz-icon] {
          font-size: 16px;
          color: #fff;
        }

        &.user {
          background: linear-gradient(135deg, #52c41a, #389e0d);
          span[nz-icon] {
            color: #fff;
          }
        }
      }

      .message-bubble {
        padding: 10px 14px;
        border-radius: 14px;
        line-height: 1.5;
        word-break: break-word;
        max-width: 80%;
      }

      .message-user .message-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .message-assistant .message-bubble {
        background: #fff;
        color: #262626;
        border: 1px solid #e8e8e8;
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
            background: #f0f0f0;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 13px;
          }
          pre {
            background: #1a1a2e;
            color: #e8e8e8;
            padding: 10px 14px;
            border-radius: 8px;
            overflow-x: auto;
          }
          strong {
            font-weight: 600;
          }
          a.kb-link {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            background: #f0f5ff;
            border: 1px solid #adc6ff;
            border-radius: 4px;
            color: #2f54eb;
            font-size: 13px;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
              background: #d6e4ff;
              border-color: #597ef7;
            }
          }

          a.report-download-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            margin: 4px 0;
            background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
            border: none;
            border-radius: 6px;
            color: #fff;
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(82, 196, 26, 0.3);

            &:hover {
              background: linear-gradient(135deg, #73d13d 0%, #52c41a 100%);
              box-shadow: 0 4px 8px rgba(82, 196, 26, 0.4);
              transform: translateY(-1px);
            }
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
          background: #667eea;
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

      /* ── Input area ───────────────────────────────── */
      .chat-input-area {
        padding: 12px 16px;
        border-top: 1px solid #f0f0f0;
        background: #fff;
      }
    `,
  ],
})
export class ChatWidgetComponent implements AfterViewChecked, OnInit {
  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
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

  /** Whether current user is staff/admin (has access to analytics, reports) */
  readonly isStaffOrAdmin = computed(() => {
    const role = this.authService.currentUser()?.role;
    return ['ADMIN', 'ICT_STAFF', 'SUPERVISOR'].includes(role || '');
  });

  inputMessage = '';

  ngOnInit() {
    // Listen for external requests to open chat (e.g., from submit-ticket page)
    this.chatService.openChat$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.isOpen.set(true);
      if (this.sessions().length === 0) {
        this.loadSessions();
      }
      // Start a new chat session automatically
      this.startNewChat();
    });
  }

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

  /**
   * Handle clicks inside message bubbles — intercept report download links
   */
  onMessageClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('a') as HTMLAnchorElement;
    if (link) {
      const href = link.getAttribute('href') || '';
      // Intercept report download links
      if (href.startsWith('/reports/download')) {
        event.preventDefault();
        event.stopPropagation();
        this.downloadReport(href);
        return;
      }
      // Intercept KB links for in-app navigation
      if (href.startsWith('/knowledge-base/')) {
        event.preventDefault();
        event.stopPropagation();
        this.router.navigate([href]);
        return;
      }
    }
  }

  /**
   * Download an Excel report via the REST endpoint with auth
   */
  private downloadReport(reportPath: string) {
    const token = this.authService.getToken();
    if (!token) {
      this.message.error('Please log in to download reports');
      return;
    }

    // Build the full URL from the API base
    const baseUrl = environment.apiUrl.replace('/graphql', '');
    const fullUrl = `${baseUrl}${reportPath}`;

    this.message.loading('Generating report...');

    fetch(fullUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw new Error(err.error || 'Download failed');
          });
        }
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Extract filename from reportPath or use default
        const type = new URLSearchParams(reportPath.split('?')[1]).get('type') || 'report';
        a.download = `ICT_Report_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        this.message.success('Report downloaded!');
      })
      .catch((err) => {
        this.message.error(err.message || 'Failed to download report');
      });
  }

  renderMarkdown(content: string): string {
    // Simple markdown rendering — bold, code, lists, links, KB article links
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
      // KB article links: [KB: Title](kb:ID) → clickable link to /knowledge-base/ID
      .replace(
        /\[KB:\s*([^\]]+)\]\(kb:(\d+)\)/g,
        '<a class="kb-link" href="/knowledge-base/$2">📖 $1</a>',
      )
      // Report download links: [...](/reports/download?...) → button-style download link
      .replace(
        /\[([^\]]+)\]\((\/reports\/download[^)]*)\)/g,
        '<a class="report-download-link" href="$2">📥 $1</a>',
      )
      // Standard markdown links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
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
