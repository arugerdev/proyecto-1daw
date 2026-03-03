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
    <div class="modal-content">
        <form id="userForm" class="modal-form" (submit)="onSubmit($event)">
            <div class="form-group">
                <label class="form-label" for="username">Nombre de Usuario</label>
                <input class="form-input" type="text" id="username" placeholder="ej. juanperez" required>
                <small class="form-hint">Este es el nombre que se mostrará en el sistema.</small>
            </div>

            <div class="form-group">
                <label class="form-label" for="email">Correo Electrónico</label>
                <input class="form-input" type="email" id="email" placeholder="juan@ejemplo.com" required>
            </div>

            <div class="form-group">
                <label class="form-label" for="password">Contraseña</label>
                <input class="form-input" type="password" id="password" placeholder="Mínimo 6 caracteres" required>
            </div>

            <div class="form-group">
                <label class="form-label" for="role">Rol de Usuario</label>
                <select id="role" class="form-select">
                    <option value="Administrador">Administrador - Acceso total</option>
                    <option value="Avanzado">Usuario Avanzado - Puede editar</option>
                    <option value="Espectador" selected>Espectador - Solo lectura</option>
                </select>
            </div>

        </form>
    </div>
    `
    ,
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

    .form-hint {
        font-size: 12px;
        color: var(--text-muted);
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
export class RegisterUserModalComponent {
    @Input() modalRef?: ModalRef;

    users: { id: number; name: string; rol: string; }[] = [];


    private modalClose = new Subject<any>();

    constructor() { }

    onSubmit(event: Event) {
        event.preventDefault();

        const formData = new FormData();
        formData.append('username', (document.getElementById('username') as HTMLInputElement).value);
        formData.append('email', (document.getElementById('email') as HTMLInputElement).value);
        formData.append('password', (document.getElementById('password') as HTMLInputElement).value);
        formData.append('role', (document.getElementById('role') as HTMLSelectElement).value);

        // Aquí iría la llamada al servicio
        console.log("Datos a enviar:", {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role')
        });

        // Cerrar modal con resultado
        this.modalClose.next({ success: true, data: formData });
        this.modalRef?.close({ success: true });
    }

}