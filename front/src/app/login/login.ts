import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { LocalStorageService } from '../../services/localStorage.service';
import { Router } from '@angular/router';

@Component({
    selector: 'login-page',
    templateUrl: './page.html',
    styleUrl: './style.css'
})
export class LoginPage {
    constructor(
        private http: HttpClient,
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

        const errorDisplay = (form.querySelector('#errorDisplay') as HTMLParagraphElement)

        fetch('http://localhost:3000/api/login', {
            method: "POST",
            body: JSON.stringify({ username, password }),
            headers: { "Content-Type": "application/json" }

        }).then((res) => res.json()).then((data) => {
            if (data.success) {
                errorDisplay.style.display = "none";

                this.storage.setAuthSession(
                    data.token,
                    data,
                    60 * 60 * 24 * 7 // 7 días en segundos
                );

                this.router.navigate(['/']);
                return;
            }

            errorDisplay.style.display = "flex";
            (errorDisplay.querySelector(".error-content p") as HTMLParagraphElement)
                .innerHTML = data.error;
        })

        /*
        this.http.post('https://localhost:3000/api/login', {
            username: 'usuario',
            password: 'usuario123'
        }).subscribe({
            next: (data) => {
                console.log(data);
            },
            error: (err) => {
                console.error(err);
            }
        });

        */
    }

    onTogglePassword() {
        this.showPassword = !this.showPassword;
    }
}
