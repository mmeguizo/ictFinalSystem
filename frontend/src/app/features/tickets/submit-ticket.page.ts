import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  effect,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzMessageService } from 'ng-zorro-antd/message';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import {
  TicketService,
  CreateMISTicketInput,
  CreateITSTicketInput,
} from '../../core/services/ticket.service';
import { MISFormComponent } from './mis-form.component';
import { ITSFormComponent } from './its-form.component';
import {
  suggestPriority,
  PrioritySuggestion,
  Priority,
} from '../../core/utils/priority-suggestion';
import { AIService, SmartSuggestions } from '../../core/services/ai.service';
import { firstValueFrom } from 'rxjs';

type RequestCategory = 'WEBSITE' | 'SOFTWARE';

@Component({
  selector: 'app-submit-ticket',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzRadioModule,
    NzGridModule,
    NzSpinModule,
    NzSelectModule,
    NzTagModule,
    NzToolTipModule,
    NzIconModule,
    NzAlertModule,
    NzCollapseModule,
    NzListModule,
    NzBadgeModule,
    MISFormComponent,
    ITSFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './submit-ticket.page.html',
  styleUrls: ['./submit-ticket.page.scss'],
})
export class SubmitTicketPage {
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly ticketService = inject(TicketService);
  private readonly aiService = inject(AIService);

  readonly today = new Date();
  readonly busy = signal(false);

  readonly userName = computed(() => this.authService.currentUser()?.name ?? '');
  readonly userDept = signal('');

  private readonly formType = signal<'MIS' | 'ITS'>('MIS');
  readonly isMIS = computed(() => this.formType() === 'MIS');
  readonly isITS = computed(() => this.formType() === 'ITS');
  readonly formTypeControl = new FormControl<'MIS' | 'ITS'>('MIS', { nonNullable: true });

  // Get reference to child form components
  private readonly misFormRef = viewChild(MISFormComponent);
  private readonly itsFormRef = viewChild(ITSFormComponent);

  // ========================================
  // SMART PRIORITY SUGGESTION
  // ========================================

  /** User-selected priority (can override suggestion) */
  readonly selectedPriority = signal<Priority>('MEDIUM');

  /** Whether the user has manually overridden the suggestion */
  readonly priorityOverridden = signal(false);

  /** Current suggestion from the analysis engine */
  readonly prioritySuggestion = signal<PrioritySuggestion>({
    priority: 'MEDIUM',
    score: 0,
    reasons: ['No specific urgency indicators detected \u2014 defaulting to Medium'],
    confidence: 'low',
  });

  /** Show/hide the suggestion details popover */
  readonly showSuggestionDetails = signal(false);

  // ========================================
  // AI SMART SUGGESTIONS
  // ========================================

  /** Smart suggestion results from AI + similar search */
  readonly smartSuggestions = signal<SmartSuggestions | null>(null);
  readonly loadingSuggestions = signal(false);
  readonly suggestionsRequested = signal(false);

  /** Priority options for the selector */
  readonly priorityOptions: { value: Priority; label: string; color: string }[] = [
    { value: 'LOW', label: 'Low', color: '#8c8c8c' },
    { value: 'MEDIUM', label: 'Medium', color: '#1890ff' },
    { value: 'HIGH', label: 'High', color: '#fa8c16' },
    { value: 'CRITICAL', label: 'Critical', color: '#f5222d' },
  ];

  /**
   * Recalculate priority suggestion.
   * Called by child forms when their content changes.
   */
  onFormContentChanged(): void {
    this.recalculateSuggestion();
  }

  /** User manually selects a priority */
  onPriorityChange(priority: Priority): void {
    this.selectedPriority.set(priority);
    this.priorityOverridden.set(true);
  }

  /** Accept the AI suggestion */
  acceptSuggestion(): void {
    const suggestion = this.prioritySuggestion();
    this.selectedPriority.set(suggestion.priority);
    this.priorityOverridden.set(false);
  }

  /** Get color for a priority tag */
  getPriorityColor(priority: string): string {
    const map: Record<string, string> = {
      LOW: 'default',
      MEDIUM: 'blue',
      HIGH: 'orange',
      CRITICAL: 'red',
    };
    return map[priority] || 'default';
  }

