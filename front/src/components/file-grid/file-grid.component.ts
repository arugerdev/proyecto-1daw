import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService } from '../../services/file.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, finalize } from 'rxjs';
import { FileCardComponent } from '../file-card/file-card.component';
import { MediaItem } from '../../app/models/file.model';
import { ModalService } from '../modal/modal.component';
import { ConfirmationModalComponent } from '../../app/modals/confirmation.modal';
import { AuthService } from '../../services/auth.service';
import { ContentModalComponent } from '../../app/modals/new-file.modal';
import { DetailsModalComponent } from '../../app/modals/details.modal';

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
                <button *ngIf="canUploadContent" (click)="openModal.emit()" class="button button-primary">
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
    @Input() selectedType: number = 0;
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

    canUploadContent = false;

    private observer: IntersectionObserver | null = null;
    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();

    constructor(
        private fileService: FileService,
        private cdr: ChangeDetectorRef,
        private modalService: ModalService,
        private auth: AuthService
    ) { }

    ngOnInit() {
        this.loadFiles(true);
        this.setupSearch();
        this.setupInfiniteScroll();
        this.canUploadContent = this.auth.hasPermission('canUpload')
        this.cdr.markForCheck();
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
            this.selectedSort,
            this.selectedType
        ).pipe(
            finalize(() => {
                isNewSearch ? this.isLoading = false : this.isLoadingMore = false;
                this.cdr.detectChanges();
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (response) => {
                if (response.success) {
                    console.log(response.data)
                    if (isNewSearch) {
                        this.files = response.data;
                    } else {
                        this.files = [...this.files, ...response.data];
                    }

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
        this.modalService.open(DetailsModalComponent, {
            title: 'Detalles del Archivo',
            data: {
                file: file
            },
            size: 'full'
        });
    }

    onDownload(file: MediaItem) {
        // ─── FIX ──────────────────────────────────────────────────────────────
        // HttpClient con responseType:'blob' envía el header Authorization,
        // lo que convierte la petición en "credencialed". El browser exige que
        // el servidor responda con el origin exacto (no '*'), y cualquier fallo
        // CORS con blob resulta en status 0 / ERR_FAILED sin mensaje útil.
        //
        // El endpoint /download no requiere token, así que podemos usar un
        // <a href> directo: el browser lo descarga de forma nativa, sin XHR
        // y sin restricciones CORS para descargas de archivos.
        // ─────────────────────────────────────────────────────────────────────
        const url = this.fileService.getDownloadUrl(file.id);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    onEdit(file: MediaItem) {
        console.log(file.id)
        this.modalService.open(ContentModalComponent, {
            title: 'Editar Archivo',
            data: {
                confirmText: 'Guardar Cambios',
                cancelText: 'Cancelar Cambios',
                id: file.id,
                title: file.title,
                description: file.description,
                publicationYear: file.publication_year,
                selectedTypeId: file.media_type_id,
                storageLocationId: file.media_location_id,
                tags: file.tags?.split(','),
                currentFileName: file.filename,
                onSubmit: () => {
                    window.location.reload();
                }
            }
        })
    }

    onDelete(file: MediaItem) {
        // Abrir modal de confirmación
        this.modalService.open(ConfirmationModalComponent, {
            title: 'Confirmar Eliminación',
            data: {
                message: `¿Eliminar "${file.title}"? Esta acción no se puede deshacer.`,
                confirmText: 'Sí, eliminar',
                cancelText: 'Cancelar',
                onConfirm: () => {
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
        });
    }
}