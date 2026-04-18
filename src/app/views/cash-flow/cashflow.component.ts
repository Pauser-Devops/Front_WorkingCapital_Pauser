import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

interface CapexFila {
  id?: number;
  proyecto: string;
  descripcion: string;
  monto: number | null;
  orden: number;
}

interface VariacionWK {
  cxc_anterior: number | null;
  cxc_actual:   number | null;
  inv_anterior: number | null;
  inv_actual:   number | null;
  cxp_anterior: number | null;
  cxp_actual:   number | null;
}

interface CashflowDatos {
  ebitda:            number | null;
  impuestos_pagados: number | null;
}

interface Mes {
  ym: string;
  label: string;
  fecha_mes: string;
}

@Component({
  selector: 'app-cashflow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cashflow.component.html',
  styleUrls: ['./cashflow.component.css'],
})
export class CashflowComponent implements OnInit {

  // ── Estado general ─────────────────────────────
  meses: Mes[] = [];
  ymSeleccionado = '';
  cargando = false;
  guardando = false;
  error = '';

  // ── Modal nueva fecha ──────────────────────────
  mostrarModal = false;
  nuevoYm = '';

  // ── Modal eliminar ─────────────────────────────
  mostrarModalEliminar = false;
  eliminando = false;

  // ── Datos del mes activo ───────────────────────
  capex: CapexFila[] = [];
  variacionWK: VariacionWK = this._emptyVariacion();
  cashflow: CashflowDatos = { ebitda: null, impuestos_pagados: null };

  // ── Cálculo variacion WK desde BD ─────────────
  calculandoWK = false;

