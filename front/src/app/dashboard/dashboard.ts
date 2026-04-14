import { ChangeDetectorRef, Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Header } from '../../components/header/header.component';
import { ModalService } from '../../components/modal/modal.component';
import { AuthService } from '../../services/auth.service';
import { CommonModule, NgForOf } from '@angular/common';
import { FileService } from '../../services/file.service';
import { ConfirmationModalComponent } from '../modals/confirmation.modal';
import { RouteModalComponent } from '../modals/new-route.modal';
import { UserModalComponent } from '../modals/new-user.modal';
import { Router } from '@angular/router';
import { UpdateInfo, UpdateService } from '../../services/update.service';
import { Subscription, forkJoin, of, timer } from 'rxjs';
import { catchError, timeout, retry, switchMap, takeWhile } from 'rxjs/operators';

@Component({
    selector: 'dashboard-page',
    imports: [Header, NgForOf, CommonModule],
    templateUrl: './page.html',
    styleUrl: './style.css'
})
export class DashboardPage implements OnInit, OnDestroy {
    protected readonly title = signal('Administración del sistema');

    // Propiedades existentes
    users: { id: number; name: string; rol: string; password?: string }[] = [];
    locations: { id: number, path: string }[] = [];
    tree: any[] = [];

    // Propiedades para actualización
    updateInfo: UpdateInfo | null = null;
    isUpdating = false;
    updateSubscription: Subscription | null = null;
    appVersion: string = 'desconocida';
    versionLoaded = false;


    // A partir de ahora se utilizara authService para verificar permisos en lugar de currentUserId y showUpdateSection

    canManageUsers = false;
    canPerformUpdates = false;
    canViewAllUsers = false;

    currentUserId: number | null = null; // Para saber cual es el usuario actual y evitar que se elimine a sí mismo

    constructor(
        private modalService: ModalService,
        private auth: AuthService,
        private file: FileService,
        private cdr: ChangeDetectorRef,
        private router: Router,
        private updateService: UpdateService
    ) { }

    ngOnInit() {
        // Cargar versión inmediatamente (antes que cualquier otra cosa)
        this.loadVersion();

        this.auth.refreshUserRole().subscribe(() => {
            const currentUser = this.auth.getCurrentUser();
            this.currentUserId = currentUser?.id_user || null;

            this.canManageUsers = this.auth.hasPermission('canManageUsers');
            this.canPerformUpdates = this.auth.hasPermission('canPerformUpdates');
            this.canViewAllUsers = this.auth.hasPermission('canViewAllUsers');

            if (this.canPerformUpdates) {

                // Esperar a que la versión se cargue antes de verificar actualizaciones
                // pero no bloquear la UI
                this.waitForVersionAndCheckUpdates();

                this.cdr.detectChanges();
                this.cdr.markForCheck();

                // Suscribirse a cambios de estado
                this.updateSubscription = this.updateService.getUpdateStatusObservable()
                    .subscribe(updateInfo => {
                        if (updateInfo) {
                            this.updateInfo = updateInfo;
                            this.isUpdating = updateInfo.currentStatus.status === 'updating';
                            this.cdr.detectChanges();
                            this.cdr.markForCheck();
                        }
                    });
            }
        });

        this.cdr.detectChanges();
        this.cdr.markForCheck();

        this.auth.getAllUsers().subscribe(users => {
            this.users = users;
            this.cdr.detectChanges();
            this.cdr.markForCheck();
        });

        this.loadLocations();

    }

    ngOnDestroy() {
        if (this.updateSubscription) {
            this.updateSubscription.unsubscribe();
        }
    }

    loadVersion() {
        this.updateService.getVersion().subscribe({
            next: (response) => {
                this.appVersion = response.version;
                this.versionLoaded = true;
                this.cdr.detectChanges();
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.warn('Error loading version from API, using fallback:', error);
                if (this.updateInfo?.version) {
                    this.appVersion = this.updateInfo.version;
                }
                this.versionLoaded = true;
                this.cdr.detectChanges();
            }
        });

        timer(2000, 5000).pipe(
            takeWhile(() => !this.versionLoaded && this.canPerformUpdates),
            switchMap(() => this.updateService.getVersion().pipe(catchError(() => of(null))))
        ).subscribe(response => {
            if (response && !this.versionLoaded) {
                this.appVersion = response.version;
                this.versionLoaded = true;
                this.cdr.detectChanges();
            }
        });
    }

