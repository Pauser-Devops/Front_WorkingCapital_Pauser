import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email    = '';
  password = '';
  error    = '';
  cargando = false;
  mostrarPassword = false;

  constructor(private auth: AuthService) {}

  submit() {
    if (!this.email || !this.password) {
      this.error = 'Completa todos los campos';
      return;
    }
    this.cargando = true;
    this.error    = '';

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.cargando = false;
        // app.component maneja la navegación con *ngIf automáticamente
      },
      error: (e) => {
        this.cargando = false;
        this.error = e.error?.detail || 'Error al iniciar sesión';
      }
    });
  }
}