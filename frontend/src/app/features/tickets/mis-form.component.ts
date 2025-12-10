import { ChangeDetectionStrategy, Component, signal, computed, effect, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzGridModule } from 'ng-zorro-antd/grid';

@Component({
  selector: 'app-mis-form',
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzCheckboxModule,
    NzRadioModule,
    NzGridModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="formGroup">
      <div nz-row [nzGutter]="16">
        <div nz-col [nzXs]="24" [nzSm]="12">
          <nz-form-item>
            <nz-form-label>Name</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="requesterName" placeholder="Your full name" />
            </nz-form-control>
          </nz-form-item>
        </div>
        <div nz-col [nzXs]="24" [nzSm]="12">
          <nz-form-item>
            <nz-form-label>Department</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="department" placeholder="Your department" />
            </nz-form-control>
          </nz-form-item>
        </div>
      </div>

      <div nz-row [nzGutter]="16">
        <div nz-col [nzXs]="24" [nzSm]="12">
          <nz-form-item>
            <nz-form-label>Date</nz-form-label>
            <nz-form-control>
              <input nz-input type="date" formControlName="requestedDate" aria-label="Request date" />
            </nz-form-control>
          </nz-form-item>
        </div>
        <div nz-col [nzXs]="24" [nzSm]="12">
          <nz-form-item>
            <nz-form-label>Control Number</nz-form-label>
            <nz-form-control>
              <input
                nz-input
                formControlName="controlNumber"
                placeholder="e.g. 2025-001"
                aria-label="Control number"
              />
            </nz-form-control>
          </nz-form-item>
        </div>
      </div>

      <nz-form-item>
        <nz-form-label>Request Category</nz-form-label>
        <nz-form-control>
          <nz-radio-group [formControl]="categoryControl">
            <label nz-radio nzValue="WEBSITE">Website</label>
            <label nz-radio nzValue="SOFTWARE">Software</label>
          </nz-radio-group>
        </nz-form-control>
      </nz-form-item>

      @if (isWebsite()) {
        <nz-card nzTitle="Website">
          <div [formGroup]="websiteGroup">
            <label nz-checkbox formControlName="addRemoveContent">Add/Remove Content</label><br />
            <label nz-checkbox formControlName="addRemoveFeatures">Add/Remove Features</label><br />
            <label nz-checkbox formControlName="addRemovePage">Add/Remove Page</label><br />
            <div class="others">
              <span>Others:</span>
              <input nz-input formControlName="others" placeholder="Please specify" />
            </div>
          </div>
        </nz-card>
      }

      @if (isSoftware()) {
        <nz-card nzTitle="Software">
          <div [formGroup]="softwareGroup">
            <div class="checkbox-grid">
              <label nz-checkbox formControlName="fixError">Fix error/bug</label>
              <label nz-checkbox formControlName="enhancement">Enhancement</label>
              <label nz-checkbox formControlName="newIS">New IS</label>
              <label nz-checkbox formControlName="userTraining">User Training</label>
              <label nz-checkbox formControlName="backupDatabase">Back Up Database</label>
              <label nz-checkbox formControlName="installExisting">Install Existing IS</label>
              <label nz-checkbox formControlName="isImplementationSupport">IS Implementation Support</label>
            </div>
            <div class="others">
              <span>Others:</span>
              <input nz-input formControlName="others" placeholder="Please specify" />
            </div>
          </div>
        </nz-card>
      }

      <!-- Additional Notes (Optional) -->
      <nz-form-item>
        <nz-form-label>Additional Notes (Optional)</nz-form-label>
        <nz-form-control>
          <textarea
            nz-input
            formControlName="details"
            rows="4"
            placeholder="Add any useful details"
          ></textarea>
        </nz-form-control>
      </nz-form-item>
    </div>
  `,
  styles: [`
    .others {
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 8px;

      span {
        min-width: 56px;
        color: #555;
      }
    }

    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 8px 16px;
      margin-bottom: 8px;
    }
  `],
})
export class MISFormComponent {
  private readonly fb = inject(FormBuilder);

  private formatDateForInput(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  readonly formGroup = this.fb.group({
    requesterName: ['', [Validators.required, Validators.maxLength(120)]],
    department: ['', [Validators.required, Validators.maxLength(80)]],
    requestedDate: [this.formatDateForInput(new Date()), Validators.required],
    controlNumber: ['', [Validators.required, Validators.maxLength(100)]],
    category: ['SOFTWARE' as 'WEBSITE' | 'SOFTWARE'],
    details: [''],

    website: this.fb.group({
      addRemoveContent: [false],
      addRemoveFeatures: [false],
      addRemovePage: [false],
      others: [''],
    }),

    software: this.fb.group({
      fixError: [false],
      enhancement: [false],
      newIS: [false],
      userTraining: [false],
      backupDatabase: [false],
      installExisting: [false],
      isImplementationSupport: [false],
      others: [''],
    }),
  });

  categoryControl = this.formGroup.get('category') as FormControl;
  websiteGroup = this.formGroup.get('website') as FormGroup;
  softwareGroup = this.formGroup.get('software') as FormGroup;

  private category = signal<'WEBSITE' | 'SOFTWARE'>('SOFTWARE');

  isWebsite = computed(() => this.category() === 'WEBSITE');
  isSoftware = computed(() => this.category() === 'SOFTWARE');

  constructor() {
    // Set initial category
    const initial = this.categoryControl.value;
    if (initial) {
      this.category.set(initial);
    }

    // Subscribe to category changes
    this.categoryControl.valueChanges.subscribe(cat => {
      this.category.set(cat);
      if (cat === 'WEBSITE') {
        this.softwareGroup?.reset({
          fixError: false,
          enhancement: false,
          newIS: false,
          userTraining: false,
          backupDatabase: false,
          installExisting: false,
          isImplementationSupport: false,
          others: '',
        });
      } else if (cat === 'SOFTWARE') {
        this.websiteGroup?.reset({
          addRemoveContent: false,
          addRemoveFeatures: false,
          addRemovePage: false,
          others: '',
        });
      }
    });
  }

  validate(): { valid: boolean; error?: string } {
    const fg = this.formGroup;

    // Check required fields
    const requesterName = fg.get('requesterName')?.value?.trim();
    const department = fg.get('department')?.value?.trim();
    const controlNumber = fg.get('controlNumber')?.value?.trim();
    const requestedDate = fg.get('requestedDate')?.value;

    if (!requesterName) {
      return { valid: false, error: 'Please fill in Name.' };
    }
    if (!department) {
      return { valid: false, error: 'Please fill in Department.' };
    }
    if (!requestedDate) {
      return { valid: false, error: 'Please select a Date.' };
    }
    // if (!controlNumber) {
    //   return { valid: false, error: 'Please fill in Control Number.' };
    // }

    const cat = this.categoryControl?.value;

    if (cat === 'WEBSITE') {
      const web = this.websiteGroup.value;
      const hasChoice = web.addRemoveContent || web.addRemoveFeatures ||
                        web.addRemovePage || web.others?.trim();
      if (!hasChoice) {
        return { valid: false, error: 'Please select at least one Website option or fill in Others.' };
      }
    } else if (cat === 'SOFTWARE') {
      const soft = this.softwareGroup.value;
      const hasChoice = soft.fixError || soft.enhancement || soft.newIS ||
                        soft.userTraining || soft.backupDatabase ||
                        soft.installExisting || soft.isImplementationSupport ||
                        soft.others?.trim();
      if (!hasChoice) {
        return { valid: false, error: 'Please select at least one Software option or fill in Others.' };
      }
    }

    return { valid: true };
  }

  getPayload() {
    const values = this.formGroup.value;
    const category = values.category;

    return {
      requesterName: values.requesterName,
      department: values.department,
      requestedDate: values.requestedDate,
      controlNumber: values.controlNumber,
      category: category,
      details: values.details,
      // Only include the relevant category data
      ...(category === 'WEBSITE' ? { website: values.website } : { software: values.software }),
      requestedAtISO: new Date(values.requestedDate || new Date()).toISOString(),
    };
  }
}
