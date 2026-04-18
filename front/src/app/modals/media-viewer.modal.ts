import { Component, Input, Output, EventEmitter, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MediaItem } from '../models/file.model';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-media-viewer-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-box max-w-5xl" (click)="$event.stopPropagation()" style="max-height:92vh">

        <!-- Header -->
        <div class="modal-header">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-lg">{{ kindEmoji }}</span>
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-surface-100 truncate">{{ file.title }}</h2>
              <p class="text-xs text-surface-500">
                {{ file.filename }}
                <span *ngIf="file.file_size_formatted"> · {{ file.file_size_formatted }}</span>
                <span *ngIf="file.publication_year"> · {{ file.publication_year }}</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button *ngIf="canDownload" (click)="download.emit(file)" class="btn-secondary btn-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Descargar
            </button>
            <button *ngIf="canEdit" (click)="edit.emit(file)" class="btn-secondary btn-sm">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Editar
            </button>
            <button (click)="close.emit()" class="btn-ghost btn-sm p-1.5">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Media area -->
        <div class="p-4">

          <!-- VIDEO -->
          <div *ngIf="file.media_kind === 'video'" class="rounded-xl overflow-hidden bg-black">
            <video [src]="mediaUrl" controls class="w-full max-h-[50vh]" preload="metadata">
              Tu navegador no soporta la reproducción de vídeo.
            </video>
          </div>

          <!-- AUDIO -->
          <div *ngIf="file.media_kind === 'audio'" class="flex flex-col items-center gap-6 py-8">
            <div class="w-24 h-24 bg-emerald-600/20 rounded-2xl flex items-center justify-center text-5xl">🎵</div>
            <audio [src]="mediaUrl" controls class="w-full max-w-lg">
              Tu navegador no soporta la reproducción de audio.
            </audio>
          </div>

          <!-- IMAGE -->
          <div *ngIf="file.media_kind === 'image'" class="flex items-center justify-center bg-black/30 rounded-xl overflow-hidden">
            <img [src]="mediaUrl" [alt]="file.title" class="max-w-full max-h-[60vh] object-contain rounded-xl"/>
          </div>

          <!-- PDF -->
          <div *ngIf="file.media_kind === 'document' && file.file_extension === 'pdf'" class="rounded-xl overflow-hidden">
            <iframe [src]="safeUrl" class="w-full" style="height: 60vh; border: none;" title="PDF"></iframe>
          </div>

          <!-- TEXT / MARKDOWN -->
          <div *ngIf="file.media_kind === 'text' || (file.media_kind === 'document' && file.file_extension !== 'pdf')"
            class="rounded-xl bg-surface-900 p-4 text-center py-12">
            <div class="text-5xl mb-4">{{ kindEmoji }}</div>
            <p class="text-surface-400 mb-4">Vista previa no disponible para este tipo de archivo.</p>
            <button *ngIf="canDownload" (click)="download.emit(file)" class="btn-primary">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Descargar archivo
            </button>
          </div>

          <!-- OTHER -->
          <div *ngIf="file.media_kind === 'other'" class="text-center py-12">
            <div class="text-5xl mb-4">📦</div>
            <p class="text-surface-400 mb-4">No hay vista previa disponible.</p>
            <button *ngIf="canDownload" (click)="download.emit(file)" class="btn-primary">Descargar</button>
          </div>

          <!-- Metadata -->
          <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div *ngIf="file.description" class="col-span-full bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Descripción</p>
              <p class="text-surface-300">{{ file.description }}</p>
            </div>

            <div *ngIf="file.category_name" class="bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Categoría</p>
              <span class="text-sm font-medium px-2 py-0.5 rounded"
                [style.background-color]="file.category_color + '20'"
                [style.color]="file.category_color">
                {{ file.category_name }}
              </span>
            </div>

            <div *ngIf="file.created_by_name" class="bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Subido por</p>
              <p class="text-surface-300">{{ file.created_by_name }}</p>
            </div>

            <div *ngIf="file.view_count !== undefined" class="bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Vistas</p>
              <p class="text-surface-300">{{ file.view_count | number }}</p>
            </div>

            <div *ngIf="file.created_at" class="bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-1">Añadido</p>
              <p class="text-surface-300">{{ file.created_at | date:'dd/MM/yyyy' }}</p>
            </div>

            <div *ngIf="file.tags.length > 0" class="col-span-full bg-surface-900/50 rounded-xl p-3">
              <p class="text-xs text-surface-500 mb-2">Etiquetas</p>
              <div class="flex flex-wrap gap-1.5">
                <span *ngFor="let tag of file.tags" class="badge-neutral">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MediaViewerModalComponent implements OnInit {
  @Input() file!: MediaItem;
  @Input() canDownload = false;
  @Input() canEdit = false;
  @Output() close = new EventEmitter<void>();
  @Output() download = new EventEmitter<MediaItem>();
  @Output() edit = new EventEmitter<MediaItem>();

  mediaUrl = '';
  safeUrl?: SafeResourceUrl;

  readonly kindEmojis: Record<string, string> = {
    video: '🎬', audio: '🎵', image: '🖼️', document: '📄', text: '📝', other: '📦'
  };

  get kindEmoji() { return this.kindEmojis[this.file.media_kind] || '📦'; }

  constructor(private fs: FileService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.mediaUrl = this.fs.getDownloadUrl(this.file.id);
    if (this.file.media_kind === 'document' && this.file.file_extension === 'pdf') {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.mediaUrl);
    }
  }

  @HostListener('document:keydown.escape') onEsc() { this.close.emit(); }
}
