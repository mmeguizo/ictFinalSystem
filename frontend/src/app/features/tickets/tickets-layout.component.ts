import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-tickets-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-layout class="tickets-layout">
      <nz-sider
        nzTheme="light"
        nzWidth="250px"
        nzBreakpoint="lg"
        [nzCollapsedWidth]="80"
        [nzCollapsible]="true"
        [(nzCollapsed)]="isCollapsed"
        [nzTrigger]="null"
      >
        <div class="sidebar-header">
          @if (!isCollapsed()) {
            <h3>Tickets</h3>
          } @else {
            <span nz-icon nzType="file-text" nzTheme="outline" class="collapsed-icon"></span>
          }
        </div>
        <ul nz-menu nzMode="inline" class="tickets-menu" [nzInlineCollapsed]="isCollapsed()">
          <li nz-menu-item [routerLink]="['/tickets']" routerLinkActive="ant-menu-item-selected" [routerLinkActiveOptions]="{exact: true}">
            <span nz-icon nzType="unordered-list" nzTheme="outline"></span>
            <span>My Tickets</span>
          </li>
          @if (canApprove()) {
            <li nz-menu-item [routerLink]="['/tickets/approvals']" routerLinkActive="ant-menu-item-selected" [routerLinkActiveOptions]="{exact: true}">
              <!-- <span nz-icon nzType="unordered-list" nzTheme="outline"></span> -->
              <nz-icon nzType="solution" nzTheme="outline" />
              <span>Secretary Approvals</span>
            </li>
          }
          <li nz-menu-item [routerLink]="['/tickets/new']" routerLinkActive="ant-menu-item-selected">
            <span nz-icon nzType="plus-circle" nzTheme="outline"></span>
            <span>Submit New Ticket</span>
          </li>
        </ul>
        <div class="collapse-trigger" (click)="isCollapsed.set(!isCollapsed())">
          <span nz-icon [nzType]="isCollapsed() ? 'menu-unfold' : 'menu-fold'" nzTheme="outline"></span>
        </div>
      </nz-sider>
      <nz-content class="tickets-content">
        <router-outlet />
      </nz-content>
    </nz-layout>
  `,
  styles: [`
    .tickets-layout {
      min-height: 100%;
      background: #f0f2f5;
    }

    nz-sider {
      background: #fff;
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
      position: relative;
    }

    .sidebar-header {
      padding: 24px 24px 16px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;

      h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #262626;
      }

      .collapsed-icon {
        font-size: 24px;
        color: #1890ff;
      }
    }

    .tickets-menu {
      border-right: none;
      padding: 8px 0;
      flex: 1;
    }

    .collapse-trigger {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        color: #1890ff;
        border-color: #1890ff;
      }

      span {
        font-size: 16px;
      }
    }

    .tickets-content {
      padding: 24px;
      background: #f0f2f5;
    }

    :host ::ng-deep {
      .ant-menu-item {
        margin: 4px 8px;
        border-radius: 4px;
        width: calc(100% - 16px);
      }

      .ant-menu-item-selected {
        background-color: #e6f7ff;
        color: #1890ff;
      }

      .ant-layout-sider-collapsed {
        .tickets-menu {
          padding: 8px 0;
        }

        .ant-menu-item {
          padding: 0 !important;
          text-align: center;
          margin: 4px auto;
          width: 64px;
        }
      }
    }
  `],
})
export class TicketsLayoutComponent {
  private readonly authService = inject(AuthService);
  isCollapsed = signal(false);

  readonly canApprove = computed(() =>
    this.authService.isAdmin() ||
    // this.authService.isOfficeHead() ||
    this.authService.isSecretary()
    // this.authService.isDirector()
  );

  constructor() {
    // console.log('TicketsLayoutComponent initialized. User can approve:', this.canApprove());
    // console.log('TicketsLayoutComponent currentUser:', this.authService.currentUser());
    // console.log('TicketsLayoutComponent flags:', {
    //   isAdmin: this.authService.isAdmin(),
    //   isOfficeHead: this.authService.isOfficeHead(),
    //   isSecretary: this.authService.isSecretary(),
    //   isDirector: this.authService.isDirector(),
    // });
  }
}
