import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
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
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth.service';
import { TicketService, CreateMISTicketInput, CreateITSTicketInput } from '../../core/services/ticket.service';
import { MISFormComponent } from './mis-form.component';
import { ITSFormComponent } from './its-form.component';
import { firstValueFrom } from 'rxjs';

type RequestCategory = 'WEBSITE' | 'SOFTWARE';

@Component({
  selector: 'app-submit-ticket',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzRadioModule,
    NzGridModule,
    NzSpinModule,
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

      console.log('Submitting ticket payload:', payload);

      let response;

      if (selectedFormType === 'MIS') {
        // Map frontend payload to backend CreateMISTicketInput
        const categoryData = payload.category === 'WEBSITE' ? payload.website : payload.software;

        // Build description with user info
        const fullDescription = `Requester: ${payload.requesterName}\nDepartment: ${payload.department}\nRequested Date: ${new Date(payload.requestedDate).toLocaleDateString()}\n\n${payload.details || 'No additional details provided'}`;

        const misInput: CreateMISTicketInput = {
          title: this.generateMISTitle(payload),
          description: fullDescription,
          priority: 'MEDIUM',
          category: payload.category,
        };

        // Map category-specific fields based on type
        if (payload.category === 'WEBSITE') {
          misInput.websiteNewRequest = categoryData.addRemovePage || false;
          misInput.websiteUpdate = categoryData.addRemoveContent || categoryData.addRemoveFeatures || false;
        } else {
          misInput.softwareNewRequest = categoryData.newIS || false;
          misInput.softwareUpdate = categoryData.enhancement || categoryData.fixError || false;
          misInput.softwareInstall = categoryData.installExisting || categoryData.backupDatabase || false;
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

        const maintenanceDetailsStr = maintenanceItems.length > 0 ? maintenanceItems.join('\n') : undefined;
        const borrowDetailsStr = borrow?.purpose ? `Purpose: ${borrow.purpose}\nDuration: ${borrow.duration || 'N/A'}\nVenue: ${borrow.venueRoom || 'N/A'}\nItems: ${borrow.borrowedItems || 'N/A'}` : undefined;

        const itsInput: CreateITSTicketInput = {
          title: this.generateITSTitle(payload),
          description: fullDescription,
          priority: 'MEDIUM',
          borrowRequest: !!borrow?.purpose,
          borrowDetails: borrowDetailsStr,
          maintenanceDesktopLaptop: !!(maintenance?.desktopLaptop && Object.values(maintenance.desktopLaptop).some(v => v)),
          maintenanceInternetNetwork: !!(maintenance?.internetNetwork && Object.values(maintenance.internetNetwork).some(v => v)),
          maintenancePrinter: !!(maintenance?.printer && Object.values(maintenance.printer).some(v => v)),
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
