import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

const API = 'http://localhost:8000';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  debe_cambiar_password: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _usuario = new BehaviorSubject<Usuario | null>(this.cargarUsuario());

  usuario$: Observable<Usuario | null> = this._usuario.asObservable();

  constructor(private http: HttpClient) {}

  // ── LOGIN ──────────────────────────────────────────────
  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${API}/auth/login`, { email, password }).pipe(
      tap(r => {
        localStorage.setItem('token', r.access_token);
        localStorage.setItem('usuario', JSON.stringify(r.usuario));
        this._usuario.next({
          ...r.usuario,
          debe_cambiar_password: r.debe_cambiar_password
        });
      })
    );
  }

  // ── CAMBIAR PASSWORD ───────────────────────────────────
  cambiarPassword(actual: string, nuevo: string): Observable<any> {
    return this.http.post<any>(`${API}/auth/cambiar-password`, {
      password_actual: actual,
      password_nuevo:  nuevo
    }).pipe(
      tap(() => {
        const u = this._usuario.value;
        if (u) {
          const actualizado = { ...u, debe_cambiar_password: false };
          localStorage.setItem('usuario', JSON.stringify(actualizado));
          this._usuario.next(actualizado);
        }
      })
    );
  }

  // ── LOGOUT ─────────────────────────────────────────────
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this._usuario.next(null);
  }

  // ── HELPERS ────────────────────────────────────────────
  get token(): string | null {
    return localStorage.getItem('token');
  }

  get usuarioActual(): Usuario | null {
    return this._usuario.value;
  }

  get isLoggedIn(): boolean {
    return !!this.token && !!this._usuario.value;
  }

  get esAdmin(): boolean {
    return this._usuario.value?.rol === 'admin';
  }

  private cargarUsuario(): Usuario | null {
    try {
      const u = localStorage.getItem('usuario');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }
}