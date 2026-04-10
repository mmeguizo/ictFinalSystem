import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { TicketService, TicketDetail, TicketAttachment } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { RealtimeService } from '../../core/services/realtime.service';

// SLA Step types
type SLAStepStatus =
  | 'COMPLETED_ON_TIME'
  | 'COMPLETED_LATE'
  | 'IN_PROGRESS'
  | 'IN_PROGRESS_OVERDUE'
  | 'NOT_STARTED'
  | 'SKIPPED';

interface SLAStep {
  stepNumber: number;
  name: string;
  expectedMinutes: number;
  actualMinutes: number | null;
  startedAt: string | null;
  completedAt: string | null;
  status: SLAStepStatus;
}

@Component({
  selector: 'app-ticket-detail',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    NzCardModule,
    NzDescriptionsModule,
    NzTagModule,
    NzButtonModule,
    NzSpinModule,
    NzTimelineModule,
    NzDividerModule,
    NzEmptyModule,
    NzAlertModule,
    NzInputModule,
    NzCheckboxModule,
    NzFormModule,
    NzSelectModule,
    NzModalModule,
    NzPopconfirmModule,
    NzIconModule,
    NzDatePickerModule,
    NzUploadModule,
    NzToolTipModule,
    NzProgressModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-detail.page.html',
  styleUrls: ['./ticket-detail.page.scss'],
})
export class TicketDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ticketService = inject(TicketService);
  private readonly message = inject(NzMessageService);
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Ticks every second so the SLA live timer auto-updates */
  private readonly liveTick = signal(0);

  /** The current ticket number displayed on this page */
  private currentTicketNumber = '';

  constructor() {
    // Tick every second for live SLA timer
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.liveTick.update((v) => v + 1));

    // Real-time: auto-refresh ticket detail when WebSocket events arrive
    effect(() => {
      const changed = this.realtimeService.lastStatusChange();
      if (changed && this.currentTicketNumber) {
        this.silentReloadTicket();
      }
    });

    effect(() => {
      const notif = this.realtimeService.lastNotification();
      if (notif && this.currentTicketNumber) {
        // Refresh the current ticket when any notification arrives
        // (could be a note, attachment, status change, etc.)
        this.silentReloadTicket();
      }
    });

    // Handle forced refresh from notification click (same-page navigation)
    effect(() => {
      const ticketNum = this.realtimeService.forceTicketRefresh();
      if (ticketNum && ticketNum === this.currentTicketNumber) {
        this.silentReloadTicket();
      }
    });
  }

  readonly loading = signal(true);
  readonly ticket = signal<TicketDetail | null>(null);
  readonly submittingNote = signal(false);
  readonly noteContent = signal('');
  readonly isInternalNote = signal(false);

  // Status update state
  readonly updatingStatus = signal(false);
  readonly showStatusModal = signal(false);
  readonly selectedStatus = signal('');
  readonly statusComment = signal('');

  // Reopen ticket state
  readonly showReopenModal = signal(false);
  readonly reopenDescription = signal('');
  readonly reopenComment = signal('');
  readonly reopening = signal(false);

  // Secretary Review state (for admin/secretary)
  readonly showSecretaryReviewModal = signal(false);
  readonly secretaryReviewComment = signal('');
  readonly secretaryReviewAction = signal<'approve' | 'reject'>('approve');
  readonly processingSecretaryReview = signal(false);

  // Director Approval state (for admin/director)
  readonly showDirectorApprovalModal = signal(false);
  readonly directorApprovalComment = signal('');
  readonly directorApprovalAction = signal<'approve' | 'disapprove'>('approve');
  readonly processingDirectorApproval = signal(false);

  // Schedule Visit state removed - scheduling is now part of the assign step

  // Head Acknowledge & Assign Developer state (for department heads)
  readonly showHeadAcknowledgeModal = signal(false);
  readonly headAckDeveloperName = signal('');
  readonly headAckDateToVisit = signal<Date | null>(null);
  readonly headAckTargetCompletion = signal<Date | null>(null);
  readonly headAckComment = signal('');
  readonly processingHeadAcknowledge = signal(false);

  // Resolution Update state (for department heads)
  readonly showResolutionModal = signal(false);
  readonly resolutionText = signal('');
  readonly resolutionDateFinished = signal<Date | null>(null);
  readonly resolutionComment = signal('');
  readonly processingResolution = signal(false);

  // ========================================
  // FILE ATTACHMENT STATE
  // ========================================
  readonly uploadingFiles = signal(false);
  readonly uploadProgress = signal(0);
  readonly selectedFiles = signal<File[]>([]);
  readonly deletingAttachmentId = signal<number | null>(null);

  /** Hidden file input reference */
  readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // ========================================
  // ASSIGN TICKET STATE (for Department Heads)
  // Used when assigning a staff member from the detail page
  // ========================================
  readonly showAssignModal = signal(false);
  readonly staffList = signal<{ id: number; name: string; email: string; role: string }[]>([]);
  readonly selectedUserId = signal<number | null>(null);
  // Optional schedule dates included during assignment (not required)
  readonly assignDateToVisit = signal<Date | null>(null);
  readonly assignTargetCompletion = signal<Date | null>(null);
  readonly assignComment = signal('');
  readonly processingAssignment = signal(false);

  // ========================================
  // DEVELOPER STATUS UPDATE WITH DATE (for Staff)
  // Developer can update targetCompletionDate when changing status
  // ========================================
  readonly devTargetCompletionDate = signal<Date | null>(null);

  // ========================================
  // SATISFACTION SURVEY STATE
  // ========================================
  readonly showSatisfactionModal = signal(false);
  readonly satisfactionRating = signal(0);
  readonly satisfactionComment = signal('');
  readonly submittingSatisfaction = signal(false);

  /** Check if user can submit satisfaction survey */
  readonly canSubmitSatisfaction = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    // Only creator, only resolved/closed, and not already rated
    return (
      this.isMyTicket() &&
      (t.status === 'RESOLVED' || t.status === 'CLOSED') &&
      !t.satisfactionRating
    );
  });

  /** Check if satisfaction was already submitted */
  readonly hasSatisfactionRating = computed(() => {
    const t = this.ticket();
    return t?.satisfactionRating != null;
  });

  /**
   * Get developer's status update comments from the ticket's statusHistory
   * These are comments from DEVELOPER/TECHNICAL role users during status transitions
   */
  readonly devStatusComments = computed(() => {
    const t = this.ticket();
    if (!t?.statusHistory) return [];
    return t.statusHistory.filter(
      (h: any) => (h.user.role === 'DEVELOPER' || h.user.role === 'TECHNICAL') && h.comment,
    );
  });

  // ========================================
  // ROLE CHECKS
  // ========================================

  /** Check if current user is admin */
  readonly isAdmin = computed(() => this.authService.isAdmin());

  /** Check if current user is a regular user (not staff) */
  readonly isRegularUser = computed(() => this.authService.isUser());

  /** Check if current user is secretary */
  readonly isSecretaryRole = computed(() => this.authService.isSecretary());

  /** Check if current user is director */
  readonly isDirectorRole = computed(() => this.authService.isDirector());

  /** Check if user can perform secretary review (admin or secretary, ticket status FOR_REVIEW) */
  readonly canReviewAsSecretary = computed(() => {
    const t = this.ticket();
    if (!t || t.status !== 'FOR_REVIEW') return false;
    return this.isAdmin() || this.isSecretaryRole();
  });

  /** Check if user can perform director approval (admin, director, or department heads, ticket status REVIEWED) */
  readonly canApproveAsDirector = computed(() => {
    const t = this.ticket();
    if (!t || t.status !== 'REVIEWED') return false;
    return this.isAdmin() || this.isDirectorRole() || this.isDepartmentHead();
  });

  /** Check if current user is the creator of this ticket */
  readonly isMyTicket = computed(() => {
    const t = this.ticket();
    const userId = this.authService.currentUser()?.id;
    return t?.createdBy?.id === userId;
  });

  /** Check if ticket can be reopened (cancelled and user is creator) */
  readonly canReopenTicket = computed(() => {
    const t = this.ticket();
    return t?.status === 'CANCELLED' && this.isMyTicket();
  });

  /** Check if current user is assigned to this ticket */
  readonly isAssignedToMe = computed(() => {
    const t = this.ticket();
    const userId = this.authService.currentUser()?.id;
    if (!t || !userId) return false;
    return t.assignments?.some((a) => a.user.id === userId) ?? false;
  });

  /** Check if user is staff (Developer or Technical) */
  readonly isStaff = computed(
    () => this.authService.isDeveloper() || this.authService.isTechnical(),
  );

  /** Check if user is a department head (MIS or ITS) */
  readonly isDepartmentHead = computed(() => this.authService.isOfficeHead());

  /** Schedule visit is now part of the assign step - this always returns false */
  readonly canScheduleVisit = computed(() => false);

  /** Check if department head can acknowledge & assign developer (ticket is ASSIGNED) */
  readonly canHeadAcknowledge = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    return this.isDepartmentHead() && t.status === 'ASSIGNED';
  });

  /** Check if department head can update resolution (PENDING, IN_PROGRESS, ON_HOLD, RESOLVED) */
  readonly canUpdateResolution = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    if (!this.isDepartmentHead()) return false;
    return ['PENDING', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED'].includes(t.status);
  });

  /**
   * Check if department head can assign a staff member to this ticket
   * Shows the Assign button on the detail page (same as the table action)
   * Conditions: user is department head, ticket is ASSIGNED status, no staff assigned yet
   */
  readonly canAssignTicket = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    // Only MIS_HEAD and ITS_HEAD can assign (not admin)
    if (!this.isDepartmentHead()) return false;
    // Only allow assignment when ticket is in ASSIGNED status (from director approval)
    if (t.status !== 'ASSIGNED' && t.status !== 'DIRECTOR_APPROVED') return false;
    // Check if there's already a DEVELOPER or TECHNICAL staff assigned
    const hasStaffAssigned = t.assignments?.some(
      (a) => a.user.role === 'DEVELOPER' || a.user.role === 'TECHNICAL',
    );
    return !hasStaffAssigned;
  });

  /** Check if current user can view internal notes (staff members only) */
  readonly canViewInternalNotes = computed(() => {
    const role = this.authService.currentUser()?.role;
    const staffRoles = [
      'ADMIN',
      'SECRETARY',
      'DIRECTOR',
      'DEVELOPER',
      'TECHNICAL',
      'MIS_HEAD',
      'ITS_HEAD',
    ];
    return role ? staffRoles.includes(role) : false;
  });

  /** Filtered notes - hide internal notes from regular users */
  readonly visibleNotes = computed(() => {
    const t = this.ticket();
    if (!t?.notes) return [];

    // Staff can see all notes, regular users only see non-internal notes
    if (this.canViewInternalNotes()) {
      return t.notes;
    }
    return t.notes.filter((note) => !note.isInternal);
  });

  /** Check if user can add internal notes (staff only) */
  readonly canAddInternalNotes = computed(() => this.canViewInternalNotes());

  // ========================================
  // SLA TIME TRACKING
  // Based on ICT Support Services processing times:
  // Step 1: Secretary Review (FOR_REVIEW → REVIEWED) — 5 min
  // Step 2: Director Endorsement (REVIEWED → DIRECTOR_APPROVED) — 5 min
  // Step 3: Assignment (DIRECTOR_APPROVED → ASSIGNED) — 5 min
  // Step 4: Head Acknowledge (ASSIGNED → PENDING) — 5 min
  // Total SLA: 20 minutes
  // ========================================

  /** SLA step definitions mapping status transitions to expected processing times */
  private readonly SLA_STEPS = [
    {
      stepNumber: 1,
      name: 'Secretary Review',
      fromStatus: 'FOR_REVIEW',
      toStatus: 'REVIEWED',
      expectedMinutes: 5,
    },
    {
      stepNumber: 2,
      name: 'Director Endorsement',
      fromStatus: 'REVIEWED',
      toStatus: 'DIRECTOR_APPROVED',
      expectedMinutes: 5,
    },
    {
      stepNumber: 3,
      name: 'Assignment',
      fromStatus: 'DIRECTOR_APPROVED',
      toStatus: 'ASSIGNED',
      expectedMinutes: 5,
    },
    {
      stepNumber: 4,
      name: 'Head Acknowledge',
      fromStatus: 'ASSIGNED',
      toStatus: 'PENDING',
      expectedMinutes: 5,
    },
  ];

  /** Computed SLA timeline from ticket status history */
  readonly slaTimeline = computed(() => {
    const t = this.ticket();
    if (!t) return null;
    // Read liveTick to trigger recomputation every second (for live timer)
    this.liveTick();

    const history = [...(t.statusHistory || [])].sort(
      (a, b) => this.parseDate(a.createdAt).getTime() - this.parseDate(b.createdAt).getTime(),
    );

    const steps: SLAStep[] = [];
    let totalActualMinutes = 0;
    let hasOverdue = false;
    const currentStatus = t.status;

    for (const slaDef of this.SLA_STEPS) {
      // Find when this step started (entry into fromStatus)
      const startEntry = this.findStatusEntry(history, slaDef.fromStatus, t.createdAt);
      // Find when this step completed (transition to toStatus)
      const completionEntry = history.find(
        (h) => h.fromStatus === slaDef.fromStatus && h.toStatus === slaDef.toStatus,
      );

      let status: SLAStepStatus;
      let actualMinutes: number | null = null;
      let startedAt: string | null = startEntry;
      let completedAt: string | null = null;

      if (completionEntry) {
        // Step is completed
        completedAt = completionEntry.createdAt;
        const startTime = this.parseDate(startEntry).getTime();
        const endTime = this.parseDate(completionEntry.createdAt).getTime();
        actualMinutes = Math.round(((endTime - startTime) / 60000) * 100) / 100;
        totalActualMinutes += actualMinutes;

        status = actualMinutes <= slaDef.expectedMinutes ? 'COMPLETED_ON_TIME' : 'COMPLETED_LATE';
        if (status === 'COMPLETED_LATE') hasOverdue = true;
      } else if (currentStatus === slaDef.fromStatus) {
        // Currently in this step
        const startTime = this.parseDate(startEntry).getTime();
        const now = Date.now();
        actualMinutes = Math.round(((now - startTime) / 60000) * 100) / 100;

        status = actualMinutes <= slaDef.expectedMinutes ? 'IN_PROGRESS' : 'IN_PROGRESS_OVERDUE';
        if (status === 'IN_PROGRESS_OVERDUE') hasOverdue = true;
      } else if (currentStatus === 'CANCELLED' || currentStatus === 'CLOSED') {
        // Ticket was cancelled or closed before reaching this step
        status = 'SKIPPED';
      } else {
        // Step hasn't been reached yet
        const statusOrder = [
          'FOR_REVIEW',
          'REVIEWED',
          'DIRECTOR_APPROVED',
          'ASSIGNED',
          'PENDING',
          'IN_PROGRESS',
          'ON_HOLD',
          'RESOLVED',
          'CLOSED',
        ];
        const currentIdx = statusOrder.indexOf(currentStatus);
        const stepIdx = statusOrder.indexOf(slaDef.fromStatus);
        status = currentIdx >= stepIdx ? 'SKIPPED' : 'NOT_STARTED';
        startedAt = null;
      }

      steps.push({
        stepNumber: slaDef.stepNumber,
        name: slaDef.name,
        expectedMinutes: slaDef.expectedMinutes,
        actualMinutes,
        startedAt,
        completedAt,
        status,
      });
    }

    const completedSteps = steps.filter(
      (s) => s.status === 'COMPLETED_ON_TIME' || s.status === 'COMPLETED_LATE',
    );
    const totalExpected = 20; // Total SLA in minutes

    return {
      steps,
      totalExpectedMinutes: totalExpected,
      totalActualMinutes: Math.round(totalActualMinutes * 100) / 100,
      completedSteps: completedSteps.length,
      totalSteps: this.SLA_STEPS.length,
      isOverdue: hasOverdue,
      submittedAt: t.createdAt,
      currentStatus,
    };
  });

  /** Find when a status was first entered */
  private findStatusEntry(
    history: Array<{ fromStatus?: string; toStatus: string; createdAt: string }>,
    status: string,
    ticketCreatedAt: string,
  ): string {
    if (status === 'FOR_REVIEW') {
      return ticketCreatedAt; // Ticket starts as FOR_REVIEW upon creation
    }
    const entry = history.find((h) => h.toStatus === status);
    return entry ? entry.createdAt : ticketCreatedAt;
  }

  /** Parse date string to Date object (handles timestamps and ISO strings) */
  private parseDate(dateString: string): Date {
    if (/^\d+$/.test(dateString)) {
      return new Date(parseInt(dateString, 10));
    }
    return new Date(dateString);
  }

  /** Format minutes into human-readable duration */
  formatDuration(minutes: number | null): string {
    if (minutes === null || minutes === undefined) return '-';
    if (minutes < 1) return `${Math.round(minutes * 60)}s`;
    if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    const days = Math.floor(hrs / 24);
    const remHrs = hrs % 24;
    return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
  }

  /** Get SLA step icon */
  getSLAStepIcon(status: SLAStepStatus): string {
    switch (status) {
      case 'COMPLETED_ON_TIME':
        return '✅';
      case 'COMPLETED_LATE':
        return '⚠️';
      case 'IN_PROGRESS':
        return '🔄';
      case 'IN_PROGRESS_OVERDUE':
        return '🔴';
      case 'NOT_STARTED':
        return '⏳';
      case 'SKIPPED':
        return '⏭️';
    }
  }

  /** Get SLA step color class */
  getSLAStepColor(status: SLAStepStatus): string {
    switch (status) {
      case 'COMPLETED_ON_TIME':
        return '#52c41a';
      case 'COMPLETED_LATE':
        return '#faad14';
      case 'IN_PROGRESS':
        return '#1890ff';
      case 'IN_PROGRESS_OVERDUE':
        return '#ff4d4f';
      case 'NOT_STARTED':
        return '#d9d9d9';
      case 'SKIPPED':
        return '#bfbfbf';
    }
  }

  /** Check if user can upload attachments (creator, assigned staff, heads, admin) */
  readonly canUploadAttachments = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    // Anyone associated with the ticket can upload
    return this.isMyTicket() || this.isAssignedToMe() || this.isDepartmentHead() || this.isAdmin();
  });

  /** Check if user can delete a specific attachment */
  canDeleteAttachment(_attachment: TicketAttachment): boolean {
    return this.isMyTicket() || this.isAssignedToMe() || this.isDepartmentHead() || this.isAdmin();
  }

  /** Check if user can update ticket status */
  readonly canUpdateStatus = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    // Staff can update if assigned to them and status allows updates
    const workableStatuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];
    return this.isStaff() && this.isAssignedToMe() && workableStatuses.includes(t.status);
  });

  /** Status options for staff */
  readonly statusOptions = [
    {
      value: 'IN_PROGRESS',
      label: 'In Progress',
      color: 'processing',
      description: 'Start working on this ticket',
    },
    {
      value: 'ON_HOLD',
      label: 'On Hold',
      color: 'warning',
      description: 'Pause work - waiting for info/resources',
    },
    {
      value: 'RESOLVED',
      label: 'Resolved',
      color: 'success',
      description: 'Work completed - ready for closure',
    },
  ];

  ngOnInit(): void {
    // Subscribe to route param changes so navigating from one ticket to another reloads
    this.route.paramMap.subscribe((params) => {
      const ticketNumber = params.get('ticketNumber');
      if (ticketNumber) {
        this.currentTicketNumber = ticketNumber;
        this.loadTicket(ticketNumber);
      } else {
        this.loading.set(false);
        this.message.error('Invalid ticket number');
      }
    });

    // Load staff list if user is a department head (for assignment dropdown)
    if (this.isDepartmentHead()) {
      this.loadStaffList();
    }
  }

  /** Silently reload the current ticket without showing loading spinner */
  private silentReloadTicket(): void {
    if (!this.currentTicketNumber) return;
    this.ticketService.getTicketByNumber(this.currentTicketNumber).subscribe({
      next: (ticket) => this.ticket.set(ticket),
      error: (err) => console.error('Silent ticket refresh failed:', err),
    });
  }

  /**
   * Load available staff members for the assignment dropdown
   * MIS_HEAD sees DEVELOPERs, ITS_HEAD sees TECHNICAL staff
   */
  loadStaffList(): void {
    const isMISHead = this.authService.isMISHead();
    const role = isMISHead ? 'DEVELOPER' : 'TECHNICAL';

    this.ticketService.getUsersByRole(role).subscribe({
      next: (users) => this.staffList.set(users),
      error: (err) => {
        console.error('Failed to load staff list:', err);
        this.message.error('Failed to load staff list');
      },
    });
  }

  loadTicket(ticketNumber: string): void {
    this.loading.set(true);
    this.ticketService.getTicketByNumber(ticketNumber).subscribe({
      next: (ticket) => {
        // console.log('🎫 Ticket data received:', ticket);
        // console.log('� Notes count:', ticket.notes?.length || 0, 'Notes:', ticket.notes);
        // console.log('📊 Status History count:', ticket.statusHistory?.length || 0, 'History:', ticket.statusHistory);
        // console.log('�📅 createdAt:', ticket.createdAt, 'Type:', typeof ticket.createdAt);
        // console.log('📅 dueDate:', ticket.dueDate, 'Type:', typeof ticket.dueDate);
        this.ticket.set(ticket);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load ticket:', error);
        this.message.error('Failed to load ticket details');
        this.loading.set(false);
      },
    });
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

  formatDate(dateString?: string | number | Date | null): string {
    // Return dash for null, undefined, or empty string
    if (!dateString) return '-';

    let d: Date;

    // Handle different input types
    if (dateString instanceof Date) {
      d = dateString;
    } else if (typeof dateString === 'number') {
      // Already a number (timestamp in milliseconds)
      d = new Date(dateString);
    } else if (typeof dateString === 'string') {
      // Check if it's a numeric string (timestamp)
      if (/^\d+$/.test(dateString)) {
        d = new Date(parseInt(dateString, 10));
      } else {
        // Try parsing as date string
        d = new Date(dateString);
      }
    } else {
      // Fallback
      d = new Date(dateString as any);
    }

    // Check if date is valid
    if (isNaN(d.getTime())) {
      // console.warn('⚠️ Invalid date value:', dateString);
      return '-';
    }

    return d.toLocaleString();
  }

  formatDateShort(dateString?: string | number | Date | null): string {
    // Return dash for null, undefined, or empty string
    if (!dateString) return '-';

    // Parse the date - handle ISO strings, timestamps, and Date objects
    let d: Date;

    if (dateString instanceof Date) {
      d = dateString;
    } else if (typeof dateString === 'number') {
      d = new Date(dateString);
    } else if (typeof dateString === 'string') {
      // Support numeric timestamp strings
      d = /^\d+$/.test(dateString) ? new Date(parseInt(dateString, 10)) : new Date(dateString);
    } else {
      d = new Date(dateString as any);
    }

    // Check if date is valid by testing if getTime() returns NaN
    if (isNaN(d.getTime())) {
      // console.warn('⚠️ Invalid date value:', dateString);
      return '-';
    }

    return d.toLocaleDateString();
  }

  getApprovalProgress(): { current: number; total: number } {
    const t = this.ticket();
    if (!t) return { current: 0, total: 2 };

    let current = 0;
    if (t.secretaryReviewedAt) current++;
    if (t.directorApprovedAt) current++;

    return { current, total: 2 };
  }

  isAwaitingSecretaryReview(): boolean {
    const t = this.ticket();
    return t?.status === 'FOR_REVIEW' && !t.secretaryReviewedAt;
  }

  isAwaitingDirectorApproval(): boolean {
    const t = this.ticket();
    return t?.status === 'REVIEWED' && !t.directorApprovedAt;
  }

  isFullyApproved(): boolean {
    const t = this.ticket();
    return !!(t?.secretaryReviewedAt && t?.directorApprovedAt);
  }

  submitNote(): void {
    const content = this.noteContent().trim();
    if (!content) {
      this.message.warning('Please enter a note');
      return;
    }

    const ticket = this.ticket();
    if (!ticket) {
      this.message.error('Ticket not found');
      return;
    }

    this.submittingNote.set(true);
    this.ticketService
      .addTicketNote(ticket.id, {
        content,
        isInternal: this.isInternalNote(),
      })
      .subscribe({
        next: () => {
          this.message.success('Note added successfully');
          this.noteContent.set('');
          this.isInternalNote.set(false);
          // Reload ticket to show new note
          this.loadTicket(ticket.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to add note:', error);
          this.message.error('Failed to add note');
          this.submittingNote.set(false);
        },
        complete: () => {
          this.submittingNote.set(false);
        },
      });
  }

  // ========================================
  // ASSIGN TICKET METHODS (for Department Heads)
  // These allow heads to assign staff directly from the detail page
  // (same as the table action, but available when navigating from notifications)
  // ========================================

  /**
   * Open the assignment modal
   * Resets all fields to default values
   */
  openAssignModal(): void {
    this.selectedUserId.set(null);
    this.assignDateToVisit.set(null);
    this.assignTargetCompletion.set(null);
    this.assignComment.set('');
    this.showAssignModal.set(true);
  }

  /**
   * Close the assignment modal and reset all fields
   */
  closeAssignModal(): void {
    this.showAssignModal.set(false);
    this.selectedUserId.set(null);
    this.assignDateToVisit.set(null);
    this.assignTargetCompletion.set(null);
    this.assignComment.set('');
  }

  /**
   * Confirm assignment of ticket to selected staff member
   * Date to visit is required - this triggers assign + schedule in one step
   */
  confirmAssignment(): void {
    const t = this.ticket();
    const userId = this.selectedUserId();
    const dateToVisit = this.assignDateToVisit();

    if (!t || !userId) {
      this.message.warning('Please select a staff member');
      return;
    }

    if (!dateToVisit) {
      this.message.warning('Please select a date to visit');
      return;
    }

    this.processingAssignment.set(true);

    // Date to visit is required - triggers assign + schedule in one step
    const options = {
      dateToVisit: dateToVisit.toISOString(),
    };

    this.ticketService.assignTicketToUser(t.id, userId, options).subscribe({
      next: () => {
        this.message.success('Ticket assigned and scheduled! Pending admin acknowledgment.');
        this.closeAssignModal();
        this.loadTicket(t.ticketNumber); // Reload to show updated data
      },
      error: (error) => {
        console.error('Failed to assign ticket:', error);
        this.message.error('Failed to assign ticket');
        this.processingAssignment.set(false);
      },
      complete: () => {
        this.processingAssignment.set(false);
      },
    });
  }

  // ========================================
  // STATUS UPDATE METHODS (for Staff)
  // ========================================

  /**
   * Open status update modal
   * Pre-fills the target completion date from the ticket if it exists
   */
  openStatusModal(): void {
    const t = this.ticket();
    if (!t) return;
    this.selectedStatus.set(t.status);
    this.statusComment.set('');
    // Pre-fill target completion date if ticket already has one
    this.devTargetCompletionDate.set(
      t.targetCompletionDate ? new Date(t.targetCompletionDate) : null,
    );
    this.showStatusModal.set(true);
  }

  /**
   * Close status update modal and reset all fields
   */
  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.selectedStatus.set('');
    this.statusComment.set('');
    this.devTargetCompletionDate.set(null);
  }

  /**
   * Quick status update (e.g., Start Work button)
   */
  quickStatusUpdate(newStatus: string, comment?: string): void {
    const t = this.ticket();
    if (!t) return;

    this.updatingStatus.set(true);
    this.ticketService.updateStatus(t.id, newStatus, comment).subscribe({
      next: () => {
        this.message.success(`Status updated to ${newStatus.replace('_', ' ')}`);
        this.loadTicket(t.ticketNumber);
      },
      error: (error) => {
        console.error('Failed to update status:', error);
        this.message.error('Failed to update status');
        this.updatingStatus.set(false);
      },
    });
  }

  /**
   * Confirm status update from modal
   * Passes optional targetCompletionDate if developer updated it
   * Developer's comment is added as a note (carried over to heads via notes)
   */
  confirmStatusUpdate(): void {
    const t = this.ticket();
    const status = this.selectedStatus();
    const comment = this.statusComment();

    if (!t || !status) {
      this.message.warning('Please select a status');
      return;
    }

    // Get the developer's target completion date update (optional)
    const targetDate = this.devTargetCompletionDate();
    const targetDateStr = targetDate ? targetDate.toISOString() : undefined;

    this.updatingStatus.set(true);
    this.ticketService.updateStatus(t.id, status, comment || undefined, targetDateStr).subscribe({
      next: () => {
        this.message.success(`Status updated to ${status.replace('_', ' ')}`);
        this.closeStatusModal();
        this.loadTicket(t.ticketNumber);
      },
      error: (error) => {
        console.error('Failed to update status:', error);
        this.message.error('Failed to update status');
        this.updatingStatus.set(false);
      },
    });
  }

  // ========================================
  // REOPEN TICKET METHODS (for rejected/cancelled tickets)
  // ========================================

  /**
   * Open the reopen ticket modal
   */
  openReopenModal(): void {
    const t = this.ticket();
    if (!t) return;
    // Pre-fill with existing description for editing
    this.reopenDescription.set(t.description || '');
    this.reopenComment.set('');
    this.showReopenModal.set(true);
  }

  /**
   * Close the reopen ticket modal
   */
  closeReopenModal(): void {
    this.showReopenModal.set(false);
    this.reopenDescription.set('');
    this.reopenComment.set('');
  }

  /**
   * Submit the reopened ticket
   */
  confirmReopenTicket(): void {
    const t = this.ticket();
    if (!t) return;

    const description = this.reopenDescription().trim();
    const comment = this.reopenComment().trim();

    this.reopening.set(true);
    this.ticketService
      .reopenTicket(t.id, {
        updatedDescription: description !== t.description ? description : undefined,
        comment: comment || undefined,
      })
      .subscribe({
        next: () => {
          this.message.success('Ticket reopened successfully! It will be reviewed again.');
          this.closeReopenModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to reopen ticket:', error);
          this.message.error(error.message || 'Failed to reopen ticket');
          this.reopening.set(false);
        },
        complete: () => {
          this.reopening.set(false);
        },
      });
  }

  // ========================================
  // SATISFACTION SURVEY METHODS
  // ========================================

  openSatisfactionModal(): void {
    this.satisfactionRating.set(0);
    this.satisfactionComment.set('');
    this.showSatisfactionModal.set(true);
  }

  closeSatisfactionModal(): void {
    this.showSatisfactionModal.set(false);
    this.satisfactionRating.set(0);
    this.satisfactionComment.set('');
  }

  submitSatisfactionSurvey(): void {
    const t = this.ticket();
    if (!t) return;
    const rating = this.satisfactionRating();
    if (rating < 1 || rating > 5) {
      this.message.warning('Please select a rating between 1 and 5 stars');
      return;
    }

    this.submittingSatisfaction.set(true);
    this.ticketService
      .submitSatisfaction(t.id, rating, this.satisfactionComment().trim() || undefined)
      .subscribe({
        next: () => {
          this.message.success('Thank you for your feedback!');
          this.closeSatisfactionModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to submit satisfaction:', error);
          this.message.error(error.message || 'Failed to submit satisfaction');
          this.submittingSatisfaction.set(false);
        },
        complete: () => {
          this.submittingSatisfaction.set(false);
        },
      });
  }

  // ========================================
  // SECRETARY REVIEW METHODS (for Admin/Secretary)
  // ========================================

  /**
   * Open secretary review modal
   */
  openSecretaryReviewModal(): void {
    this.secretaryReviewComment.set('');
    this.secretaryReviewAction.set('approve');
    this.showSecretaryReviewModal.set(true);
  }

  /**
   * Close secretary review modal
   */
  closeSecretaryReviewModal(): void {
    this.showSecretaryReviewModal.set(false);
    this.secretaryReviewComment.set('');
    this.secretaryReviewAction.set('approve');
  }

  /**
   * Confirm secretary review (approve or reject)
   */
  confirmSecretaryReview(): void {
    const t = this.ticket();
    if (!t) return;

    const action = this.secretaryReviewAction();
    const comment = this.secretaryReviewComment().trim();

    if (action === 'reject' && !comment) {
      this.message.warning('Please provide a reason for rejecting the ticket');
      return;
    }

    this.processingSecretaryReview.set(true);

    if (action === 'approve') {
      this.ticketService.reviewAsSecretary(t.id, comment || undefined).subscribe({
        next: () => {
          this.message.success('Ticket reviewed and forwarded for director approval!');
          this.closeSecretaryReviewModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to review ticket:', error);
          this.message.error('Failed to review ticket');
          this.processingSecretaryReview.set(false);
        },
        complete: () => {
          this.processingSecretaryReview.set(false);
        },
      });
    } else {
      this.ticketService.rejectAsSecretary(t.id, comment).subscribe({
        next: () => {
          this.message.success('Ticket returned to requester with notes');
          this.closeSecretaryReviewModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to reject ticket:', error);
          this.message.error(error?.message || 'Failed to reject ticket');
          this.processingSecretaryReview.set(false);
        },
        complete: () => {
          this.processingSecretaryReview.set(false);
        },
      });
    }
  }

  // ========================================
  // DIRECTOR APPROVAL METHODS (for Admin/Director)
  // ========================================

  /**
   * Open director approval modal
   */
  openDirectorApprovalModal(): void {
    this.directorApprovalComment.set('');
    this.directorApprovalAction.set('approve');
    this.showDirectorApprovalModal.set(true);
  }

  /**
   * Close director approval modal
   */
  closeDirectorApprovalModal(): void {
    this.showDirectorApprovalModal.set(false);
    this.directorApprovalComment.set('');
    this.directorApprovalAction.set('approve');
  }

  /**
   * Confirm director approval (approve or disapprove)
   */
  confirmDirectorApproval(): void {
    const t = this.ticket();
    if (!t) return;

    const action = this.directorApprovalAction();
    const comment = this.directorApprovalComment().trim();

    if (action === 'disapprove' && !comment) {
      this.message.warning('Please provide a reason for disapproving the ticket');
      return;
    }

    this.processingDirectorApproval.set(true);

    if (action === 'approve') {
      this.ticketService.approveAsDirector(t.id, comment || undefined).subscribe({
        next: () => {
          this.message.success('Ticket endorsed and auto-assigned to Office Head!');
          this.closeDirectorApprovalModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to endorse ticket:', error);
          this.message.error('Failed to approve ticket');
          this.processingDirectorApproval.set(false);
        },
        complete: () => {
          this.processingDirectorApproval.set(false);
        },
      });
    } else {
      this.ticketService.disapproveAsDirector(t.id, comment).subscribe({
        next: () => {
          this.message.success('Ticket disapproved and returned to requester');
          this.closeDirectorApprovalModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to disapprove ticket:', error);
          this.message.error(error?.message || 'Failed to disapprove ticket');
          this.processingDirectorApproval.set(false);
        },
        complete: () => {
          this.processingDirectorApproval.set(false);
        },
      });
    }
  }

  /**
   * Disable past dates in date picker
   */
  disablePastDates = (current: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return current < today;
  };

  // ========================================
  // HEAD ACKNOWLEDGE & ASSIGN DEVELOPER (for Department Heads)
  // ========================================

  openHeadAcknowledgeModal(): void {
    this.headAckDeveloperName.set('');
    this.headAckDateToVisit.set(null);
    this.headAckTargetCompletion.set(null);
    this.headAckComment.set('');
    this.selectedUserId.set(null);
    this.showHeadAcknowledgeModal.set(true);
  }

  closeHeadAcknowledgeModal(): void {
    this.showHeadAcknowledgeModal.set(false);
    this.headAckDeveloperName.set('');
    this.headAckDateToVisit.set(null);
    this.headAckTargetCompletion.set(null);
    this.headAckComment.set('');
    this.selectedUserId.set(null);
  }

  confirmHeadAcknowledge(): void {
    const t = this.ticket();
    if (!t) return;

    const developerName = this.headAckDeveloperName().trim();
    if (!developerName) {
      this.message.warning('Please enter the developer name');
      return;
    }

    const input: any = { assignedDeveloperName: developerName };
    const userId = this.selectedUserId();
    if (userId) input.assignToUserId = userId;
    const dateToVisit = this.headAckDateToVisit();
    if (dateToVisit) input.dateToVisit = dateToVisit.toISOString();
    const targetCompletion = this.headAckTargetCompletion();
    if (targetCompletion) input.targetCompletionDate = targetCompletion.toISOString();
    const comment = this.headAckComment().trim();
    if (comment) input.comment = comment;

    this.processingHeadAcknowledge.set(true);
    this.ticketService.acknowledgeAndAssignDeveloper(t.id, input).subscribe({
      next: () => {
        this.message.success('Ticket acknowledged and developer assigned!');
        this.closeHeadAcknowledgeModal();
        this.loadTicket(t.ticketNumber);
      },
      error: (err) => {
        console.error('Failed to acknowledge ticket:', err);
        this.message.error(err?.message || 'Failed to acknowledge ticket');
        this.processingHeadAcknowledge.set(false);
      },
      complete: () => this.processingHeadAcknowledge.set(false),
    });
  }

  // ========================================
  // RESOLUTION UPDATE (for Department Heads)
  // ========================================

  openResolutionModal(): void {
    const t = this.ticket();
    this.resolutionText.set(t?.resolution || '');
    this.resolutionDateFinished.set(null);
    this.resolutionComment.set('');
    this.showResolutionModal.set(true);
  }

  closeResolutionModal(): void {
    this.showResolutionModal.set(false);
    this.resolutionText.set('');
    this.resolutionDateFinished.set(null);
    this.resolutionComment.set('');
  }

  confirmResolution(): void {
    const t = this.ticket();
    if (!t) return;

    const resolution = this.resolutionText().trim();
    if (!resolution) {
      this.message.warning('Please enter a resolution');
      return;
    }

    const input: any = { resolution };
    const dateFinished = this.resolutionDateFinished();
    if (dateFinished) input.dateFinished = dateFinished.toISOString();
    const comment = this.resolutionComment().trim();
    if (comment) input.comment = comment;

    this.processingResolution.set(true);
    this.ticketService.updateResolution(t.id, input).subscribe({
      next: () => {
        this.message.success('Resolution updated successfully!');
        this.closeResolutionModal();
        this.loadTicket(t.ticketNumber);
      },
      error: (err) => {
        console.error('Failed to update resolution:', err);
        this.message.error(err?.message || 'Failed to update resolution');
        this.processingResolution.set(false);
      },
      complete: () => this.processingResolution.set(false),
    });
  }

  // ========================================
  // FILE ATTACHMENT METHODS
  // ========================================

  /**
   * Trigger the hidden file input
   */
  triggerFileInput(): void {
    const input = this.fileInputRef()?.nativeElement;
    if (input) {
      input.click();
    }
  }

  /**
   * Handle file selection from the file input
   */
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);
    const maxSize = 50 * 1024 * 1024; // 50MB

    // Validate file sizes
    const oversized = files.filter((f) => f.size > maxSize);
    if (oversized.length > 0) {
      this.message.error(
        `File(s) too large (max 50MB): ${oversized.map((f) => f.name).join(', ')}`,
      );
      input.value = ''; // Reset input
      return;
    }

    if (files.length > 5) {
      this.message.warning('Maximum 5 files per upload');
      input.value = '';
      return;
    }

    this.uploadFiles(files);
    input.value = ''; // Reset input for next selection
  }

  /**
   * Upload selected files to the ticket
   */
  private uploadFiles(files: File[]): void {
    const t = this.ticket();
    if (!t) return;

    this.uploadingFiles.set(true);
    this.uploadProgress.set(0);

    this.ticketService
      .uploadAttachments(
        t.id,
        files,
        // Progress callback — updates the progress bar in real time
        (percent) => this.uploadProgress.set(percent),
      )
      .subscribe({
        next: (result) => {
          this.message.success(`${result.attachments.length} file(s) uploaded successfully!`);
          this.uploadingFiles.set(false);
          this.uploadProgress.set(100);
          // Reload ticket to show new attachments
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to upload files:', error);
          const errorMsg = error?.error?.error || error?.message || 'Failed to upload files';
          this.message.error(errorMsg);
          this.uploadingFiles.set(false);
          this.uploadProgress.set(0);
        },
      });
  }

  /**
   * Delete a ticket attachment
   */
  deleteAttachment(attachment: TicketAttachment): void {
    const t = this.ticket();
    if (!t) return;

    this.deletingAttachmentId.set(attachment.id);
    this.ticketService.deleteAttachment(attachment.id).subscribe({
      next: () => {
        this.message.success(`"${attachment.originalName}" deleted`);
        this.deletingAttachmentId.set(null);
        this.loadTicket(t.ticketNumber);
      },
      error: (error) => {
        console.error('Failed to delete attachment:', error);
        this.message.error('Failed to delete attachment');
        this.deletingAttachmentId.set(null);
      },
    });
  }

  /**
   * Get a human-readable file size string
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get an icon type for the file based on MIME type
   */
  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'file-image';
    if (mimeType === 'application/pdf') return 'file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'file-ppt';
    if (mimeType.startsWith('text/')) return 'file-text';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z'))
      return 'file-zip';
    return 'file';
  }

  /**
   * Check if attachment is previewable (image)
   */
  isImageAttachment(mimeType: string): boolean {
    return mimeType.startsWith('image/') && !mimeType.includes('svg');
  }
}
