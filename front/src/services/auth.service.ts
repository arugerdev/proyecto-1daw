import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LocalStorageService } from './localStorage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {

    private API = "http://localhost:3000/api";

    constructor(
        private http: HttpClient,
        private storage: LocalStorageService,
        private router: Router
    ) { }

    login(username: string, password: string) {
        return this.http.post<any>(`${this.API}/login`, { username, password });
    }

    logout() {
        this.storage.clearAuthSession();
        this.router.navigate(['/login']);
    }

    isAuthenticated(): boolean {
        return this.storage.isAuthenticated();
    }

    getRole(): string | null {
        return (this.storage.getUserData() as any).rol || null;
    }
}
