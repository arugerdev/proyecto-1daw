import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { Header } from '../../components/header/header.component';
import { ModalService } from '../../components/modal/modal.component';
import { RegisterUserModalComponent } from './new-user.modal';
import { AuthService } from '../../services/auth.service';
import { CommonModule, NgForOf } from '@angular/common';

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
        private cdr: ChangeDetectorRef

    ) { }

    users: { id: number; name: string; rol: string; }[] = [];

    //On init cargar usuario de la base de datos
    ngOnInit() {

        // Cargar utilizando getAllUsers
        this.auth.getAllUsers().subscribe(users => {
            console.log('Usuarios cargados:', users);
            // Mostrar los usuarios en la tabla
            this.users = users;

        }, error => {
            console.error('Error cargando usuarios:', error);
        });
    }

    // Funcion para eliminar un usuario (solo si no es admin)
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
                {
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
            ],
            data: {
            }
        });

        modalRef.afterClosed$.subscribe(result => {
            if (result?.success) {
                // Aquí podríamos mostrar un mensaje de éxito o refrescar la lista de usuarios
                console.log('Usuario creado exitosamente');
            }
        });

    }
}
