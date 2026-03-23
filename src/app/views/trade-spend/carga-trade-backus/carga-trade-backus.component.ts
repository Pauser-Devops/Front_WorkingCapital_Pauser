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

export interface ResultadoSync {
  archivo: string;
  estado: string;
  anio?: number;
  mes?: number;
  total_insertados?: number;
  max_row_previo?: number;
  max_row_nuevo?: number;
  total_excel?: number;
  detalle?: string;
}

export interface PeriodoBD {
  agencia: string;
  anio: number;
  mes: number;
  total_filas: number;
  ultima_fila: number;
  ultimo_sync: string;
}

export interface HistorialItem {
  archivo: string;
  periodo: string;
  insertadas: number;
  omitidas: number;
  estado: string;
  fecha_carga: string;
}

const MESES_LABELS: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

type VistaActual = 'listar' | 'estado' | 'historial';

@Component({
  selector: 'app-carga-trade-backus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carga-trade-backus.component.html',
  styleUrls: ['./carga-trade-backus.component.css'],
})
export class CargaTradeBackusComponent implements OnInit {

  vistaActual: VistaActual = 'listar';

  // ── Lista archivos OneDrive ───────────────────────────────────────────────
  archivos: ArchivoOneDrive[] = [];
  cargandoArchivos = false;
  errorListado: string | null = null;
  archivoSeleccionado: ArchivoOneDrive | null = null;
  busqueda = '';

  private _norm(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  get archivosFiltrados(): ArchivoOneDrive[] {
    if (!this.busqueda.trim()) return this.archivos;
    const q = this._norm(this.busqueda);
    return this.archivos.filter(a => this._norm(a.nombre).includes(q));
  }

  get mensajeVacio(): string {
    if (this.busqueda.trim() && this.archivosFiltrados.length === 0) {
      return 'Sin resultados para "' + this.busqueda.trim() + '"';
    }
    return 'No se encontraron archivos .xlsx en la carpeta configurada.';
  }

  // ── Sync ─────────────────────────────────────────────────────────────────
  sincronizando = false;
  progreso = 0;
  intervaloProgreso: any = null;
  resultadoSync: ResultadoSync | null = null;
  errorSync: string | null = null;

  // ── Estado BD ─────────────────────────────────────────────────────────────
  periodos: PeriodoBD[] = [];
  cargandoPeriodos = false;
  totalRegistros = 0;

  // ── Historial ─────────────────────────────────────────────────────────────
  historial: HistorialItem[] = [];
  cargandoHistorial = false;

  readonly mesesLabels = MESES_LABELS;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.listarArchivos();
  }

  // ── Vista ─────────────────────────────────────────────────────────────────

  cambiarVista(vista: VistaActual): void {
    this.vistaActual = vista;
    if (vista === 'estado' && this.periodos.length === 0) this.cargarEstado();
    if (vista === 'historial' && this.historial.length === 0) this.cargarHistorial();
  }

  // ── Listar archivos ───────────────────────────────────────────────────────

  listarArchivos(): void {
    this.cargandoArchivos = true;
    this.errorListado = null;
    this.archivos = [];
    this.archivoSeleccionado = null;
    this.resultadoSync = null;
    this.errorSync = null;

    this.http
      .get<{ estado: string; archivos: ArchivoOneDrive[] }>(
        `${environment.apiUrl}/trade-spend/backus-listar`
      )
      .subscribe({
        next: res => {
          this.archivos = res.archivos ?? [];
          // El backend ya devuelve ordenado por modificado desc,
          // pero lo reforzamos en el cliente por si acaso
          this.archivos.sort(
            (a, b) =>
              new Date(b.modificado).getTime() - new Date(a.modificado).getTime()
          );
          this.cargandoArchivos = false;
          // Pre-seleccionar el más reciente
          if (this.archivos.length > 0) {
            this.archivoSeleccionado = this.archivos[0];
          }
        },
        error: err => {
          this.errorListado =
            err.error?.detalle ?? err.message ?? 'Error al conectar con OneDrive';
          this.cargandoArchivos = false;
        },
      });
  }

  seleccionar(archivo: ArchivoOneDrive): void {
    this.archivoSeleccionado = archivo;
    this.resultadoSync = null;
    this.errorSync = null;
  }

  esMasReciente(archivo: ArchivoOneDrive): boolean {
    return this.archivos.length > 0 && this.archivos[0].nombre === archivo.nombre;
  }

  // ── Sync ─────────────────────────────────────────────────────────────────

