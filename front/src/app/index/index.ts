import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Header } from '../../components/header/header.component';
import { FileGridComponent } from '../../components/file-grid/file-grid.component';
import { FileService } from '../../services/file.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Subject, takeUntil, forkJoin, finalize } from 'rxjs';
import { Stats } from '../models/file.model';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../components/modal/modal.component';
import { RegisterContentModalComponent } from './new-file.modal';

@Component({
    selector: 'index-page',
    standalone: true,
    imports: [
        Header,
        FileGridComponent,
        FormsModule,
        CommonModule,
        HttpClientModule
        // Eliminamos ModalComponent de imports
    ],
    templateUrl: './page.html',
    styleUrls: ['./style.css']
})
export class IndexPage implements OnInit, OnDestroy {
    types: { id: number; name: string | undefined; }[] = [];

    searchTerm = '';
    selectedType = 0;
    selectedSort = 'masReciente';

    stats: Stats | null = null;

    isLoading = true;
    hasError = false;
    errorMessage = '';

    canUploadContent = false;

    private destroy$ = new Subject<void>();

    constructor(
        private fileService: FileService,
        private cdr: ChangeDetectorRef,
        public auth: AuthService,
        private modalService: ModalService
    ) { }

    ngOnInit() {
        this.auth.refreshUserRole().pipe(
            takeUntil(this.destroy$)
        ).subscribe(user => {
            this.canUploadContent = !!user?.permissions?.canUpload;
            this.cdr.markForCheck();
        });

        this.loadInitialData();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadInitialData() {
        this.isLoading = true;

        forkJoin({
            stats: this.fileService.getStats(),
            types: this.fileService.getContentTypes()
        }).pipe(
            finalize(() => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (results) => {
                console.log('Datos iniciales cargados:', results);
                // Stats
                if (results.stats?.success) {
                    this.stats = results.stats.stats;
                }

                // Content Types desde BD
                if (results.types?.success) {
                    this.types = results.types.data;
                }

                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error loading initial data:', error);
                this.hasError = true;
                this.errorMessage = 'Error al cargar los datos. Por favor, recarga la página.';
                this.cdr.detectChanges();
            }
        });
    }

    // Métodos para manejar cambios en los filtros
    onSearchChange() {
        this.cdr.detectChanges();
    }

    onTypeChange() {
        this.cdr.detectChanges();
    }

    onSortChange() {
        this.cdr.detectChanges();
    }

    // Refrescar estadísticas
    refreshStats() {
        this.fileService.getStats().pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: (response) => {
                if (response.success) {
                    this.stats = response.stats;
                    this.cdr.detectChanges();
                }
            }
        });
    }

    // Control del modal - NUEVA VERSIÓN
    openModal() {
        if (!this.canUploadContent) return;

        const modalRef = this.modalService.open(RegisterContentModalComponent, {
            title: 'Registrar Nuevo Contenido',
            description: 'Completa la información del contenido multimedia que deseas agregar al sistema.',
            size: 'xl',
            showCloseButton: true,
            closeOnOverlayClick: true,
            buttons: [
                // {
                //     text: 'Cancelar',
                //     variant: 'secondary',
                //     handler: (modalRef) => modalRef.close()
                // },
                // {
                //     text: 'Registrar Contenido',
                //     variant: 'primary',
                //     type: 'submit',
                //     closeOnClick: false  // El cierre lo maneja el componente después de enviar
                // }
            ],
            data: {
                // Podemos pasar datos iniciales si queremos
                initialData: {
                    contentTypes: this.types  // Pasamos los tipos ya cargados
                }
            }
        });

        // Escuchamos cuando se cierra el modal
        modalRef.afterClosed$.subscribe(result => {
            if (result?.success) {
                // Refrescamos estadísticas y grid
                this.refreshStats();

                // Forzamos un cambio en searchTerm para que el grid se recargue
                this.searchTerm = this.searchTerm; // Trigger cambio
                this.cdr.detectChanges();
            }
        });
    }

    reloadPage() {
        this.loadInitialData();
    }

    formatBytes(bytes: number, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}