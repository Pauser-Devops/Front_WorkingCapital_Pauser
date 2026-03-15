import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DonutChartComponent, DonutSlice } from '../../shared/components/donut-chart/donut-chart.component';

const API = environment.apiUrl;

const COLORES_ACTIVO: Record<string, string> = {
  'Bancos':      '#1d4ed8',
  'Prosegur':    '#0369a1',
  'Inventarios': '#0891b2',
  'CxC':         '#0284c7',
  'Venta Ruta':  '#6366f1',
};

const COLORES_PASIVO: Record<string, string> = {
  'Proveedores':    '#c2410c',
  'G&G':            '#b45309',
  'Impuestos':      '#dc2626',
  'Detracciones':   '#9333ea',
  'Préstamos':      '#be185d',
  'Comodato':       '#0f766e',
};

const FALLBACK = ['#3b82f6','#06b6d4','#8b5cf6','#ec4899','#f59e0b','#10b981','#f43f5e','#6366f1'];

function asignarColores(data: Record<string, number>, paleta: Record<string, string>): DonutSlice[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({ name, value, color: paleta[name] ?? FALLBACK[i % FALLBACK.length] }));
}

interface Kpis {
  wk: number; activo: number; pasivo: number;
  fecha_actual: string; label_actual: string; fecha_anterior: string | null;
  var_wk: number | null; var_activo: number | null; var_pasivo: number | null;
}
interface PuntoSerie { fecha: string; label: string; wk: number; activo: number; pasivo: number; }
interface VariacionFila { concepto: string; tipo: string; anterior: number; actual: number; variacion: number | null; }
interface DashData {
  kpis: Kpis;
  composicion_activo: Record<string, number>;
  composicion_pasivo: Record<string, number>;
  proveedores: Record<string, number>;
  proveedores_ant: Record<string, number>;
  tabla_variaciones: VariacionFila[];
  serie_semanal: PuntoSerie[];
  serie_mensual: PuntoSerie[];
}

