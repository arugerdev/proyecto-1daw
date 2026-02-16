import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';

@Component({
    selector: 'login-page',
    templateUrl: './page.html',
    styleUrl: './style.css'
})
export class LoginPage {
    constructor(private http: HttpClient) { }

    showPassword: boolean = false;

    async onSubmit(event: Event) {
        event.preventDefault();

        const form = event.target as HTMLFormElement;

        const username = (form.elements.namedItem('username') as HTMLInputElement).value;
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;

        fetch('http://localhost:3000/api/login', {
            method: "POST",
            body: JSON.stringify({ username, password }),
            headers: { "Content-Type": "application/json" }

        }).then((res) => res.json()).then((data) => {
            if (data.success) {
                console.log(data)
                return
            }

            const errorDisplay = (form.querySelector('#errorDisplay') as HTMLParagraphElement)
            errorDisplay.hidden = false;
            errorDisplay.innerHTML = data.error;
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
