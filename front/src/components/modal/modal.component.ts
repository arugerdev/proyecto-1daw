import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { FileService } from '../../services/file.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css'],
})
export class ModalComponent implements OnInit {

  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();

  contentTypes: { id: number; name: string }[] = [];
  selectedTypeId: number | null = null;
  selectedFile: File | null = null;
  isDragOver = false;

  constructor(private fileService: FileService) { }

  ngOnInit(): void {
    this.loadContentTypes();
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
  onClose() {
    this.close.emit();
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay') || (event.target as HTMLElement).classList.contains('modal-wrapper')) {
      this.onClose();
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();

    if (!this.selectedFile || !this.selectedTypeId) {
      alert("Debes seleccionar archivo y tipo");
      return;
    }

    const formData = new FormData();
    formData.append("file", this.selectedFile);
    formData.append("content_type_id", String(this.selectedTypeId));

    // this.fileService.uploadContent(formData).subscribe({
    //   next: () => {
    //     console.log("Archivo subido correctamente");
    //     this.onClose();
    //   },
    //   error: (err) => {
    //     console.error("Error subiendo archivo:", err);
    //   }
    // });
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
}