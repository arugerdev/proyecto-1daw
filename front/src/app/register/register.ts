import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common'; 
import { Router, RouterModule } from '@angular/router'; 

@Component({
  selector: 'app-register',
  templateUrl: './page.html',
  styleUrls: ['./style.css'],
  standalone: true, 
  imports: [FormsModule, CommonModule, RouterModule]
})
export class RegisterComponent {
  // Variables para tooltips
  showTooltipUsername = false; 
  showTooltipPassword = false;
  showTooltipConfirm = false;

  showPassword = false;
  password = '';
  confirmPassword = '';
  
  // Fuerza de contraseña
  passwordStrength = 0;
  passwordColor = '#e5e7eb'; 
  passwordText = '';

  constructor(private http: HttpClient, private router: Router) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onPasswordInput(event: any) {
    this.password = event.target.value;
    this.passwordStrength = this.checkPasswordStrength(this.password);
  }

  onConfirmInput(event: any) {
    this.confirmPassword = event.target.value;
  }

  checkPasswordStrength(password: string): number {
    if (!password) {
      this.passwordColor = '#e5e7eb';
      this.passwordText = '';
      return 0;
    }
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[0-9!@#$%^&*()_\-+=]/.test(password)) strength += 25;

    if (strength <= 50) {
      this.passwordColor = '#ef4444';
      this.passwordText = 'Débil';
    } else if (strength < 100) {
      this.passwordColor = '#f59e0b';
      this.passwordText = 'Media';
    } else {
      this.passwordColor = '#22c55e';
      this.passwordText = 'Fuerte';
    }
    return strength;
  }

  highlightInputError(input: HTMLInputElement, show: boolean) {
    if (show) input.classList.add('invalid');
    else input.classList.remove('invalid');
  }

  showError(message: string) {
    const error = document.getElementById('errorDisplay');
    const text = document.getElementById('errorText');
    if (error && text) {
      error.style.display = 'flex'; 
      text.innerText = message;
    }
  }

  async onRegister(event: any) {
    event.preventDefault();
    const form = event.target.closest('form');
    const usernameInput = form.username as HTMLInputElement;
    const passwordInput = form.password as HTMLInputElement;
    const confirmInput = form.confirmPassword as HTMLInputElement;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    this.highlightInputError(usernameInput, false);
    this.highlightInputError(passwordInput, false);
    this.highlightInputError(confirmInput, false);

    // Validaciones
    if (!/^[a-zA-Z0-9-]+$/.test(username)) {
      this.highlightInputError(usernameInput, true);
      return this.showError('Usuario inválido (solo letras, números y guiones)');
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      this.highlightInputError(passwordInput, true);
      return this.showError('La contraseña no cumple los requisitos mínimos');
    }

    if (password !== confirm) {
      this.highlightInputError(confirmInput, true);
      return this.showError('Las contraseñas no coinciden');
    }

    this.http.post('http://localhost:3000/api/register', { username, password }).subscribe({
      next: () => {
        alert('Cuenta creada con éxito');
        this.router.navigate(['/login']);
      },
      error: () => this.showError('Error al registrar: el usuario ya existe o el servidor no responde')
    });
  }
}