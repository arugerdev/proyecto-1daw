import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService } from '../../services/file.service';
import { Subject } from 'rxjs';
import { ModalRef } from '../models/modal.model';
import { AuthService } from '../../services/auth.service';

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

      <!-- TIPO DE CONTENIDO -->
      <div class="form-group">
        <label class="form-label">Tipo de Contenido *</label>
        
        <!-- Selector de tipo existente -->
        <select class="form-select" [(ngModel)]="selectedTypeId" name="contentType" 
                [disabled]="isCreatingNewType" required>
          <option [ngValue]="null" disabled>Selecciona un tipo existente</option>
          <option *ngFor="let type of contentTypes" [ngValue]="type.id">
            {{ type.name }}
          </option>
        </select>

        <!-- Checkbox para crear nuevo tipo -->
        <div class="checkbox-wrapper">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="isCreatingNewType" name="createNewType" />
            <span>Crear nuevo tipo de contenido</span>
          </label>
        </div>

        <!-- Input para nuevo tipo -->
        <div class="new-type-input" *ngIf="isCreatingNewType">
          <input type="text" 
                 placeholder="Nombre del nuevo tipo de contenido" 
                 class="form-input" 
                 [(ngModel)]="newTypeName" 
                 name="newTypeName"
                 [required]="isCreatingNewType" />
        </div>
      </div>

      <!-- TÍTULO -->
      <div class="form-group">
        <label class="form-label">Título *</label>
        <input type="text" placeholder="Título del contenido" class="form-input" [(ngModel)]="title" name="title" required />
      </div>

      <!-- DESCRIPCIÓN -->
      <div class="form-group">
        <label class="form-label">Descripción *</label>
        <textarea rows="3" required placeholder="Descripción detallada del contenido" class="form-textarea" [(ngModel)]="description" name="description"></textarea>
      </div>

      <!-- AÑO DE PUBLICACIÓN -->
      <div class="form-group">
        <label class="form-label">Año de Publicación *</label>
        <input type="number" 
               placeholder="Ej: 2024" 
               class="form-input" 
               [(ngModel)]="publicationYear" 
               name="publicationYear"
               min="1900" 
               required
               [max]="currentYear" />
      </div>

      <!-- AUTORES -->
      <div class="form-group">
      <!--
        <label class="form-label">Autores</label>
        <div class="authors-section">
          <select class="form-select" [(ngModel)]="selectedAuthorId" name="authorSelect">
            <option [ngValue]="null">Selecciona un autor</option>
            <option *ngFor="let author of authors" [ngValue]="author.id">
              {{ author.name }} {{ author.role ? '- ' + author.role : '' }}
            </option>
          </select>
          <button type="button" class="btn btn-secondary btn-sm" (click)="addAuthor()">
            Agregar Autor
          </button>
        </div>
        -->
        <div class="tags-list" *ngIf="selectedAuthors.length">
          <span class="tag" *ngFor="let author of selectedAuthors; let i = index">
            {{ author.name }}
            <button type="button" class="tag-remove" (click)="removeAuthor(i)">×</button>
          </span>
        </div>
      </div>

      <!-- UBICACIÓN DE ALMACENAMIENTO -->
      <div class="form-group">
        <label class="form-label">Ubicación de Almacenamiento *</label>
        <select class="form-select" [(ngModel)]="storageLocationId" name="storageLocation" required>
          <option [ngValue]="null" disabled>Selecciona una ubicación</option>
          <option *ngFor="let location of mediaLocations" [ngValue]="location.id">
            {{ location.path }}
          </option>
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
      <div class="form-group-h actions-container">
        <button type="button" class="btn btn-secondary btn-sm" (click)="modalRef?.close({ success: false })">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-sm">Registrar Contenido</button>
      </div>
    
    </form>
  `,
  //Actions container 100 % de tamaño, alineado central, con espacio entre botones, botones lo mas grande posible escalado con la pantalla
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

    .authors-section {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .authors-section select {
      flex: 1;
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

  // Content Types
  contentTypes: { id: number; name: string }[] = [];
  selectedTypeId: number | null = null;
  isCreatingNewType = false;
  newTypeName = '';

  // Authors
  authors: { id: number; name: string; role: string }[] = [];
  selectedAuthorId: number | null = null;
  selectedAuthors: { id: number; name: string; role: string }[] = [];

  // Media Locations
  mediaLocations: { id: number; path: string }[] = [];
  storageLocationId: number | null = null;

  // File
  selectedFile: File | null = null;
  isDragOver = false;

  // Metadata
  title = '';
  description = '';
  publicationYear: number | null = null;
  tags: string[] = [];
  tagInput = '';

  // Current year for validation
  currentYear = new Date().getFullYear();

  private modalClose = new Subject<any>();

  constructor(
    private fileService: FileService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) { }

  ngOnInit(): void {
    this.loadContentTypes();
    this.loadAuthors();
    this.loadMediaLocations();
    this.cdr.detectChanges(); // Asegura que los cambios se reflejen en la vista después de cargar datos
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
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error cargando content types:', err);
      }
    });
  }

  private loadAuthors() {
    this.fileService.getAuthors().subscribe({
      next: (response) => {
        if (response.success) {
          this.authors = response.authors;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error cargando autores:', err);
      }
    });
  }

  private loadMediaLocations() {
    this.fileService.getMediaLocations().subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Media locations cargadas:', response.locations);
          this.mediaLocations = response.locations;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error cargando ubicaciones:', err);
      }
    });
  }

  async onSubmit(event: Event) {
    event.preventDefault();

    // Validaciones de campos obligatorios
    if (!this.selectedFile) {
      alert("Debes seleccionar un archivo");
      return;
    }

    if (!this.title) {
      alert("Debes ingresar un título");
      return;
    }
    if (!this.description) {
      alert("Debes ingresar una descripción");
      return;
    }
    if (!this.publicationYear) {
      alert("Debes indicar un año de publicacion");
      return;
    }
    if (!this.storageLocationId) {
      alert("Debes seleccionar una ubicación de almacenamiento");
      return;
    }

    // Validación de tipo de contenido
    let typeIdToUse: number | null = null;

    if (this.isCreatingNewType) {
      if (!this.newTypeName || !this.newTypeName.trim()) {
        alert("Debes ingresar un nombre para el nuevo tipo de contenido");
        return;
      }

      try {
        // Crear nuevo tipo de contenido
        typeIdToUse = await this.createNewContentType(this.newTypeName.trim());
      } catch (error) {
        alert("Error al crear el nuevo tipo de contenido");
        return;
      }
    } else {
      if (!this.selectedTypeId) {
        alert("Debes seleccionar un tipo de contenido");
        return;
      }
      typeIdToUse = this.selectedTypeId;
    }

    const formData = new FormData();
    formData.append("file", this.selectedFile);
    formData.append("media_type_id", String(typeIdToUse));
    formData.append("title", this.title);
    formData.append("description", this.description || '');
    formData.append("media_location_id", String(this.storageLocationId));

    if (this.publicationYear) {
      formData.append("publication_year", String(this.publicationYear));
    }

    if (this.tags.length) {
      formData.append("tags", JSON.stringify(this.tags));
    }

    if (this.selectedAuthors.length) {
      const authorIds = this.selectedAuthors.map(a => a.id);
      formData.append("author_ids", JSON.stringify(authorIds));
    }

    formData.append("author_ids", JSON.stringify([this.auth.getCurrentUser()?.id_user]));

    console.log(formData);

    this.fileService.createMedia(formData).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.modalRef?.close({ success: true });
          this.cdr.detectChanges();
          window.location.reload();
        } else {
          alert("Error al registrar el contenido");
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error creando contenido:', err);
        alert("Error al registrar el contenido");
        this.cdr.detectChanges();
      }
    });

  }

  private createNewContentType(name: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.fileService.createContentType(name).subscribe({
        next: (response: any) => {
          if (response.success && response.id) {
            // Recargar tipos de contenido
            this.loadContentTypes();
            resolve(response.id);
          } else {
            reject(new Error('Error al crear tipo de contenido'));
          }
        },
        error: (err) => {
          console.error('Error creando tipo de contenido:', err);
          reject(err);
        }
      });
    });
  }

  addAuthor() {
    if (this.selectedAuthorId) {
      const author = this.authors.find(a => a.id === this.selectedAuthorId);
      if (author && !this.selectedAuthors.some(a => a.id === author.id)) {
        this.selectedAuthors.push({ ...author });
        this.selectedAuthorId = null;
      }
    }
  }

  removeAuthor(index: number) {
    this.selectedAuthors.splice(index, 1);
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