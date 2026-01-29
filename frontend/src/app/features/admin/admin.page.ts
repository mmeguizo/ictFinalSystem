import { Component, ChangeDetectionStrategy, inject, OnInit,signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerComponent } from 'ng-zorro-antd/divider';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { AdminApiService } from '../../api/admin-api.service';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';

@Component({
  selector: 'app-admin',
  imports: [NzCardModule, NzIconModule, NzTableModule, NzDividerComponent, NzAvatarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnInit {
  private readonly adminApiService = inject(AdminApiService);

  userDataSource = signal<Array<{
    id: number;
    name: string | null;
    role: string;
    email: string;
    avatarUrl: string | null;
    picture: string | null;
  }>>([]);


  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.adminApiService.getAllUsers().subscribe({
      next: (response) => {
        // this.userDataSource = response?.data?.users;
        console.log('Users loaded:', response?.data?.users);
        this.userDataSource.set(response?.data?.users || []);
      },
      error: (error) => {
        console.error('Failed to load users:', error);
      },
    });
  }

  readonly dataSet = [
    {
      name: 'John Doe',
      age: 30,
      address: '123 Main St, City, State',
    },
    {
      name: 'Jane Smith',
      age: 25,
      address: '456 Oak Ave, Town, State',
    },
    {
      name: 'Bob Johnson',
      age: 35,
      address: '789 Pine Rd, Village, State',
    },
    {
      name: 'Alice Brown',
      age: 28,
      address: '321 Elm St, Borough, State',
    },
  ];
}
