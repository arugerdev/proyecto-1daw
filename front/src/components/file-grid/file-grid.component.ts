import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService } from '../../services/file.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs';
import { FileCardComponent } from '../file-card/file-card.component';
import { MediaItem } from '../../app/models/file.model';

@Component({
    selector: 'app-file-grid',
    standalone: true,
    imports: [CommonModule, FileCardComponent],
    template: `
        <div class="files-grid">
            <!-- Estado vacío -->
            <div *ngIf="files.length === 0 && !isLoading && !isLoadingMore" class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="1">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" x2="12" y1="18" y2="12"></line>
                    <line x1="9" x2="15" y1="15" y2="15"></line>
                </svg>
                <h3>No hay archivos</h3>
                <p>Comienza subiendo tu primer contenido multimedia</p>
                <button (click)="openModal.emit()" class="button button-primary">
                    Subir Contenido
                </button>
            </div>

            <!-- Grid de tarjetas -->
            <app-file-card 
                *ngFor="let file of files"
                [file]="file"
                (viewDetails)="onViewDetails($event)"
                (download)="onDownload($event)"
                (edit)="onEdit($event)"
                (delete)="onDelete($event)">
            </app-file-card>

            <!-- Centinela para scroll infinito -->
            <div id="scroll-sentinel" class="scroll-sentinel" *ngIf="files.length > 0">
                <div *ngIf="isLoadingMore" class="loading-spinner">
                    <div class="spinner"></div>
                    <span>Cargando más archivos...</span>
                </div>
                <div *ngIf="!hasMore && files.length > 0" class="end-message">
                    No hay más archivos para mostrar
                </div>
            </div>
        </div>
    `,
    styleUrls: ['./file-grid.component.css']
})
export class FileGridComponent implements OnInit, OnDestroy {

    @Input() searchTerm: string = '';
    @Input() selectedType: string = '';
    @Input() selectedSort: string = 'masReciente';

    @Output() openModal = new EventEmitter<void>();
    @Output() statsChanged = new EventEmitter<void>();

    files: MediaItem[] = [];

    isLoading = false;
    isLoadingMore = false;
    hasMore = true;

    currentPage = 1;
    pageSize = 20;
    totalPages = 0;

    private observer: IntersectionObserver | null = null;
    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();

    constructor(
        private fileService: FileService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadFiles(true);
        this.setupSearch();
        this.setupInfiniteScroll();

    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.observer?.disconnect();
    }

    ngOnChanges() {
        this.resetAndSearch();
    }

    // ===========================
    // 🔎 SEARCH
    // ===========================

    private setupSearch() {
        this.searchSubject.pipe(
            debounceTime(500),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
        ).subscribe(() => this.resetAndSearch());
    }

    onSearchChange() {
        this.searchSubject.next(this.searchTerm);
    }

    private resetAndSearch() {
        this.currentPage = 1;
        this.files = [];
        this.hasMore = true;
        this.loadFiles(true);
    }

    // ===========================
    // 📄 LOAD MEDIA
    // ===========================

    private loadFiles(isNewSearch: boolean = false) {

        if (!isNewSearch && (this.isLoadingMore || !this.hasMore)) return;

        isNewSearch ? this.isLoading = true : this.isLoadingMore = true;
        this.cdr.detectChanges();

        this.fileService.getMediaPaginated(
            this.currentPage,
            this.pageSize,
            this.searchTerm,
            this.selectedSort
        ).pipe(
            finalize(() => {
                isNewSearch ? this.isLoading = false : this.isLoadingMore = false;
                this.cdr.detectChanges();
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (response) => {
                if (response.success) {

                    if (isNewSearch) {
                        this.files = response.data;
                    } else {
                        this.files = [...this.files, ...response.data];
                    }
                    console.log(response.data)

                    this.totalPages = response.pagination.pages;
                    this.hasMore = this.currentPage < this.totalPages;
                }
            },
            error: (error) => {
                console.error('Error loading media:', error);
                this.hasMore = false;
            }
        });

    }

    // ===========================
    // ♾ INFINITE SCROLL
    // ===========================

    private setupInfiniteScroll() {
        setTimeout(() => {
            const sentinel = document.getElementById('scroll-sentinel');
            if (!sentinel) return;

            this.observer = new IntersectionObserver((entries) => {
                const first = entries[0];
                if (first.isIntersecting && this.hasMore && !this.isLoadingMore && !this.isLoading) {
                    this.currentPage++;
                    this.loadFiles(false);
                }
            }, { threshold: 0.1, rootMargin: '650px' });

            this.observer.observe(sentinel);
        }, 500);
    }

    // ===========================
    // 🎬 ACTIONS
    // ===========================

    onViewDetails(file: MediaItem) {
        console.log('View details:', file);
    }

    onDownload(file: MediaItem) {
        this.fileService.downloadMedia(file.id).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.title;
                a.click();
                window.URL.revokeObjectURL(url);
            },
            error: (error) => console.error('Error downloading:', error)
        });
    }

    onEdit(file: MediaItem) {

        const newTitle = prompt('Nuevo título:', file.title);

        if (newTitle && newTitle !== file.title) {

            this.fileService.updateMedia(file.id, {
                title: newTitle
            }).pipe(
                takeUntil(this.destroy$)
            ).subscribe({
                next: () => {
                    file.title = newTitle;
                    this.cdr.detectChanges();
                },
                error: (error) => console.error('Error updating:', error)
            });
        }
    }

    onDelete(file: MediaItem) {

        if (confirm(`¿Eliminar "${file.title}"?`)) {

            this.fileService.deleteMedia(file.id).pipe(
                takeUntil(this.destroy$)
            ).subscribe({
                next: () => {
                    this.files = this.files.filter(f => f.id !== file.id);
                    this.statsChanged.emit();
                    this.cdr.detectChanges();
                },
                error: (error) => console.error('Error deleting:', error)
            });
        }
    }
}
