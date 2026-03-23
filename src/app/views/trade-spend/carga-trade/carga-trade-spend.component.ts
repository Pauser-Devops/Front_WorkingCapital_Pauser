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

export interface EstadoPeriodo {
  existe: boolean;
  periodo_id?: number;
  precios: boolean;
  politica: boolean;
  chess_base: boolean;
}

export interface ResultadoCarga {
  insertados?: number;
  reemplazados?: number;
  errores: string[];
}

export interface ResultadoSyncPrecios {
  archivo: string;
  estado: string;
  anio?: number;
  mes?: number;
  total_insertados?: number;
  total_skus?: number;
  errores_parser?: number;
  errores_detalle?: string[];
  detalle?: string;
}

export interface ResultadoSyncChess {
  archivo: string;
  estado: string;
  total_insertados?: number;
  detalle?: any[];
}

export interface CargaLog {
  id: number;
  agencia: string;
  tipo: string;
  nombre_archivo: string;
  estado: string;
  filas_cargadas: number;
  filas_error: number;
  anio: number;
  mes: number;
  fecha_carga: string;
}

export interface PrecioProducto {
  cd_pauser: number;
  cod_cbc: string;
  sku_gerencial: string;
  nombre_completo: string;
  negocio: string;
  unds_bulto: number;
  trad_pnd_sigv: number;
  mayo_pnd_sigv: number;
  precio_sistema_trad: number;
  dif_trad: number;
  dif_mayo: number;
  ttv_trad: number;
  ttv_mayo: number;
  flete: number;
  mc: number;
  precio_corregido: boolean;
  tiene_diferencia: boolean;
}

const MESES_LABELS: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

type VistaActual = 'carga' | 'productos' | 'historial';
type PasoActivo = 'precios' | 'politica' | 'chess';

@Component({
  selector: 'app-carga-trade-spend',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carga-trade-spend.component.html',
  styleUrls: ['./carga-trade-spend.component.css'],
})
export class CargaTradeSpendComponent implements OnInit {

  vistaActual: VistaActual = 'carga';

  // ── Período ───────────────────────────────────────────────────────────────
  anioSeleccionado = new Date().getFullYear();
  mesSeleccionado  = new Date().getMonth() + 1;
  readonly mesesOpciones = Object.entries(MESES_LABELS).map(([n, l]) => ({ num: Number(n), label: l }));
  readonly aniosOpciones = [new Date().getFullYear(), new Date().getFullYear() - 1];

  // ── Estado por agencia ────────────────────────────────────────────────────
  estadoCHM: EstadoPeriodo = { existe: false, precios: false, politica: false, chess_base: false };
  estadoHRZ: EstadoPeriodo = { existe: false, precios: false, politica: false, chess_base: false };
  cargandoEstado = false;

  // ── Paso activo ───────────────────────────────────────────────────────────
  pasoExpandido: PasoActivo | null = 'precios';

  // ── PASO 1: Precios CBC desde OneDrive ────────────────────────────────────
  conflictoPrecios = false;
  archivosPrecios: ArchivoOneDrive[] = [];
  cargandoListaPrecios = false;
  errorListaPrecios: string | null = null;
  precioSeleccionado: ArchivoOneDrive | null = null;
  busquedaPrecios = '';
  sincronizandoPrecios = false;
  progresoPrecios = 0;
  intervaloPrecios: any = null;
  resultadoPrecios: ResultadoSyncPrecios | null = null;
  errorPrecios: string | null = null;

  // ── PASO 2: Política comercial (subida manual) ────────────────────────────
  archivoPolitica: File | null = null;
  subiendoPolitica = false;
  resultadoPolitica: ResultadoCarga | null = null;
  errorPolitica: string | null = null;
  tipoConflictoPolitica = false;

  // ── PASO 3: Chess Base desde OneDrive ─────────────────────────────────────
  archivosChess: ArchivoOneDrive[] = [];
  cargandoListaChess = false;
  errorListaChess: string | null = null;
  chessSeleccionado: ArchivoOneDrive | null = null;
  busquedaChess = '';
  sincronizandoChess = false;
  progresoChess = 0;
  intervaloChess: any = null;
  resultadoChess: ResultadoSyncChess | null = null;
  errorChess: string | null = null;