    waitForVersionAndCheckUpdates() {
        // Esperar máximo 3 segundos a que la versión se cargue
        const maxWaitTime = 3000;
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
            if (this.versionLoaded || (Date.now() - startTime) >= maxWaitTime) {
                clearInterval(checkInterval);
                // Ya sea que tengamos versión o no, procedemos a verificar actualizaciones
                this.checkForUpdates();
            }
        }, 100);
    }

    checkForUpdates() {
        this.updateService.checkForUpdates().subscribe({
            next: (info) => {
                this.updateInfo = info;
                // Si no tenemos versión aún, usar la del updateInfo
                if (!this.versionLoaded && info?.version) {
                    this.appVersion = info.version;
                    this.versionLoaded = true;
                }
                this.cdr.detectChanges();
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('Error checking updates:', error);
                this.modalService.open(ConfirmationModalComponent, {
                    title: 'Error al verificar actualizaciones',
                    data: {
                        message: `No se pudieron verificar las actualizaciones: ${error.error?.error || error.message}`,
                        confirmText: 'Entendido',
                        cancelText: '',
                        hideCancelButton: true,
                        onConfirm: () => { }
                    }
                });
            }
        });
    }

    executeUpdate() {
        // Usar modal de confirmación en lugar de confirm()
        this.modalService.open(ConfirmationModalComponent, {
            title: 'Actualizar Sistema',
            data: {
                message: `¿Estás seguro de que quieres actualizar la aplicación?\n\n` +
                    `Esto reiniciará los servicios y puede causar una breve interrupción.\n\n` +
                    `Versión actual: ${this.updateInfo?.version || this.appVersion || 'desconocida'}\n` +
                    `Nueva versión: ${this.updateInfo?.remoteVersion || 'desconocida'}`,
                confirmText: 'Sí, actualizar',
                cancelText: 'Cancelar',
                onConfirm: () => {
                    this.updateService.executeUpdate().subscribe({
                        next: (response) => {
                            this.modalService.open(ConfirmationModalComponent, {
                                title: 'Actualización Iniciada',
                                data: {
                                    message: `La actualización ha comenzado en segundo plano.\n\n` +
                                        `Puedes monitorear el progreso en esta misma pantalla.\n\n` +
                                        `Los servicios se reiniciarán automáticamente al finalizar.`,
                                    confirmText: 'Entendido',
                                    cancelText: '',
                                    hideCancelButton: true,
                                    onConfirm: () => { }
                                }
                            });
                        },
                        error: (error) => {
                            console.error('Error starting update:', error);
                            this.modalService.open(ConfirmationModalComponent, {
                                title: 'Error al Iniciar Actualización',
                                data: {
                                    message: `No se pudo iniciar la actualización: ${error.error?.error || error.message}`,
                                    confirmText: 'Entendido',
                                    cancelText: '',
                                    hideCancelButton: true,
                                    onConfirm: () => { }
                                }
                            });
                        }
                    });
                }
            }
        });
    }

    get hasChangesToShow(): boolean {
        return !!(this.updateInfo?.hasUpdates &&
            this.updateInfo?.changes &&
            this.updateInfo.changes.length > 0);
    }

    get changesList(): string[] {
        return this.updateInfo?.changes || [];
    }

    get currentStatus() {
        return this.updateInfo?.currentStatus || {
            status: 'idle',
            step: 'none',
            message: 'No hay actualizaciones',
            error: null,
            timestamp: new Date().toISOString(),
            lastUpdate: null
        };
    }

    getStatusIcon(): string {
        if (!this.updateInfo) return '⏳';

        switch (this.updateInfo.currentStatus.status) {
            case 'updating': return '🔄';
            case 'success': return '✅';
            case 'error': return '❌';
            default: return '⏹️';
        }
    }

    getStatusClass(): string {
        if (!this.updateInfo) return '';

        switch (this.updateInfo.currentStatus.status) {
            case 'updating': return 'status-updating';
            case 'success': return 'status-success';
            case 'error': return 'status-error';
            default: return 'status-idle';
        }
    }

    loadLocations() {
        this.file.getMediaLocations().subscribe(data => {
            this.locations = data.locations;
            this.tree = this.buildTree(data.locations);
            this.cdr.detectChanges();
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
        });
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
        });
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
            this.modalService.open(ConfirmationModalComponent, {
                title: 'No se puede eliminar',
                data: {
                    message: 'No se puede eliminar el usuario administrador principal.',
                    confirmText: 'Entendido',
                    cancelText: '',
                    hideCancelButton: true,
                    onConfirm: () => { }
                }
            });
            return;
        }

        const userToDelete = this.users.find(user => user.id === userId);
        if (!userToDelete) {
            this.modalService.open(ConfirmationModalComponent, {
                title: 'Usuario no encontrado',
                data: {
                    message: 'El usuario que intentas eliminar no existe.',
                    confirmText: 'Entendido',
                    cancelText: '',
                    hideCancelButton: true,
                    onConfirm: () => { }
                }
            });
            return;
        }

        const currentUser = this.auth.getCurrentUser();
        if (currentUser && currentUser.id_user === userId) {
            this.modalService.open(ConfirmationModalComponent, {
                title: `No puedes eliminarte a ti mismo`,
                data: {
                    message: `⚠ ATENCIÓN: No puedes eliminar tu propia cuenta.\n\n` +
                        `Debe ser el otro administrador quien elimine tu cuenta.`,
                    confirmText: 'Entendido',
                    cancelText: 'Cancelar',
                    onConfirm: () => { }
                }
            });
            return;
        }

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
                    this.users = this.users.filter(user => user.id !== userId);

                    if (isSelfDelete) {
                        this.modalService.open(ConfirmationModalComponent, {
                            title: 'Cuenta Eliminada',
                            data: {
                                message: 'Tu cuenta ha sido eliminada. Serás redirigido al login.',
                                confirmText: 'Aceptar',
                                cancelText: '',
                                hideCancelButton: true,
                                onConfirm: () => {
                                    this.auth.logout();
                                }
                            }
                        });
                    } else {
                        this.modalService.open(ConfirmationModalComponent, {
                            title: 'Usuario Eliminado',
                            data: {
                                message: `El usuario "${userToDelete.name}" ha sido eliminado exitosamente.`,
                                confirmText: 'Aceptar',
                                cancelText: '',
                                hideCancelButton: true,
                                onConfirm: () => { }
                            }
                        });
                    }

                    this.cdr.detectChanges();
                    this.cdr.markForCheck();
                } else {
                    this.handleDeletionError(res.error, userToDelete);
                }
            },
            error: (error) => {
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
        this.modalService.open(ConfirmationModalComponent, {
            title: 'Error al eliminar usuario',
            data: {
                message: `No se pudo eliminar al usuario "${userToDelete.name}".\n\nMotivo: ${errorMessage}`,
                confirmText: 'Entendido',
                cancelText: '',
                hideCancelButton: true,
                onConfirm: () => { }
            }
        });

        this.cdr.detectChanges();
        this.cdr.markForCheck();
    }

    handleUpdateButtonClick() {
        // Si está actualizando, no hacer nada
        if (this.isUpdating) {
            return;
        }

        // Si hay error en la última verificación
        if (this.updateInfo?.currentStatus?.error) {
            this.checkForUpdates(); // Reintentar
            return;
        }

        // Si hay actualizaciones disponibles
        if (this.updateInfo?.hasUpdates) {
            this.executeUpdate(); // Actualizar ahora
            return;
        }

        // Si está actualizado o no hay información
        this.checkForUpdates();
        this.updateInfo = null; // Limpiar info para mostrar el spinner
        this.updateService.clearStatus(); // Limpiar estado en el servicio para reiniciar el proceso
        this.cdr.detectChanges();
        this.cdr.markForCheck();
    }

    openModal() {
        const modalRef = this.modalService.open(UserModalComponent, {
            title: 'Crear Nuevo Usuario',
            description: 'Completa la información del usuario que deseas agregar al sistema.',
            size: 'xl',
            showCloseButton: true,
            closeOnOverlayClick: true,
            buttons: [],
            data: {}
        });

        modalRef.afterClosed$.subscribe(result => {
            if (result?.success) {
                this.ngOnInit();
            }
        });
    }

    onEdit(userId: number) {
        const user = this.users.find(u => u.id === userId);

        if (!user) {
            this.modalService.open(ConfirmationModalComponent, {
                title: 'Usuario no encontrado',
                data: {
                    message: 'El usuario que intentas editar no existe.',
                    confirmText: 'Entendido',
                    cancelText: '',
                    hideCancelButton: true,
                    onConfirm: () => { }
                }
            });
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

        modalRef.afterClosed$.subscribe(result => {
            if (result?.success) {
                this.ngOnInit();
            }
        });
    }
}