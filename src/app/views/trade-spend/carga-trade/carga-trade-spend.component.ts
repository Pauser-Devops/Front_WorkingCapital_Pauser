import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface EstadoPeriodo {
  existe: boolean;
  periodo_id?: number;
  precios: boolean;
  politica: boolean;
  chess_base: boolean;
}

export interface ResultadoCarga {
  insertados: number;
  reemplazados?: number;
  errores: string[];
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

type TipoArchivo = 'precios' | 'politica' | 'chess_base';
type VistaActual = 'carga' | 'productos' | 'historial';

const MESES_LABELS: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

export interface PasoCarga {
  tipo: TipoArchivo;
  numero: number;
  titulo: string;
  descripcion: string;
  detalle: string;
  icono: string;
}

const PASOS: PasoCarga[] = [
  {
    tipo: 'precios', numero: 1,
    titulo: 'Tabla de precios',
    descripcion: 'Precios CBC · Chimbote y Huaraz',
    detalle: 'Bebidas_Mes.xlsx — ambas agencias en un solo archivo',
    icono: '₡',
  },
  {
    tipo: 'politica', numero: 2,
    titulo: 'Política comercial',
    descripcion: 'Bonificaciones y descuentos por SKU',
    detalle: 'Política_Comercial_Pauser.xlsx — hojas Chimbote / Huaraz',
    icono: '%',
  },
  {
    tipo: 'chess_base', numero: 3,
    titulo: 'Chess Base',
    descripcion: 'Ventas reales del mes',
    detalle: 'Chess_Base.xlsx — para el cierre de Trade Spend',
    icono: '▦',
  },
];

@Component({
  selector: 'app-carga-trade-spend',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carga-trade-spend.component.html',
  styleUrls: ['./carga-trade-spend.component.css'],
})
export class CargaTradeSpendComponent implements OnInit {

  vistaActual: VistaActual = 'carga';

  // Periodo — sin selector de agencia (el Excel trae ambas)
  anioSeleccionado = new Date().getFullYear();
  mesSeleccionado  = new Date().getMonth() + 1;

  readonly mesesOpciones = Object.entries(MESES_LABELS).map(([n, l]) => ({ num: Number(n), label: l }));
  readonly aniosOpciones = [new Date().getFullYear(), new Date().getFullYear() - 1];

  // Estado por agencia
  estadoCHM: EstadoPeriodo = { existe: false, precios: false, politica: false, chess_base: false };
  estadoHRZ: EstadoPeriodo = { existe: false, precios: false, politica: false, chess_base: false };
  cargandoEstado = false;

  readonly pasos = PASOS;
  pasoActivo = 1;

  archivos:     Record<TipoArchivo, File | null>         = { precios: null, politica: null, chess_base: null };
  subiendo:     Record<TipoArchivo, boolean>             = { precios: false, politica: false, chess_base: false };
  resultados:   Record<TipoArchivo, ResultadoCarga|null> = { precios: null, politica: null, chess_base: null };
  erroresCarga: Record<TipoArchivo, string|null>         = { precios: null, politica: null, chess_base: null };

  tipoConflicto: TipoArchivo | null = null;
  mensajeConflicto = '';

  // Productos
  productos: PrecioProducto[] = [];
  agenciaProductos: 'CHM' | 'HRZ' = 'CHM';
  cargandoProductos = false;
  filtroNegocio = '';
  readonly negocios = ['Agua', 'CSD', 'Gatorade', 'Licores', 'Energizantes'];

  // Historial
  historial: CargaLog[] = [];
  cargandoHistorial = false;

  // Chess Sync desde OneDrive
  archivosOneDrive: { nombre: string; tamanio_mb: number; modificado: string }[] = [];
  cargandoArchivos  = false;
  archivoSeleccionado: string | null = null;
  sincronizando     = false;
  resultadoSync: any = null;
  errorSync: string | null = null;

  readonly mesesLabels = MESES_LABELS;

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.consultarEstado(); }

  onCambioPeriodo(): void {
    this.pasos.forEach(p => {
      this.archivos[p.tipo] = null;
      this.resultados[p.tipo] = null;
      this.erroresCarga[p.tipo] = null;
    });
    this.tipoConflicto = null;
    this.consultarEstado();
  }

