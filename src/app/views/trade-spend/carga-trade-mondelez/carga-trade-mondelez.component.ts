import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface ArchivoOneDrive {
  nombre: string;
  tamanio_mb: number;
  modificado: string;
}

export interface ResultadoSyncVentas {
  archivo: string;
  estado: string;
  anio?: number;
  mes?: number;
  total_excel?: number;
  insertados?: number;
  omitidas?: number;
  max_row_previo?: number;
  max_row_nuevo?: number;
  detalle?: string;
}

export interface ResultadoSyncPrecios {
  archivo: string;
  estado: string;
  anio?: number;
  mes?: number;
  total_insertados?: number;
  descuento_adicional?: number;
  detalle?: string;
}

export interface PeriodoVentas {
  anio: number;
  mes: number;
  total_filas: number;
  ultima_fila: number;
  ultimo_sync: string;
}

export interface PeriodoPrecios {
  anio: number;
  mes: number;
  total_skus: number;
  ultimo_sync: string;
}

const MESES_LABELS: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

type VistaActual = 'ventas' | 'precios' | 'estado';

@Component({
  selector: 'app-carga-trade-mondelez',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carga-trade-mondelez.component.html',
  styleUrls: ['./carga-trade-mondelez.component.css'],
})
export class CargaTradeMondelezComponent implements OnInit {

  vistaActual: VistaActual = 'ventas';

  // ── Ventas ────────────────────────────────────────────────────────────────
  archivosVentas: ArchivoOneDrive[] = [];
  cargandoVentas = false;
  errorListaVentas: string | null = null;
  ventaSeleccionada: ArchivoOneDrive | null = null;
  busquedaVentas = '';
  sincronizandoVentas = false;
  progresoVentas = 0;
  intervaloVentas: any = null;
  resultadoVentas: ResultadoSyncVentas | null = null;
  errorVentas: string | null = null;
  conflictoVentas = false;

  // ── Precios ───────────────────────────────────────────────────────────────
  archivosPrecios: ArchivoOneDrive[] = [];
  cargandoPrecios = false;
  errorListaPrecios: string | null = null;
  precioSeleccionado: ArchivoOneDrive | null = null;
  busquedaPrecios = '';
  sincronizandoPrecios = false;
  progresoPrecios = 0;
  intervaloPrecios: any = null;
  resultadoPrecios: ResultadoSyncPrecios | null = null;
  errorPrecios: string | null = null;
  conflictoPrecios = false;

  // ── Estado BD ─────────────────────────────────────────────────────────────
  periodosVentas: PeriodoVentas[] = [];
  periodosPrecios: PeriodoPrecios[] = [];
  cargandoEstado = false;

