import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const API = environment.apiUrl;

const IDS_AUTO = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10]);
const IDS_PROSEGUR_AUTO = new Set([13, 14, 15, 16]);
const IDS_VENTAS_CONTADO_AUTO = new Set([28, 29, 30, 31, 32, 33, 34]);

const BANCO_KEY: Record<number, string> = {
  2: 'BCP LN', 3: 'BCP TRU', 4: 'BCP SEDES', 5: 'BCP',
  6: 'INTERBANK', 7: 'BBVA', 8: 'CAJA AREQUIPA', 9: 'PICHINCHA', 10: 'BNACION',
};
const IDS_USD = new Set([54]);
const VALORES_DEFAULT: Record<number, number> = {
  51: 567027.27,
  54: 366400.00
};

interface Concepto {
  id: number;
  nombre: string;
  seccion: string;
  tipo_fila: string;
  indent: number;
  orden: number;
}

interface Columna {
  fecha: string;
  label: string;
  guardado: boolean;
}

interface ProsegurResult {
  estado: string;
  total_puno?: number;
  total_huaraz?: number;
  total_trujillo?: number;
  total_ingresos_dia?: number;
  sedes?: {
    puno_billetes?: { total: number };
    lima_olivos?: { total: number };
    chimbote?: { total: number };
  };
  [key: string]: any;
}

@Component({
  selector: 'app-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ingresos.component.html',
  styleUrls: ['./ingresos.component.css'],
})
export class IngresosComponent implements OnInit {

  conceptos: Concepto[] = [];
  columnas: Columna[] = [];
  datos: Record<number, Record<string, number | null>> = {};

  mostrarPanel = false;
  nuevaFecha = '';
  fechaExistente = false;
  cargandoFecha = false;
  calculandoBancos = false;
  calculandoProsegur = false;
  calculandoVentasContado = false;
  bancosCalculados: Record<string, number> = {};
  guardandoFecha = false;

  cargando = true;
  error = '';

  editandoCelda: { concepto_id: number; fecha: string } | null = null;
  valorEditando = '';

  valoresManualesPanel: Record<number, number | null> = {};
  tipoCambio = 0;
  readonly IDS_USD = IDS_USD;
  readonly BANCO_KEY = BANCO_KEY;

  sincronizando = false;
  syncMensaje = '';
  syncTipo: 'ok' | 'info' | '' = '';

  saldosUsdOriginal: Record<number, number> = {};
  ibkUsdSoles = 0;
  ibkUsdOriginal = 0;
  filtroDesde = '';
  filtroHasta = '';
  private readonly IDS_SUBCUENTAS_BCP = new Set([2, 3, 4]);
  readonly IDS_SNACKS_ING = new Set([20, 29, 40]);

  prosegurDetalle: {
    punoBilletes: number | null;
    limaOlivos: number | null;
    chimbote: number | null;
    ingresos_dia: number | null;
    error?: string;
  } = { punoBilletes: null, limaOlivos: null, chimbote: null, ingresos_dia: null };

  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) { }

  ngOnInit() { this.cargarConceptos(); }

  cargarConceptos() {
    this.cargando = true;
    this.http.get<any>(`${API}/wk/ingresos-conceptos`).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.conceptos = r.conceptos;
          this.buildManualesAgrupados();
          this.cargarDatos();
        } else {
          this.cargando = false;
          this.error = 'Error al cargar conceptos';
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar conceptos'; }
    });
  }

  cargarDatos() {
    this.http.get<any>(`${API}/wk/ingresos-datos`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          const fechasSet = new Set<string>();
          for (const d of r.datos) fechasSet.add(d.fecha_corte);
          this.columnas = Array.from(fechasSet).sort().map(f => ({
            fecha: f, label: this.formatFechaCorta(f), guardado: true,
          }));
          this.datos = {};
          for (const d of r.datos) {
            if (!this.datos[d.concepto_id]) this.datos[d.concepto_id] = {};
            this.datos[d.concepto_id][d.fecha_corte] = d.valor;
          }
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar datos'; }
    });
  }

  get columnasFiltradas(): Columna[] {
    if (!this.filtroDesde && !this.filtroHasta) return this.columnas;
    return this.columnas.filter(col => {
      const ok1 = !this.filtroDesde || col.fecha >= this.filtroDesde;
      const ok2 = !this.filtroHasta || col.fecha <= this.filtroHasta;
      return ok1 && ok2;
    });
  }

  exportar() {
    if (!this.columnasFiltradas.length) return;
    const fechas = this.columnasFiltradas.map(c => c.fecha).join(',');
    window.open(`${API}/exportar/ingresos?fechas=${fechas}`, '_blank');
  }

  get conceptosBancoAuto(): Concepto[] {
    return this.conceptos.filter(c => IDS_AUTO.has(c.id));
  }

  get conceptosProsegurAuto(): Concepto[] {
    return this.conceptos.filter(c => IDS_PROSEGUR_AUTO.has(c.id));
  }

  get conceptosVentasContadoAuto(): Concepto[] {
    return this.conceptos.filter(c => IDS_VENTAS_CONTADO_AUTO.has(c.id));
  }

  get conceptosManuales(): Concepto[] {
    return this.conceptos.filter(c =>
      !IDS_AUTO.has(c.id) &&
      !IDS_PROSEGUR_AUTO.has(c.id) &&
      !IDS_VENTAS_CONTADO_AUTO.has(c.id) &&
      c.tipo_fila !== 'seccion' &&
      c.tipo_fila !== 'total'
    );
  }

  editandoBancoId: number | null = null;

