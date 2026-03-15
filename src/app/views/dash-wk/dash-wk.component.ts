import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgxChartsModule } from '@swimlane/ngx-charts';

const API = environment.apiUrl;

interface Kpis {
  wk: number; activo: number; pasivo: number;
  fecha_actual: string; label_actual: string; fecha_anterior: string | null;
  var_wk: number | null; var_activo: number | null; var_pasivo: number | null;
}
interface PuntoSerie { fecha: string; label: string; wk: number; activo: number; pasivo: number; }
interface VariacionFila { concepto: string; tipo: string; anterior: number; actual: number; variacion: number | null; }

interface DashData {
  kpis:               Kpis;
  composicion_activo: Record<string, number>;
  composicion_pasivo: Record<string, number>;
  proveedores:        Record<string, number>;
  proveedores_ant:    Record<string, number>;
  tabla_variaciones:  VariacionFila[];
  serie_semanal:      PuntoSerie[];
  serie_mensual:      PuntoSerie[];
}

@Component({
  selector: 'app-dash-wk',
  standalone: true,
  imports: [CommonModule, NgxChartsModule],
  templateUrl: './dash-wk.component.html',
  styleUrls: ['./dash-wk.component.css'],
})
export class DashWkComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  datos:    DashData | null = null;
  cargando  = true;
  error     = '';

  // Selector de vista para gráfico principal
  vistaGrafico: 'semanal' | 'mensual' = 'semanal';

  // ngx-charts — datos para donuts
  donutActivo:  { name: string; value: number }[] = [];
  donutPasivo:  { name: string; value: number }[] = [];
  colorSchemeActivo = 'cool';
  colorSchemePasivo = 'fire';

  // Tooltip
  tooltip: { visible: boolean; x: number; y: number; label: string; wk: number; activo: number; pasivo: number } = {
    visible: false, x: 0, y: 0, label: '', wk: 0, activo: 0, pasivo: 0
  };

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
          this.donutActivo = Object.entries(r.datos.composicion_activo)
            .filter(([,v]) => (v as number) > 0)
            .map(([name, value]) => ({ name, value: value as number }));
          this.donutPasivo = Object.entries(r.datos.composicion_pasivo)
            .filter(([,v]) => (v as number) > 0)
            .map(([name, value]) => ({ name, value: value as number }));
        }
        else this.error = r.detalle ?? 'Error al cargar';
      },
      error: () => { this.cargando = false; this.error = 'Error de conexión'; }
    });
  }

  // ── Helpers de formato ────────────────────────────────────────────

  fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtM(n: number | null | undefined): string {
    // Formato compacto: 11,722,041 → 11.7M  |  640,475 → 640K
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
    const positivo = invertir ? v < 0 : v > 0;
    return positivo ? 'var-pos' : 'var-neg';
  }

  entries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj);
  }

  // ── Tooltip ───────────────────────────────────────────────────────

  mostrarTooltip(pt: { x: number; y: number; label: string; val: number }, serie: PuntoSerie[]) {
    const punto = serie.find(p => p.label === pt.label);
    this.tooltip = {
      visible: true,
      x: pt.x,
      y: pt.y,
      label: pt.label,
      wk:     punto?.wk     ?? pt.val,
      activo: punto?.activo ?? 0,
      pasivo: punto?.pasivo ?? 0,
    };
  }

  ocultarTooltip() {
    this.tooltip = { ...this.tooltip, visible: false };
  }

  tooltipX(x: number, svgW = 700): number {
    // Evitar que el tooltip se salga por la derecha
    return x > svgW - 120 ? x - 140 : x + 12;
  }

  tooltipY(y: number): number {
    return Math.max(y - 60, 4);
  }

  // ── Gráficos SVG ─────────────────────────────────────────────────

  get serieActiva(): PuntoSerie[] {
    if (!this.datos) return [];
    return this.vistaGrafico === 'semanal'
      ? this.datos.serie_semanal
      : this.datos.serie_mensual;
  }

  /** Genera los puntos SVG para el gráfico de línea WK */
  lineaWK(serie: PuntoSerie[], w = 700, h = 160, pad = 30): string {
    if (serie.length < 2) return '';
    const valores = serie.map(p => p.wk);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const rango = max - min || 1;
    const pts = serie.map((p, i) => {
      const x = pad + (i / (serie.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p.wk - min) / rango) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(' ');
  }

  /** Genera path de área rellena bajo la línea */
  areaWK(serie: PuntoSerie[], w = 700, h = 160, pad = 30): string {
    if (serie.length < 2) return '';
    const valores = serie.map(p => p.wk);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const rango = max - min || 1;
    const pts = serie.map((p, i) => {
      const x = pad + (i / (serie.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p.wk - min) / rango) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const firstX = pad;
    const lastX  = pad + (w - pad * 2);
    const baseY  = h - pad;
    return `M${firstX},${baseY} L${pts.join(' L')} L${lastX},${baseY} Z`;
  }

  /** Puntos para dots encima de la línea */
  puntosLinea(serie: PuntoSerie[], w = 700, h = 160, pad = 30): {x:number;y:number;label:string;val:number}[] {
    if (serie.length === 0) return [];
    const valores = serie.map(p => p.wk);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const rango = max - min || 1;
    return serie.map((p, i) => ({
      x: pad + (i / (serie.length - 1)) * (w - pad * 2),
      y: pad + (1 - (p.wk - min) / rango) * (h - pad * 2),
      label: p.label,
      val: p.wk,
    }));
  }

  /** Barras para activo y pasivo por fecha */
  barrasActPas(serie: PuntoSerie[], w = 700, h = 140, pad = 30): {x:number;hA:number;hP:number;yA:number;yP:number;label:string}[] {
    if (serie.length === 0) return [];
    const maxVal = Math.max(...serie.map(p => Math.max(p.activo, p.pasivo)));
    const totalW = w - pad * 2;
    const barW   = Math.max(4, (totalW / serie.length) * 0.35);
    return serie.map((p, i) => {
      const cx = pad + (i + 0.5) * (totalW / serie.length);
      const hA = ((p.activo / maxVal) * (h - pad - 10));
      const hP = ((p.pasivo / maxVal) * (h - pad - 10));
      return {
        x: cx, label: p.label,
        hA, yA: h - pad - hA,
        hP, yP: h - pad - hP,
        barW,
      };
    });
  }

  /** Barras horizontales para proveedores */
  barrasProveedores(prov: Record<string, number>, provAnt: Record<string, number>, maxW = 220): {
    nombre: string; actual: number; anterior: number; wAct: number; wAnt: number;
  }[] {
    const entries = Object.entries(prov).sort((a, b) => b[1] - a[1]);
    const maxVal  = Math.max(...entries.map(e => e[1]), 1);
    return entries.map(([nombre, actual]) => ({
      nombre,
      actual,
      anterior: provAnt[nombre] ?? 0,
      wAct: (actual / maxVal) * maxW,
      wAnt: ((provAnt[nombre] ?? 0) / maxVal) * maxW,
    }));
  }

  /** Porcentaje de un bloque sobre el total */
  pct(val: number, total: number): number {
    return total === 0 ? 0 : Math.round((val / total) * 100);
  }

  /** Calcula % sobre el total de un array ngx-charts {name,value} */
  pctDe(val: number, serie: { name: string; value: number }[]): number {
    const total = serie.reduce((a, b) => a + b.value, 0);
    return total === 0 ? 0 : Math.round((val / total) * 100);
  }

  onSelectDonut(event: any) {
    // Opcional: puedes usar para navegar o filtrar
    console.log('Segmento seleccionado:', event);
  }

  // donutSegmentos eliminado — reemplazado por ngx-charts
}