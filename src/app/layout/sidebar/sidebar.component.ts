import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth.service';

interface Modulo {
  id: string;
  label: string;
  roles?: string[]; // undefined = todos pueden ver
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() vistaActiva = 'semanal';
  @Output() vistaChange = new EventEmitter<string>();

  private readonly todosModulos: Modulo[] = [
    { id: 'ingresosbancarios',  label: 'Ingresos Bancarios' },
    { id: 'registroIB',         label: 'Registros Ingresos Bancarios' },
    { id: 'reportes-bancarios', label: 'Reporte Bancario' },
    { id: 'analisisBancarios',  label: 'Registros Reportes Bancarios' },
    // Solo roles con acceso total
    { id: 'semanal',  label: 'WK Semanal',         roles: ['admin', 'gerencia', 'finanzas_admin'] },
    { id: 'mensual',  label: 'WK Mensual',          roles: ['admin', 'gerencia', 'finanzas_admin'] },
    { id: 'ingresos', label: 'Ingresos',            roles: ['admin', 'gerencia', 'finanzas_admin'] },
    { id: 'egresos',  label: 'Egresos',             roles: ['admin', 'gerencia', 'finanzas_admin'] },
    { id: 'stock',    label: 'Stock vs CxP',        roles: ['admin', 'gerencia', 'finanzas_admin'] },
    { id: 'renta',    label: 'Renta y Proyección',  roles: ['admin', 'gerencia', 'finanzas_admin'] },
    { id: 'flujo',    label: 'Flujo de Caja',       roles: ['admin', 'gerencia', 'finanzas_admin'] },
  ];

  constructor(private auth: AuthService) {}

  get modulos(): Modulo[] {
    const rol = this.auth.rolActual;
    return this.todosModulos.filter(m => !m.roles || m.roles.includes(rol));
  }

  setVista(id: string) { this.vistaChange.emit(id); }
}