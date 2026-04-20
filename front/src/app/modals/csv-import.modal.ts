import { Component, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService } from '../../services/file.service';

interface ImportResult {
  imported: number;
  total: number;
  valid: number;
  errors: string[];
}

@Component({
  selector: 'app-csv-import-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-box max-w-2xl" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h2 class="text-lg font-semibold text-surface-100">Importar desde CSV</h2>
            <p class="text-sm text-surface-500">Importa metadatos de archivos existentes en el servidor</p>
          </div>
          <button (click)="close.emit()" class="btn-ghost btn-sm p-1.5">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-4">

          <!-- Format info -->
          <div class="bg-surface-900/50 rounded-xl p-4 border border-surface-700">
            <p class="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Formato del CSV</p>
            <code class="text-xs text-emerald-400 font-mono block">
              title, file_path, description, publication_year, category, tags
            </code>
            <div class="mt-2 text-xs text-surface-500 space-y-1">
              <p>• <strong class="text-surface-400">title</strong> / <strong class="text-surface-400">nombre</strong> — Nombre del archivo (obligatorio)</p>
              <p>• <strong class="text-surface-400">file_path</strong> / <strong class="text-surface-400">ruta</strong> — Ruta al archivo (obligatorio)</p>
              <p>• <strong class="text-surface-400">description</strong> / <strong class="text-surface-400">descripcion</strong> — Descripción (opcional)</p>
              <p>• <strong class="text-surface-400">publication_year</strong> / <strong class="text-surface-400">año</strong> — Año (opcional)</p>
              <p>• <strong class="text-surface-400">category</strong> / <strong class="text-surface-400">categoria</strong> — Categoría (opcional, se crea automáticamente)</p>
              <p>• <strong class="text-surface-400">tags</strong> / <strong class="text-surface-400">etiquetas</strong> — Etiquetas separadas por coma (opcional)</p>
            </div>
          </div>

          <!-- File picker -->
          <div *ngIf="!result" class="drop-zone" [class.dragover]="dragging"
            (dragover)="$event.preventDefault(); dragging = true"
            (dragleave)="dragging = false"
            (drop)="onDrop($event)"
            (click)="fileInput.click()">
            <div *ngIf="!selectedFile">
              <div class="text-4xl mb-3">📊</div>
              <p class="text-surface-300 font-medium">Selecciona un archivo CSV</p>
              <p class="text-surface-500 text-sm mt-1">o arrástralo aquí</p>
              <p class="text-surface-600 text-xs mt-2">Codificación UTF-8 o UTF-8 BOM</p>
            </div>
            <div *ngIf="selectedFile" class="flex items-center gap-3">
              <span class="text-3xl">📊</span>
              <div class="text-left">
                <p class="text-surface-100 font-medium">{{ selectedFile.name }}</p>
                <p class="text-surface-500 text-sm">{{ formatBytes(selectedFile.size) }}</p>
              </div>
            </div>
          </div>
          <input #fileInput type="file" accept=".csv,.tsv,text/csv" class="hidden" (change)="onFileSelected($event)"/>

          <!-- Importing progress -->
          <div *ngIf="importing" class="text-center py-4">
            <svg class="w-8 h-8 animate-spin text-primary-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p class="text-surface-400">Importando registros...</p>
          </div>

          <!-- Result -->
          <div *ngIf="result" class="space-y-3">
            <div class="flex items-center gap-3 p-4 rounded-xl"
              [class.bg-emerald-600/10]="result.imported > 0"
              [class.border-emerald-600/30]="result.imported > 0"
              [class.bg-red-600/10]="result.imported === 0"
              [class.border-red-600/30]="result.imported === 0"
              [class.border]="true">
              <span class="text-2xl">{{ result.imported > 0 ? '✅' : '❌' }}</span>
              <div>
                <p class="font-semibold text-surface-100">
                  {{ result.imported }} de {{ result.total }} importados
                </p>
                <p class="text-sm text-surface-400">{{ result.valid }} filas válidas procesadas</p>
              </div>
            </div>

            <div *ngIf="result.errors.length" class="bg-surface-900/50 rounded-xl p-3 max-h-40 overflow-y-auto">
              <p class="text-xs font-semibold text-amber-400 mb-2">Advertencias / Errores</p>
              <div *ngFor="let err of result.errors" class="text-xs text-surface-400 py-0.5 border-b border-surface-700/50 last:border-0">
                {{ err }}
              </div>
            </div>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="p-3 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">
            {{ error }}
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2 border-t border-surface-700">
            <button *ngIf="!result" (click)="close.emit()" class="btn-secondary" [disabled]="importing">Cancelar</button>
            <button *ngIf="!result" (click)="onImport()" class="btn-primary"
              [disabled]="importing || !selectedFile">
              <svg *ngIf="importing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Importar CSV
            </button>
            <button *ngIf="result && result.imported > 0" (click)="imported.emit()" class="btn-primary">
              Finalizar
            </button>
            <button *ngIf="result" (click)="result = null; selectedFile = null" class="btn-secondary">
              Importar otro
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CsvImportModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  selectedFile: File | null = null;
  dragging = false;
  importing = false;
  error = '';
  result: ImportResult | null = null;

  constructor(private fs: FileService, private cdr: ChangeDetectorRef) {}

  onDrop(e: DragEvent) {
    e.preventDefault(); this.dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.selectedFile = file;
  }

  onFileSelected(e: Event) {
    this.selectedFile = (e.target as HTMLInputElement).files?.[0] || null;
  }

  onImport() {
    if (!this.selectedFile) return;
    this.importing = true; this.error = '';

    this.fs.importCSV(this.selectedFile).subscribe({
      next: res => {
        this.importing = false;
        this.result = { imported: res.imported, total: res.total, valid: res.valid, errors: res.errors || [] };
        this.cdr.detectChanges();
      },
      error: err => {
        this.importing = false;
        this.error = err.error?.error || 'Error al importar el CSV';
        this.cdr.detectChanges();
      }
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B','KB','MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
