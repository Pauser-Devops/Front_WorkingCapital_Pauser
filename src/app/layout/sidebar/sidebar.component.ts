import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Modulo {
  id: string;
  label: string;
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

  readonly modulos: Modulo[] = [
    { id: 'semanal',  label: 'WK Semanal' },
    { id: 'mensual',  label: 'WK Mensual' },
    { id: 'ingresos', label: 'Ingresos' },
    { id: 'egresos',  label: 'Egresos' },
    { id: 'stock',    label: 'Stock vs CxP' },
    { id: 'renta',    label: 'Renta y Proyección' },
    { id: 'flujo',    label: 'Flujo de Caja' },
  ];

  setVista(id: string) { this.vistaChange.emit(id); }
}