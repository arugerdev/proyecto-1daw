import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService } from '../../services/file.service';
import { Archivo } from '../../app/models/file.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'app-file-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="file-card group" (click)="onCardClick()">
            <!-- Imagen/Thumbnail -->
            <div class="card-image-container">
                <img 
                    [src]="getThumbnailUrl()"
                    [alt]="getTitle()"
                    class="card-image group-hover:scale-105"
                >
                
                <!-- Icono de tipo de archivo (SVG) -->
                <div class="type-icon" [ngClass]="getTipoColor()">
                    <div class="type-icon-svg" [innerHTML]="getTipoIcon()"></div>
                </div>
                
                <!-- Duración (para videos/audio) -->
                <div *ngIf="file.tipo_archivo === 'video' || file.tipo_archivo === 'audio'" 
                     class="duration-badge">
                    {{ getDuration() }}
                </div>
                
                <!-- Overlay con botón de vista previa -->
                <div class="card-overlay">
                    <button class="preview-button" (click)="onViewDetails($event)">
                        <svg class="preview-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Ver Detalles
                    </button>
                </div>
            </div>
            
            <!-- Contenido de la tarjeta -->
            <div class="card-content">
                <!-- Título y estado -->
                <div class="title-section">
                    <h3 class="card-title" [title]="getTitle()">{{ getTitle() }}</h3>
                    <span class="badge" [ngClass]="getEstadoClass()">{{ getEstadoText() }}</span>
                </div>
                
                <p class="card-description">{{ getDescription() }}</p>
                
                <!-- Categoría -->
                <span class="category-badge">{{ getCategoria() }}</span>
                
                <!-- Etiquetas -->
                <div class="tags-container" *ngIf="getEtiquetas().length > 0">
                    <span *ngFor="let tag of getEtiquetas().slice(0,3)" class="tag">
                        #{{ tag }}
                    </span>
                    <span *ngIf="getEtiquetas().length > 3" class="tag-more">
                        +{{ getEtiquetas().length - 3 }}
                    </span>
                </div>
                
                <!-- Metadatos -->
                <div class="metadata">
                    <div class="metadata-item">
                        <svg class="metadata-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>{{ formatDate() }}</span>
                    </div>
                    <div class="metadata-item">
                        <svg class="metadata-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 7h-4.5A2.5 2.5 0 0 1 13 4.5V3"></path>
                            <path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"></path>
                        </svg>
                        <span>{{ formatSize() }}</span>
                    </div>
                </div>
                
                <!-- Ubicación (SVG en lugar de emoji) -->
                <div class="location" [title]="getUbicacion()">
                    <div class="location-svg" [innerHTML]="locationIcon"></div>
                    <span class="location-text">{{ getUbicacion() }}</span>
                </div>
                
                <!-- Acciones -->
                <div class="card-actions">
                    <button class="action-btn" (click)="onDownload($event)" title="Descargar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" x2="12" y1="15" y2="3"></line>
                        </svg>
                    </button>
                    <button class="action-btn" (click)="onEdit($event)" title="Editar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"></path>
                        </svg>
                    </button>
                    <button class="action-btn delete" (click)="onDelete($event)" title="Eliminar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            <path d="M8 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `,
    styleUrls: ['./file-card.component.css']
})
export class FileCardComponent {
    @Input() file!: Archivo;
    @Output() viewDetails = new EventEmitter<Archivo>();
    @Output() download = new EventEmitter<Archivo>();
    @Output() edit = new EventEmitter<Archivo>();
    @Output() delete = new EventEmitter<Archivo>();

    // SVG para ubicación
    locationIcon = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>
    `;

    constructor(
        private fileService: FileService,
        private sanitizer: DomSanitizer
    ) { }

    // Sanitizar SVG para evitar problemas de seguridad
    getTipoIcon(): SafeHtml {
        const svg = this.fileService.getTipoIcon(this.file.tipo_archivo);
        return this.sanitizer.bypassSecurityTrustHtml(svg);
    }

    getTipoColor(): string {
        return this.fileService.getTipoColor(this.file.tipo_archivo);
    }

    getTitle(): string {
        return this.file.titulo || this.fileService.generateTitle(this.file.nombre_archivo);
    }

    getDescription(): string {
        return this.file.descripcion || 'Sin descripción';
    }

    getCategoria(): string {
        return this.file.categoria || 'General';
    }

    getEstadoClass(): string {
        return this.fileService.getEstadoBadgeClass(this.file.estado);
    }

    getEstadoText(): string {
        return this.fileService.getEstadoText(this.file.estado);
    }

    getEtiquetas(): string[] {
        return this.file.etiquetas || [];
    }

    getUbicacion(): string {
        return this.file.ubicacion || 'Almacenamiento local';
    }

    getThumbnailUrl(): string {
        // ON PRODUCTION
        // return this.fileService.getThumbnailUrl(this.file);

        // FOR PLACEHOLDER:
        return 'https://placehold.co/800x600';
    }

    getDuration(): string {
        return this.file.duracion || "0:00";
    }

    formatDate(): string {
        return this.fileService.formatDate(this.file.fecha_subida);
    }

    formatSize(): string {
        return this.fileService.formatFileSize(this.file.size);
    }

    onCardClick() {
        this.viewDetails.emit(this.file);
    }

    onViewDetails(event: Event) {
        event.stopPropagation();
        this.viewDetails.emit(this.file);
    }

    onDownload(event: Event) {
        event.stopPropagation();
        this.download.emit(this.file);
    }

    onEdit(event: Event) {
        event.stopPropagation();
        this.edit.emit(this.file);
    }

    onDelete(event: Event) {
        event.stopPropagation();
        this.delete.emit(this.file);
    }
}