  consultarEstado(): void {
    this.cargandoEstado = true;
    let pendiente = 2;
    const done = () => { if (--pendiente === 0) { this.cargandoEstado = false; this._actualizarPaso(); } };
    const vacio = (): EstadoPeriodo => ({ existe: false, precios: false, politica: false, chess_base: false });

    for (const ag of ['CHM', 'HRZ'] as const) {
      const url = `${environment.apiUrl}/trade-spend/periodos/${ag}/${this.anioSeleccionado}/${this.mesSeleccionado}/estado`;
      this.http.get<EstadoPeriodo>(url).subscribe({
        next:  e  => { ag === 'CHM' ? (this.estadoCHM = e) : (this.estadoHRZ = e); done(); },
        error: () => { ag === 'CHM' ? (this.estadoCHM = vacio()) : (this.estadoHRZ = vacio()); done(); },
      });
    }
  }

  onArchivoSeleccionado(event: Event, tipo: TipoArchivo): void {
    const input = event.target as HTMLInputElement;
    this.archivos[tipo]     = input.files?.[0] ?? null;
    this.resultados[tipo]   = null;
    this.erroresCarga[tipo] = null;
    input.value = '';
  }

  subirArchivo(tipo: TipoArchivo, forzar = false): void {
    const archivo = this.archivos[tipo];
    if (!archivo) return;

    const yaExiste = this.estadoCHM[tipo] || this.estadoHRZ[tipo];
    if (yaExiste && !forzar) {
      this.tipoConflicto    = tipo;
      this.mensajeConflicto =
        `Ya existe data de "${this.pasos.find(p => p.tipo === tipo)?.titulo}" ` +
        `para ${MESES_LABELS[this.mesSeleccionado]} ${this.anioSeleccionado}. ` +
        `Si continúas se reemplazará la información de ambas agencias.`;
      return;
    }

    this.tipoConflicto      = null;
    this.subiendo[tipo]     = true;
    this.erroresCarga[tipo] = null;

    const form = new FormData();
    form.append('archivo',    archivo);
    form.append('reemplazar', String(forzar));
    if (tipo === 'chess_base') {
      form.append('anio', String(this.anioSeleccionado));
      form.append('mes',  String(this.mesSeleccionado));
    }

    const ep = `${environment.apiUrl}/trade-spend/cargas/${tipo === 'chess_base' ? 'chess' : tipo}`;
    this.http.post<ResultadoCarga>(ep, form).subscribe({
      next: res => {
        this.resultados[tipo] = res;
        this.subiendo[tipo]   = false;
        this.archivos[tipo]   = null;
        this.estadoCHM[tipo]  = true;
        this.estadoHRZ[tipo]  = true;
        this.estadoCHM.existe = true;
        this.estadoHRZ.existe = true;
        this._actualizarPaso();
      },
      error: err => {
        this.subiendo[tipo] = false;
        if (err.status === 409) {
          this.tipoConflicto    = tipo;
          this.mensajeConflicto = err.error?.detail?.mensaje ?? 'Ya existe data para este mes.';
        } else {
          this.erroresCarga[tipo] = err.error?.detail ?? err.message ?? 'Error al subir el archivo.';
        }
      },
    });
  }

  confirmarReemplazo(): void {
    if (!this.tipoConflicto) return;
    const t = this.tipoConflicto;
    this.tipoConflicto = null;
    this.subirArchivo(t, true);
  }

  cancelarReemplazo(): void { this.tipoConflicto = null; }

  verProductos(): void { this.vistaActual = 'productos'; this.cargarProductos(); }

  cargarProductos(): void {
    this.cargandoProductos = true;
    let url = `${environment.apiUrl}/trade-spend/periodos/${this.agenciaProductos}/${this.anioSeleccionado}/${this.mesSeleccionado}/precios`;
    if (this.filtroNegocio) url += `?negocio=${encodeURIComponent(this.filtroNegocio)}`;
    this.http.get<{ productos: PrecioProducto[] }>(url).subscribe({
      next:  r  => { this.productos = r.productos; this.cargandoProductos = false; },
      error: () => { this.cargandoProductos = false; },
    });
  }

