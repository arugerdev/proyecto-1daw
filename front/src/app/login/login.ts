import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'login-page',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './page.html'
})
export class LoginPage {
  username = '';
  password = '';
  showPassword = false;
  loading = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    if (this.auth.isAuthenticated()) this.router.navigate(['/']);
  }

  onSubmit() {
    if (!this.username || !this.password) { this.error = 'Completa todos los campos'; return; }
    this.loading = true;
    this.error = '';

    this.auth.login(this.username, this.password).subscribe({
      next: res => {
        this.loading = false;
        if (res.success) this.router.navigate(['/']);
        else this.error = res.error || 'Credenciales incorrectas';
      },
      error: err => {
        this.loading = false;
        this.error = err.error?.error || 'Error de conexión';
      }
    });
  }
}
