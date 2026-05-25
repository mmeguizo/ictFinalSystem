import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { AuthService } from '../../core/services/auth.service';

type RequestType = 'BORROW' | 'MAINTENANCE' | 'BOTH';

@Component({
  selector: 'app-its-form',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzCheckboxModule,
    NzGridModule,
    NzRadioModule,
    NzIconModule,
    NzDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './its-form.component.html',
  styleUrl: './its-form.component.scss',
})
export class ITSFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly contentChanged = output<void>();

  private formatDateForInput(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ─── Request Type ────────────────────────────────────────────────────────────
  // Controls which section cards are shown: BORROW, MAINTENANCE, or BOTH
  readonly requestType = signal<RequestType>('MAINTENANCE');
  readonly showBorrow = computed(
    () => this.requestType() === 'BORROW' || this.requestType() === 'BOTH',
  );
  readonly showMaintenance = computed(
    () => this.requestType() === 'MAINTENANCE' || this.requestType() === 'BOTH',
  );

  // ─── Form Value Signal ───────────────────────────────────────────────────────
  // Mirrors the reactive form value as a signal so computed properties
  // stay reactive inside an OnPush component.
  private readonly formValue = signal<any>({});

  // Highlight a category group when any of its checkboxes is checked
  readonly hasDesktopCheck = computed(() => {
    const dl = this.formValue()?.itsMaintenance?.desktopLaptop;
    return dl ? Object.values(dl).some((v) => v === true) : false;
  });
  readonly hasNetworkCheck = computed(() => {
    const inet = this.formValue()?.itsMaintenance?.internetNetwork;
    return inet ? Object.values(inet).some((v) => v === true) : false;
  });
  readonly hasPrinterCheck = computed(() => {
    const p = this.formValue()?.itsMaintenance?.printer;
    return p ? Object.values(p).some((v) => v === true) : false;
  });

  // ─── Form Group ──────────────────────────────────────────────────────────────
  readonly formGroup = this.fb.group({
    details: [''],

    itsBorrow: this.fb.group({
      purpose: [''],
      duration: [''],
      venueRoom: [''],
      borrowedItems: [''],
    }),

    itsMaintenance: this.fb.group({
      desktopLaptop: this.fb.group({
        reformatBackup: [false],
        virusRemoval: [false],
        cleaning: [false],
        noPower: [false],
        checkup: [false],
      }),
      internetNetwork: this.fb.group({
        newConnection: [false],
        noInternetConnection: [false],
        wifiRouterProblem: [false],
      }),
      printer: this.fb.group({
        noPowerDeadset: [false],
        paperJam: [false],
      }),
      othersConcerns: [''],
    }),

    itsEndUserInfo: this.fb.group({
      name: [''],
      date: [this.formatDateForInput(new Date())],
      departmentUnit: [''],
      mrn: [''],
    }),
  });

  // Convenient group accessors for template bindings
  readonly borrowGroup = this.formGroup.get('itsBorrow') as FormGroup;
  readonly maintenanceGroup = this.formGroup.get('itsMaintenance') as FormGroup;
  readonly endUserGroup = this.formGroup.get('itsEndUserInfo') as FormGroup;
  readonly desktopLaptopGroup = this.maintenanceGroup.get('desktopLaptop') as FormGroup;
  readonly internetNetworkGroup = this.maintenanceGroup.get('internetNetwork') as FormGroup;
  readonly printerGroup = this.maintenanceGroup.get('printer') as FormGroup;

  constructor() {
    // Auto-fill name from the currently logged-in user
    const user = this.authService.currentUser();
    if (user?.name) {
      this.formGroup.get('itsEndUserInfo.name')?.setValue(user.name, { emitEvent: false });
    }

    // Keep the formValue signal in sync so computed properties re-evaluate
    this.formGroup.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((val) => {
      this.formValue.set(val);
      this.contentChanged.emit();
    });
  }

  // ─── Validation ──────────────────────────────────────────────────────────────
  validate(): { valid: boolean; error?: string } {
    const type = this.requestType();
    const maintenance = this.maintenanceGroup.value;
    const borrow = this.borrowGroup.value;

    const hasMaintenance =
      maintenance?.desktopLaptop?.reformatBackup ||
      maintenance?.desktopLaptop?.virusRemoval ||
      maintenance?.desktopLaptop?.cleaning ||
      maintenance?.desktopLaptop?.noPower ||
      maintenance?.desktopLaptop?.checkup ||
      maintenance?.internetNetwork?.newConnection ||
      maintenance?.internetNetwork?.noInternetConnection ||
      maintenance?.internetNetwork?.wifiRouterProblem ||
      maintenance?.printer?.noPowerDeadset ||
      maintenance?.printer?.paperJam ||
      !!maintenance?.othersConcerns?.trim();

    const hasBorrow = !!borrow?.purpose?.trim();

    if ((type === 'BORROW' || type === 'BOTH') && !hasBorrow) {
      return { valid: false, error: 'Please specify the purpose of borrowing.' };
    }
    if ((type === 'MAINTENANCE' || type === 'BOTH') && !hasMaintenance) {
      return { valid: false, error: 'Please select at least one maintenance option.' };
    }

    return { valid: true };
  }

  /** Apply AI-rewritten description to the details field */
  setDetails(text: string): void {
    this.formGroup.get('details')?.setValue(text);
  }

  getPayload() {
    return {
      ...this.formGroup.value,
      requestType: this.requestType(),
      requestedAtISO: new Date().toISOString(),
    };
  }
}
