import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { Header } from '../../components/header/header.component';
import { ModalService } from '../../components/modal/modal.component';
import { RegisterUserModalComponent } from './new-user.modal';
import { AuthService } from '../../services/auth.service';
import { CommonModule, NgForOf } from '@angular/common';
import { FileService } from '../../services/file.service';

@Component({
    selector: 'dashboard-page',
    imports: [Header, NgForOf, CommonModule],
    templateUrl: './page.html',
    styleUrl: './style.css'
})
export class DashboardPage implements OnInit {
    protected readonly title = signal('Administración del sistem');

    constructor(
        private modalService: ModalService,
        private auth: AuthService,
        private file: FileService,
        private cdr: ChangeDetectorRef

    ) { }

    users: { id: number; name: string; rol: string; password?: string }[] = [];

    locations: { id: number, path: string }[] = [];
    tree: any[] = [];

    ngOnInit() {

        this.auth.getAllUsers().subscribe(users => {
            this.users = users;
            this.cdr.markForCheck();
        });

        this.loadLocations();
    }

    loadLocations() {

        this.file.getMediaLocations().subscribe(data => {

            this.locations = data.locations;

            this.tree = this.buildTree(data.locations);

            this.cdr.markForCheck();

        });

    }

    buildTree(locations: any[]) {

        const root: any = {};

        locations.forEach(loc => {

            const parts = loc.path.split('/').filter(Boolean);

            let current = root;

            parts.forEach((part: string | number) => {

                if (!current[part]) {

                    current[part] = {
                        name: part,
                        children: {},
                        path: loc.path
                    };

                }

                current = current[part].children;

            });

        });

        function convert(node: any): any {

            return Object.values(node).map((n: any) => ({
                name: n.name,
                path: n.path,
                children: convert(n.children)
            }));

        }

        return convert(root);

    }

    createFolder() {

        const path = prompt("Ruta de la nueva carpeta");

        if (!path) return;

        this.file.createMediaLocation(path).subscribe(() => {
            this.loadLocations();
        });

    }

    renameFolder(loc: any) {

        const newPath = prompt("Nuevo nombre", loc.path);

        if (!newPath) return;

        this.file.renameMediaLocation(loc.id, newPath).subscribe(() => {
            this.loadLocations();
        });

    }

    deleteFolder(loc: any) {

        if (!confirm("Eliminar carpeta y contenido?")) return;

        this.file.deleteMediaLocation(loc.id).subscribe(() => {
            this.loadLocations();
        });

    }

    deleteUser(userId: number) {
        if (userId === 1) {
            alert('No se puede eliminar el usuario admin');
            return;
        }

        if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
            this.auth.deleteUser(userId).subscribe(() => {
                // Eliminar el usuario de la lista local después de eliminarlo en el servidor
                this.users = this.users.filter(user => user.id !== userId);
                this.cdr.markForCheck();

            }, error => {
                console.error('Error eliminando usuario:', error);
                alert('Error eliminando usuario');
            });
        }
    }



    openModal() {
        const modalRef = this.modalService.open(RegisterUserModalComponent, {
            title: 'Crear Nuevo Usuario',
            description: 'Completa la información del usuario que deseas agregar al sistema.',
            size: 'xl',
            showCloseButton: true,
            closeOnOverlayClick: true,
            buttons: [
                /*               {
                                   text: 'Cancelar',
                                   variant: 'secondary',
                                   handler: (modalRef) => modalRef.close()
                               },
                               {
                                   text: 'Crear Usuario',
                                   variant: 'primary',
                                   type: 'submit',
                                   closeOnClick: false
                               }
               */
            ],
            data: {
            }
        });

        modalRef.afterClosed$.subscribe(result => {
            if (result?.success) {
                this.ngOnInit(); // Refrescar la lista de usuarios
            }
        });

    }

    onEdit(userId: number) {
        // Abrimos la modal que ya tenemos con los datos de ese usuario cargados, y al hacer submit se debe de hacer un UPDATE en lugar de un CREATE
        const user = this.users.find(u => u.id === userId);

        if (!user) {
            alert('Usuario no encontrado');
            return;
        }

        const modalRef = this.modalService.open(RegisterUserModalComponent, {
            title: 'Editar Usuario',
            description: `Editando el usuario ${user.name}. Modifica la información que deseas actualizar.`,
            size: 'xl',
            showCloseButton: true,
            closeOnOverlayClick: true,
            buttons: [],
            data: {
                id: user.id,
                name: user.name,
                password: user.password,
                rol: user.rol
            }
        });

        // Escuchamos el resultado de la modal para actualizar el usuario en la lista después de editarlo
        modalRef.afterClosed$.subscribe(result => {
            if (result?.success) {
                console.log('Usuario actualizado exitosamente');
                this.ngOnInit(); // Refrescar la lista de usuarios
            }
        });
    }
}