  // ── Productos ─────────────────────────────────────────────────────────────
  productos: PrecioProducto[] = [];
  agenciaProductos: 'CHM' | 'HRZ' = 'CHM';
  cargandoProductos = false;
  filtroNegocio = '';
  readonly negocios = ['Agua', 'CSD', 'Gatorade', 'Licores', 'Energizantes'];

  // ── Historial ─────────────────────────────────────────────────────────────
  historial: CargaLog[] = [];
  cargandoHistorial = false;

  readonly mesesLabels = MESES_LABELS;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.consultarEstado();
  }

  // ── Normalización para búsqueda ───────────────────────────────────────────

  private _norm(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  get archivosPreciosFiltrados(): ArchivoOneDrive[] {
    if (!this.busquedaPrecios.trim()) return this.archivosPrecios;
    const q = this._norm(this.busquedaPrecios);
    return this.archivosPrecios.filter(a => this._norm(a.nombre).includes(q));
  }

  get archivosChessFiltrados(): ArchivoOneDrive[] {
    if (!this.busquedaChess.trim()) return this.archivosChess;
    const q = this._norm(this.busquedaChess);
    return this.archivosChess.filter(a => this._norm(a.nombre).includes(q));
  }

  // ── Período ───────────────────────────────────────────────────────────────

  onCambioPeriodo(): void {
    this.resultadoPrecios = null;
    this.resultadoPolitica = null;
    this.resultadoChess = null;
    this.archivoPolitica = null;
    this.consultarEstado();
  }

  consultarEstado(): void {
    this.cargandoEstado = true;
    let pendiente = 2;
    const done = () => { if (--pendiente === 0) { this.cargandoEstado = false; this._actualizarPasoExpandido(); } };
    const vacio = (): EstadoPeriodo => ({ existe: false, precios: false, politica: false, chess_base: false });

    for (const ag of ['CHM', 'HRZ'] as const) {
      const url = `${environment.apiUrl}/trade-spend/periodos/${ag}/${this.anioSeleccionado}/${this.mesSeleccionado}/estado`;
      this.http.get<EstadoPeriodo>(url).subscribe({
        next:  e  => { ag === 'CHM' ? (this.estadoCHM = e) : (this.estadoHRZ = e); done(); },
        error: () => { ag === 'CHM' ? (this.estadoCHM = vacio()) : (this.estadoHRZ = vacio()); done(); },
      });
    }
  }

  private _actualizarPasoExpandido(): void {
    if (!this.estadoCHM.precios && !this.estadoHRZ.precios) { this.pasoExpandido = 'precios'; return; }
    if (!this.estadoCHM.politica && !this.estadoHRZ.politica) { this.pasoExpandido = 'politica'; return; }
    if (!this.estadoCHM.chess_base && !this.estadoHRZ.chess_base) { this.pasoExpandido = 'chess'; return; }
    this.pasoExpandido = null;
  }

  togglePaso(paso: PasoActivo): void {
    this.pasoExpandido = this.pasoExpandido === paso ? null : paso;
  }

  estadoPaso(tipo: 'precios' | 'politica' | 'chess_base'): 'ok' | 'activo' | 'pendiente' {
    if (this.estadoCHM[tipo] || this.estadoHRZ[tipo]) return 'ok';
    const mapa: Record<string, PasoActivo> = { precios: 'precios', politica: 'politica', chess_base: 'chess' };
    if (this.pasoExpandido === mapa[tipo]) return 'activo';
    return 'pendiente';
  }

  get todoCargado(): boolean {
    return this.estadoCHM.precios && this.estadoCHM.politica;
  }

  get periodoLabel(): string {
    return `${MESES_LABELS[this.mesSeleccionado]} ${this.anioSeleccionado}`;
  }

  // ── PASO 1: Precios ───────────────────────────────────────────────────────

  listarPrecios(): void {
    this.cargandoListaPrecios = true;
    this.errorListaPrecios = null;
    this.archivosPrecios = [];
    this.precioSeleccionado = null;
    this.resultadoPrecios = null;
    this.busquedaPrecios = '';

    this.http.get<{ estado: string; archivos: ArchivoOneDrive[] }>(
      `${environment.apiUrl}/trade-spend/cbc-listar`
    ).subscribe({
      next: res => {
        this.archivosPrecios = (res.archivos ?? []).sort(
          (a, b) => new Date(b.modificado).getTime() - new Date(a.modificado).getTime()
        );
        this.cargandoListaPrecios = false;
        if (this.archivosPrecios.length > 0) this.precioSeleccionado = this.archivosPrecios[0];
      },
      error: err => {
        this.errorListaPrecios = err.error?.detalle ?? 'Error al conectar con OneDrive';
        this.cargandoListaPrecios = false;
      },
    });
  }

  seleccionarPrecio(a: ArchivoOneDrive): void {
    this.precioSeleccionado = a;
    this.resultadoPrecios = null;
    this.errorPrecios = null;
  }

  sincronizarPrecios(forzar = false): void {
    if (!this.precioSeleccionado || this.sincronizandoPrecios) return;
    // Si ya hay precios cargados y no se fuerza, mostrar aviso
    if ((this.estadoCHM.precios || this.estadoHRZ.precios) && !forzar) {
      this.conflictoPrecios = true;
      return;
    }
    this.conflictoPrecios = false;
    this.sincronizandoPrecios = true;
    this.progresoPrecios = 0;
    this.resultadoPrecios = null;
    this.errorPrecios = null;

    this.intervaloPrecios = setInterval(() => {
      if (this.progresoPrecios < 85) this.progresoPrecios += Math.random() * 12 + 4;
      if (this.progresoPrecios > 85) this.progresoPrecios = 85;
    }, 250);

    const url = `${environment.apiUrl}/trade-spend/cbc-sync?filename=${encodeURIComponent(this.precioSeleccionado.nombre)}`;
    this.http.post<ResultadoSyncPrecios>(url, {}).subscribe({
      next: res => {
        this._detener(this.intervaloPrecios);
        this.progresoPrecios = 100;
        this.resultadoPrecios = res;
        this.sincronizandoPrecios = false;
        if (res.estado === 'ok') {
          this.estadoCHM.precios = true; this.estadoHRZ.precios = true;
          this.estadoCHM.existe = true;  this.estadoHRZ.existe = true;
          this._actualizarPasoExpandido();
        }
      },
      error: err => {
        this._detener(this.intervaloPrecios);
        this.errorPrecios = err.error?.detalle ?? 'Error al sincronizar';
        this.sincronizandoPrecios = false;
      },
    });
  }

  // ── PASO 2: Política ──────────────────────────────────────────────────────

  onArchivoPolitica(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivoPolitica = input.files?.[0] ?? null;
    this.resultadoPolitica = null;
    this.errorPolitica = null;
    this.tipoConflictoPolitica = false;
    input.value = '';
  }

  subirPolitica(forzar = false): void {
    if (!this.archivoPolitica) return;
    const yaExiste = this.estadoCHM.politica || this.estadoHRZ.politica;
    if (yaExiste && !forzar) { this.tipoConflictoPolitica = true; return; }

    this.tipoConflictoPolitica = false;
    this.subiendoPolitica = true;
    this.errorPolitica = null;

    const form = new FormData();
    form.append('archivo', this.archivoPolitica);
    form.append('reemplazar', String(forzar));

    this.http.post<ResultadoCarga>(`${environment.apiUrl}/trade-spend/cargas/politica`, form).subscribe({
      next: res => {
        this.resultadoPolitica = res;
        this.subiendoPolitica = false;
        this.archivoPolitica = null;
        this.estadoCHM.politica = true; this.estadoHRZ.politica = true;
        this.estadoCHM.existe = true;   this.estadoHRZ.existe = true;
        this._actualizarPasoExpandido();
      },
      error: err => {
        this.subiendoPolitica = false;
        if (err.status === 409) {
          this.tipoConflictoPolitica = true;
        } else {
          this.errorPolitica = err.error?.detail?.mensaje ?? err.error?.detail ?? err.message ?? 'Error al subir';
        }
      },
    });
  }

  // ── PASO 3: Chess ─────────────────────────────────────────────────────────

  listarChess(): void {
    this.cargandoListaChess = true;
    this.errorListaChess = null;
    this.archivosChess = [];
    this.chessSeleccionado = null;
    this.resultadoChess = null;
    this.busquedaChess = '';

    this.http.get<{ estado: string; archivos: ArchivoOneDrive[] }>(
      `${environment.apiUrl}/trade-spend/chess-listar`
    ).subscribe({
      next: res => {
        this.archivosChess = (res.archivos ?? []).sort(
          (a, b) => new Date(b.modificado).getTime() - new Date(a.modificado).getTime()
        );
        this.cargandoListaChess = false;
        if (this.archivosChess.length > 0) this.chessSeleccionado = this.archivosChess[0];
      },
      error: err => {
        this.errorListaChess = err.error?.detalle ?? 'Error al conectar con OneDrive';
        this.cargandoListaChess = false;
      },
    });
  }

  seleccionarChess(a: ArchivoOneDrive): void {
    this.chessSeleccionado = a;
    this.resultadoChess = null;
    this.errorChess = null;
  }

  conflictoChess = false;

  sincronizarChess(forzar = false): void {
    if (!this.chessSeleccionado || this.sincronizandoChess) return;
    if ((this.estadoCHM.chess_base || this.estadoHRZ.chess_base) && !forzar) {
      this.conflictoChess = true;
      return;
    }
    this.conflictoChess = false;
    this.sincronizandoChess = true;
    this.progresoChess = 0;
    this.resultadoChess = null;
    this.errorChess = null;

    this.intervaloChess = setInterval(() => {
      if (this.progresoChess < 85) this.progresoChess += Math.random() * 10 + 3;
      if (this.progresoChess > 85) this.progresoChess = 85;
    }, 300);

    const url = `${environment.apiUrl}/trade-spend/chess-sync?filename=${encodeURIComponent(this.chessSeleccionado.nombre)}`;
    this.http.post<ResultadoSyncChess>(url, {}).subscribe({
      next: res => {
        this._detener(this.intervaloChess);
        this.progresoChess = 100;
        this.resultadoChess = res;
        this.sincronizandoChess = false;
        if ((res.total_insertados ?? 0) > 0) {
          this.estadoCHM.chess_base = true; this.estadoHRZ.chess_base = true;
          this._actualizarPasoExpandido();
        }
      },
      error: err => {
        this._detener(this.intervaloChess);
        if (err.status === 409) {
          this.conflictoChess = true;
        } else {
          this.errorChess = err.error?.detalle ?? 'Error al sincronizar';
        }
        this.sincronizandoChess = false;
      },
    });
  }

  // ── Productos ─────────────────────────────────────────────────────────────

  verProductos(): void {
    this.vistaActual = 'productos';
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.cargandoProductos = true;
    let url = `${environment.apiUrl}/trade-spend/periodos/${this.agenciaProductos}/${this.anioSeleccionado}/${this.mesSeleccionado}/precios`;
    if (this.filtroNegocio) url += `?negocio=${encodeURIComponent(this.filtroNegocio)}`;
    this.http.get<{ productos: PrecioProducto[] }>(url).subscribe({
      next:  r  => { this.productos = r.productos; this.cargandoProductos = false; },
      error: () => { this.cargandoProductos = false; },
    });
  }

  // ── Historial ─────────────────────────────────────────────────────────────

  verHistorial(): void {
    this.vistaActual = 'historial';
    this.cargandoHistorial = true;
    this.http.get<CargaLog[]>(`${environment.apiUrl}/trade-spend/cargas/`).subscribe({
      next:  d  => { this.historial = d; this.cargandoHistorial = false; },
      error: () => { this.cargandoHistorial = false; },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _detener(intervalo: any): void {
    clearInterval(intervalo);
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

  get productosConDiferencia(): number { return this.productos.filter(p => p.tiene_diferencia).length; }

  badgeTipo(tipo: string): string {
    return ({ precios: 'ts-badge-blue', politica: 'ts-badge-amber', chess_base: 'ts-badge-gray' } as any)[tipo] ?? 'ts-badge-gray';
  }
  badgeEstadoCarga(e: string): string { return e === 'ok' ? 'ts-badge-green' : 'ts-badge-red'; }
  labelTipo(t: string): string { return ({ precios: 'Precios', politica: 'Política', chess_base: 'Chess Base' } as any)[t] ?? t; }
  labelEstadoCarga(e: string): string { return ({ ok: 'OK', error: 'Error' } as any)[e] ?? e; }
  formatFechaCorta(iso: string): string { return iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
}