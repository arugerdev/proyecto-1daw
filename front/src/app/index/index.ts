import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ModalComponent } from '../../components/modal/modal.component';
import { FormsModule } from '@angular/forms';
import { Header } from '../../components/header/header.component';
import { FileGridComponent } from '../../components/file-grid/file-grid.component';
import { FileService } from '../../services/file.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Subject, takeUntil, forkJoin, finalize } from 'rxjs';
import { Stats } from '../models/file.model';

@Component({
    selector: 'index-page',
    standalone: true,
    imports: [
        Header, 
        ModalComponent, 
        FileGridComponent, 
        FormsModule, 
        CommonModule, 
        HttpClientModule
    ],
    templateUrl: './page.html',
    styleUrls: ['./style.css']
})
export class IndexPage implements OnInit, OnDestroy {
    // Control del modal
    isModalVisible = false;

    // Filtros (binding con el formulario)
    searchTerm = '';
    selectedType = '';
    selectedSort = 'masReciente';

    // Datos de estadísticas
    stats: Stats | null = null;

    // Estados de carga inicial
    isLoading = true;
    hasError = false;
    errorMessage = '';

    private destroy$ = new Subject<void>();

    constructor(
        private fileService: FileService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.loadInitialData();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadInitialData() {
        this.isLoading = true;
        
        forkJoin({
            stats: this.fileService.getStats()
        }).pipe(
            finalize(() => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }),
            takeUntil(this.destroy$)
        ).subscribe({
            next: (results) => {
                if (results.stats?.success) {
                    this.stats = results.stats.stats;
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
        // Este método se llama desde el template, pero la lógica está en el grid
        // Solo necesitamos que Angular detecte el cambio
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

    // Control del modal
    openModal() {
        this.isModalVisible = true;
        this.cdr.detectChanges();
    }

    closeModal() {
        this.isModalVisible = false;
        this.cdr.detectChanges();
        this.refreshStats();
        // Forzar recarga del grid pasando null temporalmente para que resetee
        this.searchTerm = this.searchTerm; // Trigger cambio
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