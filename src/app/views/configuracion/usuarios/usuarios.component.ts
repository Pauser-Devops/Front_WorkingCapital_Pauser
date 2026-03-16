import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../auth.service';
import { environment } from '../../../../environments/environment';

const API = environment.apiUrl;

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  debe_cambiar_password: boolean;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  cargando = false;
  error    = '';
  exito    = '';

  modalAbierto      = false;
  modoEdicion       = false;
  usuarioEditandoId: number | null = null;
  form = { nombre: '', email: '', password: '', rol: 'finanzas' };

  confirmVisible   = false;
  confirmMensaje   = '';
  confirmSubtexto  = '';
  confirmAccion:   (() => void) | null = null;
  confirmTipo:     'danger' | 'warning' | 'success' = 'danger';

  readonly roles = [
    { value: 'admin',          label: 'Admin' },
    { value: 'gerencia',       label: 'Gerencia' },
    { value: 'finanzas_admin', label: 'Finanzas' },
    { value: 'finanzas',       label: 'Finanzas (Acceso Limitado)' },
  ];

  constructor(private http: HttpClient, public auth: AuthService) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token}` });
  }

  ngOnInit() { this.cargarUsuarios(); }

  get totalUsuarios(): number { return this.usuarios.length; }
  get totalActivos():  number { return this.usuarios.filter(u => u.activo).length; }

  generarCredenciales() {
    const nombre = this.form.nombre.trim();
    if (!nombre) return;
    const partes  = nombre.split(' ').filter(p => p.length > 0);
    const limpiar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const inicial  = limpiar(partes[0]?.charAt(0) ?? '');
    const apellido = limpiar(partes[1] ?? '');
    const anio     = new Date().getFullYear();
    this.form.password = `${inicial}${apellido}${anio}!`;
    this.form.email    = `${inicial}${apellido}@pauserdistribuciones.com`;
  }

  cargarUsuarios() {
    this.cargando = true;
    this.http.get<any>(`${API}/auth/usuarios`, { headers: this.headers }).subscribe({
      next: r => { this.usuarios = r.usuarios; this.cargando = false; },
      error: () => { this.error = 'Error al cargar usuarios'; this.cargando = false; }
    });
  }

  abrirCrear() {
    this.modoEdicion = false;
    this.usuarioEditandoId = null;
    this.form = { nombre: '', email: '', password: '', rol: 'finanzas' };
    this.modalAbierto = true;
    this.exito = ''; this.error = '';
  }

  abrirEditar(u: Usuario) {
    this.modoEdicion = true;
    this.usuarioEditandoId = u.id;
    this.form = { nombre: u.nombre, email: u.email, password: '', rol: u.rol };
    this.modalAbierto = true;
    this.exito = ''; this.error = '';
  }

  guardar() {
    if (this.modoEdicion) {
      this.http.put<any>(`${API}/auth/usuarios/${this.usuarioEditandoId}`, {
        nombre: this.form.nombre, email: this.form.email, rol: this.form.rol
      }, { headers: this.headers }).subscribe({
        next: () => { this.exito = 'Usuario actualizado'; this.modalAbierto = false; this.cargarUsuarios(); },
        error: e  => this.error = e.error?.detail || 'Error al editar'
      });
    } else {
      this.http.post<any>(`${API}/auth/usuarios`, this.form, { headers: this.headers }).subscribe({
        next: () => { this.exito = 'Usuario creado'; this.modalAbierto = false; this.cargarUsuarios(); },
        error: e  => this.error = e.error?.detail || 'Error al crear'
      });
    }
  }

  resetPassword(u: Usuario) {
    this.abrirConfirm(
      `Resetear contraseña de ${u.nombre}`,
      'Se asignará una contraseña temporal y el usuario deberá cambiarla al iniciar sesión.',
      'warning',
      () => {
        this.http.post<any>(`${API}/auth/reset-password`, { email: u.email }, { headers: this.headers }).subscribe({
          next: r  => this.exito = `Contraseña reseteada. Temporal: ${r.password_temporal}`,
          error: () => this.error = 'Error al resetear'
        });
      }
    );
  }

  desactivar(u: Usuario) {
    this.abrirConfirm(
      `Desactivar a ${u.nombre}`,
      'El usuario no podrá iniciar sesión. Sus datos se conservarán y podrás reactivarlo después.',
      'danger',
      () => {
        this.http.delete<any>(`${API}/auth/usuarios/${u.id}`, { headers: this.headers }).subscribe({
          next: () => { this.exito = 'Usuario desactivado'; this.cargarUsuarios(); },
          error: () => this.error = 'Error al desactivar'
        });
      }
    );
  }

  reactivar(u: Usuario) {
    this.abrirConfirm(
      `Reactivar a ${u.nombre}`,
      'El usuario podrá iniciar sesión nuevamente. Se le pedirá cambiar su contraseña al ingresar.',
      'success',
      () => {
        this.http.patch<any>(`${API}/auth/usuarios/${u.id}/reactivar`, {}, { headers: this.headers }).subscribe({
          next: () => { this.exito = `${u.nombre} reactivado correctamente`; this.cargarUsuarios(); },
          error: () => this.error = 'Error al reactivar'
        });
      }
    );
  }

  abrirConfirm(mensaje: string, subtexto: string, tipo: 'danger' | 'warning' | 'success', accion: () => void) {
    this.confirmMensaje  = mensaje;
    this.confirmSubtexto = subtexto;
    this.confirmTipo     = tipo;
    this.confirmAccion   = accion;
    this.confirmVisible  = true;
    this.error = ''; this.exito = '';
  }

  ejecutarConfirm() {
    if (this.confirmAccion) this.confirmAccion();
    this.cerrarConfirm();
  }

  cerrarConfirm() { this.confirmVisible = false; this.confirmAccion = null; }

  rolLabel(rol: string): string {
    return this.roles.find(r => r.value === rol)?.label ?? rol;
  }

  cerrarModal() { this.modalAbierto = false; this.error = ''; }
}