import { Component, signal } from '@angular/core';
import { LocalStorageService } from '../../services/localStorage.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-header',
    templateUrl: './index.html',
    styleUrl: './style.css'
})
export class Header {
    constructor(
        private storage: LocalStorageService,
        private router: Router
    ) { }

    logout() {
        this.storage.clearAuthSession();
        this.router.navigate(["/login"])
    }
}
