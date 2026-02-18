import { Component, Output, EventEmitter, Input } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css']
})
export class ModalComponent {
  @Input() isVisible = false;  // Añadido Input para recibir el estado desde el padre
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  onOverlayClick(event: MouseEvent) {
    // Cerrar solo si se hace clic en el overlay, no en el contenido del modal
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.onClose();
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();
    console.log('Formulario enviado');
    // Aquí iría la lógica para guardar el contenido
    this.onClose(); // Opcional: cerrar después de enviar
  }
}