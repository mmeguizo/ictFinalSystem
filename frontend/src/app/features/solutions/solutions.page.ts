import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { SolutionService, Solution } from '../../core/services/solution.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-solutions-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzModalModule,
    NzFormModule,
    NzTagModule,
    NzPopconfirmModule,
    NzEmptyModule,
    NzSpinModule,
    NzToolTipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-card nzTitle="Troubleshooting Solutions" [nzExtra]="headerExtra">
      <ng-template #headerExtra>
        <div style="display: flex; gap: 8px; align-items: center;">
          <nz-input-group [nzPrefix]="searchIcon" style="width: 250px;">
            <input
              nz-input
              placeholder="Search solutions..."
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearch()"
            />
          </nz-input-group>
          <ng-template #searchIcon><span nz-icon nzType="search"></span></ng-template>
          <button nz-button nzType="primary" (click)="openCreateModal()">
            <span nz-icon nzType="plus"></span> Add Solution
          </button>
        </div>
      </ng-template>

      <p style="color: #8c8c8c; margin-bottom: 16px;">
        Add troubleshooting solutions here. The AI assistant will use these to help users resolve
        issues.
      </p>

      @if (loading()) {
        <div style="text-align: center; padding: 40px;"><nz-spin nzSimple></nz-spin></div>
      } @else if (solutions().length === 0) {
        <nz-empty [nzNotFoundContent]="'No solutions yet. Be the first to add one!'"></nz-empty>
      } @else {
        <nz-table
          #solutionTable
          [nzData]="solutions()"
          [nzPageSize]="pageSize"
          [nzTotal]="totalCount()"
          [nzPageIndex]="page()"
          [nzFrontPagination]="false"
          (nzPageIndexChange)="onPageChange($event)"
          nzSize="middle"
        >
          <thead>
            <tr>
              <th nzWidth="30%">Problem</th>
              <th nzWidth="35%">Solution</th>
              <th nzWidth="10%">Category</th>
              <th nzWidth="10%">Added By</th>
              <th nzWidth="15%">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (item of solutionTable.data; track item.id) {
              <tr>
                <td>
                  <strong>{{ item.problem }}</strong>
                  @if (item.tags) {
                    <div style="margin-top: 4px;">
                      @for (tag of item.tags.split(','); track tag) {
                        <nz-tag>{{ tag.trim() }}</nz-tag>
                      }
                    </div>
                  }
                </td>
                <td style="white-space: pre-wrap; max-width: 300px;">
                  {{ item.solution | slice: 0 : 200 }}{{ item.solution.length > 200 ? '...' : '' }}
                </td>
                <td>
                  <nz-tag [nzColor]="getCategoryColor(item.category)">{{ item.category }}</nz-tag>
                </td>
                <td>{{ item.createdBy.name }}</td>
                <td>
                  <button
                    nz-button
                    nzType="link"
                    nzSize="small"
                    (click)="openEditModal(item)"
                    nz-tooltip
                    nzTooltipTitle="Edit"
                  >
                    <span nz-icon nzType="edit"></span>
                  </button>
                  <button
                    nz-button
                    nzType="link"
                    nzSize="small"
                    nzDanger
                    nz-popconfirm
                    nzPopconfirmTitle="Delete this solution?"
                    (nzOnConfirm)="deleteSolution(item.id)"
                  >
                    <span nz-icon nzType="delete"></span>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>

    <!-- Create/Edit Modal -->
    <nz-modal
      [(nzVisible)]="isModalVisible"
      [nzTitle]="editingId ? 'Edit Solution' : 'Add Troubleshooting Solution'"
      [nzOkText]="editingId ? 'Update' : 'Save'"
      [nzOkLoading]="saving()"
      (nzOnOk)="saveSolution()"
      (nzOnCancel)="isModalVisible = false"
      nzWidth="640px"
    >
      <ng-container *nzModalContent>
        <form [formGroup]="form" nz-form nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>Problem / Issue</nz-form-label>
            <nz-form-control nzErrorTip="Please describe the problem (min 10 characters)">
              <textarea
                nz-input
                formControlName="problem"
                rows="3"
                placeholder="e.g., User cannot connect to WiFi after Windows update"
              ></textarea>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired>Solution / Steps</nz-form-label>
            <nz-form-control nzErrorTip="Please provide the solution (min 10 characters)">
              <textarea
                nz-input
                formControlName="solution"
                rows="6"
                placeholder="1. Open Network Settings&#10;2. Click 'Network Reset'&#10;3. Restart computer&#10;4. Reconnect to WiFi"
              ></textarea>
            </nz-form-control>
          </nz-form-item>

          <div style="display: flex; gap: 16px;">
            <nz-form-item style="flex: 1;">
              <nz-form-label nzRequired>Category</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="category" nzPlaceHolder="Select category">
                  <nz-option nzValue="NETWORK" nzLabel="Network"></nz-option>
                  <nz-option nzValue="HARDWARE" nzLabel="Hardware"></nz-option>
                  <nz-option nzValue="SOFTWARE" nzLabel="Software"></nz-option>
                  <nz-option nzValue="PRINTER" nzLabel="Printer"></nz-option>
                  <nz-option nzValue="EMAIL" nzLabel="Email"></nz-option>
                  <nz-option nzValue="ACCOUNT" nzLabel="Account"></nz-option>
                  <nz-option nzValue="OTHER" nzLabel="Other"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item style="flex: 1;">
              <nz-form-label>Tags (comma-separated)</nz-form-label>
              <nz-form-control>
                <input nz-input formControlName="tags" placeholder="e.g., wifi, windows, driver" />
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SolutionsPage implements OnInit {
  private readonly solutionService = inject(SolutionService);
  private readonly authService = inject(AuthService);
  private readonly msg = inject(NzMessageService);
  private readonly fb = inject(FormBuilder);

  readonly solutions = signal<Solution[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly pageSize = 20;

  searchQuery = '';
  isModalVisible = false;
  editingId: number | null = null;

  form = this.fb.group({
    problem: ['', [Validators.required, Validators.minLength(10)]],
    solution: ['', [Validators.required, Validators.minLength(10)]],
    category: ['', Validators.required],
    tags: [''],
  });

  ngOnInit() {
    this.loadSolutions();
  }

  loadSolutions() {
    this.loading.set(true);
    const filter: any = {};
    if (this.searchQuery.trim()) filter.search = this.searchQuery.trim();

    this.solutionService.getSolutions(filter, this.page(), this.pageSize).subscribe({
      next: (data) => {
        this.solutions.set(data.items);
        this.totalCount.set(data.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.msg.error('Failed to load solutions');
        this.loading.set(false);
      },
    });
  }

  onSearch() {
    this.page.set(1);
    this.loadSolutions();
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.loadSolutions();
  }

  openCreateModal() {
    this.editingId = null;
    this.form.reset({ problem: '', solution: '', category: '', tags: '' });
    this.isModalVisible = true;
  }

  openEditModal(item: Solution) {
    this.editingId = item.id;
    this.form.patchValue({
      problem: item.problem,
      solution: item.solution,
      category: item.category,
      tags: item.tags || '',
    });
    this.isModalVisible = true;
  }

  saveSolution() {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }

    this.saving.set(true);
    const val = this.form.value;
    const input = {
      problem: val.problem!,
      solution: val.solution!,
      category: val.category!,
      tags: val.tags || undefined,
    };

    const op = this.editingId
      ? this.solutionService.updateSolution(this.editingId, input)
      : this.solutionService.createSolution(input);

    op.subscribe({
      next: () => {
        this.msg.success(this.editingId ? 'Solution updated' : 'Solution added');
        this.isModalVisible = false;
        this.saving.set(false);
        this.loadSolutions();
      },
      error: () => {
        this.msg.error('Failed to save solution');
        this.saving.set(false);
      },
    });
  }

  deleteSolution(id: number) {
    this.solutionService.deleteSolution(id).subscribe({
      next: () => {
        this.msg.success('Solution deleted');
        this.loadSolutions();
      },
      error: () => this.msg.error('Failed to delete solution'),
    });
  }

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      NETWORK: 'blue',
      HARDWARE: 'orange',
      SOFTWARE: 'green',
      PRINTER: 'purple',
      EMAIL: 'cyan',
      ACCOUNT: 'gold',
      OTHER: 'default',
    };
    return colors[category] || 'default';
  }
}
