import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="cp-wrap">
  <div class="cp-box">
    <div class="cp-icon">🔐</div>
    <h2>Cambiar contraseña</h2>
    <p *ngIf="esPrimerAcceso" class="cp-alerta">
      Es tu primer acceso. Debes establecer una contraseña personal antes de continuar.
    </p>
    <p *ngIf="!esPrimerAcceso" class="cp-sub">Actualiza tu contraseña de acceso</p>

    <div class="cp-form">
      <div class="cp-field">
        <label>Contraseña actual</label>
        <input [type]="mostrar1 ? 'text' : 'password'" [(ngModel)]="actual" placeholder="••••••••"/>
        <button class="cp-eye" type="button" (click)="mostrar1=!mostrar1">{{mostrar1?'🙈':'👁️'}}</button>
      </div>
      <div class="cp-field">
        <label>Nueva contraseña</label>
        <input [type]="mostrar2 ? 'text' : 'password'" [(ngModel)]="nueva" placeholder="Mínimo 8 caracteres"/>
        <button class="cp-eye" type="button" (click)="mostrar2=!mostrar2">{{mostrar2?'🙈':'👁️'}}</button>
      </div>
      <div class="cp-field">
        <label>Confirmar nueva contraseña</label>
        <input [type]="mostrar3 ? 'text' : 'password'" [(ngModel)]="confirmar" placeholder="Repite la contraseña"/>
        <button class="cp-eye" type="button" (click)="mostrar3=!mostrar3">{{mostrar3?'🙈':'👁️'}}</button>
      </div>

      <div class="cp-reqs">
        <div class="cp-req" [class.ok]="nueva.length >= 8">
          <span>{{ nueva.length >= 8 ? '✅' : '⭕' }}</span> Mínimo 8 caracteres
        </div>
        <div class="cp-req" [class.ok]="nueva === confirmar && nueva.length > 0">
          <span>{{ nueva === confirmar && nueva.length > 0 ? '✅' : '⭕' }}</span> Las contraseñas coinciden
        </div>
      </div>

      <div class="cp-error" *ngIf="error">⚠️ {{ error }}</div>
      <div class="cp-ok"    *ngIf="exito">✅ {{ exito }}</div>

      <button class="cp-btn" type="button" (click)="submit()" [disabled]="cargando || !valido">
        <span *ngIf="!cargando">Guardar contraseña</span>
        <span *ngIf="cargando" class="cp-spinner"></span>
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
.cp-wrap { height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f4f8;font-family:'Segoe UI',sans-serif; }
.cp-box { background:#fff;border-radius:20px;padding:40px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(30,58,95,.12);border:1px solid #dde3eb;display:flex;flex-direction:column;align-items:center;gap:6px; }
.cp-icon { font-size:40px;margin-bottom:4px; }
h2 { margin:0;font-size:22px;font-weight:700;color:#0f1f35; }
.cp-alerta { background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13px;color:#92400e;text-align:center;width:100%;box-sizing:border-box; }
.cp-sub { font-size:13px;color:#64748b;margin:0; }
.cp-form { width:100%;display:flex;flex-direction:column;gap:14px;margin-top:8px; }
.cp-field { display:flex;flex-direction:column;gap:5px;position:relative; }
.cp-field label { font-size:12px;font-weight:600;color:#374151; }
.cp-field input { padding:10px 38px 10px 12px;border:1.5px solid #dde3eb;border-radius:8px;font-size:14px;outline:none;background:#f8fafc;transition:border-color .15s; }
.cp-field input:focus { border-color:#1e3a5f;background:#fff; }
.cp-eye { position:absolute;right:8px;bottom:8px;background:none;border:none;cursor:pointer;font-size:15px; }
.cp-reqs { display:flex;flex-direction:column;gap:4px; }
.cp-req { font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:6px;transition:color .2s; }
.cp-req.ok { color:#16a34a; }
.cp-error { background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:13px;color:#dc2626;width:100%;box-sizing:border-box; }
.cp-ok    { background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:13px;color:#16a34a;width:100%;box-sizing:border-box; }
.cp-btn { padding:12px;background:#1e3a5f;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:background .15s;display:flex;align-items:center;justify-content:center;min-height:46px;width:100%; }
.cp-btn:hover:not(:disabled) { background:#112240; }
.cp-btn:disabled { background:#94a3b8;cursor:not-allowed; }
.cp-spinner { width:18px;height:18px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite; }
@keyframes spin{to{transform:rotate(360deg)}}
  `]
})
export class CambiarPasswordComponent {
  actual    = '';
  nueva     = '';
  confirmar = '';
  error     = '';
  exito     = '';
  cargando  = false;
  mostrar1  = false;
  mostrar2  = false;
  mostrar3  = false;

  get esPrimerAcceso(): boolean {
    return !!this.auth.usuarioActual?.debe_cambiar_password;
  }

  get valido(): boolean {
    return this.nueva.length >= 8 && this.nueva === this.confirmar && this.actual.length > 0;
  }

  constructor(private auth: AuthService) {}

  submit() {
    this.error    = '';
    this.exito    = '';
    this.cargando = true;

    this.auth.cambiarPassword(this.actual, this.nueva).subscribe({
      next: () => {
        this.cargando = false;
        this.exito    = '¡Contraseña actualizada correctamente!';
      },
      error: (e) => {
        this.cargando = false;
        this.error = e.error?.detail || 'Error al cambiar la contraseña';
      }
    });
  }
}