import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { LocalStorageService } from '../../services/localStorage.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'login-page',
    templateUrl: './page.html',
    styleUrl: './style.css'
})
export class LoginPage {
    constructor(
        private auth: AuthService,
        private storage: LocalStorageService,
        private router: Router
    ) { }

    ngOnInit() {
        if (this.storage.isAuthenticated()) {
            this.router.navigate(['/']);
        }
    }

    showPassword: boolean = false;

    async onSubmit(event: Event) {
        event.preventDefault();

        const form = event.target as HTMLFormElement;

        const username = (form.elements.namedItem('username') as HTMLInputElement).value;
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;

        const errorDisplay = form.querySelector('#errorDisplay') as HTMLElement;

        this.auth.login(username, password).subscribe({
            next: (data) => {

                if (!data.success) {
                    errorDisplay.style.display = "flex";
                    return;
                }

                errorDisplay.style.display = "none";

                this.storage.setAuthSession(
                    data.token,
                    data,
                    60 * 60 * 24 * 7
                );

                this.router.navigate(['/']);
            },
            error: () => {
                errorDisplay.style.display = "flex";
            }
        });
    }


    onTogglePassword() {
        this.showPassword = !this.showPassword;
    }
}
