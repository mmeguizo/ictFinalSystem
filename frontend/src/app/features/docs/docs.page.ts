import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzAnchorModule } from 'ng-zorro-antd/anchor';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzBackTopModule } from 'ng-zorro-antd/back-top';

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [
    NzCardModule,
    NzTabsModule,
    NzTagModule,
    NzIconModule,
    NzDividerModule,
    NzAnchorModule,
    NzTypographyModule,
    NzButtonModule,
    NzBackTopModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './docs.page.html',
  styleUrls: ['./docs.page.scss'],
})
export class DocsPage {
  readonly activeTab = signal(0);

  onTabChange(index: number): void {
    this.activeTab.set(index);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
