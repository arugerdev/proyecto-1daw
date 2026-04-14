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
<form class="modal-form" (ngSubmit)="submit()" #contentForm="ngForm">

  <!-- ARCHIVO -->
  <div class="form-group" [class.has-error]="showErrors && !isFileValid()">
    <label class="form-label">
      Archivo <span class="required-star">*</span>
      <span class="error-message" *ngIf="showErrors && !isFileValid()">
        Debes seleccionar un archivo
      </span>
    </label>

    <div class="drag-area"
         [class.dragover]="dragActive"
         [class.error]="showErrors && !isFileValid()"
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
  <div class="form-group" [class.has-error]="showErrors && !isTypeValid()">
    <label class="form-label">
      Tipo de Contenido <span class="required-star">*</span>
      <span class="error-message" *ngIf="showErrors && !isTypeValid()">
        {{ getTypeErrorMessage() }}
      </span>
    </label>

    <select class="form-select"
            [(ngModel)]="selectedTypeId"
            name="contentType"
            [disabled]="isCreatingNewType"
            (ngModelChange)="validateField('type')">

      <option [ngValue]="null" disabled>Selecciona un tipo</option>

      <option *ngFor="let type of contentTypes"
              [ngValue]="type.id">

        {{ type.name }}

      </option>

    </select>
    
    <div class="checkbox-wrapper">
      <label class="checkbox-label">
        <input type="checkbox" 
               [(ngModel)]="isCreatingNewType" 
               name="createNewType"
               (ngModelChange)="validateField('type')" /> 
        <span>Crear nuevo tipo de contenido</span>
      </label>
    </div>
    
    <div class="new-type-input" *ngIf="isCreatingNewType">
      <input type="text" 
             placeholder="Nombre del nuevo tipo de contenido" 
             class="form-input" 
             [(ngModel)]="newTypeName" 
             name="newTypeName"
             (input)="validateField('type')"
             [class.error]="showErrors && isCreatingNewType && !newTypeName.trim()" />
      <small class="field-hint" *ngIf="showErrors && isCreatingNewType && !newTypeName.trim()">
        El nombre del nuevo tipo es requerido
      </small>
    </div>
  </div>

  <!-- TÍTULO -->
  <div class="form-group" [class.has-error]="showErrors && !title.trim()">
    <label class="form-label">
      Título <span class="required-star">*</span>
      <span class="error-message" *ngIf="showErrors && !title.trim()">
        El título es requerido
      </span>
    </label>

    <input type="text"
           class="form-input"
           [(ngModel)]="title"
           name="title"
           required
           (input)="validateField('title')"
           [class.error]="showErrors && !title.trim()" />
  </div>

  <!-- DESCRIPCIÓN -->
  <div class="form-group" [class.has-error]="showErrors && !description.trim()">
    <label class="form-label">
      Descripción <span class="required-star">*</span>
      <span class="error-message" *ngIf="showErrors && !description.trim()">
        La descripción es requerida
      </span>
    </label>

    <textarea rows="3"
              class="form-textarea"
              [(ngModel)]="description"
              name="description"
              required
              (input)="validateField('description')"
              [class.error]="showErrors && !description.trim()">

    </textarea>
  </div>

  <!-- AÑO -->
  <div class="form-group" [class.has-error]="showErrors && !publicationYear">
    <label class="form-label">
      Año de Publicación <span class="required-star">*</span>
      <span class="error-message" *ngIf="showErrors && !publicationYear">
        El año es requerido
      </span>
      <span class="error-message" *ngIf="showErrors && publicationYear && !isYearValid()">
        El año debe ser entre 1900 y {{ currentYear }}
      </span>
    </label>

    <input type="number"
           class="form-input"
           [(ngModel)]="publicationYear"
           name="publicationYear"
           required
           min="1900"
           [max]="currentYear"
           (input)="validateField('year')"
           [class.error]="showErrors && (!publicationYear || !isYearValid())" />
  </div>

  <!-- UBICACIÓN -->
  <div class="form-group" [class.has-error]="showErrors && !storageLocationId">
    <label class="form-label">
      Ubicación de almacenamiento <span class="required-star">*</span>
      <span class="error-message" *ngIf="showErrors && !storageLocationId">
        Debes seleccionar una ubicación
      </span>
    </label>

    <select class="form-select"
            [(ngModel)]="storageLocationId"
            name="storageLocation"
            required
            (ngModelChange)="validateField('location')"
            [class.error]="showErrors && !storageLocationId">

      <option [ngValue]="null" disabled>Selecciona una ubicación</option>

      <option *ngFor="let location of locations"
              [ngValue]="location.id">

        {{ location.path }}

      </option>

    </select>
  </div>

  <!-- TAGS (OPCIONAL) -->
  <div class="form-group">
    <label class="form-label">Etiquetas (opcional)</label>

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

    <div class="tags-list" *ngIf="tags?.length">
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

  <!-- MENSAJE DE ERROR GENERAL -->
  <div class="form-error-message" *ngIf="showErrors && !isFormValid()">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" x2="12" y1="8" y2="12"></line>
      <line x1="12" x2="12.01" y1="16" y2="16"></line>
    </svg>
    <span>Por favor, completa todos los campos requeridos correctamente</span>
  </div>

  <!-- BOTONES -->
  <div class="form-group-h actions-container">

    <button type="button"
            class="btn btn-secondary btn-sm"
            (click)="modalRef?.close({success:false})"
            [disabled]="isLoading">

      {{cancelText}}

    </button>

    <button type="submit"
            class="btn btn-primary btn-sm"
            [disabled]="isLoading || (showErrors && !isFormValid())">

      <span *ngIf="!isLoading">{{ confirmText }}</span>
      <span *ngIf="isLoading" class="loading-spinner-small"></span>
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
      gap: 6px;
      position: relative;
    }

    .form-group.has-error .form-label {
      color: #ef4444;
    }

    .form-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .required-star {
      color: #ef4444;
      margin-left: 2px;
      font-size: 16px;
    }

    .error-message {
      color: #ef4444;
      font-size: 12px;
      font-weight: normal;
      margin-left: auto;
    }

    .form-error-message {
      background: rgba(239, 68, 68, 0.1);
      border-left: 4px solid #ef4444;
      border-radius: 6px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #ef4444;
      font-size: 13px;
      animation: slideIn 0.3s ease;
    }

    .form-error-message svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .field-hint {
      color: #ef4444;
      font-size: 11px;
      margin-top: 2px;
    }

    .form-input.error,
    .form-select.error,
    .form-textarea.error {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.02);
    }

    .form-input.error:focus,
    .form-select.error:focus,
    .form-textarea.error:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
    }

    .drag-area.error {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.02);
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

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: var(--btn-secondary-bg);
      border-color: var(--btn-secondary-border);
      color: var(--text-primary);
      padding: 8px 16px;
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--btn-secondary-hover);
    }
      
    .btn-primary {
      background: var(--btn-primary-bg);
      color: var(--btn-primary-text);
      padding: 8px 16px;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--btn-primary-hover);
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 13px;
    }

    .actions-container {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    
    .actions-container .btn {
      flex: 1;
      height: 40px;
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
      line-height: 1;
    }

    .tag-remove:hover {
      color: var(--text-primary);
    }

    .loading-spinner-small {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Responsive */
    @media screen and (max-width: 480px) {
      .form-label {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .error-message {
        margin-left: 0;
      }

      .actions-container {
        flex-direction: column;
      }

      .actions-container .btn {
        width: 100%;
      }

      .drag-area {
        padding: 30px 15px;
      }
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

  newTypeName = "";

  // =========================
  // UI
  // =========================

  isLoading = false;
  dragActive = false;
  isCreatingNewType = false;
  showErrors = false;
  currentYear = new Date().getFullYear();

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
  // VALIDACIONES
  // =========================

  isFileValid(): boolean {
    // En modo edición, si hay currentFileName, el archivo no es requerido
    if (this.id && this.currentFileName && !this.selectedFile) {
      return true;
    }
    // En creación, el archivo es requerido
    return !!this.selectedFile;
  }

  isTypeValid(): boolean {
    if (this.isCreatingNewType) {
      return !!this.newTypeName?.trim();
    }
    return !!this.selectedTypeId;
  }

  isYearValid(): boolean {
    if (!this.publicationYear) return false;
    return this.publicationYear >= 1900 && this.publicationYear <= this.currentYear;
  }

  isFormValid(): boolean {
    // Validar todos los campos requeridos
    const isFileValid = this.isFileValid();
    const isTypeValid = this.isTypeValid();
    const isTitleValid = !!this.title?.trim();
    const isDescriptionValid = !!this.description?.trim();
    const isYearValid = this.isYearValid();
    const isLocationValid = !!this.storageLocationId;

    return isFileValid && isTypeValid && isTitleValid &&
      isDescriptionValid && isYearValid && isLocationValid;
  }

  getTypeErrorMessage(): string {
    if (this.isCreatingNewType) {
      return 'El nombre del nuevo tipo es requerido';
    }
    return 'Debes seleccionar un tipo de contenido';
  }

  validateField(field: string): void {
    // Marcar errores solo si ya se mostraron
    if (this.showErrors) {
      this.cdr.detectChanges();
    }
  }

  validateAllFields(): boolean {
    this.showErrors = true;
    return this.isFormValid();
  }

  // =========================
  // FILE SELECT
  // =========================

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedFile = file;
    if (this.showErrors) this.cdr.detectChanges();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragActive = false;
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    this.selectedFile = file;
    if (this.showErrors) this.cdr.detectChanges();
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
    if (!this.tags) this.tags = [];

    if (this.tags.includes(tag)) {
      this.tagInput = '';
      return;
    }

    this.tags.push(tag);
    this.tagInput = '';
  }

  removeTag(tag: string) {
    this.tags = this.tags.filter(t => t !== tag);
  }

  // =========================
  // SUBMIT
  // =========================

  private createNewContentType(name: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.fileService.createContentType(name).subscribe({
        next: (response: any) => {
          if (response.success && response.id) {
            this.loadContentTypes();
            resolve(response.id);
          } else {
            reject(new Error('Error al crear tipo de contenido'));
          }
        },
        error: (err) => {
          // console.error('Error creando tipo de contenido:', err);
          reject(err);
        }
      });
    });
  }

  async submit() {
    // Validar todos los campos antes de enviar
    if (!this.validateAllFields()) {
      // Scroll al primer error
      const firstError = document.querySelector('.has-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const formData = new FormData();

    // Archivo (solo si hay uno nuevo)
    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }

    // Campos requeridos
    formData.append('title', this.title.trim());
    formData.append('description', this.description.trim());

    // Año (ya validado)
    if (this.publicationYear) {
      formData.append('publication_year', String(this.publicationYear));
    }

    // Ubicación (ya validada)
    if (this.storageLocationId) {
      formData.append('media_location_id', String(this.storageLocationId));
    }

    // Tags (opcional)
    if (this.tags.length) {
      formData.append('tags', this.tags.join(','));
    }

    this.isLoading = true;

    // =========================
    // TIPO DE CONTENIDO
    // =========================

    let typeIdToUse: number | null = null;

    if (this.isCreatingNewType) {
      try {
        typeIdToUse = await this.createNewContentType(this.newTypeName.trim());
      } catch (error) {
        this.isLoading = false;
        alert("Error al crear el nuevo tipo de contenido");
        return;
      }
    } else {
      typeIdToUse = this.selectedTypeId; // Ya validado que no es null
    }

    if (typeIdToUse) {
      formData.append('media_type_id', String(typeIdToUse));
    }

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