fmtBancoPanel(concepto_id: number): string {
  const key = BANCO_KEY[concepto_id];
  const v = key ? (this.bancosCalculados[key] ?? null) : null;
  if (v === null || v === undefined || isNaN(v)) return '';
  if (this.editandoBancoId === concepto_id) return v.toString();
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

setValorBancoPanel(concepto_id: number, val: string) {
  const key = BANCO_KEY[concepto_id];
  if (!key) return;
  const clean = val.replace(/[^0-9.]/g, '');
  this.bancosCalculados[key] = clean === '' ? 0 : parseFloat(clean);
}

onFocusBancoPanel(concepto_id: number, event: FocusEvent) {
  this.editandoBancoId = concepto_id;
  const key = BANCO_KEY[concepto_id];
  const v = key ? (this.bancosCalculados[key] ?? null) : null;
  const input = event.target as HTMLInputElement;
  input.value = v !== null && v !== undefined ? v.toString() : '';
  setTimeout(() => input.select(), 0);
}

onBlurBancoPanel(concepto_id: number, event: FocusEvent) {
  this.editandoBancoId = null;
  const key = BANCO_KEY[concepto_id];
  const v = key ? (this.bancosCalculados[key] ?? null) : null;
  const input = event.target as HTMLInputElement;
  input.value = v !== null && v !== undefined && !isNaN(v)
    ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
}
  abrirPanel() {
    this.mostrarPanel = true;
    this.nuevaFecha = '';
    this.fechaExistente = false;
    this.cargandoFecha = false;
    this.bancosCalculados = {};
    this.prosegurDetalle = { punoBilletes: null, limaOlivos: null, chimbote: null, ingresos_dia: null };
    this.valoresManualesPanel = { ...VALORES_DEFAULT };
  }

  cerrarPanel() { this.mostrarPanel = false; }

  onFechaChange() {
    if (!this.nuevaFecha) return;
    this.cargandoFecha = true;
    this.fechaExistente = false;
    this.bancosCalculados = {};
    this.prosegurDetalle = { punoBilletes: null, limaOlivos: null, chimbote: null, ingresos_dia: null };
    this.valoresManualesPanel = { ...VALORES_DEFAULT };

    this.http.get<any>(`${API}/wk/ingresos-datos?fecha_corte=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.cargandoFecha = false;
        if (r.estado === 'OK' && r.datos && Object.keys(r.datos).length > 0) {
          this.fechaExistente = true;
          for (const [idStr, valor] of Object.entries(r.datos)) {
            const id = parseInt(idStr);
            const key = BANCO_KEY[id];
            if (key) {
              this.bancosCalculados[key] = valor as number;
            } else if (IDS_PROSEGUR_AUTO.has(id)) {
              this._setProsegurById(id, valor as number);
            } else {
              this.valoresManualesPanel[id] = valor as number;
            }
          }
          // Al editar fecha existente, recalcular ingresos_dia para obtener el desglose de sedes
          this.calcularIngresosdiaSedes();
        } else {
          this.calcularBancos();
          this.calcularProsegur();
          this.calcularVentasContado();
        }
      },
      error: () => {
        this.cargandoFecha = false;
        this.calcularBancos();
        this.calcularProsegur();
        this.calcularVentasContado();
      }
    });
  }

  calcularBancos() {
    if (!this.nuevaFecha) return;
    this.calculandoBancos = true;
    this.bancosCalculados = {};
    this.saldosUsdOriginal = {};

    this.http.get<any>(`${API}/wk/calcular-bancos?fecha=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.calculandoBancos = false;
        if (r.estado === 'OK') {
          this.tipoCambio = r.tipo_cambio || 0;
          this.bancosCalculados = r.bancos;
          const ibkUsdSoles = r.bancos['INTERBANK USD'] || 0;
          this.ibkUsdSoles = ibkUsdSoles;
          this.ibkUsdOriginal = this.tipoCambio > 0
            ? Math.round((ibkUsdSoles / this.tipoCambio) * 100) / 100
            : 0;
          this.bancosCalculados['INTERBANK'] = (r.bancos['INTERBANK'] || 0) + ibkUsdSoles;
        }
      },
      error: () => { this.calculandoBancos = false; }
    });
  }

  // Llama solo al endpoint de ingresos_dia para refrescar el desglose de sedes
  // sin tocar los valores de PUNO/HUARAZ/TRUJILLO ya cargados desde BD
  calcularIngresosdiaSedes() {
    if (!this.nuevaFecha) return;
    this.http.get<ProsegurResult>(`${API}/wk/prosegur-ingresos-dia?fecha=${this.nuevaFecha}`)
      .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult)))
      .subscribe(r => {
        if (r.estado === 'OK') {
          const sedes = r.sedes;
          this.prosegurDetalle.punoBilletes = sedes?.puno_billetes?.total ?? null;
          this.prosegurDetalle.limaOlivos = sedes?.lima_olivos?.total ?? null;
          this.prosegurDetalle.chimbote = sedes?.chimbote?.total ?? null;
          this.prosegurDetalle.ingresos_dia = r.total_ingresos_dia ?? null;
        }
      });
  }

  calcularProsegur() {
    if (!this.nuevaFecha) return;
    this.calculandoProsegur = true;
    this.prosegurDetalle = { punoBilletes: null, limaOlivos: null, chimbote: null, ingresos_dia: null };

    forkJoin({
      puno: this.http.get<ProsegurResult>(`${API}/wk/prosegur-puno?fecha=${this.nuevaFecha}`)
        .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult))),
      huaraz: this.http.get<ProsegurResult>(`${API}/wk/prosegur-huaraz?fecha=${this.nuevaFecha}`)
        .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult))),
      trujillo: this.http.get<ProsegurResult>(`${API}/wk/prosegur-trujillo?fecha=${this.nuevaFecha}`)
        .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult))),
      ingresos_dia: this.http.get<ProsegurResult>(`${API}/wk/prosegur-ingresos-dia?fecha=${this.nuevaFecha}`)
        .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult))),
    }).subscribe(results => {
      this.calculandoProsegur = false;

      const puno = results.puno.estado === 'OK' ? (results.puno.total_puno ?? 0) : null;
      const huaraz = results.huaraz.estado === 'OK' ? (results.huaraz.total_huaraz ?? 0) : null;
      const trujillo = results.trujillo.estado === 'OK' ? (results.trujillo.total_trujillo ?? 0) : null;

      const ingresosDiaRes = results.ingresos_dia;
      const ingresos_dia = ingresosDiaRes.estado === 'OK' ? (ingresosDiaRes.total_ingresos_dia ?? 0) : null;

      // Desglose de sedes viene del propio endpoint ingresos_dia, no de puno/huaraz/trujillo
      const sedes = ingresosDiaRes.sedes;
      this.prosegurDetalle = {
        punoBilletes: sedes?.puno_billetes?.total ?? null,
        limaOlivos: sedes?.lima_olivos?.total ?? null,
        chimbote: sedes?.chimbote?.total ?? null,
        ingresos_dia,
      };

      this.valoresManualesPanel[13] = puno;
      this.valoresManualesPanel[14] = huaraz;
      this.valoresManualesPanel[15] = trujillo;
      this.valoresManualesPanel[16] = ingresos_dia;
    });
  }

  calcularVentasContado() {
    if (!this.nuevaFecha) return;
    this.calculandoVentasContado = true;
    this.http.get<any>(`${API}/wk/ventas-contado-powerbi?fecha=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.calculandoVentasContado = false;
        if (r.estado === 'OK') {
          for (const [idStr, valor] of Object.entries(r.ventas)) {
            this.valoresManualesPanel[parseInt(idStr)] = valor as number;
          }
        }
      },
      error: () => { this.calculandoVentasContado = false; }
    });
  }

  private _setProsegurById(id: number, valor: number) {
    // Solo actualiza el valor del panel (lo que se guarda en BD)
    // El desglose de sedes (punoBilletes/limaOlivos/chimbote) se obtiene
    // via calcularIngresosdiaSedes(), no desde BD
    if (id === 16) this.prosegurDetalle.ingresos_dia = valor;
    this.valoresManualesPanel[id] = valor;
  }

  valorBancoCalculado(concepto_id: number): number {
    const key = BANCO_KEY[concepto_id];
    return key ? (this.bancosCalculados[key] || 0) : 0;
  }

  valorProsegurCalculado(concepto_id: number): number | null {
    if (concepto_id === 13) return this.valoresManualesPanel[13] ?? null;
    if (concepto_id === 14) return this.valoresManualesPanel[14] ?? null;
    if (concepto_id === 15) return this.valoresManualesPanel[15] ?? null;
    if (concepto_id === 16) return this.prosegurDetalle.ingresos_dia;
    return null;
  }

  editandoManualId: number | null = null;

  fmtPanel(concepto_id: number): string {
    const v = this.valoresManualesPanel[concepto_id];
    if (v === null || v === undefined || isNaN(v)) return '';
    if (this.editandoManualId === concepto_id) return v.toString();
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  setValorManualPanel(concepto_id: number, val: string) {
    const clean = val.replace(/[^0-9.]/g, '');
    this.valoresManualesPanel[concepto_id] = clean === '' ? null : parseFloat(clean);
  }

  onFocusManualPanel(concepto_id: number, event: FocusEvent) {
    this.editandoManualId = concepto_id;
    const v = this.valoresManualesPanel[concepto_id];
    const input = event.target as HTMLInputElement;
    input.value = v !== null && v !== undefined ? v.toString() : '';
    setTimeout(() => input.select(), 0);
  }

  onBlurManualPanel(concepto_id: number, event: FocusEvent) {
    this.editandoManualId = null;
    const input = event.target as HTMLInputElement;
    const v = this.valoresManualesPanel[concepto_id];
    input.value = v !== null && v !== undefined && !isNaN(v)
      ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
  }

  manualesAgrupados: [string, Concepto[]][] = [];

  private buildManualesAgrupados() {
    const grupos: Record<string, Concepto[]> = {};
    this.conceptos.forEach(c => {
      if (this.esItem(c) && !this.esAuto(c) && !IDS_PROSEGUR_AUTO.has(c.id) && !IDS_VENTAS_CONTADO_AUTO.has(c.id)) {
        if (!grupos[c.seccion]) grupos[c.seccion] = [];
        grupos[c.seccion].push(c);
      }
    });
    this.manualesAgrupados = Object.entries(grupos);
  }

  guardarFecha() {
    if (!this.nuevaFecha) return;
    this.guardandoFecha = true;
    const payload: { concepto_id: number; valor: number | null }[] = [];

    for (const c of this.conceptosBancoAuto)
      payload.push({ concepto_id: c.id, valor: this.valorBancoCalculado(c.id) });

    for (const c of this.conceptosProsegurAuto)
      payload.push({ concepto_id: c.id, valor: this.valoresManualesPanel[c.id] ?? null });

    for (const c of this.conceptosVentasContadoAuto)
      payload.push({ concepto_id: c.id, valor: this.valoresManualesPanel[c.id] ?? null });

    for (const c of this.conceptosManuales)
      payload.push({ concepto_id: c.id, valor: this.valoresManualesPanel[c.id] ?? null });

    this.http.post<any>(`${API}/wk/ingresos-guardar`, {
      fecha_corte: this.nuevaFecha, datos: payload
    }).subscribe({
      next: r => {
        this.guardandoFecha = false;
        if (r.estado === 'OK') {
          this.cerrarPanel();
          this.valoresManualesPanel = {};
          this.cargarDatos();
          this.wkRefresh.notificarIngresosGuardado(this.nuevaFecha);
        }
      },
      error: () => { this.guardandoFecha = false; }
    });
  }

  // ── Tabla ──────────────────────────────────────────────

  getValor(concepto_id: number, fecha: string): number | null {
    return this.datos[concepto_id]?.[fecha] ?? null;
  }

  getTotal(concepto: Concepto, fecha: string): number {
    const idx = this.conceptos.indexOf(concepto);
    let suma = 0;
    for (let i = idx - 1; i >= 0; i--) {
      const c = this.conceptos[i];
      if (c.tipo_fila === 'seccion') break;
      if (c.tipo_fila === 'item' && !this.IDS_SUBCUENTAS_BCP.has(c.id)) {
        suma += this.getValor(c.id, fecha) || 0;
      }
    }
    return suma;
  }

  esSeccion(c: Concepto) { return c.tipo_fila === 'seccion'; }
  esTotal(c: Concepto) { return c.tipo_fila === 'total'; }
  esItem(c: Concepto) { return c.tipo_fila === 'item'; }
  esAuto(c: Concepto) { return IDS_AUTO.has(c.id); }
  esProsegurAuto(c: Concepto) { return IDS_PROSEGUR_AUTO.has(c.id); }
  esVentasContadoAuto(c: Concepto) { return IDS_VENTAS_CONTADO_AUTO.has(c.id); }

  iniciarEdicion(concepto_id: number, fecha: string) {
    if (this.editandoCelda) this.confirmarEdicion();
    const v = this.getValor(concepto_id, fecha);
    this.editandoCelda = { concepto_id, fecha };
    this.valorEditando = v !== null ? v.toString() : '';
  }

  onClickTabla(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT') return;
    if (this.editandoCelda) this.confirmarEdicion();
  }

  confirmarEdicion() {
    if (!this.editandoCelda) return;
    const { concepto_id, fecha } = this.editandoCelda;
    const valor = this.valorEditando === '' ? null : parseFloat(this.valorEditando);
    if (!this.datos[concepto_id]) this.datos[concepto_id] = {};
    this.datos[concepto_id][fecha] = valor;
    this.editandoCelda = null;
    this.http.post<any>(`${API}/wk/ingresos-guardar`, {
      fecha_corte: fecha, datos: [{ concepto_id, valor }]
    }).subscribe();
  }

  cancelarEdicion() { this.editandoCelda = null; }

  esEditando(concepto_id: number, fecha: string): boolean {
    return this.editandoCelda?.concepto_id === concepto_id &&
      this.editandoCelda?.fecha === fecha;
  }

  formatFechaCorta(fecha: string): string {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const d = new Date(fecha + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${meses[d.getMonth()]}`;
  }

  fmt(n: number | null): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackById(_: number, c: Concepto) { return c.id; }
  trackByFecha(_: number, col: Columna) { return col.fecha; }

  sincronizarProsegur() {
    this.sincronizando = true;
    this.syncMensaje = '';
    this.http.post<any>(`${API}/wk/prosegur-sync`, {}).subscribe({
      next: r => {
        this.sincronizando = false;
        if (r.estado === 'OK') {
          const r1 = r.resultado?.anio_actual;
          const r2 = r.resultado?.anio_anterior;
          const total = (r1?.insertados || 0) + (r2?.insertados || 0);
          if (total > 0) {
            this.syncMensaje = `✓ ${total} filas nuevas agregadas`;
            this.syncTipo = 'ok';
          } else {
            this.syncMensaje = 'Sin filas nuevas — Está al día';
            this.syncTipo = 'info';
          }
        } else {
          this.syncMensaje = 'Error al sincronizar';
          this.syncTipo = 'info';
        }
        setTimeout(() => { this.syncMensaje = ''; this.syncTipo = ''; }, 4000);
      },
      error: () => {
        this.sincronizando = false;
        this.syncMensaje = 'Error al sincronizar';
        this.syncTipo = 'info';
        setTimeout(() => { this.syncMensaje = ''; }, 4000);
      }
    });
  }

  conceptoAplicaEnFecha(concepto_id: number, fecha: string): boolean {
    if (!fecha) return true;
    const esAbrilOmas = fecha >= '2026-04-01';
    if (this.IDS_SNACKS_ING.has(concepto_id) && esAbrilOmas) return false;
    return true;
  }

  mostrarFila(concepto_id: number): boolean {
    if (!this.IDS_SNACKS_ING.has(concepto_id)) return true;
    return this.columnasFiltradas.some(col => this.conceptoAplicaEnFecha(concepto_id, col.fecha));
  }

  get kpisIng() {
    const ID_BCP = 5, ID_INTERBANK = 6, ID_BBVA = 7,
      ID_CAJA_ARQ = 8, ID_PICHINCHA = 9, ID_BNACION = 10;

    const totalBancos = this.columnasFiltradas.reduce((acc, col) =>
      acc + [ID_BCP, ID_INTERBANK, ID_BBVA, ID_CAJA_ARQ, ID_PICHINCHA, ID_BNACION]
        .reduce((s, id) => s + (this.getValor(id, col.fecha) || 0), 0), 0);

    const totalSeccion = (nombreSeccion: string) =>
      this.columnasFiltradas.reduce((acc, col) => {
        const totalConcepto = this.conceptos.find(
          x => x.tipo_fila === 'total' && x.seccion === nombreSeccion
        );
        return acc + (totalConcepto ? this.getTotal(totalConcepto, col.fecha) : 0);
      }, 0);

    return {
      totalBancos,
      totalProsegur: totalSeccion('PROSEGUR'),
      ventasContado: totalSeccion('VENTAS CONTADO REPARTO'),
      ventasCredito: totalSeccion('VENTAS CRÉDITO 3-10 DÍAS'),
    };
  }

  mostrarModalEliminar = false;
  fechaAEliminar = '';
  eliminando = false;

  confirmarEliminar(fecha: string) {
    this.fechaAEliminar = fecha;
    this.mostrarModalEliminar = true;
  }

  cancelarEliminar() {
    this.mostrarModalEliminar = false;
    this.fechaAEliminar = '';
  }

  eliminarFecha() {
    if (!this.fechaAEliminar) return;
    this.eliminando = true;
    this.http.delete<any>(`${API}/wk/ingresos-eliminar/${this.fechaAEliminar}`).subscribe({
      next: r => {
        this.eliminando = false;
        if (r.estado === 'OK') {
          this.mostrarModalEliminar = false;
          this.fechaAEliminar = '';
          this.cargarDatos();
        }
      },
      error: () => { this.eliminando = false; }
    });
  }



  // ── VARIACIÓN ──────────────────────────────────────────
  mostrarVariacion = false;
  varFecha1 = '';
  varFecha2 = '';

  abrirVariacion() {
    this.mostrarVariacion = true;
    // Pre-seleccionar las últimas 2 fechas si existen
    if (this.columnas.length >= 2) {
      this.varFecha1 = this.columnas[this.columnas.length - 2].fecha;
      this.varFecha2 = this.columnas[this.columnas.length - 1].fecha;
    } else if (this.columnas.length === 1) {
      this.varFecha1 = this.columnas[0].fecha;
      this.varFecha2 = '';
    }
  }

  cerrarVariacion() { this.mostrarVariacion = false; }

  get filasVariacion() {
    if (!this.varFecha1 || !this.varFecha2) return [];
    return this.conceptos
      .filter(c => c.tipo_fila === 'item' || c.tipo_fila === 'total')
      .map(c => {
        const v1 = c.tipo_fila === 'total'
          ? this.getTotal(c, this.varFecha1)
          : (this.getValor(c.id, this.varFecha1) ?? 0);
        const v2 = c.tipo_fila === 'total'
          ? this.getTotal(c, this.varFecha2)
          : (this.getValor(c.id, this.varFecha2) ?? 0);
        const diff = v2 - v1;
        const pct = v1 !== 0 ? (diff / Math.abs(v1)) * 100 : null;
        return { concepto: c, v1, v2, diff, pct };
      });
  }

  get seccionesVariacion(): string[] {
    const secciones = new Set<string>();
    this.conceptos
      .filter(c => c.tipo_fila === 'item' || c.tipo_fila === 'total')
      .forEach(c => secciones.add(c.seccion));
    return Array.from(secciones);
  }

  filasDeSeccion(seccion: string) {
    return this.filasVariacion.filter(f => f.concepto.seccion === seccion);
  }

  labelFecha(fecha: string): string {
    return this.columnas.find(c => c.fecha === fecha)?.label ?? fecha;
  }

  // ── COLAPSABLES ───────────────────────────────────────
seccionesColapsadas = new Set<string>();

toggleSeccion(seccion: string) {
  if (this.seccionesColapsadas.has(seccion)) {
    this.seccionesColapsadas.delete(seccion);
  } else {
    this.seccionesColapsadas.add(seccion);
  }
}

estaColapsada(seccion: string): boolean {
  return this.seccionesColapsadas.has(seccion);
}
}