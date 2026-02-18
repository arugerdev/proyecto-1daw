import { Component, signal } from '@angular/core';
import { LocalStorageService } from '../../services/localStorage.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-header',
    templateUrl: './index.html',
    styleUrl: './style.css'
})
export class Header {
    constructor(
        private storage: LocalStorageService,
        private router: Router,
        public auth: AuthService
    ) { }
    // Si no tenemos el rol suficiente hay que quitar el boton

    // Vamos a hacerlo obteniendo el rol de la base de datos para evitar dependencia del cliente.

    logout() {
        this.storage.clearAuthSession();
        this.router.navigate(["/login"])
    }
}
