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
import { NzMessageService } from 'ng-zorro-antd/message';
import { UserService } from '../../core/services/user.service';
import { MISFormComponent } from './mis-form.component';
import { ITSFormComponent } from './its-form.component';

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
  private readonly userService = inject(UserService);

  readonly today = new Date();
  readonly busy = signal(false);

  readonly userName = computed(() => this.userService.currentUser()?.name ?? '');
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

      // TODO: integrate with backend API
      await new Promise((res) => setTimeout(res, 400));

      this.message.success('Ticket submitted successfully.');
      // this.router.navigateByUrl('/dashboard');
    } catch {
      this.message.error('Failed to submit ticket. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
