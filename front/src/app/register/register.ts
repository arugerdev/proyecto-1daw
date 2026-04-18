import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './page.html',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule]
})
export class RegisterComponent {
  username = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  loading = false;
  error = '';

  get strength(): number {
    if (!this.password) return 0;
    let s = 0;
    if (this.password.length >= 8) s++;
    if (/[A-Z]/.test(this.password)) s++;
    if (/[a-z]/.test(this.password)) s++;
    if (/[0-9!@#$%^&*]/.test(this.password)) s++;
    return s;
  }

  get strengthLabel(): string {
    return ['', 'Muy débil', 'Débil', 'Media', 'Fuerte'][this.strength] || '';
  }

  get strengthColor(): string {
    return ['bg-surface-700', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-500'][this.strength];
  }

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    if (this.auth.isAuthenticated()) this.router.navigate(['/']);
  }

  onRegister() {
    this.error = '';
    if (!this.username || !this.password || !this.confirmPassword) {
      this.error = 'Completa todos los campos'; return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(this.username)) {
      this.error = 'Usuario inválido (letras, números, guiones y guiones bajos)'; return;
    }
    if (this.password.length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres'; return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden'; return;
    }

    this.loading = true;
    this.auth.register(this.username, this.password).subscribe({
      next: res => {
        this.loading = false;
        if (res.success) this.router.navigate(['/']);
        else this.error = res.error || 'Error al registrar';
      },
      error: err => {
        this.loading = false;
        this.error = err.error?.error || 'El usuario ya existe o el servidor no responde';
      }
    });
  }
}