  sincronizar(): void {
    if (!this.archivoSeleccionado || this.sincronizando) return;

    this.sincronizando = true;
    this.progreso = 0;
    this.resultadoSync = null;
    this.errorSync = null;

    // Progreso simulado hasta 85% mientras espera la respuesta
    this.intervaloProgreso = setInterval(() => {
      if (this.progreso < 85) {
        this.progreso += Math.random() * 12 + 4;
        if (this.progreso > 85) this.progreso = 85;
      }
    }, 250);

    const url = `${environment.apiUrl}/trade-spend/backus-sync?filename=${encodeURIComponent(
      this.archivoSeleccionado.nombre
    )}`;

    this.http.post<ResultadoSync>(url, {}).subscribe({
      next: res => {
        this._detenerProgreso();
        this.resultadoSync = res;
        this.sincronizando = false;
        // Refrescar periodos si estaban cargados
        if (this.periodos.length > 0) this.cargarEstado();
        // Agregar al historial local si estaba cargado
        if (this.historial.length > 0) this._agregarAlHistorial(res);
      },
      error: err => {
        this._detenerProgreso();
        this.errorSync =
          err.error?.detalle ?? err.message ?? 'Error al sincronizar';
        this.sincronizando = false;
      },
    });
  }

  private _detenerProgreso(): void {
    clearInterval(this.intervaloProgreso);
    this.progreso = 100;
    setTimeout(() => { this.progreso = 0; }, 600);
  }

  private _agregarAlHistorial(res: ResultadoSync): void {
    const mes = res.mes ? MESES_LABELS[res.mes] : '—';
    this.historial.unshift({
      archivo:     res.archivo,
      periodo:     res.mes && res.anio ? `${mes} ${res.anio}` : '—',
      insertadas:  res.total_insertados ?? 0,
      omitidas:    (res.total_excel ?? 0) - (res.total_insertados ?? 0),
      estado:      res.estado,
      fecha_carga: new Date().toISOString(),
    });
  }

  // ── Estado BD ─────────────────────────────────────────────────────────────

  cargarEstado(): void {
    this.cargandoPeriodos = true;
    this.http
      .get<{ estado: string; resumen: PeriodoBD[] }>(
        `${environment.apiUrl}/trade-spend/backus-estado`
      )
      .subscribe({
        next: res => {
          this.periodos = res.resumen ?? [];
          this.totalRegistros = this.periodos.reduce(
            (s, p) => s + (p.total_filas ?? 0), 0
          );
          this.cargandoPeriodos = false;
        },
        error: () => { this.cargandoPeriodos = false; },
      });
  }

  // ── Historial ─────────────────────────────────────────────────────────────

  cargarHistorial(): void {
    // El backend de chess_sync tiene /chess-estado. Para Backus se puede
    // agregar un endpoint /backus-historial en el futuro; por ahora
    // usamos los datos que se construyen localmente tras cada sync,
    // o se puede apuntar a una tabla de logs si la tienes.
    this.cargandoHistorial = true;
    this.http
      .get<HistorialItem[]>(`${environment.apiUrl}/trade-spend/backus-historial`)
      .subscribe({
        next:  d  => { this.historial = d ?? []; this.cargandoHistorial = false; },
        error: () => { this.historial = []; this.cargandoHistorial = false; },
      });
  }

  // ── Helpers de template ───────────────────────────────────────────────────

  mesLabel(mes: number): string {
    return MESES_LABELS[mes] ?? String(mes);
  }

  formatFecha(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatNum(n: number): string {
    return (n ?? 0).toLocaleString('es-PE');
  }

  get omitidas(): number {
    if (!this.resultadoSync) return 0;
    return (this.resultadoSync.total_excel ?? 0) -
           (this.resultadoSync.total_insertados ?? 0);
  }

  get syncExitoso(): boolean {
    return this.resultadoSync?.estado === 'ok' ||
           this.resultadoSync?.estado === 'sin_cambios';
  }

  get labelEstado(): string {
    const e = this.resultadoSync?.estado;
    if (e === 'ok')               return 'Carga completada';
    if (e === 'sin_cambios')      return 'Sin cambios — ya estaba cargado';
    if (e === 'no_encontrado')    return 'Archivo no encontrado en OneDrive';
    if (e === 'error_lectura')    return 'Error al leer el archivo';
    if (e === 'sin_filas_validas')return 'El archivo no tiene filas válidas';
    if (e === 'error_nombre')     return 'No se pudo deducir mes/año del nombre';
    return e ?? '—';
  }
}