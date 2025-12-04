import { Component, ChangeDetectionStrategy } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-admin',
  imports: [NzCardModule, NzIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-page">
      <h1>Admin Panel</h1>
      <nz-card nzTitle="System Overview">
        <p>Admin landing page placeholder.</p>
      </nz-card>
    </div>
  `,
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage {}
