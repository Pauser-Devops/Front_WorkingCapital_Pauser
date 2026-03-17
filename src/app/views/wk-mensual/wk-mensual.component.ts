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
}

interface Mes {
  fecha: string;   // fecha real para query ("2026-01-29")
  ym: string;   // "2026-01"
  label: string;   // "Ene 2026"
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
  indiceActivo = 0;
  datos: Record<string, WkDatos> = {};   // clave: ym "2026-01"
  cargando = true;
  error = '';

 
  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) { }

  ngOnInit() {
    // Recarga el mes correspondiente cuando se guardan ingresos o egresos
    this.wkRefresh.ingresosGuardado$.pipe(takeUntil(this.destroy$))
      .subscribe(fecha => this.recargarPorFecha(fecha));
    this.wkRefresh.egresosGuardado$.pipe(takeUntil(this.destroy$))
      .subscribe(fecha => this.recargarPorFecha(fecha));

    this.cargarMeses();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  cargarMeses() {
    this.cargando = true;
    this.http.get<any>(`${API}/wk-mensual/meses`).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.meses = r.meses;
          this.indiceActivo = Math.max(0, this.meses.length - 1);

          let pendientes = this.meses.length;
          if (pendientes === 0) { this.cargando = false; return; }

          for (const mes of this.meses) {
            this.http.get<any>(`${API}/wk-mensual/resumen?fecha_corte=${mes.fecha}`).subscribe({
              next: res => {
                if (res.estado === 'OK') {
                  this.datos = { ...this.datos, [mes.ym]: res.datos };
                } else {
                  console.error('WK mensual resumen error:', res);
                }
                if (--pendientes === 0) this.cargando = false;
              },
              error: e => {
                console.error('WK mensual HTTP error:', e);
                if (--pendientes === 0) this.cargando = false;
              }
            });
          }
        } else {
          this.cargando = false;
          this.error = 'Error al cargar meses';
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar meses'; }
    });
  }

  /** Cuando se guarda una fecha, recalcula el mes correspondiente */
  recargarPorFecha(fecha: string) {
    const ym = fecha.slice(0, 7);   // "2026-01"
    const mes = this.meses.find(m => m.ym === ym);
    if (!mes) {
      // Mes nuevo — recargar lista completa
      this.cargarMeses();
      return;
    }
    // El mes puede tener nueva última fecha — recargar lista para actualizar mes.fecha
    this.http.get<any>(`${API}/wk-mensual/meses`).subscribe({
      next: r => {
        if (r.estado !== 'OK') return;
        this.meses = r.meses;
        const mesActualizado = this.meses.find(m => m.ym === ym);
        if (!mesActualizado) return;
        this.http.get<any>(`${API}/wk-mensual/resumen?fecha_corte=${mesActualizado.fecha}`).subscribe({
          next: res => {
            if (res.estado === 'OK') {
              this.datos = { ...this.datos, [ym]: res.datos };
              this.indiceActivo = this.meses.findIndex(m => m.ym === ym);
            }
          }
        });
      }
    });
  }

  fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  colorVal(n: number): string { return n > 0 ? 'pos' : n < 0 ? 'neg' : ''; }

  entries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj);
  }
 


  filtroDesde = '';
filtroHasta = '';

get mesesFiltrados(): Mes[] {
  if (!this.filtroDesde && !this.filtroHasta) return this.meses;
  return this.meses.filter(m => {
    const ok1 = !this.filtroDesde || m.fecha >= this.filtroDesde;
    const ok2 = !this.filtroHasta || m.fecha <= this.filtroHasta;
    return ok1 && ok2;
  });
}

get mesActivo(): Mes | null { return this.mesesFiltrados[this.indiceActivo] ?? null; }
get datosActivos(): WkDatos | null {
  return this.mesActivo ? (this.datos[this.mesActivo.ym] ?? null) : null;
}

irAMes(i: number) { this.indiceActivo = i; }
irAnterior() { if (this.indiceActivo > 0) this.indiceActivo--; }
irSiguiente() { if (this.indiceActivo < this.mesesFiltrados.length - 1) this.indiceActivo++; }

exportar() {
  if (!this.mesActivo) return;
  window.open(`${API}/exportar/wk-mensual?fecha_corte=${this.mesActivo.fecha}`, '_blank');
}
}