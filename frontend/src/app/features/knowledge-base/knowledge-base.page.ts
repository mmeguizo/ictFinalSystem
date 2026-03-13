import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { QuillModule } from 'ngx-quill';
import { KnowledgeBaseService, KnowledgeArticle } from '../../core/services/knowledge-base.service';
import { AuthService } from '../../core/services/auth.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

const CATEGORY_COLORS: Record<string, string> = {
  NETWORK: 'blue',
  SOFTWARE: 'purple',
  HARDWARE: 'orange',
  ACCOUNT: 'green',
  GENERAL: 'default',
};

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzEmptyModule,
    NzSpinModule,
    NzModalModule,
    NzGridModule,
    NzBadgeModule,
    NzToolTipModule,
    NzSelectModule,
    NzFormModule,
    NzPaginationModule,
    NzDividerModule,
    NzPopconfirmModule,
    QuillModule,
  ],
  templateUrl: './knowledge-base.page.html',
  styleUrl: './knowledge-base.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeBasePage {
  private readonly kbService = inject(KnowledgeBaseService);
  private readonly authService = inject(AuthService);
  private readonly message = inject(NzMessageService);
  private readonly destroy$ = new Subject<void>();

  // State
  readonly articles = signal<KnowledgeArticle[]>([]);
  readonly loading = signal(true);
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(12);
  readonly searchTerm = signal('');
  readonly selectedCategory = signal<string | null>(null);
  readonly categories = signal<string[]>([]);

  // Article detail modal
  readonly selectedArticle = signal<KnowledgeArticle | null>(null);
  readonly detailVisible = signal(false);

  // Create/Edit modal
  readonly editorVisible = signal(false);
  readonly editingArticle = signal<KnowledgeArticle | null>(null);
  readonly editorForm = signal({
    title: '',
    content: '',
    category: 'GENERAL',
    tags: '',
    status: 'DRAFT' as string,
  });
  readonly saving = signal(false);

  // Quill editor content holder (separate from form due to async initialization)
  readonly editorFormModel = signal({ content: '' });

  // Search debounce
  private readonly searchSubject = new Subject<string>();

  readonly currentUser = computed(() => this.authService.currentUser());
  readonly isStaff = computed(() => {
    const role = this.currentUser()?.role;
    return ['ADMIN', 'MIS_HEAD', 'ITS_HEAD', 'DIRECTOR'].includes(role || '');
  });

  readonly allCategories = ['NETWORK', 'SOFTWARE', 'HARDWARE', 'ACCOUNT', 'GENERAL'];

  readonly quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean'],
    ],
  };

  constructor() {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.currentPage.set(1);
        this.loadArticles();
      });

    this.loadArticles();
    this.loadCategories();
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  onCategoryFilter(category: string | null): void {
    this.selectedCategory.set(category);
    this.currentPage.set(1);
    this.loadArticles();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadArticles();
  }

  openArticle(article: KnowledgeArticle): void {
    this.selectedArticle.set(article);
    this.detailVisible.set(true);
  }

  closeDetail(): void {
    this.detailVisible.set(false);
    this.selectedArticle.set(null);
  }

  markHelpful(article: KnowledgeArticle): void {
    this.kbService.markHelpful(article.id).subscribe({
      next: (updated) => {
        this.selectedArticle.set(updated);
        // Update in list too
        this.articles.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
        this.message.success('Thanks for your feedback!');
      },
      error: () => this.message.error('Failed to submit feedback'),
    });
  }

  // ---------- Editor ----------

  openEditor(article?: KnowledgeArticle): void {
    if (article) {
      this.editingArticle.set(article);
      this.editorForm.set({
        title: article.title,
        content: article.content,
        category: article.category,
        tags: article.tags || '',
        status: article.status,
      });
      this.editorFormModel.set({ content: article.content });
    } else {
      this.editingArticle.set(null);
      this.editorForm.set({
        title: '',
        content: '',
        category: 'GENERAL',
        tags: '',
        status: 'DRAFT',
      });
      this.editorFormModel.set({ content: '' });
    }
    this.editorVisible.set(true);
  }

  closeEditor(): void {
    this.editorVisible.set(false);
    this.editingArticle.set(null);
  }

  updateFormField(field: string, value: string): void {
    if (field === 'content') {
      this.editorFormModel.set({ content: value });
    }
    this.editorForm.update((f) => ({ ...f, [field]: value }));
  }

  onQuillEditorCreated(editor: any): void {
    // Ensure Quill is properly initialized and can receive content updates
    // This is called when the Quill editor instance is created
  }

  saveArticle(): void {
    const form = this.editorForm();
    const content = this.editorFormModel().content;
    if (!form.title.trim() || !content.trim()) {
      this.message.warning('Title and content are required');
      return;
    }

    this.saving.set(true);
    const editing = this.editingArticle();

    // Use content from editorFormModel which is updated by Quill
    const payload = { ...form, content };
    const obs = editing
      ? this.kbService.updateArticle(editing.id, payload)
      : this.kbService.createArticle(payload);

    obs.subscribe({
      next: () => {
        this.message.success(editing ? 'Article updated' : 'Article created');
        this.closeEditor();
        this.loadArticles();
        this.saving.set(false);
      },
      error: (err) => {
        this.message.error(err?.message || 'Failed to save article');
        this.saving.set(false);
      },
    });
  }

  deleteArticle(id: number): void {
    this.kbService.deleteArticle(id).subscribe({
      next: () => {
        this.message.success('Article deleted');
        this.loadArticles();
      },
      error: () => this.message.error('Failed to delete article'),
    });
  }

  getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] || 'default';
  }

  /**
   * Extract plain text from HTML content, removing all tags
   */
  extractPlainText(html: string): string {
    // Create a temporary div element to parse HTML
    const div = document.createElement('div');
    div.innerHTML = html;
    // Get text content and decode HTML entities
    return div.textContent || div.innerText || '';
  }

  getTagList(tags: string | null): string[] {
    if (!tags) return [];
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // ---------- Data Loading ----------

  private loadArticles(): void {
    this.loading.set(true);
    const filter: Record<string, string> = {};
    const search = this.searchTerm();
    const category = this.selectedCategory();
    if (search) filter['search'] = search;
    if (category) filter['category'] = category;

    this.kbService
      .getArticles(filter, { page: this.currentPage(), pageSize: this.pageSize() })
      .subscribe({
        next: (result) => {
          this.articles.set(result.items);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.message.error('Failed to load articles');
          this.loading.set(false);
        },
      });
  }

  private loadCategories(): void {
    this.kbService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