@Component({
  selector: 'app-dash-wk',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DonutChartComponent],
  templateUrl: './dash-wk.component.html',
  styleUrls: ['./dash-wk.component.css'],
})
export class DashWkComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  datos:   DashData | null = null;
  cargando = true;
  error    = '';

  vistaGrafico: 'semanal' | 'mensual' = 'semanal';

  slicesActivo: DonutSlice[] = [];
  slicesPasivo: DonutSlice[] = [];

  // Sets para filtrar desde la leyenda lateral del dashboard
  hiddenActivo = new Set<string>();
  hiddenPasivo = new Set<string>();

  tooltip = { visible: false, x: 0, y: 0, label: '', wk: 0, activo: 0, pasivo: 0 };

  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) {}

  ngOnInit() {
    this.wkRefresh.ingresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(() => this.cargar());
    this.wkRefresh.egresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(() => this.cargar());
    this.cargar();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  cargar() {
    this.cargando = true;
    this.http.get<any>(`${API}/dashboard-wk/resumen`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          this.datos = r.datos;
          this.slicesActivo = asignarColores(r.datos.composicion_activo, COLORES_ACTIVO);
          this.slicesPasivo = asignarColores(r.datos.composicion_pasivo, COLORES_PASIVO);
          this.hiddenActivo.clear();
          this.hiddenPasivo.clear();
        } else {
          this.error = r.detalle ?? 'Error al cargar';
        }
      },
      error: () => { this.cargando = false; this.error = 'Error de conexión'; }
    });
  }

  // ── Toggle leyenda ────────────────────────────────────────────
  toggleActivo(name: string) {
    if (this.hiddenActivo.has(name)) {
      this.hiddenActivo.delete(name);
    } else if (this.hiddenActivo.size < this.slicesActivo.length - 1) {
      this.hiddenActivo.add(name);
    }
    // Pasar slices filtrados al componente
    this.slicesActivo = this.slicesActivo.map(s => ({ ...s }));
  }

  togglePasivo(name: string) {
    if (this.hiddenPasivo.has(name)) {
      this.hiddenPasivo.delete(name);
    } else if (this.hiddenPasivo.size < this.slicesPasivo.length - 1) {
      this.hiddenPasivo.add(name);
    }
    this.slicesPasivo = this.slicesPasivo.map(s => ({ ...s }));
  }

  get slicesActivoFiltrados(): DonutSlice[] {
    return this.slicesActivo.filter(s => !this.hiddenActivo.has(s.name));
  }

  get slicesPasivoFiltrados(): DonutSlice[] {
    return this.slicesPasivo.filter(s => !this.hiddenPasivo.has(s.name));
  }

  // ── Formato ──────────────────────────────────────────────────
  fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtM(n: number | null | undefined): string {
    if (n == null) return '—';
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
    return n.toFixed(0);
  }

  fmtVar(v: number | null): string {
    if (v == null) return '';
    return (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(1) + '%';
  }

  clsVar(v: number | null, invertir = false): string {
    if (v == null) return 'var-neutro';
    return (invertir ? v < 0 : v > 0) ? 'var-pos' : 'var-neg';
  }

  pct(val: number, total: number): number {
    return total === 0 ? 0 : Math.round((val / total) * 100);
  }

  // ── Tooltip línea ─────────────────────────────────────────────
  mostrarTooltip(pt: { x: number; y: number; label: string; val: number }, serie: PuntoSerie[]) {
    const punto = serie.find(p => p.label === pt.label);
    this.tooltip = { visible: true, x: pt.x, y: pt.y, label: pt.label,
      wk: punto?.wk ?? pt.val, activo: punto?.activo ?? 0, pasivo: punto?.pasivo ?? 0 };
  }

  ocultarTooltip() { this.tooltip = { ...this.tooltip, visible: false }; }
  tooltipX(x: number, svgW = 700): number { return x > svgW - 120 ? x - 140 : x + 12; }
  tooltipY(y: number): number { return Math.max(y - 60, 4); }

  // ── Serie activa ──────────────────────────────────────────────
  get serieActiva(): PuntoSerie[] {
    if (!this.datos) return [];
    return this.vistaGrafico === 'semanal' ? this.datos.serie_semanal : this.datos.serie_mensual;
  }

  lineaWK(serie: PuntoSerie[], w = 700, h = 160, pad = 30): string {
    if (serie.length < 2) return '';
    const vals = serie.map(p => p.wk);
    const min = Math.min(...vals), max = Math.max(...vals), rango = max - min || 1;
    return serie.map((p, i) => {
      const x = pad + (i / (serie.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p.wk - min) / rango) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  areaWK(serie: PuntoSerie[], w = 700, h = 160, pad = 30): string {
    if (serie.length < 2) return '';
    const vals = serie.map(p => p.wk);
    const min = Math.min(...vals), max = Math.max(...vals), rango = max - min || 1;
    const pts = serie.map((p, i) => {
      const x = pad + (i / (serie.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p.wk - min) / rango) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${pad},${h - pad} L${pts.join(' L')} L${pad + (w - pad * 2)},${h - pad} Z`;
  }

  puntosLinea(serie: PuntoSerie[], w = 700, h = 160, pad = 30): {x:number;y:number;label:string;val:number}[] {
    if (!serie.length) return [];
    const vals = serie.map(p => p.wk);
    const min = Math.min(...vals), max = Math.max(...vals), rango = max - min || 1;
    return serie.map((p, i) => ({
      x: pad + (i / (serie.length - 1)) * (w - pad * 2),
      y: pad + (1 - (p.wk - min) / rango) * (h - pad * 2),
      label: p.label, val: p.wk,
    }));
  }

  barrasProveedores(prov: Record<string, number>, provAnt: Record<string, number>, maxW = 220) {
    const entries = Object.entries(prov).sort((a, b) => b[1] - a[1]);
    const maxVal  = Math.max(...entries.map(e => e[1]), 1);
    return entries.map(([nombre, actual]) => ({
      nombre, actual,
      anterior: provAnt[nombre] ?? 0,
      wAct: (actual / maxVal) * maxW,
      wAnt: ((provAnt[nombre] ?? 0) / maxVal) * maxW,
    }));
  }
}