  // ── Edición inline ─────────────────────────────
  editandoId: string | null = null;   // "campo-fila" e.g. "capex-proyecto-0"
  editandoVal = '';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.cargarMeses(); }

  // ──────────────────────────────────────────────
  // Carga lista de meses
  // ──────────────────────────────────────────────
  cargarMeses() {
    this.cargando = true;
    this.http.get<any>(`${API}/cashflow/meses`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          this.meses = r.meses;
          if (this.meses.length && !this.ymSeleccionado) {
            this.seleccionarMes(this.meses[this.meses.length - 1].ym);
          }
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar meses'; }
    });
  }

  seleccionarMes(ym: string) {
    this.ymSeleccionado = ym;
    this.cargarResumen(ym);
  }

  // ──────────────────────────────────────────────
  // Carga datos del mes seleccionado
  // ──────────────────────────────────────────────
  cargarResumen(ym: string) {
    this.cargando = true;
    this.http.get<any>(`${API}/cashflow/resumen?ym=${ym}`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          this.capex = r.capex?.length ? r.capex : [];
          this.variacionWK = r.variacion_wk ?? this._emptyVariacion();
          this.cashflow    = r.cashflow    ?? { ebitda: null, impuestos_pagados: null };
        }
      },
      error: () => { this.cargando = false; }
    });
  }

  // ──────────────────────────────────────────────
  // Modal nueva fecha
  // ──────────────────────────────────────────────
  abrirModal() {
    this.nuevoYm = '';
    this.mostrarModal = true;
  }

  cerrarModal() { this.mostrarModal = false; }

  confirmarNuevoMes() {
    if (!this.nuevoYm) return;
    const existe = this.meses.find(m => m.ym === this.nuevoYm);
    this.mostrarModal = false;

    if (!existe) {
      // Mes nuevo: inicializar datos vacíos y calcular WK automático
      this.capex       = [];
      this.variacionWK = this._emptyVariacion();
      this.cashflow    = { ebitda: null, impuestos_pagados: null };
      this.ymSeleccionado = this.nuevoYm;
      this.calcularVariacionWK();
    } else {
      this.seleccionarMes(this.nuevoYm);
    }
  }

  // ──────────────────────────────────────────────
  // Calcular variación WK desde BD
  // ──────────────────────────────────────────────
  calcularVariacionWK() {
    if (!this.ymSeleccionado) return;
    this.calculandoWK = true;
    this.http.get<any>(`${API}/cashflow/calcular-variacion-wk?ym=${this.ymSeleccionado}`).subscribe({
      next: r => {
        this.calculandoWK = false;
        if (r.estado === 'OK') {
          const act = r.mes_actual?.datos;
          const ant = r.mes_anterior?.datos;
          this.variacionWK = {
            cxc_anterior: ant?.cxc ?? null,
            cxc_actual:   act?.cxc ?? null,
            inv_anterior: ant?.inv ?? null,
            inv_actual:   act?.inv ?? null,
            cxp_anterior: ant?.cxp ?? null,
            cxp_actual:   act?.cxp ?? null,
          };
        }
      },
      error: () => { this.calculandoWK = false; }
    });
  }

  // ──────────────────────────────────────────────
  // CAPEX helpers
  // ──────────────────────────────────────────────
  agregarFilaCapex() {
    this.capex.push({ proyecto: '', descripcion: '', monto: null, orden: this.capex.length });
  }

  eliminarFilaCapex(idx: number) {
    this.capex.splice(idx, 1);
  }

  get totalCapex(): number {
    return this.capex.reduce((s, f) => s + (f.monto ?? 0), 0);
  }

  // ──────────────────────────────────────────────
  // Variación WK helpers
  // ──────────────────────────────────────────────
  variacion(anterior: number | null, actual: number | null): number {
    return (actual ?? 0) - (anterior ?? 0);
  }

  get varCXC(): number  { return this.variacion(this.variacionWK.cxc_anterior, this.variacionWK.cxc_actual); }
  get varINV(): number  { return this.variacion(this.variacionWK.inv_anterior,  this.variacionWK.inv_actual); }
  get varCXP(): number  { return this.variacion(this.variacionWK.cxp_anterior,  this.variacionWK.cxp_actual); }
  get totalVarWK(): number { return this.varCXC + this.varINV + this.varCXP; }

  // ──────────────────────────────────────────────
  // Cash Flow calculados
  // ──────────────────────────────────────────────
  get flujoCajaOperativo(): number {
    return (this.cashflow.ebitda ?? 0)
         - this.totalVarWK
         - (this.cashflow.impuestos_pagados ?? 0);
  }

  get flujoCajaLibre(): number {
    return this.flujoCajaOperativo - this.totalCapex;
  }

  // ──────────────────────────────────────────────
  // Guardar
  // ──────────────────────────────────────────────
  guardar() {
    if (!this.ymSeleccionado) return;
    this.guardando = true;
    const payload = {
      ym:            this.ymSeleccionado,
      capex:         this.capex,
      variacion_wk:  this.variacionWK,
      cashflow:      this.cashflow,
    };
    this.http.post<any>(`${API}/cashflow/guardar-mes`, payload).subscribe({
      next: r => {
        this.guardando = false;
        if (r.estado === 'OK') {
          this.cargarMeses();
        }
      },
      error: () => { this.guardando = false; }
    });
  }

  // ──────────────────────────────────────────────
  // Eliminar mes
  // ──────────────────────────────────────────────
  confirmarEliminar() { this.mostrarModalEliminar = true; }
  cancelarEliminar()  { this.mostrarModalEliminar = false; }

  eliminarMes() {
    if (!this.ymSeleccionado) return;
    this.eliminando = true;
    this.http.delete<any>(`${API}/cashflow/eliminar-mes?ym=${this.ymSeleccionado}`).subscribe({
      next: r => {
        this.eliminando = false;
        this.mostrarModalEliminar = false;
        if (r.estado === 'OK') {
          this.ymSeleccionado = '';
          this.capex = [];
          this.variacionWK = this._emptyVariacion();
          this.cashflow = { ebitda: null, impuestos_pagados: null };
          this.cargarMeses();
        }
      },
      error: () => { this.eliminando = false; }
    });
  }

  // ──────────────────────────────────────────────
  // Formato
  // ──────────────────────────────────────────────
  fmt(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtInput(n: number | null): string {
    if (n === null || n === undefined) return '';
    return n.toString();
  }

  parseNum(val: string): number | null {
    const c = val.replace(/[^0-9.\-]/g, '');
    return c === '' ? null : parseFloat(c);
  }

  colorClass(n: number): string {
    return n > 0 ? 'cf-pos' : n < 0 ? 'cf-neg' : '';
  }

  labelMesSeleccionado(): string {
    return this.meses.find(m => m.ym === this.ymSeleccionado)?.label ?? this.ymSeleccionado;
  }

  private _emptyVariacion(): VariacionWK {
    return { cxc_anterior: null, cxc_actual: null,
             inv_anterior: null, inv_actual: null,
             cxp_anterior: null, cxp_actual: null };
  }

  trackByIdx(i: number) { return i; }
}