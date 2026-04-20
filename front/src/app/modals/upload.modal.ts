import { Component, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType, HttpEvent } from '@angular/common/http';
import { FileService } from '../../services/file.service';
import { Category, StorageLocation } from '../models/file.model';

@Component({
  selector: 'app-upload-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-box max-w-2xl" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h2 class="text-lg font-semibold text-surface-100">Subir archivo</h2>
            <p class="text-sm text-surface-500">Soporta vídeos, audio, imágenes, documentos y más</p>
          </div>
          <button (click)="close.emit()" class="btn-ghost btn-sm p-1.5">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Drop zone -->
          <div class="drop-zone" [class.dragover]="dragging"
            (dragover)="$event.preventDefault(); dragging = true"
            (dragleave)="dragging = false"
            (drop)="onDrop($event)"
            (click)="fileInput.click()">
            <div *ngIf="!selectedFile">
              <div class="text-4xl mb-3">📁</div>
              <p class="text-surface-300 font-medium">Arrastra un archivo aquí</p>
              <p class="text-surface-500 text-sm mt-1">o haz clic para seleccionar</p>
              <p class="text-surface-600 text-xs mt-2">Cualquier formato · Sin límite de tamaño</p>
            </div>
            <div *ngIf="selectedFile" class="flex items-center gap-3">
              <span class="text-3xl">{{ fileEmoji }}</span>
              <div class="text-left min-w-0">
                <p class="text-surface-100 font-medium truncate">{{ selectedFile.name }}</p>
                <p class="text-surface-500 text-sm">{{ formatBytes(selectedFile.size) }}</p>
              </div>
              <button (click)="$event.stopPropagation(); selectedFile = null" class="btn-ghost btn-sm ml-auto p-1.5 text-red-400">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <input #fileInput type="file" class="hidden" (change)="onFileSelected($event)"/>

          <!-- Toggle: file upload vs external path -->
          <div class="flex items-center gap-3 text-surface-500 text-sm">
            <div class="flex-1 border-t border-surface-700"></div>
            <button type="button"
              (click)="uploadMode = uploadMode === 'file' ? 'url' : 'file'"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors text-xs"
              [class.border-primary-500]="uploadMode === 'url'"
              [class.text-primary-300]="uploadMode === 'url'"
              [class.bg-primary-600\/10]="uploadMode === 'url'"
              [class.border-surface-600]="uploadMode === 'file'"
              [class.text-surface-400]="uploadMode === 'file'">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
              {{ uploadMode === 'url' ? 'Ocultar ruta externa' : 'Registrar ruta externa' }}
            </button>
            <div class="flex-1 border-t border-surface-700"></div>
          </div>

          <div *ngIf="uploadMode === 'url'">
            <label class="input-label">Ruta del archivo (local, URL, red)</label>
            <input [(ngModel)]="externalPath" type="text" class="input"
              placeholder="C:\Videos\archivo.mp4  /  https://...  /  \\\\servidor\\recurso"/>
          </div>

          <!-- Metadata -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="input-label">Título *</label>
              <input [(ngModel)]="title" type="text" class="input" placeholder="Nombre descriptivo del archivo"/>
            </div>
            <div class="sm:col-span-2">
              <label class="input-label">Descripción</label>
              <textarea [(ngModel)]="description" rows="2" class="input resize-none" placeholder="Descripción opcional"></textarea>
            </div>
            <div>
              <label class="input-label">Categoría</label>
              <select [(ngModel)]="categoryId" class="select">
                <option value="">Sin categoría</option>
                <option *ngFor="let c of categories" [value]="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="input-label">Año de publicación</label>
              <input [(ngModel)]="year" type="number" class="input" placeholder="2024" min="1900" max="2099"/>
            </div>
            <div>
              <label class="input-label">Ubicación de almacenamiento</label>
              <select [(ngModel)]="locationId" class="select">
                <option value="">Por defecto</option>
                <option *ngFor="let l of locations" [value]="l.id">{{ l.name }}</option>
              </select>
            </div>
            <div>
              <label class="input-label">Etiquetas (separadas por coma)</label>
              <input [(ngModel)]="tags" type="text" class="input" placeholder="noticia, política, 2024"/>
            </div>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="p-3 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">
            {{ error }}
          </div>

          <!-- Progress -->
          <div *ngIf="uploading" class="space-y-2">
            <div class="flex justify-between text-sm text-surface-400">
              <span>Subiendo...</span>
              <span>{{ uploadProgress }}%</span>
            </div>
            <div class="h-2 bg-surface-700 rounded-full overflow-hidden">
              <div class="h-full bg-primary-600 rounded-full transition-all duration-300"
                [style.width.%]="uploadProgress"></div>
            </div>
            <p class="text-xs text-surface-500 text-center">
              {{ uploadProgress < 100 ? 'Transfiriendo archivo al servidor...' : 'Procesando...' }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2 border-t border-surface-700">
            <button (click)="close.emit()" class="btn-secondary" [disabled]="uploading">Cancelar</button>
            <button (click)="onSubmit()" class="btn-primary"
              [disabled]="uploading || (!selectedFile && (uploadMode === 'file' || !externalPath))">
              <svg *ngIf="uploading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ uploading ? 'Subiendo...' : (selectedFile ? 'Subir archivo' : 'Registrar ruta') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UploadModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() uploaded = new EventEmitter<void>();

  uploadMode: 'file' | 'url' = 'file';

  selectedFile: File | null = null;
  externalPath = '';
  title = '';
  description = '';
  categoryId = '';
  locationId = '';
  year: number | '' = '';
  tags = '';

  dragging = false;
  uploading = false;
  uploadProgress = 0;
  error = '';

  categories: Category[] = [];
  locations: StorageLocation[] = [];

  get fileEmoji(): string {
    if (!this.selectedFile) return '📁';
    const t = this.selectedFile.type;
    if (t.startsWith('video/')) return '🎬';
    if (t.startsWith('audio/')) return '🎵';
    if (t.startsWith('image/')) return '🖼️';
    if (t === 'application/pdf') return '📄';
    return '📦';
  }

  constructor(private fs: FileService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.fs.getCategories().subscribe(r => { if (r.success) this.categories = r.data; });
    this.fs.getLocations().subscribe(r => { if (r.success) this.locations = r.data; });
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) { this.selectedFile = file; if (!this.title) this.title = file.name.replace(/\.[^.]+$/, ''); }
  }

  onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) { this.selectedFile = file; if (!this.title) this.title = file.name.replace(/\.[^.]+$/, ''); }
  }

  onSubmit() {
    if (!this.title) { this.error = 'El título es obligatorio'; return; }
    this.error = '';
    this.uploading = true;

    const tagList = this.tags.split(',').map(t => t.trim()).filter(Boolean);

    if (this.selectedFile) {
      const fd = new FormData();
      fd.append('file', this.selectedFile);
      fd.append('title', this.title);
      fd.append('description', this.description);
      if (this.categoryId) fd.append('category_id', this.categoryId);
      if (this.locationId) fd.append('storage_location_id', this.locationId);
      if (this.year) fd.append('publication_year', String(this.year));
      if (tagList.length) fd.append('tags', tagList.join(','));

      this.uploadProgress = 0;
      this.fs.uploadMediaWithProgress(fd).subscribe({
        next: (event: HttpEvent<any>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadProgress = Math.round(100 * event.loaded / event.total);
            this.cdr.detectChanges();
          } else if (event.type === HttpEventType.Response) {
            this.uploading = false;
            const res = event.body;
            if (res?.success) this.uploaded.emit(); else this.error = res?.error || 'Error al subir';
            this.cdr.detectChanges();
          }
        },
        error: err => { this.uploading = false; this.error = err.error?.error || 'Error al subir'; this.cdr.detectChanges(); }
      });
    } else if (this.externalPath) {
      this.fs.registerExternal({
        title: this.title,
        description: this.description,
        file_path: this.externalPath,
        publication_year: this.year ? Number(this.year) : undefined,
        category_id: this.categoryId ? Number(this.categoryId) : undefined,
        storage_location_id: this.locationId ? Number(this.locationId) : undefined,
        tags: tagList
      }).subscribe({
        next: res => { this.uploading = false; if (res.success) this.uploaded.emit(); else this.error = res.error; },
        error: err => { this.uploading = false; this.error = err.error?.error || 'Error al registrar'; }
      });
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
