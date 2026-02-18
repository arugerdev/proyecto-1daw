import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { LocalStorageService } from '../../services/localStorage.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrl: './header.component.css'
})
export class Header {
    constructor(
        private storage: LocalStorageService,
        private router: Router,
        public auth: AuthService,
        private cdr: ChangeDetectorRef
    ) { }
    // Si no tenemos el rol suficiente hay que quitar el boton

    // Vamos a hacerlo obteniendo el rol de la base de datos para evitar dependencia del cliente.
    canManageUsers = false;

    ngOnInit() {
        this.auth.refreshUserRole().subscribe(user => {
            this.canManageUsers = !!user?.permissions?.canManageUsers;
            this.cdr.markForCheck();
        });
    }

    logout() {
        this.storage.clearAuthSession();
        this.router.navigate(["/login"])
    }
}
