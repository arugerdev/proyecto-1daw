import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, forkJoin, finalize } from 'rxjs';
import { FileService } from '../../services/file.service';
import { AuthService } from '../../services/auth.service';
import { MediaItem, Category, Tag, MediaKind, MediaFilter, Stats, MEDIA_KIND_LABELS, MEDIA_KIND_COLORS } from '../models/file.model';
import { FileCardComponent } from '../../components/file-card/file-card.component';
import { MediaViewerModalComponent } from '../modals/media-viewer.modal';
import { UploadModalComponent } from '../modals/upload.modal';
import { CsvImportModalComponent } from '../modals/csv-import.modal';
import { EditMediaModalComponent } from '../modals/edit-media.modal';
import { ConfirmModalComponent } from '../modals/confirm.modal';

@Component({
  selector: 'index-page',
  standalone: true,
  imports: [
    FormsModule, CommonModule, FileCardComponent,
    MediaViewerModalComponent, UploadModalComponent,
    CsvImportModalComponent, EditMediaModalComponent, ConfirmModalComponent
  ],
  templateUrl: './page.html'
})
export class IndexPage implements OnInit, OnDestroy {
  // ── Data ──────────────────────────────────────────────────────────────────
  files: MediaItem[] = [];
  categories: Category[] = [];
  tags: Tag[] = [];
  stats: Stats | null = null;

  // ── Filters ───────────────────────────────────────────────────────────────
  search = '';
  selectedKind: MediaKind | '' = '';
  selectedCategory = '';
  selectedTag = '';
  selectedYear: number | '' = '';
  sort: MediaFilter['sort'] = 'newest';
  viewMode: 'grid' | 'list' = 'grid';

  // ── Pagination ────────────────────────────────────────────────────────────
  page = 1;
  pageSize = 24;
  totalPages = 0;
  total = 0;

  // ── UI state ──────────────────────────────────────────────────────────────
  isLoading = true;
  isLoadingMore = false;
  showFilters = false;
  hasMore = false;

  // ── Modals ────────────────────────────────────────────────────────────────
  showUpload = false;
  showCsvImport = false;
  showViewer = false;
  showEdit = false;
  showConfirm = false;
  viewerFile: MediaItem | null = null;
  editFile: MediaItem | null = null;
  confirmMessage = '';
  confirmAction: (() => void) | null = null;

  // ── Permissions ───────────────────────────────────────────────────────────
  get canUpload() { return this.auth.hasPermission('canUpload'); }
  get canImportCSV() { return this.auth.hasPermission('canImportCSV'); }
  get canAccessAdmin() { return this.auth.hasPermission('canAccessAdmin'); }

  readonly KINDS = Object.entries(MEDIA_KIND_LABELS) as [MediaKind, string][];
  readonly KIND_COLORS = MEDIA_KIND_COLORS;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private sentinelObserver: IntersectionObserver | null = null;

  constructor(
    private fileService: FileService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadInitialData();
    this.setupSearch();
    setTimeout(() => this.setupInfiniteScroll(), 500);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.sentinelObserver?.disconnect();
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  private loadInitialData() {
    forkJoin({
      stats: this.fileService.getStats(),
      categories: this.fileService.getCategories(),
      tags: this.fileService.getTags()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ stats, categories, tags }) => {
        if (stats.success) this.stats = stats.data;
        if (categories.success) this.categories = categories.data;
        if (tags.success) this.tags = tags.data.slice(0, 20);
        this.cdr.detectChanges();
        this.loadFiles(true);
      },
      error: () => this.loadFiles(true)
    });
  }

  loadFiles(reset = false) {
    if (reset) {
      this.page = 1;
      this.files = [];
      this.hasMore = false;
      this.isLoading = true;
    } else {
      if (this.isLoadingMore || !this.hasMore) return;
      this.isLoadingMore = true;
    }

    const filter: MediaFilter = {
      page: this.page,
      limit: this.pageSize,
      search: this.search || undefined,
      type: this.selectedKind || undefined,
      category: this.selectedCategory || undefined,
      tag: this.selectedTag || undefined,
      year: this.selectedYear || undefined,
      sort: this.sort
    };

    this.fileService.getMedia(filter).pipe(
      finalize(() => { this.isLoading = false; this.isLoadingMore = false; this.cdr.detectChanges(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: res => {
        if (res.success) {
          this.files = reset ? res.data : [...this.files, ...res.data];
          this.total = res.pagination.total;
          this.totalPages = res.pagination.pages;
          this.hasMore = this.page < this.totalPages;
        }
      },
      error: () => { this.hasMore = false; }
    });
  }

  // ── Search & filters ─────────────────────────────────────────────────────

  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => this.loadFiles(true));
  }

  onSearchInput() { this.searchSubject.next(this.search); }

  applyFilter() {
    this.loadFiles(true);
    if (window.innerWidth < 768) this.showFilters = false;
  }

  clearFilters() {
    this.selectedKind = '';
    this.selectedCategory = '';
    this.selectedTag = '';
    this.selectedYear = '';
    this.sort = 'newest';
    this.loadFiles(true);
  }

  get hasActiveFilters(): boolean {
    return !!(this.selectedKind || this.selectedCategory || this.selectedTag || this.selectedYear);
  }

  // ── Infinite scroll ───────────────────────────────────────────────────────

  private setupInfiniteScroll() {
    const sentinel = document.getElementById('scroll-sentinel');
    if (!sentinel) return;
    this.sentinelObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && this.hasMore && !this.isLoadingMore && !this.isLoading) {
        this.page++;
        this.loadFiles(false);
      }
    }, { rootMargin: '400px' });
    this.sentinelObserver.observe(sentinel);
  }

  // ── Modal handlers ────────────────────────────────────────────────────────

  openViewer(file: MediaItem) { this.viewerFile = file; this.showViewer = true; }
  closeViewer() { this.showViewer = false; this.viewerFile = null; }

  openEdit(file: MediaItem) { this.editFile = file; this.showEdit = true; }
  onEditSaved() { this.showEdit = false; this.loadFiles(true); }

  openDelete(file: MediaItem) {
    this.confirmMessage = `¿Eliminar "${file.title}"? Esta acción no se puede deshacer.`;
    this.confirmAction = () => {
      this.fileService.deleteMedia(file.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.files = this.files.filter(f => f.id !== file.id);
          this.total = Math.max(0, this.total - 1);
          this.cdr.detectChanges();
        }
      });
    };
    this.showConfirm = true;
  }

  onDownload(file: MediaItem) {
    const url = this.fileService.getDownloadUrl(file.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename || file.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  onUploadDone() { this.showUpload = false; this.loadFiles(true); this.refreshStats(); }
  onCsvDone() { this.showCsvImport = false; this.loadFiles(true); this.refreshStats(); }

  refreshStats() {
    this.fileService.getStats().pipe(takeUntil(this.destroy$)).subscribe(res => {
      if (res.success) { this.stats = res.data; this.cdr.detectChanges(); }
    });
  }

  trackByFile(_: number, f: MediaItem) { return f.id; }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
