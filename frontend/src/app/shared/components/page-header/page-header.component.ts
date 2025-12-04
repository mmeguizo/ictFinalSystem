import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/**
 * Page Header Component
 * Reusable header for pages with title, subtitle, and action buttons
 *
 * Usage:
 * <app-page-header title="Dashboard" subtitle="Welcome back">
 *   <button actions nz-button>Action Button</button>
 * </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <div class="page-header-content">
        <h1 class="page-header-title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="page-header-subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-header-actions">
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    .page-header-content {
      flex: 1;
    }

    .page-header-title {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.85);
    }

    .page-header-subtitle {
      margin: 4px 0 0;
      font-size: 14px;
      color: rgba(0, 0, 0, 0.45);
    }

    .page-header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        gap: 16px;
      }

      .page-header-actions {
        width: 100%;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>();
}