  /** Get status color for similar tickets */
  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      RESOLVED: 'green',
      CLOSED: 'default',
      IN_PROGRESS: 'blue',
      ASSIGNED: 'cyan',
      FOR_REVIEW: 'orange',
      CANCELLED: 'red',
    };
    return map[status] || 'default';
  }

  /** Fetch AI smart suggestions based on current form content */
  fetchSmartSuggestions(): void {
    const formType = this.formType();
    let title = '';
    let description = '';

    if (formType === 'MIS') {
      const misForm = this.misFormRef();
      if (misForm) {
        const payload = misForm.getPayload();
        title = this.generateMISTitle(payload);
        description = payload.details || '';
      }
    } else {
      const itsForm = this.itsFormRef();
      if (itsForm) {
        const payload = itsForm.getPayload();
        title = this.generateITSTitle(payload);
        description = payload.details || '';
      }
    }

    if (!title && !description) {
      this.message.info('Please fill in some details first before requesting AI analysis.');
      return;
    }

    this.loadingSuggestions.set(true);
    this.suggestionsRequested.set(true);

    this.aiService.getSmartSuggestions(title, description).subscribe({
      next: (result) => {
        this.smartSuggestions.set(result);
        this.loadingSuggestions.set(false);

        // If AI returned a priority, auto-apply if user hasn't overridden
        if (result.analysis?.priority && !this.priorityOverridden()) {
          this.selectedPriority.set(result.analysis.priority as Priority);
        }
      },
      error: (err) => {
        this.message.error(err?.message || 'Failed to get AI suggestions');
        this.loadingSuggestions.set(false);
      },
    });
  }

  /** Recalculate the suggestion based on current form state */
  private recalculateSuggestion(): void {
    const formType = this.formType();
    let title = '';
    let description = '';
    const selectedOptions: string[] = [];

    if (formType === 'MIS') {
      const misForm = this.misFormRef();
      if (misForm) {
        const payload = misForm.getPayload();
        title = this.generateMISTitle(payload);
        description = payload.details || '';

        // Gather selected checkbox options
        if (payload.category === 'WEBSITE' && 'website' in payload && payload.website) {
          if (payload.website.addRemoveContent) selectedOptions.push('addRemoveContent');
          if (payload.website.addRemoveFeatures) selectedOptions.push('addRemoveFeatures');
          if (payload.website.addRemovePage) selectedOptions.push('addRemovePage');
        } else if (payload.category === 'SOFTWARE' && 'software' in payload && payload.software) {
          if (payload.software.fixError) selectedOptions.push('fixError');
          if (payload.software.enhancement) selectedOptions.push('enhancement');
          if (payload.software.newIS) selectedOptions.push('newIS');
          if (payload.software.userTraining) selectedOptions.push('userTraining');
          if (payload.software.backupDatabase) selectedOptions.push('backupDatabase');
          if (payload.software.installExisting) selectedOptions.push('installExisting');
          if (payload.software.isImplementationSupport)
            selectedOptions.push('isImplementationSupport');
        }
      }
    } else {
      const itsForm = this.itsFormRef();
      if (itsForm) {
        const payload = itsForm.getPayload();
        title = this.generateITSTitle(payload);
        description = payload.details || '';

        if (payload.itsMaintenance?.desktopLaptop) {
          const dl = payload.itsMaintenance.desktopLaptop;
          if (Object.values(dl).some((v) => v === true)) selectedOptions.push('desktopLaptop');
        }
        if (payload.itsMaintenance?.internetNetwork) {
          const inet = payload.itsMaintenance.internetNetwork;
          if (Object.values(inet).some((v) => v === true)) selectedOptions.push('internetNetwork');
        }
        if (payload.itsMaintenance?.printer) {
          const p = payload.itsMaintenance.printer;
          if (Object.values(p).some((v) => v === true)) selectedOptions.push('printer');
        }
        if (payload.itsBorrow?.purpose) selectedOptions.push('borrowRequest');
      }
    }

    const suggestion = suggestPriority(title, description, selectedOptions);
    this.prioritySuggestion.set(suggestion);

    // Auto-apply suggestion only if user hasn't manually overridden
    if (!this.priorityOverridden()) {
      this.selectedPriority.set(suggestion.priority);
    }
  }

  constructor() {
    this.formTypeControl.valueChanges.subscribe((v) => this.formType.set(v));
  }

  /**
   * Generate a descriptive title for MIS tickets based on category and selections
   */
  private generateMISTitle(payload: any): string {
    const category = payload.category;
    const details = category === 'WEBSITE' ? payload.website : payload.software;

    if (category === 'WEBSITE') {
      const selections = [];
      if (details.addRemoveContent) selections.push('Content');
      if (details.addRemoveFeatures) selections.push('Features');
      if (details.addRemovePage) selections.push('Page');
      if (details.others) selections.push(details.others);

      return `Website: ${selections.join(', ') || 'Request'}`;
    } else {
      const selections = [];
      if (details.fixError) selections.push('Fix Error');
      if (details.enhancement) selections.push('Enhancement');
      if (details.newIS) selections.push('New IS');
      if (details.userTraining) selections.push('Training');
      if (details.backupDatabase) selections.push('Backup');
      if (details.installExisting) selections.push('Installation');
      if (details.isImplementationSupport) selections.push('Implementation Support');
      if (details.others) selections.push(details.others);

      return `Software: ${selections.join(', ') || 'Request'}`;
    }
  }

  /**
   * Generate a descriptive title for ITS tickets based on maintenance/borrow selections
   */
  private generateITSTitle(payload: any): string {
    const maintenance = payload.itsMaintenance;
    const borrow = payload.itsBorrow;

    const issues = [];

    // Check maintenance categories
    if (maintenance?.desktopLaptop) {
      const dl = maintenance.desktopLaptop;
      if (dl.reformatBackup) issues.push('Reformat/Backup');
      if (dl.virusRemoval) issues.push('Virus Removal');
      if (dl.cleaning) issues.push('Cleaning');
      if (dl.noPower) issues.push('No Power');
      if (dl.checkup) issues.push('Checkup');
    }

    if (maintenance?.internetNetwork) {
      const inet = maintenance.internetNetwork;
      if (inet.newConnection) issues.push('New Connection');
      if (inet.noInternetConnection) issues.push('No Internet');
      if (inet.wifiRouterProblem) issues.push('WiFi/Router Issue');
    }

    if (maintenance?.printer) {
      const p = maintenance.printer;
      if (p.noPowerDeadset) issues.push('Printer No Power');
      if (p.paperJam) issues.push('Paper Jam');
    }

    if (maintenance?.othersConcerns) {
      issues.push(maintenance.othersConcerns);
    }

    if (borrow?.purpose) {
      issues.push(`Borrow: ${borrow.purpose}`);
    }

    return issues.length > 0 ? issues.join(', ') : 'ITS Support Request';
  }

  async submit(): Promise<void> {
    const selectedFormType = this.formType();
    let payload: any;

    // Validate and get payload from active form
    if (selectedFormType === 'MIS') {
      const misForm = this.misFormRef();
      if (!misForm) {
        this.message.error('MIS form not initialized');
        return;
      }

      const validation = misForm.validate();
      if (!validation.valid) {
        this.message.warning(validation.error || 'Please complete the MIS form.');
        return;
      }

      payload = {
        formType: 'MIS',
        ...misForm.getPayload(),
      };
    } else {
      const itsForm = this.itsFormRef();
      if (!itsForm) {
        this.message.error('ITS form not initialized');
        return;
      }

      const validation = itsForm.validate();
      if (!validation.valid) {
        this.message.warning(validation.error || 'Please complete the ITS form.');
        return;
      }

      payload = {
        formType: 'ITS',
        ...itsForm.getPayload(),
      };
    }
    try {
      this.busy.set(true);

      // console.log('Submitting ticket payload:', payload);

      let response;

      if (selectedFormType === 'MIS') {
        // Map frontend payload to backend CreateMISTicketInput
        const categoryData = payload.category === 'WEBSITE' ? payload.website : payload.software;

        // Build description with user info
        const fullDescription = `Requester: ${payload.requesterName}\nDepartment: ${payload.department}\nRequested Date: ${new Date(payload.requestedDate).toLocaleDateString()}\n\n${payload.details || 'No additional details provided'}`;

        const misInput: CreateMISTicketInput = {
          title: this.generateMISTitle(payload),
          description: fullDescription,
          priority: this.selectedPriority(),
          category: payload.category,
        };

        // Map category-specific fields based on type
        if (payload.category === 'WEBSITE') {
          misInput.websiteNewRequest = categoryData.addRemovePage || false;
          misInput.websiteUpdate =
            categoryData.addRemoveContent || categoryData.addRemoveFeatures || false;
        } else {
          misInput.softwareNewRequest = categoryData.newIS || false;
          misInput.softwareUpdate = categoryData.enhancement || categoryData.fixError || false;
          misInput.softwareInstall =
            categoryData.installExisting || categoryData.backupDatabase || false;
        }

        response = await firstValueFrom(this.ticketService.createMISTicket(misInput));
      } else {
        // Map frontend payload to backend CreateITSTicketInput
        const maintenance = payload.itsMaintenance;
        const borrow = payload.itsBorrow;
        const endUser = payload.itsEndUserInfo;

        // Build detailed description
        let fullDescription = `End User: ${endUser?.name || 'N/A'}\nDepartment: ${endUser?.departmentUnit || 'N/A'}\n${endUser?.mrn ? 'MRN: ' + endUser.mrn + '\n' : ''}\n`;

        if (payload.details) {
          fullDescription += `\nDetails: ${payload.details}\n`;
        }

        // Build maintenance details string
        const maintenanceItems = [];
        if (maintenance?.desktopLaptop) {
          const items = Object.entries(maintenance.desktopLaptop)
            .filter(([k, v]) => v === true)
            .map(([k]) => k);
          if (items.length) maintenanceItems.push(`Desktop/Laptop: ${items.join(', ')}`);
        }
        if (maintenance?.internetNetwork) {
          const items = Object.entries(maintenance.internetNetwork)
            .filter(([k, v]) => v === true)
            .map(([k]) => k);
          if (items.length) maintenanceItems.push(`Internet/Network: ${items.join(', ')}`);
        }
        if (maintenance?.printer) {
          const items = Object.entries(maintenance.printer)
            .filter(([k, v]) => v === true)
            .map(([k]) => k);
          if (items.length) maintenanceItems.push(`Printer: ${items.join(', ')}`);
        }
        if (maintenance?.othersConcerns) {
          maintenanceItems.push(`Others: ${maintenance.othersConcerns}`);
        }

        const maintenanceDetailsStr =
          maintenanceItems.length > 0 ? maintenanceItems.join('\n') : undefined;
        const borrowDetailsStr = borrow?.purpose
          ? `Purpose: ${borrow.purpose}\nDuration: ${borrow.duration || 'N/A'}\nVenue: ${borrow.venueRoom || 'N/A'}\nItems: ${borrow.borrowedItems || 'N/A'}`
          : undefined;

        const itsInput: CreateITSTicketInput = {
          title: this.generateITSTitle(payload),
          description: fullDescription,
          priority: this.selectedPriority(),
          borrowRequest: !!borrow?.purpose,
          borrowDetails: borrowDetailsStr,
          maintenanceDesktopLaptop: !!(
            maintenance?.desktopLaptop && Object.values(maintenance.desktopLaptop).some((v) => v)
          ),
          maintenanceInternetNetwork: !!(
            maintenance?.internetNetwork &&
            Object.values(maintenance.internetNetwork).some((v) => v)
          ),
          maintenancePrinter: !!(
            maintenance?.printer && Object.values(maintenance.printer).some((v) => v)
          ),
          maintenanceDetails: maintenanceDetailsStr,
        };

        response = await firstValueFrom(this.ticketService.createITSTicket(itsInput));
      }

      this.message.success(`Ticket ${response.ticketNumber} submitted successfully!`);
      this.router.navigateByUrl('/tickets');
    } catch (error: any) {
      console.error('Failed to submit ticket:', error);
      const errorMsg = error?.message || 'Failed to submit ticket. Please try again.';
      this.message.error(errorMsg);
    } finally {
      this.busy.set(false);
    }
  }
}
