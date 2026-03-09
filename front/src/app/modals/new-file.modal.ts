import {
  Component,
  OnInit,
  ChangeDetectorRef,
  Input
} from '@angular/core';

import { FileService } from '../../services/file.service';
import { ModalRef } from '../models/modal.model';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-content-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<form class="modal-form" (ngSubmit)="submit()">

  <!-- ARCHIVO -->
  <div class="form-group">
    <label class="form-label">Archivo</label>

    <div class="drag-area"
         [class.dragover]="dragActive"
         (click)="fileInput.click()"
         (dragover)="onDragOver($event)"
         (dragleave)="onDragLeave()"
         (drop)="onDrop($event)">

      <input #fileInput type="file" hidden (change)="onFileSelected($event)" />

      <svg xmlns="http://www.w3.org/2000/svg"
           class="drag-icon"
           viewBox="0 0 24 24"
           fill="none"
           stroke="currentColor"
           stroke-width="2">

        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
        <path d="M14 2v4a2 2 0 0 0 2 2h4"/>

      </svg>

      <p class="drag-text" *ngIf="!selectedFile && !currentFileName">
        Arrastra un archivo aquí o haz click para seleccionarlo
      </p>

      <p class="drag-text file-name" *ngIf="currentFileName && !selectedFile">
        Archivo actual: {{ currentFileName }}
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
    <label class="form-label">Tipo de Contenido</label>

    <select class="form-select"
            [(ngModel)]="selectedTypeId"
            name="contentType">

      <option [ngValue]="null" disabled>Selecciona un tipo</option>

      <option *ngFor="let type of contentTypes"
              [ngValue]="type.id">

        {{ type.name }}

      </option>

    </select>
  </div>

  <!-- TÍTULO -->
  <div class="form-group">
    <label class="form-label">Título</label>

    <input type="text"
           class="form-input"
           [(ngModel)]="title"
           name="title"
           required />
  </div>

  <!-- DESCRIPCIÓN -->
  <div class="form-group">

    <label class="form-label">Descripción</label>

    <textarea rows="3"
              class="form-textarea"
              [(ngModel)]="description"
              name="description">

    </textarea>

  </div>

  <!-- AÑO -->
  <div class="form-group">

    <label class="form-label">Año de Publicación</label>

    <input type="number"
           class="form-input"
           [(ngModel)]="publicationYear"
           name="publicationYear" />

  </div>

  <!-- UBICACIÓN -->
  <div class="form-group">

    <label class="form-label">Ubicación de almacenamiento</label>

    <select class="form-select"
            [(ngModel)]="storageLocationId"
            name="storageLocation">

      <option [ngValue]="null" disabled>Selecciona una ubicación</option>

      <option *ngFor="let location of locations"
              [ngValue]="location.id">

        {{ location.path }}

      </option>

    </select>

  </div>

  <!-- TAGS -->
  <div class="form-group">

    <label class="form-label">Etiquetas</label>

    <div class="tags-input">

      <input type="text"
             class="form-input"
             [(ngModel)]="tagInput"
             name="tagInput"
             placeholder="Escribe y presiona Enter"
             (keyup.enter)="addTag()" />

      <button type="button"
              class="btn btn-secondary btn-sm"
              (click)="addTag()">

        Agregar

      </button>

    </div>

    <div class="tags-list" *ngIf="tags.length">

      <span class="tag" *ngFor="let tag of tags">

        {{ tag }}

        <button type="button"
                class="tag-remove"
                (click)="removeTag(tag)">
          ×
        </button>

      </span>

    </div>

  </div>

  <!-- BOTONES -->

  <div class="form-group-h actions-container">

    <button type="button"
            class="btn btn-secondary btn-sm"
            (click)="modalRef?.close({success:false})">

      {{cancelText }}

    </button>

    <button type="submit"
            class="btn btn-primary btn-sm">

      {{ confirmText }}

    </button>

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

    .actions-container {
      display: flex;
      justify-content: center;
      place-content: center;
      gap: 8px;
    }
    
     .actions-container .btn {
      flex: 1;
      height: 40px;
    }
    

    .form-group-h {
      display: flex;
      justify-content: flex-end;
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

    .form-select:disabled {
      background: var(--btn-secondary-bg);
      opacity: 0.7;
      cursor: not-allowed;
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
      
    .btn-primary {
      background: var(--btn-primary-bg);
      color: var(--btn-primary-text);
      padding: 8px 16px;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 13px;
    }

    .checkbox-wrapper {
      margin-top: 4px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--text-primary);
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .new-type-input {
      margin-top: 8px;
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
export class ContentModalComponent implements OnInit {
  @Input() modalRef?: ModalRef;
  @Input() onSubmit!: () => {};

  // =========================
  // FORM DATA
  // =========================

  id: number | null = null;

  title = '';
  description = '';
  publicationYear: number | null = null;

  selectedTypeId: number | null = null;
  storageLocationId: number | null = null;

  tags: string[] = [];
  tagInput = '';

  // =========================
  // FILE
  // =========================

  selectedFile: File | null = null;
  currentFileName: string | null = null;

  // =========================
  // DATA
  // =========================

  contentTypes: any[] = [];
  locations: any[] = [];


  // =========================
  // UI
  // =========================

  isLoading = false;
  dragActive = false;
  confirmText = 'Guardar Cambios';
  cancelText = 'Cancelar Cambios';
  constructor(
    private fileService: FileService,
    private cdr: ChangeDetectorRef
  ) { }

  // =========================
  // INIT
  // =========================

  ngOnInit(): void {

    this.loadContentTypes();
    this.loadLocations();

    this.cdr.detectChanges();
  }

  // =========================
  // LOAD DATA
  // =========================

  loadContentTypes() {
    this.fileService.getContentTypes().subscribe(res => {

      this.contentTypes = res.data;
      this.cdr.detectChanges();
    });
  }

  loadLocations() {
    this.fileService.getMediaLocations().subscribe(res => {
      this.locations = res.locations;
      this.cdr.detectChanges();
    });
  }

  // =========================
  // FILE SELECT
  // =========================

  onFileSelected(event: any) {

    const file = event.target.files[0];

    if (!file) return;

    this.selectedFile = file;
  }

  onDrop(event: DragEvent) {

    event.preventDefault();
    this.dragActive = false;

    const file = event.dataTransfer?.files[0];

    if (!file) return;

    this.selectedFile = file;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragActive = true;
  }

  onDragLeave() {
    this.dragActive = false;
  }

  // =========================
  // TAGS
  // =========================

  addTag() {

    const tag = this.tagInput.trim();

    if (!tag) return;

    this.tags.push(tag);
    this.tagInput = '';
  }

  removeTag(tag: string) {
    this.tags = this.tags.filter(t => t !== tag);
  }

  // =========================
  // SUBMIT
  // =========================

  submit() {
    const formData = new FormData();

    if (this.selectedFile)
      formData.append('file', this.selectedFile);

    formData.append('title', this.title);
    formData.append('description', this.description);

    if (this.publicationYear)
      formData.append('publication_year', String(this.publicationYear));

    if (this.selectedTypeId)
      formData.append('media_type_id', String(this.selectedTypeId));

    if (this.storageLocationId)
      formData.append('media_location_id', String(this.storageLocationId));

    if (this.tags.length)
      formData.append('tags', this.tags.toString());

    this.isLoading = true;

    // =========================
    // EDIT
    // =========================

    if (this.id) {

      this.fileService.updateMedia(this.id, formData).subscribe({

        next: () => {
          this.modalRef?.close({ success: true });
          this.cdr.detectChanges();
          window.location.reload();
        },

        error: () => {
          this.isLoading = false;
          alert('Error actualizando contenido');
        }

      });

    }

    // =========================
    // CREATE
    // =========================

    else {

      this.fileService.createMedia(formData).subscribe({

        next: () => {
          this.modalRef?.close({ success: true });
          this.cdr.detectChanges();
          window.location.reload();
        },

        error: () => {
          this.isLoading = false;
          alert('Error creando contenido');
        }

      });

    }


  }

}