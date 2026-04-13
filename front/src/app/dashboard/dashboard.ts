import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { Header } from '../../components/header/header.component';
import { ModalService } from '../../components/modal/modal.component';
import { AuthService } from '../../services/auth.service';
import { CommonModule, NgForOf } from '@angular/common';
import { FileService } from '../../services/file.service';
import { ConfirmationModalComponent } from '../modals/confirmation.modal';
import { RouteModalComponent } from '../modals/new-route.modal';
import { UserModalComponent } from '../modals/new-user.modal';
import { Router } from '@angular/router';

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
        private cdr: ChangeDetectorRef,
        private router: Router

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

        this.modalService.open(RouteModalComponent, {
            title: "Crear Ruta",
            data: {
                path: "",
                onResult: (res: string) => {
                    this.file.createMediaLocation(res.trim()).subscribe(() => {
                        this.loadLocations();
                    });
                },
            },
            size: 'full',
        })

    }

    renameFolder(loc: any) {

        this.modalService.open(RouteModalComponent, {
            title: "Editar Ruta",
            data: {
                path: loc.path,
                onResult: (res: string) => {
                    this.file.renameMediaLocation(loc.id, res.trim()).subscribe(() => {
                        this.loadLocations();
                    });
                },
                size: 'xl',

            }
        })
    }

    deleteFolder(loc: any) {

        this.modalService.open(ConfirmationModalComponent, {
            title: `¿Eliminar "${loc.path}"? Esta acción no se puede deshacer.`,
            data: {
                message: `⚠ ATENCION: ESTO ELIMINARA TODO EL CONTENIDO DENTRO DE LA CARPETA, INCLUYENDO ARCHIVOS Y SUBCARPETAS`,
                confirmText: 'Sí, eliminar',
                cancelText: 'Cancelar',
                onConfirm: () => {
                    this.file.deleteMediaLocation(loc.id).subscribe(() => {
                        this.loadLocations();
                    });
                }
            }
        });

    }

    deleteUser(userId: number) {
        if (userId === 1) {
            alert('No se puede eliminar el usuario administrador principal');
            return;
        }

        // Obtener el usuario antes de eliminarlo
        const userToDelete = this.users.find(user => user.id === userId);
        if (!userToDelete) {
            alert('Usuario no encontrado');
            return;
        }

        // Verificar si el usuario está intentando eliminarse a sí mismo
        const currentUser = this.auth.getCurrentUser();
        if (currentUser && currentUser.id_user === userId) {
            this.modalService.open(ConfirmationModalComponent, {
                title: `Eliminar tu propio usuario`,
                data: {
                    message: `⚠ ATENCIÓN: Esta acción no se puede hacer, debe ser el otro administrador el que elimine tu cuenta.`,
                    confirmText: 'Entiendo',
                    cancelText: 'Cancelar',
                    onConfirm: () => {
                    }
                }
            });
            return;
        }

        // Confirmación normal para otros usuarios
        this.modalService.open(ConfirmationModalComponent, {
            title: `¿Eliminar el usuario "${userToDelete.name}"?`,
            data: {
                message: `Esta acción no se puede deshacer. El usuario perderá todo acceso al sistema.`,
                confirmText: 'Sí, eliminar',
                cancelText: 'Cancelar',
                onConfirm: () => {
                    this.executeUserDeletion(userId, userToDelete, false);
                }
            }
        });
    }

    private executeUserDeletion(userId: number, userToDelete: any, isSelfDelete: boolean) {
        this.auth.deleteUser(userId).subscribe({
            next: (res: any) => {
                if (res.success) {
                    // Eliminación exitosa
                    this.users = this.users.filter(user => user.id !== userId);

                    // Si el usuario se eliminó a sí mismo, cerrar sesión
                    if (isSelfDelete) {
                        alert('Tu cuenta ha sido eliminada. Serás redirigido al login.');
                        this.auth.logout();
                    }

                    this.cdr.markForCheck();
                } else {
                    // Manejar error devuelto por el servicio
                    this.handleDeletionError(res.error, userToDelete);
                }
            },
            error: (error) => {
                console.error('Error en la suscripción de eliminación:', error);

                // Extraer mensaje de error
                let errorMessage = 'Error al eliminar el usuario';

                if (error.error && error.error.error) {
                    errorMessage = error.error.error;
                } else if (error.message) {
                    errorMessage = error.message;
                }

                this.handleDeletionError(errorMessage, userToDelete);
            }
        });
    }

    private handleDeletionError(errorMessage: string, userToDelete: any) {
        // Mostrar el error en un modal o alert
        this.modalService.open(ConfirmationModalComponent, {
            title: 'Error al eliminar usuario',
            data: {
                message: `No se pudo eliminar al usuario "${userToDelete.name}".\n\nMotivo: ${errorMessage}`,
                confirmText: 'Entendido',
                cancelText: '',
                hideCancelButton: true,
                onConfirm: () => {
                    // Solo cerrar el modal
                }
            }
        });

        this.cdr.markForCheck();
    }

    openModal() {
        const modalRef = this.modalService.open(UserModalComponent, {
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

        const modalRef = this.modalService.open(UserModalComponent, {
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
                this.ngOnInit(); // Refrescar la lista de usuarios
            }
        });
    }
}