  // ── Chess Sync ────────────────────────────────────────────────────────────

  listarArchivosOneDrive(): void {
    this.cargandoArchivos   = true;
    this.archivosOneDrive   = [];
    this.archivoSeleccionado = null;
    this.resultadoSync      = null;
    this.errorSync          = null;

    this.http.get<{ estado: string; archivos: any[] }>(
      `${environment.apiUrl}/trade-spend/chess-listar`
    ).subscribe({
      next: res => {
        this.archivosOneDrive = res.archivos ?? [];
        this.cargandoArchivos = false;
      },
      error: err => {
        this.errorSync        = err.error?.detalle ?? 'Error al conectar con OneDrive';
        this.cargandoArchivos = false;
      },
    });
  }

  seleccionarArchivo(nombre: string): void {
    this.archivoSeleccionado = nombre;
    this.resultadoSync       = null;
    this.errorSync           = null;
  }

  sincronizarChess(): void {
    if (!this.archivoSeleccionado) return;
    this.sincronizando = true;
    this.resultadoSync = null;
    this.errorSync     = null;

    const url = `${environment.apiUrl}/trade-spend/chess-sync?filename=${encodeURIComponent(this.archivoSeleccionado)}`;
    this.http.post<any>(url, {}).subscribe({
      next: res => {
        this.resultadoSync = res;
        this.sincronizando = false;
        // Actualizar estado del periodo si insertó filas
        if (res.total_insertados > 0) {
          this.estadoCHM.chess_base = true;
          this.estadoHRZ.chess_base = true;
        }
      },
      error: err => {
        this.errorSync     = err.error?.detalle ?? err.message ?? 'Error al sincronizar';
        this.sincronizando = false;
      },
    });
  }

  formatModificado(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Historial ──────────────────────────────────────────────────────────────

  verHistorial(): void {
    this.vistaActual = 'historial';
    this.cargandoHistorial = true;
    this.http.get<CargaLog[]>(`${environment.apiUrl}/trade-spend/cargas/`).subscribe({
      next:  d  => { this.historial = d; this.cargandoHistorial = false; },
      error: () => { this.cargandoHistorial = false; },
    });
  }

  // ── Getters de vista ───────────────────────────────────────────────────────

  get periodoLabel(): string { return `${MESES_LABELS[this.mesSeleccionado]} ${this.anioSeleccionado}`; }
  get productosConDiferencia(): number { return this.productos.filter(p => p.tiene_diferencia).length; }
  get todoCargado(): boolean { return this.estadoCHM.precios && this.estadoCHM.politica; }

  estadoPaso(tipo: TipoArchivo): 'ok' | 'activo' | 'pendiente' {
    if (this.estadoCHM[tipo] || this.resultados[tipo]) return 'ok';
    if (this.pasos.find(p => p.tipo === tipo)?.numero === this.pasoActivo) return 'activo';
    return 'pendiente';
  }

  badgeTipo(tipo: string): string {
    return ({ precios: 'badge-blue', politica: 'badge-boni', chess_base: 'badge-sin' } as any)[tipo] ?? 'badge-sin';
  }
  badgeEstadoCarga(e: string): string { return e === 'ok' ? 'badge-pos' : e === 'error' ? 'badge-neg' : 'badge-sin'; }
  labelEstadoCarga(e: string): string { return ({ ok: 'OK', error: 'Error', procesando: '…' } as any)[e] ?? e; }
  labelTipo(t: string): string { return ({ precios: 'Tabla de precios', politica: 'Política comercial', chess_base: 'Chess Base' } as any)[t] ?? t; }
  formatFecha(iso: string): string { return iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  formatNum(n: number): string { return n?.toLocaleString('es-PE') ?? '0'; }

  private _actualizarPaso(): void {
    for (const p of this.pasos) {
      if (!this.estadoCHM[p.tipo] && !this.resultados[p.tipo]) { this.pasoActivo = p.numero; return; }
    }
    this.pasoActivo = 4; // completo
  }
}