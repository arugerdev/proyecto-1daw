import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalRef } from '../models/modal.model';

// Este modal se puede usar para confirmar acciones como eliminar un archivo, cambiar su estado, etc.


@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="modal-form" (ngSubmit)="onSubmit($event)">
      <div class="form-group">
        <p>{{ message }}</p>
      </div>
      <div class="form-group-h" style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" class="btn btn-secondary btn-sm" (click)="modalRef?.close({ success: false })">Cancelar</button>
        <button type="submit" class="btn btn-primary btn-sm">Confirmar</button>
      </div>

    </form>
  `,
  styles: [`
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .form-label {
      font-weight: 600;
      font-size: 1.125rem;
      color: var(--text-primary);
    }
    form p {
      color: var(--text-secondary);
    }
      .btn {  
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        font-size: 0.875rem;
        cursor: pointer;
        transition: background-color 0.2s;
      } 
      .btn-primary {
        background-color: var(--btn-primary-bg);
        color: var(--btn-primary-text);
      }
      .btn-primary:hover {
        background-color: var(--btn-primary-hover);
      }
      .btn-secondary {
        background-color: var(--btn-secondary-bg);
        color: var(--text-primary);
        border: 1px solid var(--btn-secondary-border);
      } 
      .btn-secondary:hover {
        background-color: var(--btn-secondary-hover);
      }

      .form-group-h {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

  `]
})
export class ConfirmationModalComponent {
  @Input() modalRef?: ModalRef;
  @Input() message: string = '¿Estás seguro de que deseas realizar esta acción?';
  @Input() onConfirm!: () => {};

  onSubmit(event: Event) {
    event.preventDefault();
    this.onConfirm();
    this.modalRef?.close({ success: true });
  }


}