  readonly mesesLabels = MESES_LABELS;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.listarVentas();
  }

  // ── Normalización búsqueda ────────────────────────────────────────────────

  private _norm(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  get ventasFiltradas(): ArchivoOneDrive[] {
    if (!this.busquedaVentas.trim()) return this.archivosVentas;
    const q = this._norm(this.busquedaVentas);
    return this.archivosVentas.filter(a => this._norm(a.nombre).includes(q));
  }

  get preciosFiltrados(): ArchivoOneDrive[] {
    if (!this.busquedaPrecios.trim()) return this.archivosPrecios;
    const q = this._norm(this.busquedaPrecios);
    return this.archivosPrecios.filter(a => this._norm(a.nombre).includes(q));
  }

  get mensajeVacioVentas(): string {
    return this.busquedaVentas.trim() && this.ventasFiltradas.length === 0
      ? 'Sin resultados para "' + this.busquedaVentas.trim() + '"'
      : 'No se encontraron archivos en la carpeta configurada.';
  }

  get mensajeVacioPrecios(): string {
    return this.busquedaPrecios.trim() && this.preciosFiltrados.length === 0
      ? 'Sin resultados para "' + this.busquedaPrecios.trim() + '"'
      : 'No se encontraron archivos en la carpeta configurada.';
  }

  // ── Vista ─────────────────────────────────────────────────────────────────

  cambiarVista(vista: VistaActual): void {
    this.vistaActual = vista;
    if (vista === 'precios' && this.archivosPrecios.length === 0) this.listarPrecios();
    if (vista === 'estado') this.cargarEstado();
  }

  // ── VENTAS ────────────────────────────────────────────────────────────────

  listarVentas(): void {
    this.cargandoVentas = true;
    this.errorListaVentas = null;
    this.archivosVentas = [];
    this.ventaSeleccionada = null;
    this.resultadoVentas = null;
    this.busquedaVentas = '';

    this.http.get<{ estado: string; archivos: ArchivoOneDrive[] }>(
      `${environment.apiUrl}/mondelez/ventas-listar`
    ).subscribe({
      next: res => {
        this.archivosVentas = (res.archivos ?? []).sort(
          (a, b) => new Date(b.modificado).getTime() - new Date(a.modificado).getTime()
        );
        this.cargandoVentas = false;
        if (this.archivosVentas.length > 0) this.ventaSeleccionada = this.archivosVentas[0];
      },
      error: err => {
        this.errorListaVentas = err.error?.detalle ?? err.message ?? 'Error al conectar con OneDrive';
        this.cargandoVentas = false;
      },
    });
  }

  seleccionarVenta(a: ArchivoOneDrive): void {
    this.ventaSeleccionada = a;
    this.resultadoVentas = null;
    this.errorVentas = null;
    this.conflictoVentas = false;
  }

  sincronizarVentas(forzar = false): void {
    if (!this.ventaSeleccionada || this.sincronizandoVentas) return;

    // Verificar si ya existe en BD
    const periodo = this._periodoDeArchivo(this.ventaSeleccionada.nombre);
    const yaExiste = periodo && this.periodosVentas.some(
      p => p.anio === periodo.anio && p.mes === periodo.mes
    );
    if (yaExiste && !forzar) { this.conflictoVentas = true; return; }

    this.conflictoVentas = false;
    this.sincronizandoVentas = true;
    this.progresoVentas = 0;
    this.resultadoVentas = null;
    this.errorVentas = null;

    this.intervaloVentas = setInterval(() => {
      if (this.progresoVentas < 85) this.progresoVentas += Math.random() * 8 + 2;
      if (this.progresoVentas > 85) this.progresoVentas = 85;
    }, 400);

    const url = `${environment.apiUrl}/mondelez/ventas-sync?filename=${encodeURIComponent(this.ventaSeleccionada.nombre)}`;
    this.http.post<ResultadoSyncVentas>(url, {}).subscribe({
      next: res => {
        this._detener(this.intervaloVentas);
        this.progresoVentas = 100;
        this.resultadoVentas = res;
        this.sincronizandoVentas = false;
        if (res.estado === 'ok') this.cargarEstado();
      },
      error: err => {
        this._detener(this.intervaloVentas);
        this.errorVentas = err.error?.detalle ?? err.message ?? 'Error al sincronizar';
        this.sincronizandoVentas = false;
      },
    });
  }

  // ── PRECIOS ───────────────────────────────────────────────────────────────

  listarPrecios(): void {
    this.cargandoPrecios = true;
    this.errorListaPrecios = null;
    this.archivosPrecios = [];
    this.precioSeleccionado = null;
    this.resultadoPrecios = null;
    this.busquedaPrecios = '';

    this.http.get<{ estado: string; archivos: ArchivoOneDrive[] }>(
      `${environment.apiUrl}/mondelez/precios-listar`
    ).subscribe({
      next: res => {
        this.archivosPrecios = (res.archivos ?? []).sort(
          (a, b) => new Date(b.modificado).getTime() - new Date(a.modificado).getTime()
        );
        this.cargandoPrecios = false;
        if (this.archivosPrecios.length > 0) this.precioSeleccionado = this.archivosPrecios[0];
      },
      error: err => {
        this.errorListaPrecios = err.error?.detalle ?? err.message ?? 'Error al conectar con OneDrive';
        this.cargandoPrecios = false;
      },
    });
  }

  seleccionarPrecio(a: ArchivoOneDrive): void {
    this.precioSeleccionado = a;
    this.resultadoPrecios = null;
    this.errorPrecios = null;
    this.conflictoPrecios = false;
  }

  sincronizarPrecios(forzar = false): void {
    if (!this.precioSeleccionado || this.sincronizandoPrecios) return;

    const periodo = this._periodoDeArchivo(this.precioSeleccionado.nombre);
    const yaExiste = periodo && this.periodosPrecios.some(
      p => p.anio === periodo.anio && p.mes === periodo.mes
    );
    if (yaExiste && !forzar) { this.conflictoPrecios = true; return; }

    this.conflictoPrecios = false;
    this.sincronizandoPrecios = true;
    this.progresoPrecios = 0;
    this.resultadoPrecios = null;
    this.errorPrecios = null;

    this.intervaloPrecios = setInterval(() => {
      if (this.progresoPrecios < 85) this.progresoPrecios += Math.random() * 12 + 4;
      if (this.progresoPrecios > 85) this.progresoPrecios = 85;
    }, 250);

    const url = `${environment.apiUrl}/mondelez/precios-sync?filename=${encodeURIComponent(this.precioSeleccionado.nombre)}`;
    this.http.post<ResultadoSyncPrecios>(url, {}).subscribe({
      next: res => {
        this._detener(this.intervaloPrecios);
        this.progresoPrecios = 100;
        this.resultadoPrecios = res;
        this.sincronizandoPrecios = false;
        if (res.estado === 'ok') this.cargarEstado();
      },
      error: err => {
        this._detener(this.intervaloPrecios);
        this.errorPrecios = err.error?.detalle ?? err.message ?? 'Error al sincronizar';
        this.sincronizandoPrecios = false;
      },
    });
  }

  // ── ESTADO BD ─────────────────────────────────────────────────────────────

  cargarEstado(): void {
    this.cargandoEstado = true;
    this.http.get<{ estado: string; ventas: PeriodoVentas[]; precios: PeriodoPrecios[] }>(
      `${environment.apiUrl}/mondelez/estado`
    ).subscribe({
      next: res => {
        this.periodosVentas  = res.ventas  ?? [];
        this.periodosPrecios = res.precios ?? [];
        this.cargandoEstado  = false;
      },
      error: () => { this.cargandoEstado = false; },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _detener(intervalo: any): void { clearInterval(intervalo); }

  private _periodoDeArchivo(nombre: string): { anio: number; mes: number } | null {
    const n = nombre.toLowerCase();
    const meses: Record<string, number> = {
      ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4,
      may: 5, jun: 6, jul: 7, ago: 8, aug: 8,
      set: 9, sep: 9, oct: 10, nov: 11, dic: 12,
    };
    let mes = 0;
    for (const [k, v] of Object.entries(meses)) {
      if (n.includes(k)) { mes = v; break; }
    }
    const m4 = n.match(/20(\d{2})/);
    const m2 = !m4 ? n.match(/(\d{2})$/) : null;
    const anio = m4 ? 2000 + parseInt(m4[1]) : m2 ? 2000 + parseInt(m2[1]) : 0;
    return mes && anio ? { mes, anio } : null;
  }

  esMasReciente(arch: ArchivoOneDrive, lista: ArchivoOneDrive[]): boolean {
    return lista.length > 0 && lista[0].nombre === arch.nombre;
  }

  formatFecha(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatNum(n: number): string { return (n ?? 0).toLocaleString('es-PE'); }
  mesLabel(mes: number): string { return MESES_LABELS[mes] ?? String(mes); }

  get totalVentasFilas(): number {
    return this.periodosVentas.reduce((s, p) => s + (p.total_filas ?? 0), 0);
  }

  get totalPreciosSkus(): number {
    return this.periodosPrecios.reduce((s, p) => s + (p.total_skus ?? 0), 0);
  }

  labelEstadoVentas(): string {
    const e = this.resultadoVentas?.estado;
    if (e === 'ok')              return 'Sincronización completada';
    if (e === 'sin_cambios')     return 'Sin filas nuevas — ya estaba actualizado';
    if (e === 'no_encontrado')   return 'Archivo no encontrado en OneDrive';
    if (e === 'error_lectura')   return 'Error al leer el archivo';
    if (e === 'error_nombre')    return 'No se pudo deducir mes/año del nombre';
    return e ?? '—';
  }

  labelEstadoPrecios(): string {
    const e = this.resultadoPrecios?.estado;
    if (e === 'ok')            return 'Precios cargados correctamente';
    if (e === 'no_encontrado') return 'Archivo no encontrado en OneDrive';
    if (e === 'error_lectura') return 'Error al leer el archivo';
    if (e === 'error_nombre')  return 'No se pudo deducir año del nombre';
    return e ?? '—';
  }
}