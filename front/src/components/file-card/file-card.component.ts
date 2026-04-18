import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaItem, MediaKind, MEDIA_KIND_COLORS } from '../../app/models/file.model';
import { AuthService } from '../../services/auth.service';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-file-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="group relative bg-surface-800 border border-surface-700 rounded-xl overflow-hidden
             hover:border-primary-600/50 hover:shadow-lg hover:shadow-primary-900/20
             transition-all duration-200 cursor-pointer flex flex-col"
      (click)="viewDetails.emit(file)">

      <!-- Thumbnail / Preview area -->
      <div class="relative h-44 bg-surface-900 overflow-hidden shrink-0">
        <!-- Thumbnail image (if video/image) -->
        <img *ngIf="['video','image'].includes(file.media_kind)"
          [src]="thumbUrl" [alt]="file.title"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          (error)="showThumb = false"
          [style.display]="showThumb ? 'block' : 'none'"/>

        <!-- Fallback icon -->
        <div class="absolute inset-0 flex items-center justify-center"
          [class.opacity-0]="showThumb && ['video','image'].includes(file.media_kind)"
          [class.group-hover:opacity-0]="showThumb && ['video','image'].includes(file.media_kind)">
          <div class="flex flex-col items-center gap-2">
            <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              [style.background-color]="kindColor + '20'">
              <span>{{ kindEmoji }}</span>
            </div>
            <span class="text-xs text-surface-500 uppercase tracking-wider font-medium">
              {{ file.file_extension || file.media_kind }}
            </span>
          </div>
        </div>

        <!-- Kind badge -->
        <div class="absolute top-2 left-2">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            [style.background-color]="kindColor + '30'"
            [style.color]="kindColor"
            [style.border]="'1px solid ' + kindColor + '50'">
            {{ kindEmoji }} {{ kindLabel }}
          </span>
        </div>

        <!-- Duration badge (video/audio) -->
        <div *ngIf="file.duration"
          class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono">
          {{ formatDuration(file.duration) }}
        </div>

        <!-- Hover overlay -->
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span class="bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Ver detalles
          </span>
        </div>
      </div>

      <!-- Card body -->
      <div class="p-3 flex flex-col gap-2 flex-1">
        <h3 class="text-sm font-semibold text-surface-100 line-clamp-2 leading-tight" [title]="file.title">
          {{ file.title }}
        </h3>

        <p *ngIf="file.description" class="text-xs text-surface-400 line-clamp-2 leading-relaxed">
          {{ file.description }}
        </p>

        <!-- Meta row -->
        <div class="flex items-center gap-3 text-xs text-surface-500 mt-auto">
          <span *ngIf="file.publication_year">{{ file.publication_year }}</span>
          <span *ngIf="file.category_name"
            class="truncate max-w-[80px] px-1.5 py-0.5 rounded text-xs"
            [style.background-color]="file.category_color + '20'"
            [style.color]="file.category_color">
            {{ file.category_name }}
          </span>
          <span *ngIf="file.file_size_formatted" class="ml-auto shrink-0">{{ file.file_size_formatted }}</span>
        </div>

        <!-- Tags -->
        <div *ngIf="file.tags.length > 0" class="flex flex-wrap gap-1">
          <span *ngFor="let tag of file.tags.slice(0, 3)"
            class="px-1.5 py-0.5 text-xs rounded bg-surface-700 text-surface-400">
            {{ tag }}
          </span>
          <span *ngIf="file.tags.length > 3"
            class="px-1.5 py-0.5 text-xs rounded bg-surface-700 text-surface-500">
            +{{ file.tags.length - 3 }}
          </span>
        </div>

        <!-- Actions (owner/admin only visible) -->
        <div *ngIf="canEdit || canDelete || canDownload"
          class="flex items-center gap-1 pt-1 border-t border-surface-700 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">

          <button *ngIf="canDownload" (click)="$event.stopPropagation(); download.emit(file)"
            class="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700 transition-colors" title="Descargar">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>

          <button *ngIf="canEdit" (click)="$event.stopPropagation(); edit.emit(file)"
            class="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-surface-700 transition-colors" title="Editar">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>

          <button *ngIf="canDelete" (click)="$event.stopPropagation(); delete.emit(file)"
            class="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-surface-700 transition-colors ml-auto" title="Eliminar">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `
})
export class FileCardComponent implements OnInit {
  @Input() file!: MediaItem;
  @Output() viewDetails = new EventEmitter<MediaItem>();
  @Output() download = new EventEmitter<MediaItem>();
  @Output() edit = new EventEmitter<MediaItem>();
  @Output() delete = new EventEmitter<MediaItem>();

  canDownload = false;
  canEdit = false;
  canDelete = false;
  showThumb = true;

  readonly kindEmojis: Record<string, string> = {
    video: '🎬', audio: '🎵', image: '🖼️', document: '📄', text: '📝', other: '📦'
  };
  readonly kindLabels: Record<string, string> = {
    video: 'Video', audio: 'Audio', image: 'Imagen', document: 'Documento', text: 'Texto', other: 'Otro'
  };

  get thumbUrl(): string { return this.fs.getThumbnailUrl(this.file.id); }
  get kindColor(): string { return MEDIA_KIND_COLORS[this.file.media_kind] || '#64748b'; }
  get kindEmoji(): string { return this.kindEmojis[this.file.media_kind] || '📦'; }
  get kindLabel(): string { return this.kindLabels[this.file.media_kind] || 'Otro'; }

  constructor(private auth: AuthService, private fs: FileService) {}

  ngOnInit() {
    this.canDownload = this.auth.hasPermission('canDownload');
    this.canEdit = this.auth.hasPermission('canEdit');
    this.canDelete = this.auth.hasPermission('canDelete');
  }

  formatDuration(seconds: number | null): string {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m}:${s.toString().padStart(2,'0')}`;
  }
}
