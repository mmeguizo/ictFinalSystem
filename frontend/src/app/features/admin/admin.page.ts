import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { AdminApiService, UserData } from '../../api/admin-api.service';

const ALL_ROLES = [
  'ADMIN',
  'DEVELOPER',
  'TECHNICAL',
  'SECRETARY',
  'DIRECTOR',
  'MIS_HEAD',
  'ITS_HEAD',
  'USER',
] as const;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  DEVELOPER: 'Developer',
  TECHNICAL: 'Technical',
  SECRETARY: 'Secretary',
  DIRECTOR: 'Director',
  MIS_HEAD: 'MIS Head',
  ITS_HEAD: 'ITS Head',
  USER: 'User',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'red',
  DEVELOPER: 'blue',
  TECHNICAL: 'cyan',
  SECRETARY: 'orange',
  DIRECTOR: 'purple',
  MIS_HEAD: 'green',
  ITS_HEAD: 'geekblue',
  USER: 'default',
};

@Component({
  selector: 'app-admin',
  imports: [
    FormsModule,
    NzCardModule,
    NzIconModule,
    NzTableModule,
    NzAvatarModule,
    NzButtonModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzPopconfirmModule,
    NzTagModule,
    NzSwitchModule,
    NzToolTipModule,
    NzBadgeModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnInit {
  private readonly adminApiService = inject(AdminApiService);
  private readonly message = inject(NzMessageService);

  // Data
  userDataSource = signal<UserData[]>([]);
  loading = signal(false);
  searchText = signal('');

  // Filtered list
  filteredUsers = computed(() => {
    const search = this.searchText().toLowerCase().trim();
    const users = this.userDataSource();
    if (!search) return users;
    return users.filter(
      (u) =>
        (u.name?.toLowerCase() ?? '').includes(search) ||
        u.email.toLowerCase().includes(search) ||
        u.role.toLowerCase().includes(search),
    );
  });

  // Create user modal
  isCreateModalVisible = signal(false);
  createForm = signal({
    email: '',
    name: '',
    password: '',
    role: 'USER' as string,
  });
  createLoading = signal(false);

  // Set password modal
  isPasswordModalVisible = signal(false);
  passwordForm = signal({ userId: 0, userName: '', password: '' });
  passwordLoading = signal(false);

  // Password visibility toggles
  showCreatePassword = signal(false);
  showSetPassword = signal(false);

  // Constants for template
  readonly allRoles = ALL_ROLES;
  readonly roleLabels = ROLE_LABELS;
  readonly roleColors = ROLE_COLORS;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.adminApiService.getAllUsers().subscribe({
      next: (response) => {
        this.userDataSource.set(response?.data?.users || []);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load users:', error);
        this.message.error('Failed to load users');
        this.loading.set(false);
      },
    });
  }

  // --- Create User ---
  openCreateModal(): void {
    this.createForm.set({ email: '', name: '', password: '', role: 'USER' });
    this.isCreateModalVisible.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalVisible.set(false);
  }

  submitCreateUser(): void {
    const form = this.createForm();
    if (!form.email.trim()) {
      this.message.warning('Email is required');
      return;
    }

    this.createLoading.set(true);
    const input: any = {
      email: form.email.trim(),
      role: form.role,
    };
    if (form.name.trim()) input.name = form.name.trim();
    if (form.password.trim()) input.password = form.password.trim();

    this.adminApiService.createUser(input).subscribe({
      next: () => {
        this.message.success('User created successfully');
        this.isCreateModalVisible.set(false);
        this.createLoading.set(false);
        this.loadUsers();
      },
      error: (error) => {
        console.error('Failed to create user:', error);
        const msg = error?.message || 'Failed to create user';
        this.message.error(msg);
        this.createLoading.set(false);
      },
    });
  }

  updateCreateField(field: string, value: string): void {
    this.createForm.update((f) => ({ ...f, [field]: value }));
  }

  // --- Change Role ---
  onRoleChange(user: UserData, newRole: string): void {
    this.adminApiService.setUserRole(user.id, newRole).subscribe({
      next: () => {
        this.message.success(`Role updated to ${ROLE_LABELS[newRole]}`);
        this.loadUsers();
      },
      error: (error) => {
        console.error('Failed to update role:', error);
        this.message.error('Failed to update role');
      },
    });
  }

  // --- Toggle Active ---
  onToggleActive(user: UserData): void {
    const action = user.isActive ? 'deactivate' : 'activate';
    this.adminApiService.toggleUserActive(user.id).subscribe({
      next: () => {
        this.message.success(`User ${action}d successfully`);
        this.loadUsers();
      },
      error: (error) => {
        console.error(`Failed to ${action} user:`, error);
        this.message.error(error?.message || `Failed to ${action} user`);
      },
    });
  }

  // --- Set Password ---
  openPasswordModal(user: UserData): void {
    this.passwordForm.set({
      userId: user.id,
      userName: user.name || user.email,
      password: '',
    });
    this.isPasswordModalVisible.set(true);
  }

  closePasswordModal(): void {
    this.isPasswordModalVisible.set(false);
  }

  submitSetPassword(): void {
    const form = this.passwordForm();
    if (!form.password.trim() || form.password.trim().length < 8) {
      this.message.warning('Password must be at least 8 characters');
      return;
    }

    this.passwordLoading.set(true);
    this.adminApiService.setLocalPassword(form.userId, form.password.trim()).subscribe({
      next: () => {
        this.message.success('Password updated successfully');
        this.isPasswordModalVisible.set(false);
        this.passwordLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to set password:', error);
        this.message.error('Failed to set password');
        this.passwordLoading.set(false);
      },
    });
  }

  updatePasswordField(value: string): void {
    this.passwordForm.update((f) => ({ ...f, password: value }));
  }

  // --- Delete User ---
  onDeleteUser(user: UserData): void {
    this.adminApiService.deleteUser(user.id).subscribe({
      next: () => {
        this.message.success('User deleted successfully');
        this.loadUsers();
      },
      error: (error) => {
        console.error('Failed to delete user:', error);
        this.message.error(error?.message || 'Failed to delete user');
      },
    });
  }

  // --- Helpers ---
  getAuthMethod(user: UserData): string {
    if (user.externalId && (user as any).password) return 'SSO + Local';
    if (user.externalId) return 'SSO';
    return 'Local';
  }

  onSearchChange(value: string): void {
    this.searchText.set(value);
  }
}
