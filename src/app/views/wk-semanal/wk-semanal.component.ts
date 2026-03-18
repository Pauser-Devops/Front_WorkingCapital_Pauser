import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';
import { Subject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';

const API = environment.apiUrl;

interface WkDatos {
  activo: {
    bancos: { items: Record<string, number>; total: number };
    prosegur: number;
    inventarios: { items: Record<string, number>; total: number };
    cxc: { items: Record<string, number>; total: number };
    ventaEnRuta: number;
    total: number;
  };
  pasivo: {
    ctasPagar: {
      proveedoresPrincipales: { items: Record<string, number>; total: number };
      proveedoresSecundarios: number;
      comodato: number;
      total: number;
    };
    gg: { items: Record<string, number>; total: number };
    impuestos: { items: Record<string, number>; total: number };
    detracciones: number;
    obligacionesFinancieras: { items: Record<string, number>; total: number };
    total: number;
  };
  wk: number;
  pagoCuentaRenta: number;
}

@Component({
  selector: 'app-wk-semanal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wk-semanal.component.html',
  styleUrls: ['./wk-semanal.component.css'],
})
export class WkSemanalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  fechas: string[] = [];
  indiceActivo = 0;
  datos: Record<string, WkDatos> = {};
  cargando = true;
  error = '';
  filtroDesde = '';
  filtroHasta = '';

  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) { }

  ngOnInit() {
    this.wkRefresh.ingresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(f => this.recargar(f));
    this.wkRefresh.egresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(f => this.recargar(f));
    this.cargarFechas();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  cargarFechas() {
    this.cargando = true;
    this.http.get<any>(`${API}/wk-semanal/fechas`).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.fechas = r.fechas;
          this.indiceActivo = Math.max(0, this.fechas.length - 1);
          let pendientes = this.fechas.length;
          if (pendientes === 0) { this.cargando = false; return; }
          for (const f of this.fechas) {
            this.http.get<any>(`${API}/wk-semanal/resumen?fecha_corte=${f}`).subscribe({
              next: res => {
                if (res.estado === 'OK') this.datos = { ...this.datos, [f]: res.datos };
                if (--pendientes === 0) this.cargando = false;
              },
              error: () => { if (--pendientes === 0) this.cargando = false; }
            });
          }
        } else { this.cargando = false; this.error = 'Error al cargar fechas'; }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar fechas'; }
    });
  }

  cargarResumen(fecha: string) {
    this.http.get<any>(`${API}/wk-semanal/resumen?fecha_corte=${fecha}`).subscribe({
      next: r => { if (r.estado === 'OK') this.datos = { ...this.datos, [fecha]: r.datos }; }
    });
  }

  recargar(fecha: string) {
    if (!this.fechas.includes(fecha)) this.fechas = [...this.fechas, fecha].sort();
    this.indiceActivo = this.fechas.indexOf(fecha);
    this.cargarResumen(fecha);
  }

  get fechasFiltradas(): string[] {
    if (!this.filtroDesde && !this.filtroHasta) return this.fechas;
    return this.fechas.filter(f => {
      const ok1 = !this.filtroDesde || f >= this.filtroDesde;
      const ok2 = !this.filtroHasta || f <= this.filtroHasta;
      return ok1 && ok2;
    });
  }

  get fechaActiva(): string { return this.fechasFiltradas[this.indiceActivo] ?? ''; }
  get datosActivos(): WkDatos | null { return this.datos[this.fechaActiva] ?? null; }

  irAFecha(i: number) { this.indiceActivo = i; }
  irAnterior() { if (this.indiceActivo > 0) this.indiceActivo--; }
  irSiguiente() { if (this.indiceActivo < this.fechasFiltradas.length - 1) this.indiceActivo++; }

  exportar() {
    if (!this.fechaActiva) return;
    window.open(`${API}/exportar/wk-semanal?fecha_corte=${this.fechaActiva}`, '_blank');
  }

  formatFecha(f: string): string {
    const m = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const d = new Date(f + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${m[d.getMonth()]}`;
  }

  fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  colorVal(n: number): string { return n > 0 ? 'pos' : n < 0 ? 'neg' : ''; }

  entries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj);
  }

  // ── Helpers seguros para tabla multi-columna ──
  private get$(f: string): WkDatos | null { return this.datos[f] ?? null; }

  gBancosTotal(f: string): number | null { return this.get$(f)?.activo.bancos.total ?? null; }
  gBancosItem(f: string, k: string): number | null { return this.get$(f)?.activo.bancos.items[k] ?? null; }
  gProsegur(f: string): number | null { return this.get$(f)?.activo.prosegur ?? null; }
  gInvTotal(f: string): number | null { return this.get$(f)?.activo.inventarios.total ?? null; }
  gInvItem(f: string, k: string): number | null { return this.get$(f)?.activo.inventarios.items[k] ?? null; }
  gCxcTotal(f: string): number | null { return this.get$(f)?.activo.cxc.total ?? null; }
  gCxcItem(f: string, k: string): number | null { return this.get$(f)?.activo.cxc.items[k] ?? null; }
  gVentaRuta(f: string): number | null { return this.get$(f)?.activo.ventaEnRuta ?? null; }
  gTotalActivo(f: string): number | null { return this.get$(f)?.activo.total ?? null; }
  gCtasPagarTotal(f: string): number | null { return this.get$(f)?.pasivo.ctasPagar.total ?? null; }
  gProvPrincTotal(f: string): number | null { return this.get$(f)?.pasivo.ctasPagar.proveedoresPrincipales.total ?? null; }
  gProvPrincItem(f: string, k: string): number | null { return this.get$(f)?.pasivo.ctasPagar.proveedoresPrincipales.items[k] ?? null; }
  gProvSec(f: string): number | null { return this.get$(f)?.pasivo.ctasPagar.proveedoresSecundarios ?? null; }
  gComodato(f: string): number | null { return this.get$(f)?.pasivo.ctasPagar.comodato ?? null; }
  gGgTotal(f: string): number | null { return this.get$(f)?.pasivo.gg.total ?? null; }
  gGgItem(f: string, k: string): number | null { return this.get$(f)?.pasivo.gg.items[k] ?? null; }
  gImpTotal(f: string): number | null { return this.get$(f)?.pasivo.impuestos.total ?? null; }
  gImpItem(f: string, k: string): number | null { return this.get$(f)?.pasivo.impuestos.items[k] ?? null; }
  gDetracciones(f: string): number | null { return this.get$(f)?.pasivo.detracciones ?? null; }
  gObligTotal(f: string): number | null { return this.get$(f)?.pasivo.obligacionesFinancieras.total ?? null; }
  gObligItem(f: string, k: string): number | null { return this.get$(f)?.pasivo.obligacionesFinancieras.items[k] ?? null; }
  gTotalPasivo(f: string): number | null { return this.get$(f)?.pasivo.total ?? null; }
  gWk(f: string): number | null { return this.get$(f)?.wk ?? null; }
  gPago(f: string): number | null { return this.get$(f)?.pagoCuentaRenta ?? null; }

  get allBancoKeys(): string[] {
    const s = new Set<string>();
    this.fechasFiltradas.forEach(f => { const d = this.datos[f]; if (d) Object.keys(d.activo.bancos.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allInvKeys(): string[] {
    const s = new Set<string>();
    this.fechasFiltradas.forEach(f => { const d = this.datos[f]; if (d) Object.keys(d.activo.inventarios.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allCxcKeys(): string[] {
    const s = new Set<string>();
    this.fechasFiltradas.forEach(f => { const d = this.datos[f]; if (d) Object.keys(d.activo.cxc.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allProvKeys(): string[] {
    const s = new Set<string>();
    this.fechasFiltradas.forEach(f => { const d = this.datos[f]; if (d) Object.keys(d.pasivo.ctasPagar.proveedoresPrincipales.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allGgKeys(): string[] {
    const s = new Set<string>();
    this.fechasFiltradas.forEach(f => { const d = this.datos[f]; if (d) Object.keys(d.pasivo.gg.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allImpKeys(): string[] {
    const s = new Set<string>();
    this.fechasFiltradas.forEach(f => { const d = this.datos[f]; if (d) Object.keys(d.pasivo.impuestos.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allObligKeys(): string[] {
    const s = new Set<string>();
    this.fechasFiltradas.forEach(f => { const d = this.datos[f]; if (d) Object.keys(d.pasivo.obligacionesFinancieras.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  sumarKpi(campo: 'activo' | 'pasivo' | 'wk'): number {
  return this.fechasFiltradas.reduce((acc, f) => {
    const d = this.datos[f];
    if (!d) return acc;
    if (campo === 'activo') return acc + d.activo.total;
    if (campo === 'pasivo') return acc + d.pasivo.total;
    return acc + d.wk;
  }, 0);
}
}