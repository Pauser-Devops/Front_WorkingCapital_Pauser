import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

const API = environment.apiUrl;

interface WkDatos {
  activo: {
    bancos: { items: Record<string, number>; total: number };
    prosegur: number;
    inventarios: { items: Record<string, number>; total: number };
    cxc: { items: Record<string, number>; total: number };
    credFiscal: number;
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

interface Mes {
  fecha: string;
  ym: string;
  label: string;
}

@Component({
  selector: 'app-wk-mensual',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wk-mensual.component.html',
  styleUrls: ['./wk-mensual.component.css'],
})
export class WkMensualComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  meses: Mes[] = [];
  datos: Record<string, WkDatos> = {};
  cargando = true;
  error = '';
  filtroDesde = '';
  filtroHasta = '';

  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) { }

  ngOnInit() {
    this.wkRefresh.ingresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(f => this.recargarPorFecha(f));
    this.wkRefresh.egresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(f => this.recargarPorFecha(f));
    this.cargarMeses();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  cargarMeses() {
    this.cargando = true;
    this.http.get<any>(`${API}/wk-mensual/meses`).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.meses = r.meses;
          let pendientes = this.meses.length;
          if (pendientes === 0) { this.cargando = false; return; }
          for (const mes of this.meses) {
            this.http.get<any>(`${API}/wk-mensual/resumen?fecha_corte=${mes.fecha}`).subscribe({
              next: res => {
                if (res.estado === 'OK') this.datos = { ...this.datos, [mes.ym]: res.datos };
                if (--pendientes === 0) this.cargando = false;
              },
              error: () => { if (--pendientes === 0) this.cargando = false; }
            });
          }
        } else { this.cargando = false; this.error = 'Error al cargar meses'; }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar meses'; }
    });
  }

  recargarPorFecha(fecha: string) {
    const ym = fecha.slice(0, 7);
    const mes = this.meses.find(m => m.ym === ym);
    if (!mes) { this.cargarMeses(); return; }
    this.http.get<any>(`${API}/wk-mensual/meses`).subscribe({
      next: r => {
        if (r.estado !== 'OK') return;
        this.meses = r.meses;
        const mesActualizado = this.meses.find(m => m.ym === ym);
        if (!mesActualizado) return;
        this.http.get<any>(`${API}/wk-mensual/resumen?fecha_corte=${mesActualizado.fecha}`).subscribe({
          next: res => { if (res.estado === 'OK') this.datos = { ...this.datos, [ym]: res.datos }; }
        });
      }
    });
  }

  get mesesFiltrados(): Mes[] {
    if (!this.filtroDesde && !this.filtroHasta) return this.meses;
    return this.meses.filter(m => {
      const ok1 = !this.filtroDesde || m.ym >= this.filtroDesde.slice(0, 7);
      const ok2 = !this.filtroHasta || m.ym <= this.filtroHasta.slice(0, 7);
      return ok1 && ok2;
    });
  }

  exportar() {
    const lista = this.mesesFiltrados;
    if (!lista.length) return;
    // Exporta la última fecha del rango visible
    const ultima = lista[lista.length - 1];
    window.open(`${API}/exportar/wk-mensual?fecha_corte=${ultima.fecha}`, '_blank');
  }

  fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  colorVal(n: number): string { return n > 0 ? 'pos' : n < 0 ? 'neg' : ''; }

  entries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj);
  }

  // ── Helpers seguros ──
  private get$(ym: string): WkDatos | null { return this.datos[ym] ?? null; }

  gBancosTotal(ym: string): number | null { return this.get$(ym)?.activo.bancos.total ?? null; }
  gBancosItem(ym: string, k: string): number | null { return this.get$(ym)?.activo.bancos.items[k] ?? null; }
  gProsegur(ym: string): number | null { return this.get$(ym)?.activo.prosegur ?? null; }
  gInvTotal(ym: string): number | null { return this.get$(ym)?.activo.inventarios.total ?? null; }
  gInvItem(ym: string, k: string): number | null { return this.get$(ym)?.activo.inventarios.items[k] ?? null; }
  gCxcTotal(ym: string): number | null { return this.get$(ym)?.activo.cxc.total ?? null; }
  gCxcItem(ym: string, k: string): number | null { return this.get$(ym)?.activo.cxc.items[k] ?? null; }
  gVentaRuta(ym: string): number | null { return this.get$(ym)?.activo.ventaEnRuta ?? null; }
   gCredFiscal(ym: string): number | null { return this.get$(ym)?.activo.credFiscal ?? null; }
  gTotalActivo(ym: string): number | null { return this.get$(ym)?.activo.total ?? null; }
  gCtasPagarTotal(ym: string): number | null { return this.get$(ym)?.pasivo.ctasPagar.total ?? null; }
  gProvPrincTotal(ym: string): number | null { return this.get$(ym)?.pasivo.ctasPagar.proveedoresPrincipales.total ?? null; }
  gProvPrincItem(ym: string, k: string): number | null { return this.get$(ym)?.pasivo.ctasPagar.proveedoresPrincipales.items[k] ?? null; }
  gProvSec(ym: string): number | null { return this.get$(ym)?.pasivo.ctasPagar.proveedoresSecundarios ?? null; }
  gComodato(ym: string): number | null { return this.get$(ym)?.pasivo.ctasPagar.comodato ?? null; }
  gGgTotal(ym: string): number | null { return this.get$(ym)?.pasivo.gg.total ?? null; }
  gGgItem(ym: string, k: string): number | null { return this.get$(ym)?.pasivo.gg.items[k] ?? null; }
  gImpTotal(ym: string): number | null { return this.get$(ym)?.pasivo.impuestos.total ?? null; }
  gImpItem(ym: string, k: string): number | null { return this.get$(ym)?.pasivo.impuestos.items[k] ?? null; }
  gDetracciones(ym: string): number | null { return this.get$(ym)?.pasivo.detracciones ?? null; }
  gObligTotal(ym: string): number | null { return this.get$(ym)?.pasivo.obligacionesFinancieras.total ?? null; }
  gObligItem(ym: string, k: string): number | null { return this.get$(ym)?.pasivo.obligacionesFinancieras.items[k] ?? null; }
  gTotalPasivo(ym: string): number | null { return this.get$(ym)?.pasivo.total ?? null; }
  gWk(ym: string): number | null { return this.get$(ym)?.wk ?? null; }
  gPago(ym: string): number | null { return this.get$(ym)?.pagoCuentaRenta ?? null; }

  get allBancoKeys(): string[] {
    const s = new Set<string>();
    this.mesesFiltrados.forEach(m => { const d = this.datos[m.ym]; if (d) Object.keys(d.activo.bancos.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allInvKeys(): string[] {
    const s = new Set<string>();
    this.mesesFiltrados.forEach(m => { const d = this.datos[m.ym]; if (d) Object.keys(d.activo.inventarios.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allCxcKeys(): string[] {
    const s = new Set<string>();
    this.mesesFiltrados.forEach(m => { const d = this.datos[m.ym]; if (d) Object.keys(d.activo.cxc.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allProvKeys(): string[] {
    const s = new Set<string>();
    this.mesesFiltrados.forEach(m => { const d = this.datos[m.ym]; if (d) Object.keys(d.pasivo.ctasPagar.proveedoresPrincipales.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allGgKeys(): string[] {
    const s = new Set<string>();
    this.mesesFiltrados.forEach(m => { const d = this.datos[m.ym]; if (d) Object.keys(d.pasivo.gg.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allImpKeys(): string[] {
    const s = new Set<string>();
    this.mesesFiltrados.forEach(m => { const d = this.datos[m.ym]; if (d) Object.keys(d.pasivo.impuestos.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  get allObligKeys(): string[] {
    const s = new Set<string>();
    this.mesesFiltrados.forEach(m => { const d = this.datos[m.ym]; if (d) Object.keys(d.pasivo.obligacionesFinancieras.items).forEach(k => s.add(k)); });
    return Array.from(s);
  }
  sumarKpi(campo: 'activo' | 'pasivo' | 'wk'): number {
    return this.mesesFiltrados.reduce((acc, m) => {
      const d = this.datos[m.ym];
      if (!d) return acc;
      if (campo === 'activo') return acc + d.activo.total;
      if (campo === 'pasivo') return acc + d.pasivo.total;
      return acc + d.wk;
    }, 0);
  }
}