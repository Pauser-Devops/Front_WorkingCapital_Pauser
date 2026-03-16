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

  // Recalcula renta y saldo para todas las filas
  recalcularSaldos() {
    for (const fila of this.filas) {
      fila.renta = fila.ventas != null
        ? Math.round(fila.ventas * fila.porcentaje)
        : null;

      if (fila.renta != null) {
        fila.saldo = fila.renta + (fila.cred_anual ?? 0);
      } else {
        fila.saldo = null;
      }
    }
  }

  // ── Helpers de formateo para inputs de tabla ──────────────────────────────

  /** Convierte string de input (puede tener comas de miles) a número */
  private parseInput(val: string): number | null {
    if (val === '' || val == null) return null;
    // Elimina comas de miles, acepta punto decimal
    const clean = val.replace(/,/g, '');
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  }

  /** Formatea número: miles con coma, 2 decimales con punto. Ej: 1,234.56 */
  fmtInput(n: number | null): string {
    if (n == null) return '';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Ventas ────────────────────────────────────────────────────────────────

  onVentasFocus(event: FocusEvent) {
    const input = event.target as HTMLInputElement;
    const raw = this.parseInput(input.value);
    input.value = raw != null ? raw.toString() : '';
    setTimeout(() => input.select(), 0);
  }

  onVentasBlur(fila: MesData, event: FocusEvent) {
    const input = event.target as HTMLInputElement;
    fila.ventas = this.parseInput(input.value);
    this.recalcularSaldos();
    this.guardarMes(fila);
    input.value = this.fmtInput(fila.ventas);
  }

  // ── Crédito Anual ─────────────────────────────────────────────────────────

  onCredFocus(event: FocusEvent) {
    const input = event.target as HTMLInputElement;
    const raw = this.parseInput(input.value);
    input.value = raw != null ? raw.toString() : '';
    setTimeout(() => input.select(), 0);
  }

  onCredBlur(fila: MesData, event: FocusEvent) {
    const input = event.target as HTMLInputElement;
    fila.cred_anual = this.parseInput(input.value);
    this.recalcularSaldos();
    this.guardarMes(fila);
    input.value = this.fmtInput(fila.cred_anual);
  }

  // ── Persistencia ──────────────────────────────────────────────────────────

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

  // ── Totales ───────────────────────────────────────────────────────────────

  get totalVentas(): number {
    return this.filas.reduce((s, f) => s + (f.ventas || 0), 0);
  }

  get totalRenta(): number {
    return this.filas.reduce((s, f) => s + (f.renta || 0), 0);
  }

  get totalSaldo(): number {
    return this.filas.reduce((s, f) => s + (f.saldo || 0), 0);
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  nombreMes(mes: number): string { return MESES[mes - 1]; }

  fmt(n: number | null): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackByMes(_: number, f: MesData) { return f.mes; }

  // ── Panel de valores manuales ─────────────────────────────────────────────

  valoresManualesPanel: Record<number, number | null> = {};
  editandoManualId: number | null = null;

  setValorManualPanel(concepto_id: number, val: string) {
    const clean = val.replace(/,/g, '').replace(/[^0-9.]/g, '');
    this.valoresManualesPanel[concepto_id] = clean === '' ? null : parseFloat(clean);
  }

  fmtPanel(concepto_id: number): string {
    const v = this.valoresManualesPanel[concepto_id];
    if (v === null || v === undefined || isNaN(v)) return '';
    if (this.editandoManualId === concepto_id) return v.toString();
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  onFocusManualPanel(concepto_id: number, event: FocusEvent) {
    this.editandoManualId = concepto_id;
    const v = this.valoresManualesPanel[concepto_id];
    const input = event.target as HTMLInputElement;
    input.value = v !== null && v !== undefined ? v.toString() : '';
    setTimeout(() => input.select(), 0);
  }

  onBlurManualPanel(concepto_id: number, event: FocusEvent) {
    this.editandoManualId = null;
    const input = event.target as HTMLInputElement;
    const v = this.valoresManualesPanel[concepto_id];
    input.value = v !== null && v !== undefined && !isNaN(v)
      ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
  }
}