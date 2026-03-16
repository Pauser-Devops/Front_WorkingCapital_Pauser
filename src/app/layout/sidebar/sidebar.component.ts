import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth.service';

interface Modulo {
  id: string;
  label: string;
  roles?: string[];
}

interface Grupo {
  label: string;
  icono: string;
  modulos: Modulo[];
  abierto: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() vistaActiva = 'ingresosbancarios';
  @Output() vistaChange = new EventEmitter<string>();

  gruposFiltrados: Grupo[] = [];

  private readonly todosGrupos: Grupo[] = [
    {
      label: 'Conciliación Bancaria',
      icono: 'account_balance',
      abierto: true,
      modulos: [
        { id: 'ingresosbancarios',  label: 'Ingresos Bancarios - POP' },
        { id: 'registroIB',         label: 'Registros POP' },
        { id: 'reportes-bancarios', label: 'Dashboard Reportes Bancos' },
        { id: 'analisisBancarios',  label: 'Registros Reportes Bancos' },
         { id: 'compBancario',  label: 'Comparador de Conciliación' },
      ]
    },
    {
      label: 'Working Capital',
      icono: 'trending_up',
      abierto: true,
      modulos: [
        { id: 'dashwk',   label: 'Dashboard',          roles: ['admin', 'gerencia', 'finanzas_admin'] },
        { id: 'semanal',  label: 'WK Semanal',         roles: ['admin', 'gerencia', 'finanzas_admin'] },
        { id: 'mensual',  label: 'WK Mensual',         roles: ['admin', 'gerencia', 'finanzas_admin'] },
        { id: 'ingresos', label: 'Ingresos',           roles: ['admin', 'gerencia', 'finanzas_admin'] },
        { id: 'egresos',  label: 'Egresos',            roles: ['admin', 'gerencia', 'finanzas_admin'] },
        { id: 'stock',    label: 'Stock vs CxP',       roles: ['admin', 'gerencia', 'finanzas_admin'] },
        { id: 'renta',    label: 'Renta y Proyección', roles: ['admin', 'gerencia', 'finanzas_admin'] },
        { id: 'flujo',    label: 'Flujo de Caja',      roles: ['admin', 'gerencia', 'finanzas_admin'] },
      ]
    },
    {
      label: 'Power BI',
      icono: 'bar_chart',
      abierto: true,
      modulos: [
        { id: 'maes', label: 'MAEs' },
        { id: 'pga',  label: 'PGA'  },
      ]
    },
    {
      label: 'Revenue',
      icono: 'settings',
      abierto: true,
      modulos: [
        { id: 'simuladorTS', label: 'Simulador' ,roles: ['admin', 'gerencia']},
       
      ]
    },
    {
      label: 'Configuración ',
      icono: 'settings',
      abierto: true,
      modulos: [
        { id: 'usuarios', label: 'Usuarios' ,roles: ['admin', 'gerencia']},
       
      ]
    },
  ];

  constructor(private auth: AuthService) {
    this.calcularGrupos();
  }

  calcularGrupos() {
    const rol = this.auth.rolActual;
    this.gruposFiltrados = this.todosGrupos
      .map(g => ({
        ...g,
        modulos: g.modulos.filter(m => !m.roles || m.roles.includes(rol))
      }))
      .filter(g => g.modulos.length > 0);
  }

  toggleGrupo(grupo: Grupo) {
    grupo.abierto = !grupo.abierto;
  }

  setVista(id: string) {
    this.vistaChange.emit(id);
  }

  grupoActivo(grupo: Grupo): boolean {
    return grupo.modulos.some(m => m.id === this.vistaActiva);
  }
}