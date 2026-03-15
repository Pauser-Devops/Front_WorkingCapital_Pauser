import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface MesData {
  mes: number;
  ventas: number | null;
  porcentaje: number;
  renta: number | null;
  cred_anual: number | null;
  saldo: number | null;
}

@Component({
  selector: 'app-renta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './renta-proyeccion.component.html',
  styleUrls: ['./renta-proyeccion.component.css'],
})
export class RentaProyeccionComponent implements OnInit {

  anio = new Date().getFullYear();
  filas: MesData[] = [];
  cargando = true;
  error = '';
  guardando: Record<number, boolean> = {};

  constructor(private http: HttpClient) { }

  ngOnInit() { this.cargarDatos(); }

  cargarDatos() {
    this.cargando = true;
    this.http.get<any>(`${API}/renta/datos?anio=${this.anio}`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          // Construir 12 filas — con datos si existen, vacías si no
          this.filas = Array.from({ length: 12 }, (_, i) => {
            const mes = i + 1;
            return r.meses[mes] ?? {
              mes, ventas: null, porcentaje: 0.015,
              renta: null, cred_anual: null, saldo: null
            };
          });
          this.recalcularSaldos();
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar datos'; }
    });
  }

  cambiarAnio(delta: number) {
    this.anio += delta;
    this.cargarDatos();
  }

  // Recalcula renta, cred_anual encadenado y saldo para todas las filas
  recalcularSaldos() {
    for (const fila of this.filas) {
      // Renta = Ventas × 1.5%
      fila.renta = fila.ventas != null
        ? Math.round(fila.ventas * fila.porcentaje)
        : null;

      // Saldo = Renta + Cred Anual (solo si se ingresó manualmente)
      if (fila.renta != null) {
        fila.saldo = fila.renta + (fila.cred_anual ?? 0);
      } else {
        fila.saldo = null;
      }
    }
  }

  onVentasChange(fila: MesData, val: string) {
    fila.ventas = val === '' ? null : parseFloat(val.replace(/\./g, '').replace(',', '.'));
    this.recalcularSaldos();
    this.guardarMes(fila);
  }
get totalVentas(): number {
  return this.filas.reduce((s, f) => s + (f.ventas || 0), 0);
}
  onCredChange(fila: MesData, val: string) {
    fila.cred_anual = val === '' ? null : parseFloat(val.replace(/\./g, '').replace(',', '.'));
    this.recalcularSaldos();
    this.guardarMes(fila);
  }

  guardarMes(fila: MesData) {
    this.guardando[fila.mes] = true;
    this.http.post<any>(`${API}/renta/guardar-mes`, {
      anio: this.anio,
      mes: fila.mes,
      ventas: fila.ventas,
      cred_anual: fila.cred_anual,
    }).subscribe({
      next: () => { this.guardando[fila.mes] = false; },
      error: () => { this.guardando[fila.mes] = false; }
    });
  }

  get totalRenta(): number {
    return this.filas.reduce((s, f) => s + (f.renta || 0), 0);
  }

  get totalSaldo(): number {
    return this.filas.reduce((s, f) => s + (f.saldo || 0), 0);
  }

  nombreMes(mes: number): string { return MESES[mes - 1]; }

  fmt(n: number | null): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackByMes(_: number, f: MesData) { return f.mes; }
}