import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';
import { Subject } from 'rxjs';
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
}

@Component({
  selector: 'app-wk-semanal',
  standalone: true,
  imports: [CommonModule],
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

  get fechaActiva(): string { return this.fechas[this.indiceActivo] ?? ''; }
  get datosActivos(): WkDatos | null { return this.datos[this.fechaActiva] ?? null; }

  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) {}

  ngOnInit() {
    // Auto-recarga cuando ingresos o egresos cambian
    this.wkRefresh.ingresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(fecha => {
      this.recargar(fecha);
    });
    this.wkRefresh.egresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(fecha => {
      this.recargar(fecha);
    });
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
          // carga todos los resúmenes; apaga cargando al terminar el último
          let pendientes = this.fechas.length;
          if (pendientes === 0) { this.cargando = false; return; }
          for (const f of this.fechas) {
            this.http.get<any>(`${API}/wk-semanal/resumen?fecha_corte=${f}`).subscribe({
              next: res => {
                if (res.estado === 'OK') {
                  this.datos = { ...this.datos, [f]: res.datos };
                } else {
                  console.error('WK resumen error:', res);
                }
                if (--pendientes === 0) this.cargando = false;
              },
              error: e => {
                console.error('WK resumen HTTP error:', e);
                if (--pendientes === 0) this.cargando = false;
              }
            });
          }
        } else {
          this.cargando = false;
          this.error = 'Error al cargar fechas';
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar fechas'; }
    });
  }

  cargarResumen(fecha: string) {
    this.http.get<any>(`${API}/wk-semanal/resumen?fecha_corte=${fecha}`).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.datos = { ...this.datos, [fecha]: r.datos };  // spread para trigger change detection
        } else {
          console.error('WK resumen error:', r);
        }
      },
      error: e => console.error('WK resumen HTTP error:', e)
    });
  }

  recargar(fecha: string) {
    if (!this.fechas.includes(fecha)) {
      this.fechas = [...this.fechas, fecha].sort();
    }
    this.indiceActivo = this.fechas.indexOf(fecha);
    this.cargarResumen(fecha);
  }

  irAFecha(i: number) { this.indiceActivo = i; }
  irAnterior() { if (this.indiceActivo > 0) this.indiceActivo--; }
  irSiguiente() { if (this.indiceActivo < this.fechas.length - 1) this.indiceActivo++; }

  formatFecha(f: string): string {
    const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const d = new Date(f + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')} ${m[d.getMonth()]} ${d.getFullYear()}`;
  }

  fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  colorVal(n: number): string {
    return n > 0 ? 'pos' : n < 0 ? 'neg' : '';
  }

  entries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj);
  }
}