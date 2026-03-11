

import { ChangeDetectorRef, Component, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalRef } from '../models/modal.model';
import { FileService } from '../../services/file.service';

@Component({
    selector: 'app-route-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
<form #routeForm="ngForm" class="modal-form" (ngSubmit)="onSubmit()">

<div class="form-group">

<label class="form-label">Ruta actual</label>

<input
class="form-input"
type="text"
name="path"
[(ngModel)]="path"
readonly>

<div class="explorer">

<button
type="button"
class="btn btn-secondary"
(click)="goUp()">
⬆ Atrás
</button>

<div class="folder-list">

<!-- DISKS -->
<div
class="folder"
*ngFor="let disk of disks"
(click)="openDisk(disk)">
💾 {{disk}}
</div>

<!-- FOLDERS -->
<div
class="folder"
*ngFor="let folder of folders"
(click)="openFolder(folder)">
📁 {{folder}}
</div>

</div>

</div>

<small class="form-hint">
Selecciona una carpeta del servidor.
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
class="btn btn-primary">
Usar esta ruta
</button>

</div>

</form>

`,
    styles: [`
.explorer{
border:1px solid var(--border-soft);
border-radius:8px;
padding:10px;
max-height:250px;
overflow:auto;
}

.folder{
padding:6px;
cursor:pointer;
border-radius:6px;
color: var(--text-primary);
}

.folder:hover{
background:var(--btn-secondary-hover);
}

.folder-list{
margin-top:8px;
display:flex;
flex-direction:column;
gap:4px;
}

        .modal-form {
            min-width:20vw;
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
    folders: string[] = [];
    disks: string[] = [];

    constructor(
        private fileService: FileService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {

        if (this.modalRef) {
            const data = this.modalRef.componentRef.instance.data;

            if (data?.path) {
                this.path = data.path;
            }
        }

        this.loadFolders();
        this.cdr.detectChanges();
    }

    loadFolders() {

        this.fileService.listFolders(this.path).subscribe({

            next: (res: any) => {

                if (res.disks) {

                    this.disks = res.disks;
                    this.folders = [];
                    this.path = '';

                } else {

                    this.disks = [];
                    this.folders = res.folders || [];

                }

                this.cdr.detectChanges();
            },

            error: (err) => {
                console.error('Filesystem error', err);
            }

        });

        this.cdr.detectChanges();

    }

    openDisk(disk: string) {

        this.path = disk;
        this.loadFolders();

        this.cdr.detectChanges();

    }

    openFolder(folder: string) {

        if (!this.path) {
            this.path = folder;
            this.cdr.detectChanges();
        }
        else {

            const separator = this.path.includes('\\') ? '\\' : '/';

            if (this.path.endsWith(separator))
                this.path = this.path + folder;
            else
                this.path = this.path + separator + folder;

            this.cdr.detectChanges();
        }

        this.loadFolders();
        this.cdr.detectChanges();
    }

    goUp() {

        if (!this.path) {
            this.loadFolders();
            this.cdr.detectChanges();
            return;
        }

        const separator = this.path.includes('\\') ? '\\' : '/';

        const parts = this.path.split(separator).filter(Boolean);
        parts.pop();

        if (parts.length === 0) {
            this.path = '';
        } else {
            this.path = parts.join(separator);

            if (separator === '\\')
                this.path += '\\';
            else
                this.path = '/' + this.path;
        }

        this.loadFolders();
        this.cdr.detectChanges();
    }

    onSubmit() {

        this.onResult(this.path);

        this.modalRef?.close({
            success: true,
            path: this.path
        });

    }

    onCancel() {
        this.modalRef?.close({ success: false });
    }

}