import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LocalStorageService } from '../services/localStorage.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('Sistema de Gestión Multimedia');

  private router = inject(Router);

  userData: any;
  isAuthenticated = false;

  constructor(private storageService: LocalStorageService) { }

  ngOnInit() {
    // Verificar autenticación
    this.isAuthenticated = this.storageService.isAuthenticated();

    if (this.isAuthenticated) {
      this.userData = this.storageService.getUserData();
      return
    }


    this.router.navigate(['/login'])
  }

  login() {
    // Después de login exitoso
    const token = 'jwt_token_example';
    const refreshToken = 'refresh_token_example';
    const userData = { name: 'Usuario', email: 'user@example.com' };
    const expiresIn = 604800; // 7 dias

    this.storageService.setAuthSession(token, refreshToken, userData, expiresIn);
    this.isAuthenticated = true;
    this.userData = userData;
  }

  logout() {
    this.storageService.clearAuthSession();
    this.isAuthenticated = false;
    this.userData = null;
  }

  // Ejemplo de uso genérico
  savePreferences() {
    const preferences = {
      theme: 'dark',
      language: 'es'
    };
    this.storageService.setItem('user_preferences', preferences);
  }

  loadPreferences() {
    const preferences = this.storageService.getItem('user_preferences');
    console.log('Preferences:', preferences);
  }
}
