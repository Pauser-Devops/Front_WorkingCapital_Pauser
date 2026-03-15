import { Component, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { HeaderComponent } from './layout/header/header.component';
import { WkSemanalComponent } from './views/wk-semanal/wk-semanal.component';
import { WkMensualComponent } from './views/wk-mensual/wk-mensual.component';
import { IngresosComponent } from './views/ingresos/ingresos.component';
import { EgresosComponent } from './views/egresos/egresos.component';
import { StockVsCxpComponent } from './views/stock-vs-cxp/stock-vs-cxp.component';
import { RentaProyeccionComponent } from './views/renta-proyeccion/renta-proyeccion.component';
import { IngresosBancariosComponent } from './views/ingresos-bancarios/ingresos-bancarios.component';
import { RegistroIngresosBancariosComponent } from './views/registro-ingresos-bancarios/registro-ingresos-bancarios.component';
import { ReportesBancariosComponent } from './views/reportes-bancarios/reportes-bancarios.component';
import { AnalisisBancariosComponent } from './views/analisis-bancarios/analisis-bancarios.component';
import { AuthService } from './auth.service';
import { LoginComponent } from './views/login/login.component';
import { CambiarPasswordComponent } from './views/cambiar-password/cambiar-password.component';
import { ComparadorIngresosComponent } from './views/comparador-ingresos/comparador-ingresos.component';
import {DashWkComponent} from './views/dash-wk/dash-wk.component';
import { MaesComponent } from './views/powerbi/maes.component';
import { PGAComponent } from './views/powerbi/pga.component';
import { ComparadorBancarioComponent } from './views/comparador-sede/comparador-bancario.component';
import { UsuariosComponent } from './views/configuracion/usuarios/usuarios.component';

const VISTA_NOMBRES: Record<string, string> = {
  semanal: 'WK Semanal 2026',
  mensual: 'WK Mensual 2026',
  ingresosbancarios: 'Ingresos Bancarios',
  egresos: 'Egresos',
  stock: 'Stock vs CxP',
  renta: 'Renta y Proyección',
  flujo: 'Flujo de Caja',
  'reportes-bancarios': 'Reporte Bancario',
  registroIB: 'Registros Ingresos Bancarios',
  analisisBancarios: 'Registros Reportes Bancarios',
  comparadorIngresos: 'Comparar Ingresos Bancarios',
  dashwk: 'Dashboard Working Capital',
  maes: 'MAEs',
  pga: 'PGA Finanzas',
  compBancario: 'Comparador Bancario por Sede',
  usuarios: 'Usuarios',
};

@Component({
  selector: 'app-root',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule, 
    SidebarComponent, 
    HeaderComponent, 
    WkSemanalComponent, 
    WkMensualComponent, 
    ReportesBancariosComponent, 
    IngresosComponent, 
    EgresosComponent, 
    StockVsCxpComponent, 
    RentaProyeccionComponent,
    IngresosBancariosComponent, 
    RegistroIngresosBancariosComponent, 
    AnalisisBancariosComponent, 
    LoginComponent, 
    CambiarPasswordComponent, 
    ComparadorIngresosComponent, 
    DashWkComponent,
    MaesComponent,
    PGAComponent,
    ComparadorBancarioComponent, UsuariosComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  vista = localStorage.getItem('vistaActiva') || 'ingresos-bancarios';
  constructor(public auth: AuthService) { }
  get estaLogueado(): boolean { return this.auth.isLoggedIn; }
  get debeCambiarPassword(): boolean { return !!this.auth.usuarioActual?.debe_cambiar_password; }
  logout() { this.auth.logout(); }
  @ViewChild('wkSemanal') wkSemanalRef?: WkSemanalComponent;

  get vistaNombre(): string { return VISTA_NOMBRES[this.vista] || this.vista; }
  get esFinanzas(): boolean { return this.auth.esFinanzas; }
  readonly rolesLabel: Record<string, string> = {
    admin: 'Admin',
    gerencia: 'Gerencia',
    finanzas_admin: 'Finanzas',
    finanzas: 'Finanzas',
    viewer: 'Viewer'
  };

  get rolLabel(): string {
    return this.rolesLabel[this.auth.rolActual] ?? this.auth.rolActual;
  }
  get tituloModulo(): string {
    const vistasBancarias = [
      'ingresosbancarios',
      'registroIB',
      'reportes-bancarios',
      'analisisBancarios'
    ];

    return vistasBancarias.includes(this.vista)
      ? 'Conciliación Bancaria'
      : 'Working Capital';
  }
  //get datosApi(): any { return this.wkSemanalRef?.datosApi ?? null; }

  setVista(v: string) {
    this.vista = v;
    localStorage.setItem('vistaActiva', v);
  }

  onNavegarA(vista: string) { this.setVista(vista); }
  // onFile(event: any) { this.wkSemanalRef?.onFile(event); }
  //exportar() { this.wkSemanalRef?.exportar(); }
}