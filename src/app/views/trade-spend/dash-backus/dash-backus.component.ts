import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface FiltroBackus {
  fecha_desde: string;
  fecha_hasta: string;
  responsable: 'todos' | 'pauser' | 'backus';
}

export interface KpisBackus {
  total_descuento: number;
  descuento_pauser: number;
  descuento_backus: number;
  pct_pauser: number;
  pct_backus: number;
  total_ventas: number;
  total_unidades: number;
  total_transacciones: number;
  anuladas: number;
  ratio_descuento_venta: number;
}

export interface ProductoDescuento {
  producto: string;
  descuento_pauser: number;
  descuento_backus: number;
  total: number;
}

export interface ClienteDescuento {
  cliente: string;
  descuento_pauser: number;
  descuento_backus: number;
  total: number;
}

export interface DiaDescuento {
  fecha: string;
  descuento_pauser: number;
  descuento_backus: number;
  total: number;
}

export interface DashBackusData {
  kpis: KpisBackus;
  por_producto: ProductoDescuento[];
  por_cliente: ClienteDescuento[];
  por_dia: DiaDescuento[];
  periodo_label: string;
}

export interface PeriodoDisponible {
  anio: number;
  mes: number;
  label: string;
  total_filas: number;
}

const MESES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

@Component({
  selector: 'app-dash-backus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dash-backus.component.html',
  styleUrls: ['./dash-backus.component.css'],
})
export class DashBackusComponent implements OnInit {

  // ── Períodos disponibles ──────────────────────────────────────────────────
  periodos: PeriodoDisponible[] = [];
  cargandoPeriodos = false;
  periodoSeleccionado: PeriodoDisponible | null = null;

  // ── Filtros ───────────────────────────────────────────────────────────────
  filtro: FiltroBackus = {
    fecha_desde: '',
    fecha_hasta: '',
    responsable: 'todos',
  };

  // ── Data ──────────────────────────────────────────────────────────────────
  data: DashBackusData | null = null;
  cargando = false;
  error: string | null = null;

  // ── Vista tabla ───────────────────────────────────────────────────────────
  tablaActiva: 'productos' | 'clientes' = 'productos';
  maxBarProducto = 0;
  maxBarCliente  = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarPeriodos();
  }

  // ── Períodos ──────────────────────────────────────────────────────────────

  cargarPeriodos(): void {
    this.cargandoPeriodos = true;
    this.http
      .get<{ estado: string; resumen: any[] }>(
        `${environment.apiUrl}/trade-spend/backus-estado`
      )
      .subscribe({
        next: res => {
          this.periodos = (res.resumen ?? []).map(p => ({
            anio:       p.anio,
            mes:        p.mes,
            label:      `${MESES[p.mes]} ${p.anio}`,
            total_filas: p.total_filas,
          }));
          this.cargandoPeriodos = false;
          if (this.periodos.length > 0) {
            this.seleccionarPeriodo(this.periodos[0]);
          }
        },
        error: () => { this.cargandoPeriodos = false; },
      });
  }

  onSelectPeriodo(event: Event): void {
    const val = (event.target as HTMLSelectElement).value; // "2026-2"
    const [anio, mes] = val.split('-').map(Number);
    const p = this.periodos.find(x => x.anio === anio && x.mes === mes);
    if (p) this.seleccionarPeriodo(p);
  }

  seleccionarPeriodo(p: PeriodoDisponible): void {
    this.periodoSeleccionado = p;
    // Setear rango de fechas al mes completo por defecto
    const inicio = new Date(p.anio, p.mes - 1, 1);
    const fin    = new Date(p.anio, p.mes, 0);
    this.filtro.fecha_desde = this.toInputDate(inicio);
    this.filtro.fecha_hasta = this.toInputDate(fin);
    this.filtro.responsable = 'todos';
    this.cargarDashboard();
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  cargarDashboard(): void {
    if (!this.periodoSeleccionado) return;
    this.cargando = true;
    this.error    = null;

    const params: any = {
      anio:         this.periodoSeleccionado.anio,
      mes:          this.periodoSeleccionado.mes,
      responsable:  this.filtro.responsable,
    };
    if (this.filtro.fecha_desde) params['fecha_desde'] = this.filtro.fecha_desde;
    if (this.filtro.fecha_hasta) params['fecha_hasta'] = this.filtro.fecha_hasta;

    const qs = new URLSearchParams(params).toString();

    this.http
      .get<DashBackusData>(
        `${environment.apiUrl}/trade-spend/backus-dashboard?${qs}`
      )
      .subscribe({
        next: d => {
          this.data = d;
          this.maxBarProducto = Math.max(...(d.por_producto ?? []).map(p => p.total), 1);
          this.maxBarCliente  = Math.max(...(d.por_cliente ?? []).map(c => c.total), 1);
          this.cargando = false;
        },
        error: err => {
          this.error   = err.error?.detalle ?? 'Error al cargar el dashboard';
          this.cargando = false;
        },
      });
  }

  aplicarFiltros(): void { this.cargarDashboard(); }

  resetFiltros(): void {
    if (this.periodoSeleccionado) this.seleccionarPeriodo(this.periodoSeleccionado);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  barWidthPauser(item: ProductoDescuento | ClienteDescuento, max: number): number {
    return max > 0 ? Math.round((item.descuento_pauser / max) * 100) : 0;
  }

  barWidthBackus(item: ProductoDescuento | ClienteDescuento, max: number): number {
    return max > 0 ? Math.round((item.descuento_backus / max) * 100) : 0;
  }

  maxDia(): number {
    if (!this.data) return 1;
    return Math.max(...this.data.por_dia.map(d => d.total), 1);
  }

  barDia(val: number): number {
    return Math.round((val / this.maxDia()) * 100);
  }

  private toInputDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  formatMoney(n: number): string {
    return 'S/ ' + (n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatNum(n: number): string {
    return (n ?? 0).toLocaleString('es-PE');
  }

  formatPct(n: number): string {
    return (n ?? 0).toFixed(1) + '%';
  }

  shortName(name: string): string {
    return name?.trim().length > 38 ? name.trim().slice(0, 36) + '…' : name?.trim() ?? '—';
  }
}