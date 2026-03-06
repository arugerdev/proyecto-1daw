import { Component, Input, Output, EventEmitter, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService } from '../../services/file.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MediaItem } from '../../app/models/file.model';
import { AuthService } from '../../services/auth.service';
import { takeUntil } from 'rxjs';

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

        <!-- Autores -->
        <div *ngIf="file.authors?.length" class="metadata-item">
          <strong>Autores:</strong> {{ file.authors?.join(', ') }}
        </div>

        <!-- Fechas -->
        <section class="metadata-container">
        <div class="metadata-item">
          <strong>Fecha de creación:</strong> {{ formatDate(file.date_added) }}
        </div>
        <div class="metadata-item">
          <strong>Última actualización:</strong> {{ formatDate(file.date_updated) }}
        </div>

        <!-- Año de publicación -->
        <div class="metadata-item">
          <strong>Año:</strong> {{ file.publication_year || 'N/A' }}
        </div>

        <!-- Tags -->
        <div class="metadata-item" *ngIf="file.tags">
          <strong>Tags:</strong> {{ file.tags }}
        </div>
        </section>

        <!-- Ubicación (solo admins) -->
        <div *ngIf="canViewPath" class="location" [title]="file.media_path">
          <div class="location-svg" [innerHTML]="locationIcon"></div>
          <span class="location-text">{{ file.media_path }}</span>
        </div>

        <!-- Acciones -->
        <div class="card-actions">
          <button *ngIf="canDownloadContent" class="action-btn" (click)="onDownload($event)" title="Descargar">
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

  canDownloadContent = false
  locationIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </svg>
  `;

  canViewPath = false;

  constructor(
    private fileService: FileService,
    private sanitizer: DomSanitizer,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.auth.refreshUserRole().subscribe(user => {
      // solo usuarios con permisos canViewAllContent pueden ver rutas
      this.canViewPath = !!user?.permissions?.canUpload;
      this.canDownloadContent = !!user?.permissions?.canDownload;

      this.cdr.markForCheck();
    });
  }

  getTipoIcon(): SafeHtml {
    const svg = this.fileService.getContentTypeIcon(this.file.media_type || '');
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  getTipoColor(): string {
    return this.fileService.getContentTypeColor(this.file.media_type || '');
  }

  getTitle(): string {
    return this.file.title;
  }

  getDescription(): string {
    return this.file.description || 'Sin descripción';
  }

  getYear(): string {
    return this.file.publication_year?.toString() || 'N/A';
  }

  getDuration(): string {
    return this.fileService.formatDuration(this.file.duration);
  }

  getThumbnailUrl(): string {
    return this.fileService.getThumbnailUrl(this.file);
  }

  formatDate(dateStr?: string) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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