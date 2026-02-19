import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService } from '../../services/file.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MediaItem } from '../../app/models/file.model';

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
                <div *ngIf="file.duration" class="duration-badge">
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
                </div>
                
                <p class="card-description">{{ getDescription() }}</p>
                
                <!-- Categoría -->
                

                
                <!-- Metadatos -->
                <div class="metadata">
                    <div class="metadata-item">
                        <span>{{ getYear() }}</span>
                    </div>
                    <div class="metadata-item">
                        <span>{{ getProgram() }}</span>
                    </div>
                </div>

                <!-- Ubicación (SVG en lugar de emoji) -->
                <div class="location" [title]="file.file_path">
                    <div class="location-svg" [innerHTML]="locationIcon"></div>
                    <span class="location-text">{{ file.file_path }}</span>
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

    @Input() file!: MediaItem;

    @Output() viewDetails = new EventEmitter<MediaItem>();
    @Output() download = new EventEmitter<MediaItem>();
    @Output() edit = new EventEmitter<MediaItem>();
    @Output() delete = new EventEmitter<MediaItem>();

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


    // ===========================
    // 🎨 ICONO SEGÚN CONTENT TYPE
    // ===========================

    getTipoIcon(): SafeHtml {
        const svg = this.fileService.getContentTypeIcon(this.file.content_type || '');
        return this.sanitizer.bypassSecurityTrustHtml(svg);
    }

    getTipoColor(): string {
        return this.fileService.getContentTypeColor(this.file.content_type || '');
    }

    // ===========================
    // 📄 DATA
    // ===========================

    getTitle(): string {
        return this.file.title;
    }

    getDescription(): string {
        return this.file.description || 'Sin descripción';
    }

    getProgram(): string {
        return this.file.program || 'Programa no definido';
    }

    getYear(): string {
        return this.fileService.formatYear(this.file.recording_year);
    }

    getDuration(): string {
        return this.fileService.formatDuration(this.file.duration);
    }

    getThumbnailUrl(): string {
        return this.fileService.getThumbnailUrl(this.file);
    }

    // ===========================
    // 🎬 ACTIONS
    // ===========================

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
