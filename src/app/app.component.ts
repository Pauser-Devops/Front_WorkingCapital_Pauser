import { Component, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { HeaderComponent } from './layout/header/header.component';
import { WkSemanalComponent } from './views/wk-semanal/wk-semanal.component';
import { WkMensualComponent } from './views/wk-mensual/wk-mensual.component';
import { IngresosComponent } from './views/ingresos/ingresos.component';
import { EgresosComponent } from './views/egresos/egresos.component';
import { StockVsCxpComponent } from './views/stock-vs-cxp/stock-vs-cxp.component';
import { IngresosBancariosComponent } from './views/ingresos-bancarios/ingresos-bancarios.component';
import { RegistroIngresosBancariosComponent } from './views/registro-ingresos-bancarios/registro-ingresos-bancarios.component';
import { ReportesBancariosComponent } from './views/reportes-bancarios/reportes-bancarios.component';
import { AnalisisBancariosComponent } from './views/analisis-bancarios/analisis-bancarios.component';
import { AuthService } from './auth.service';
import { LoginComponent } from './views/login/login.component';
import { CambiarPasswordComponent } from './views/cambiar-password/cambiar-password.component';


const VISTA_NOMBRES: Record<string, string> = {
  semanal: 'WK Semanal 2026',
  mensual: 'WK Mensual 2026',
  ingresos: 'Ingresos',
  egresos: 'Egresos',
  stock: 'Stock vs CxP',
  renta: 'Renta y Proyección',
  flujo: 'Flujo de Caja',
  'reportes-bancarios': 'Reportes Bancarios',
  registroIB: 'Registros Ingresos Bancarios',
  analisisBancarios: 'Analisis Reportes Bancarios'
};

@Component({
  selector: 'app-root',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, SidebarComponent, HeaderComponent, WkSemanalComponent, WkMensualComponent, ReportesBancariosComponent, IngresosComponent, EgresosComponent, StockVsCxpComponent, IngresosBancariosComponent, RegistroIngresosBancariosComponent, AnalisisBancariosComponent, LoginComponent, CambiarPasswordComponent,],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  vista = 'semanal';
  constructor(public auth: AuthService) { }
  get estaLogueado(): boolean { return this.auth.isLoggedIn; }
  get debeCambiarPassword(): boolean { return !!this.auth.usuarioActual?.debe_cambiar_password; }
  logout() { this.auth.logout(); }
  @ViewChild('wkSemanal') wkSemanalRef?: WkSemanalComponent;

  get vistaNombre(): string { return VISTA_NOMBRES[this.vista] || this.vista; }
  get datosApi(): any { return this.wkSemanalRef?.datosApi ?? null; }

  setVista(v: string) { this.vista = v; }

  onFile(event: any) { this.wkSemanalRef?.onFile(event); }
  exportar() { this.wkSemanalRef?.exportar(); }
}