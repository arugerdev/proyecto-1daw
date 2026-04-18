import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaItem, Category } from '../models/file.model';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-edit-media-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-box max-w-xl" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="text-lg font-semibold text-surface-100">Editar archivo</h2>
          <button (click)="close.emit()" class="btn-ghost btn-sm p-1.5">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-4">
          <div>
            <label class="input-label">Título *</label>
            <input [(ngModel)]="title" type="text" class="input"/>
          </div>
          <div>
            <label class="input-label">Descripción</label>
            <textarea [(ngModel)]="description" rows="3" class="input resize-none"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="input-label">Categoría</label>
              <select [(ngModel)]="categoryId" class="select">
                <option value="">Sin categoría</option>
                <option *ngFor="let c of categories" [value]="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="input-label">Año</label>
              <input [(ngModel)]="year" type="number" class="input" placeholder="2024"/>
            </div>
          </div>
          <div>
            <label class="input-label">Etiquetas (separadas por coma)</label>
            <input [(ngModel)]="tags" type="text" class="input" placeholder="noticia, política"/>
          </div>

          <div *ngIf="error" class="p-3 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">{{ error }}</div>

          <div class="flex justify-end gap-3 pt-2 border-t border-surface-700">
            <button (click)="close.emit()" class="btn-secondary" [disabled]="saving">Cancelar</button>
            <button (click)="onSave()" class="btn-primary" [disabled]="saving">
              <svg *ngIf="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {{ saving ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class EditMediaModalComponent implements OnInit {
  @Input() file!: MediaItem;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  title = '';
  description = '';
  categoryId: number | '' = '';
  year: number | '' = '';
  tags = '';
  saving = false;
  error = '';
  categories: Category[] = [];

  constructor(private fs: FileService) {}

  ngOnInit() {
    this.title = this.file.title;
    this.description = this.file.description || '';
    this.categoryId = this.file.category_id || '';
    this.year = this.file.publication_year || '';
    this.tags = (this.file.tags || []).join(', ');
    this.fs.getCategories().subscribe(r => { if (r.success) this.categories = r.data; });
  }

  onSave() {
    if (!this.title) { this.error = 'El título es obligatorio'; return; }
    this.saving = true; this.error = '';
    const tagList = this.tags.split(',').map(t => t.trim()).filter(Boolean);

    this.fs.updateMedia(this.file.id, {
      title: this.title,
      description: this.description,
      category_id: this.categoryId ? Number(this.categoryId) : null,
      publication_year: this.year ? Number(this.year) : null,
      tags: tagList
    }).subscribe({
      next: res => { this.saving = false; if (res.success) this.saved.emit(); else this.error = res.error; },
      error: err => { this.saving = false; this.error = err.error?.error || 'Error al guardar'; }
    });
  }
}
