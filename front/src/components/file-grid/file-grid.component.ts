import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService } from '../../services/file.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs';
import { FileCardComponent } from '../file-card/file-card.component';
import { Archivo } from '../../app/models/file.model';

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

    files: Archivo[] = [];
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
        if (this.observer) {
            this.observer.disconnect();
        }
    }

    ngOnChanges() {
        if (!this.observer) return;
        this.resetAndSearch();
    }

    private setupSearch() {
        this.searchSubject.pipe(
            debounceTime(500),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.resetAndSearch();
        });
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

    private loadFiles(isNewSearch: boolean = false) {
        if (!isNewSearch && (this.isLoadingMore || !this.hasMore)) return;

        if (isNewSearch) {
            this.isLoading = true;
        } else {
            this.isLoadingMore = true;
        }
        this.cdr.detectChanges();

        this.fileService.getFilesPaginated(
            this.currentPage,
            this.pageSize,
            this.searchTerm,
            this.selectedType,
            this.selectedSort
        ).pipe(
            finalize(() => {
                if (isNewSearch) {
                    this.isLoading = false;
                } else {
                    this.isLoadingMore = false;
                }
                this.cdr.detectChanges();
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (response) => {
                if (response.success) {
                    // Enriquecer archivos con datos adicionales para la UI
                    const enrichedFiles = response.files.map(file => ({
                        ...file,
                        titulo: this.fileService.generateTitle(file.nombre_archivo),
                        categoria: 'General',
                        estado: 'publicado' as const,
                        etiquetas: ['demo', file.tipo_archivo],
                        ubicacion: 'Servidor Principal'
                    }));

                    if (isNewSearch) {
                        this.files = enrichedFiles;
                    } else {
                        this.files = [...this.files, ...enrichedFiles];
                    }

                    this.totalPages = response.pagination.pages;
                    this.hasMore = this.currentPage < this.totalPages && response.files.length > 0;
                }
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error loading files:', error);
                if (!isNewSearch) {
                    this.hasMore = false;
                }
                this.cdr.detectChanges();
            }
        });
    }

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

    onViewDetails(file: Archivo) {
        console.log('View details:', file);
        // Aquí iría la lógica para abrir el modal de detalles
    }

    onDownload(file: Archivo) {
        this.fileService.downloadFile(file.id_archivo).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.nombre_archivo;
                a.click();
                window.URL.revokeObjectURL(url);
            },
            error: (error) => console.error('Error downloading file:', error)
        });
    }

    onEdit(file: Archivo) {
        const newName = prompt('Nuevo nombre:', file.nombre_archivo);
        if (newName && newName !== file.nombre_archivo) {
            this.fileService.updateFileName(file.id_archivo, newName).pipe(
                takeUntil(this.destroy$)
            ).subscribe({
                next: () => {
                    file.nombre_archivo = newName;
                    file.titulo = this.fileService.generateTitle(newName);
                    this.cdr.detectChanges();
                },
                error: (error) => console.error('Error updating file name:', error)
            });
        }
    }

    onDelete(file: Archivo) {
        if (confirm(`¿Eliminar "${file.nombre_archivo}"?`)) {
            this.fileService.deleteFile(file.id_archivo).pipe(
                takeUntil(this.destroy$)
            ).subscribe({
                next: () => {
                    this.files = this.files.filter(f => f.id_archivo !== file.id_archivo);
                    this.statsChanged.emit();
                    this.cdr.detectChanges();
                },
                error: (error) => console.error('Error deleting file:', error)
            });
        }
    }
}