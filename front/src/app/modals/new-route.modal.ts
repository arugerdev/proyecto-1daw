import { Component, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalRef } from '../models/modal.model';

@Component({
    selector: 'app-route-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <form #routeForm="ngForm" class="modal-form" (ngSubmit)="onSubmit()">

            <div class="form-group">
                <label class="form-label" for="path">Ruta</label>

                <input
                    class="form-input"
                    type="text"
                    id="path"
                    name="path"
                    [(ngModel)]="path"
                    placeholder="/media/movies"
                    required
                    #pathInput="ngModel">

                <small class="form-hint" *ngIf="pathInput.invalid && pathInput.touched">
                    La ruta es obligatoria
                </small>

                <small class="form-hint">
                    Introduce la nueva ruta del directorio.
                </small>
            </div>

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
                    [disabled]="routeForm.invalid">
                    Aceptar
                </button>
            </div>

        </form>
    `,
    styles: [`
        .modal-content{
            min-width:30vw;
        }
        .modal-form {
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

        .form-input {
            width: 100%;
            border: 1px solid var(--border-soft);
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 14px;
            background: var(--bg-input-focus);
            color: var(--text-primary);
            transition: all 0.2s ease;
        }

        .form-input.ng-invalid.ng-touched {
            border-color: #ef4444;
        }

        .form-input:focus {
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
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid transparent;
            padding: 10px 20px;
            transition: all 0.2s ease;
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

export class RouteModalComponent {

    @Input() modalRef?: ModalRef;
    @Input() onResult!: (a: any) => {};
    @ViewChild('routeForm') routeForm: any;

    path: string = '';

    ngOnInit() {

        if (this.modalRef) {
            const data = this.modalRef.componentRef.instance.data;

            if (data?.path) {
                this.path = data.path;
            }
        }

    }

    onSubmit() {

        if (this.routeForm.invalid) {
            Object.keys(this.routeForm.controls).forEach(field => {
                const control = this.routeForm.control.get(field);
                control?.markAsTouched({ onlySelf: true });
            });
            return;
        }
        this.onResult(this.path)
        this.modalRef?.close({
            success: true,
            path: this.path
        });

    }

    onCancel() {
        this.modalRef?.close({ success: false });
    }

}