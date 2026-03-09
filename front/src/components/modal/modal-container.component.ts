import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalButton, ModalRef } from '../../app/models/modal.model';

@Component({
    selector: 'app-modal-container',
    standalone: true,
    imports: [CommonModule],
    template: `
    <!-- OVERLAY -->
    <div class="modal-overlay" [class.visible]="isVisible" (click)="onOverlayClick($event)">
      
      <!-- MODAL WRAPPER -->
        <div class="modal-wrapper" [class.visible]="isVisible" [class.size-sm]="size === 'sm'" [class.size-md]="size === 'md'" [class.size-lg]="size === 'lg'" [class.size-xl]="size === 'xl'" [class.size-full]="size === 'full'">        
    
        <!-- Contenedor dinámico para el contenido -->
        <div role="dialog" class="modal">
          
          <!-- HEADER -->
          <div class="modal-header" *ngIf="title || description">
            <h2 class="modal-title">{{ title }}</h2>
            <p class="modal-description" *ngIf="description">{{ description }}</p>
          </div>
          
          <!-- CONTENIDO DINÁMICO -->
          <div #contentHost></div>
          
          <!-- FOOTER con botones dinámicos -->
          <div class="modal-footer" *ngIf="buttons?.length">
            <button 
              *ngFor="let button of buttons" 
              type="{{ button.type || 'button' }}"
              class="btn btn-{{ button.variant || 'secondary' }}"
              (click)="onButtonClick(button)"
            >
              {{ button.text }}
            </button>
          </div>
          
          <!-- BOTÓN CERRAR -->
          <button 
            type="button" 
            class="modal-close" 
            *ngIf="showCloseButton !== false"
            (click)="close()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
          
        </div>
      </div>
    </div>
  `,
    styles: [`
    /* Tus estilos actualizados aquí */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: var(--bg-overlay);
      z-index: 1002;
      display: none;
      animation: fadeIn 0.2s ease;
    }

    .modal-overlay.visible {
      display: block;
    }

    .modal-wrapper {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 1001;
      width: fit-content;
      height: fit-content;
      place-self: center;
      max-width: fit-content;
      height: fit-content;
    }

    .modal-wrapper.visible {
      display: flex;
    }

    .modal {
      width: 100%;
      background: var(--bg-modal);
      border-radius: 8px;
      padding: 28px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      animation: zoomIn 0.2s ease;
      position: relative;
      z-index: 1003;
      scrollbar-color: var(--btn-secondary-bg) var(--bg-input);
      scrollbar-width: thin;
      max-height: 95vh;
      overflow-y: scroll;
    }

    /* Tamaños del modal */
    .modal-wrapper.size-sm .modal { max-width: 400px; }
    .modal-wrapper.size-md .modal { max-width: 600px; }
    .modal-wrapper.size-lg .modal { max-width: 800px; }
    .modal-wrapper.size-xl .modal { max-width: 1200px; }
    .modal-wrapper.size-full .modal { max-width: 95vw; }

    .modal-header {
      margin-bottom: 24px;
    }

    .modal-title {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .modal-description {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      margin-top: 8px;
      border-top: 1px solid var(--border-soft);
    }

    .modal-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: transparent;
      border: none;
      padding: 4px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .modal-close:hover {
      opacity: 1;
    }

    .close-icon {
      width: 16px;
      height: 16px;
      color: var(--text-secondary);
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
      padding: 10px 20px;
    }

    .btn-primary {
      background: var(--btn-primary-bg);
      color: var(--btn-primary-text);
    }

    .btn-primary:hover {
      background: var(--btn-primary-hover);
    }

    .btn-secondary {
      background: var(--btn-secondary-bg);
      border-color: var(--btn-secondary-border);
      color: var(--text-primary);
    }

    .btn-secondary:hover {
      background: var(--btn-secondary-hover);
    }

    .btn-danger {
      background: #dc2626;
      color: white;
    }

    .btn-danger:hover {
      background: #b91c1c;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes zoomIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `],
})
export class ModalContainerComponent {
    @ViewChild('contentHost', { static: true }) contentHost!: ElementRef;

    @Input() title?: string;
    @Input() description?: string;
    @Input() buttons?: ModalButton[];
    @Input() showCloseButton = true;
    @Input() closeOnOverlayClick = true;
    @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';

    isVisible = true;
    modalRef?: ModalRef;

    onOverlayClick(event: MouseEvent): void {
        if (this.closeOnOverlayClick &&
            (event.target as HTMLElement).classList.contains('modal-overlay')) {
            this.close();
        }
    }

    onButtonClick(button: ModalButton): void {
        if (button.handler) {
            button.handler(this.modalRef!);
        }

        if (button.closeOnClick !== false) {
            this.close();
        }
    }

    close(result?: any): void {
        this.isVisible = false;

        // Esperar animación de salida
        setTimeout(() => {
            this.modalRef?.close(result);
        }, 200);
    }
}