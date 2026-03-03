import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService } from '../../services/file.service';
import { Subject } from 'rxjs';
import { ModalRef } from '../models/modal.model';

@Component({
  selector: 'app-register-content-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="modal-form" (ngSubmit)="onSubmit($event)">

      <!-- ARCHIVO -->
      <div class="form-group">
        <label class="form-label">Archivo *</label>

        <div class="drag-area" [class.dragover]="isDragOver" 
             (click)="fileInput.click()"
             (dragover)="onDragOver($event)" 
             (dragleave)="onDragLeave($event)" 
             (drop)="onDrop($event)">

          <input #fileInput type="file" hidden (change)="onFileSelected($event)" />

          <svg xmlns="http://www.w3.org/2000/svg" class="drag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          </svg>

          <p class="drag-text" *ngIf="!selectedFile">
            Arrastra un archivo aquí o haz click para seleccionarlo
          </p>

          <p class="drag-text file-name" *ngIf="selectedFile">
            {{ selectedFile.name }}
          </p>

          <button type="button" class="btn btn-secondary btn-sm">
            Seleccionar Archivo
          </button>

        </div>
      </div>

      <!-- TIPO -->
      <div class="form-group">
        <label class="form-label">Tipo de Contenido *</label>
        <select class="form-select" [(ngModel)]="selectedTypeId" name="contentType" required>
          <option [ngValue]="null" disabled>Selecciona un tipo</option>
          <option *ngFor="let type of contentTypes" [ngValue]="type.id">
            {{ type.name }}
          </option>
        </select>
      </div>

      <!-- TÍTULO -->
      <div class="form-group">
        <label class="form-label">Título *</label>
        <input type="text" placeholder="Título del contenido" class="form-input" [(ngModel)]="title" name="title" required />
      </div>

      <!-- DESCRIPCIÓN -->
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <textarea rows="3" placeholder="Descripción detallada del contenido" class="form-textarea" [(ngModel)]="description" name="description"></textarea>
      </div>

      <!-- UBICACIÓN -->
      <div class="form-group">
        <label class="form-label">Ubicación de Almacenamiento *</label>
        <select class="form-select" [(ngModel)]="storageLocation" name="storageLocation">
          <option>Servidor Principal - Redacción</option>
          <option>Disco NAS - Archivo</option>
          <option>Disco Externo HD-01</option>
          <option>Disco Externo HD-02</option>
          <option>Estación Edición 1</option>
          <option>Estación Edición 2</option>
          <option>Portátil Reportero A</option>
        </select>
      </div>

      <!-- ESTADO -->
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-select" [(ngModel)]="status" name="status">
          <option value="publicado">Publicado</option>
          <option value="borrador">Borrador</option>
          <option value="archivado">Archivado</option>
        </select>
      </div>

      <!-- ETIQUETAS -->
      <div class="form-group">
        <label class="form-label">Etiquetas</label>
        <div class="tags-input">
          <input type="text" placeholder="Escribe y presiona Enter" class="form-input" [(ngModel)]="tagInput" name="tagInput" (keyup.enter)="addTag()" />
          <button type="button" class="btn btn-secondary btn-sm" (click)="addTag()">
            Agregar
          </button>
        </div>
        <div class="tags-list" *ngIf="tags.length">
          <span class="tag" *ngFor="let tag of tags; let i = index">
            {{ tag }}
            <button type="button" class="tag-remove" (click)="removeTag(i)">×</button>
          </span>
        </div>
      </div>

    </form>
  `,
  styles: [`
    .modal-form {
      display: grid;
      gap: 18px;
    }

    .form-group {
      display: grid;
      gap: 8px;
    }

    .form-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      border: 1px solid var(--border-soft);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      background: var(--bg-input-focus);
      color: var(--text-primary);
      transition: all 0.2s ease;
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: var(--btn-primary-bg);
      box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.08);
    }

    .drag-area {
      border: 2px dashed var(--border-soft);
      border-radius: 12px;
      padding: 40px 20px;
      background: var(--bg-dashed);
      color: var(--text-secondary);
      transition: 0.2s ease;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      cursor: pointer;
    }

    .drag-area:hover {
      background: var(--bg-dashed-hover);
    }

    .drag-area.dragover {
      border: 2px dashed var(--btn-primary-bg);
      background-color: var(--border-focus);
    }

    .drag-icon {
      width: 32px;
      height: 32px;
      color: var(--btn-primary-bg);
      margin: 0 auto;
    }

    .drag-text {
      font-size: 14px;
      color: var(--text-muted);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .btn-secondary {
      background: var(--btn-secondary-bg);
      border-color: var(--btn-secondary-border);
      color: var(--text-primary);
      padding: 8px 16px;
    }

    .btn-secondary:hover {
      background: var(--btn-secondary-hover);
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 13px;
    }

    .tags-input {
      display: flex;
      gap: 8px;
    }

    .tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--btn-secondary-bg);
      border-radius: 4px;
      font-size: 12px;
      color: var(--text-primary);
    }

    .tag-remove {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0 4px;
      font-size: 16px;
    }

    .tag-remove:hover {
      color: var(--text-primary);
    }
  `]
})
export class RegisterContentModalComponent implements OnInit {
  @Input() modalRef?: ModalRef;
  @Input() initialData?: any;

  contentTypes: { id: number; name: string }[] = [];
  selectedTypeId: number | null = null;
  selectedFile: File | null = null;
  isDragOver = false;
  title = '';
  description = '';
  storageLocation = '';
  status = 'borrador';
  tags: string[] = [];
  tagInput = '';

  private modalClose = new Subject<any>();

  constructor(private fileService: FileService) { }

  ngOnInit(): void {
    this.loadContentTypes();

    if (this.initialData) {
      // Cargar datos iniciales si existen
      Object.assign(this, this.initialData);
    }
  }

  private loadContentTypes() {
    this.fileService.getContentTypes().subscribe({
      next: (response) => {
        if (response.success) {
          this.contentTypes = response.data;
        }
      },
      error: (err) => {
        console.error('Error cargando content types:', err);
      }
    });
  }

  onSubmit(event: Event) {
    event.preventDefault();

    if (!this.selectedFile || !this.selectedTypeId || !this.title) {
      alert("Debes completar todos los campos obligatorios");
      return;
    }

    const formData = new FormData();
    formData.append("file", this.selectedFile);
    formData.append("content_type_id", String(this.selectedTypeId));
    formData.append("title", this.title);
    formData.append("description", this.description);
    formData.append("storage_location", this.storageLocation);
    formData.append("status", this.status);
    formData.append("tags", JSON.stringify(this.tags));

    // Cerrar modal con resultado
    this.modalClose.next({ success: true, data: formData });
    this.modalRef?.close({ success: true });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    if (event.dataTransfer?.files.length) {
      this.selectedFile = event.dataTransfer.files[0];
    }
  }

  addTag() {
    if (this.tagInput.trim()) {
      this.tags.push(this.tagInput.trim());
      this.tagInput = '';
    }
  }

  removeTag(index: number) {
    this.tags.splice(index, 1);
  }
}