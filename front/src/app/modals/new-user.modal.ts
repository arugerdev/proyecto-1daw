import { Component, OnInit, Input, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { ModalRef } from '../models/modal.model';
import { AuthService } from '../../services/auth.service';


@Component({
    selector: 'app-user-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    // En el template, solo cuando editamos, añadimos un checkbox para cambiar la contraseña, si el checkbox esta marcado se muestra el campo de contraseña, si no esta marcado se oculta el campo de contraseña y no se envia la contraseña al backend, esto es para evitar que al editar un usuario sin querer se cambie su contraseña a una vacía
    template: `
    <div class="modal-content">
        <form #userForm="ngForm" class="modal-form" (ngSubmit)="onSubmit()">
            <div class="form-group">
                <label class="form-label" for="username">Nombre de Usuario</label>
                <input 
                    class="form-input" 
                    type="text" 
                    id="username" 
                    name="username"
                    [(ngModel)]="userData.username"
                    placeholder="ej. juanperez" 
                    required
                    #username="ngModel">
                <small class="form-hint" *ngIf="username.invalid && username.touched">
                    El nombre de usuario es obligatorio
                </small>
                <small class="form-hint">Este es el nombre que se mostrará en el sistema.</small>
            </div>

            <!--
                <div class="form-group">
                    <label class="form-label" for="email">Correo Electrónico</label>
                    <input 
                        class="form-input" 
                        type="email" 
                        id="email" 
                        name="email"
                        [(ngModel)]="userData.email"
                        placeholder="juan@ejemplo.com" 
                        required
                        email
                        #email="ngModel">
                    <small class="form-hint" *ngIf="email.invalid && email.touched">
                        Ingresa un correo electrónico válido
                    </small>
                </div>
            -->

            <div class="form-group-h" *ngIf="userData.id">
            <label class="form-label">Cambiar Contraseña</label>
            <label class="form-checkbox">
                    <input type="checkbox" [(ngModel)]="changePassword" name="changePassword">
                    <span class="form-checkbox-indicator"></span>
                </label>
            </div>

            <div class="form-group" *ngIf="!userData.id || changePassword">
                <label class="form-label" for="password">Contraseña</label>
                <input 
                    class="form-input" 
                    type="password" 
                    id="password" 
                    name="password"
                    [(ngModel)]="userData.password"
                    placeholder="Mínimo 6 caracteres" 
                    required
                    minlength="6"
                    #password="ngModel">
                <small class="form-hint" *ngIf="password.invalid && password.touched">
                    La contraseña debe tener al menos 6 caracteres
                </small>
            </div>

            <div class="form-group" *ngIf="userData.id !== 1">
                <label class="form-label" for="role">Rol de Usuario</label>
                <select 
                    id="role" 
                    name="role"
                    [(ngModel)]="userData.role"
                    defaultValue="viewer"
                    class="form-select"
                    required>
                    <option value="viewer" selected>Espectador - Solo lectura</option>
                    <option value="admin">Administrador - Acceso total</option>
                    <option value="moderator">Usuario Avanzado - Puede editar</option>
                </select>
            </div>

            <!-- Botones dentro del formulario, cambiar entre crear y guardar al editar -->
            <div class="modal-form-actions">
                <button 
                    type="button" 
                    class="btn btn-secondary" 
                    (click)="onCancel()">
                    Cancelar
                </button>
                <button 
                    type="submit" 
                    class="btn btn-primary" 
                    [disabled]="userForm.invalid">
                    {{ userData.id ? 'Guardar Cambios' : 'Crear Usuario' }}
                </button>
            </div>
        </form>
    </div>
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

        .form-group-h {
            display: flex;
            align-items: center;
            gap: 12px;
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

        .form-hint.error {
            color: #ef4444;
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

        .form-input.ng-invalid.ng-touched,
        .form-select.ng-invalid.ng-touched {
            border-color: #ef4444;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
            outline: none;
            border-color: var(--btn-primary-bg);
            box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.08);
        }

        .modal-form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding-top: 16px;
            margin-top: 8px;
            border-top: 1px solid var(--border-soft);
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

        .btn-primary:hover:not(:disabled) {
            background: var(--btn-primary-hover);
        }

        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-secondary {
            background: var(--btn-secondary-bg);
            border-color: var(--btn-secondary-border);
            color: var(--text-primary);
        }

        .btn-secondary:hover {
            background: var(--btn-secondary-hover);
        }
    `]
})

//USAR DATA DEL MODALCONFIG PARA PASAR LOS DATOS DEL USUARIO A EDITAR, SI HAY UN ID EN LOS DATOS SE ASUME QUE ES UNA EDICION, SI NO HAY ID SE ASUME QUE ES CREACION

export class UserModalComponent {
    @Input() modalRef?: ModalRef;
    @ViewChild('userForm') userForm: any;

    userData = {
        id: null,
        username: '',
        password: '',
        role: 'viewer'
    };

    changePassword = false;

    private modalClose = new Subject<any>();

    constructor(
        private auth: AuthService,
        private cdfr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        // Si el modalRef tiene datos, cargar esos datos en el formulario (esto se usaría para la edición)

        if (this.modalRef) {
            const data = this.modalRef?.componentRef.instance.data;

            if (data) {
                this.userData = {
                    id: data.id,
                    username: data.name,
                    password: '', // No se carga la contraseña por seguridad
                    role: data.rol
                };
                this.cdfr.markForCheck();
            }
        }

    }


    onSubmit() {

        if (this.userForm.invalid) {
            // Marcar todos los campos como tocados para mostrar errores
            Object.keys(this.userForm.controls).forEach(field => {
                const control = this.userForm.control.get(field);
                control?.markAsTouched({ onlySelf: true });
            });
            return;
        }

        // Separar el proceso de creaccion al proceso de edicion, el mismo componente debe servir para las dos
        if (this.userData.id) {
            // Si hay un id, es una edición
            this.auth.updateUser(this.userData.id, this.userData).subscribe({
                next: (response) => {
                    // Cerrar modal con resultado
                    this.modalRef?.close({
                        success: true,
                        data: this.userData
                    });

                    if (this.userData.id == this.auth.getCurrentUser()?.id_user) {
                        location.href = '/'
                    }
                    else {
                        location.reload()
                    }


                },
                error: (error) => {
                    // console.error("Error al actualizar usuario:", error);
                    alert("Error al actualizar el usuario");
                }
            });
        } else {
            // Llamar al servicio para crear el usuario (esto se haría en un servicio real)
            this.auth.createUser(this.userData).subscribe({
                next: (response) => {
                    // Cerrar modal con resultado
                    this.modalRef?.close({
                        success: true,
                        data: this.userData
                    });

                    location.reload();
                },
                error: (error) => {
                    // console.error("Error al crear usuario:", error);
                    alert("Error al crear el usuario");
                }
            });
        }
    }

    onCancel() {
        this.modalRef?.close({ success: false });
    }
}