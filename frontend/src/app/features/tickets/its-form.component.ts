import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzGridModule } from 'ng-zorro-antd/grid';

@Component({
  selector: 'app-its-form',
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzCheckboxModule,
    NzGridModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './its-form.component.html',
  styles: [`
    .section-card {
      margin-bottom: 16px;

      h4 {
        font-weight: 600;
        color: #1890ff;
        margin-bottom: 12px;
        font-size: 14px;
      }
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `],
})
export class ITSFormComponent {
  private readonly fb = inject(FormBuilder);

  private formatDateForInput(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

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

    itsJobAccomplishment: this.fb.group({
      completedBy: [''],
      dateCompleted: [''],
      concernDiagnose: [''],
      workPerformed: [''],
      recommendation: [''],
      status: [''],
    }),
  });

  borrowGroup = this.formGroup.get('itsBorrow') as FormGroup;
  maintenanceGroup = this.formGroup.get('itsMaintenance') as FormGroup;
  endUserGroup = this.formGroup.get('itsEndUserInfo') as FormGroup;
  jobAccomplishmentGroup = this.formGroup.get('itsJobAccomplishment') as FormGroup;

  // Nested maintenance groups
  desktopLaptopGroup = this.maintenanceGroup.get('desktopLaptop') as FormGroup;
  internetNetworkGroup = this.maintenanceGroup.get('internetNetwork') as FormGroup;
  printerGroup = this.maintenanceGroup.get('printer') as FormGroup;

  validate(): { valid: boolean; error?: string } {
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

    if (!hasMaintenance && !hasBorrow) {
      return {
        valid: false,
        error: 'Please select a maintenance option or fill in the borrow section.',
      };
    }

    return { valid: true };
  }

  getPayload() {
    return {
      ...this.formGroup.value,
      requestedAtISO: new Date().toISOString(),
    };
  }
}
