import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="cancelled.emit()">
      <div class="modal-box max-w-md" (click)="$event.stopPropagation()">
        <div class="p-6 text-center">
          <div class="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-surface-100 mb-2">Confirmar acción</h3>
          <p class="text-surface-400 text-sm mb-6">{{ message }}</p>
          <div class="flex gap-3 justify-center">
            <button (click)="cancelled.emit()" class="btn-secondary">Cancelar</button>
            <button (click)="confirmed.emit()" class="btn-danger">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ConfirmModalComponent {
  @Input() message = '¿Estás seguro?';
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
