import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';

const API = environment.apiUrl;

// ── IDs ───────────────────────────────────────────────
const ID_BACKUS = 7;
const ID_FACTURAS = 8;
const ID_ENVASES = 9;
const ID_SALARIOS = 19;
const ID_MOVILIDADES = 20;
const ID_PROV_CTS = 21;
const ID_PROV_GRAT = 22;
// IMPUESTOS
const ID_IMP_ITAN = 33;
const ID_IMP_IGV = 34;
const ID_IMP_RENTA = 35;
const ID_IMP_PERCEPCIONES = 36;
const ID_IMP_ESSALUD = 37;
const ID_IMP_AFP = 38;
// IMP TOTAL = 39

const ID_QUALA = 102;
const ID_HOMEPERU = 101;
const ID_PAPELERA = 103;
const ID_SOFTCAR = 104;

// RENTA
const ID_VENTA_MES_CERRADO = 41;
const ID_VENTA_MES_CURSO = 42;
const ID_TOTAL_VENTAS = 43;
const ID_COMPRAS_MES_CERRADO = 44;
const ID_COMPRAS_MES_CURSO = 45;
const ID_TOTAL_COMPRAS = 46;
const ID_IGV_VENTAS = 47;
const ID_IGV_COMPRAS = 48;
const ID_IGV_POR_PAGAR = 49;
const ID_RENTA_3RA = 50;
const ID_CRED_RTA = 51;
const ID_RENTA_PRELIQ = 52;
const ID_IGV_PRELIQ = 53;
const ID_ITAN_RENTA = 54;
const ID_PERCEPCIONES_RENTA = 55;
const ID_RTA_2DA = 56;
const ID_TOTAL_PAGAR = 57;
const ID_TRUJILLO = 100;
const IDS_CALCULADOS = new Set([
  ID_BACKUS,
  ID_TRUJILLO,
  ID_TOTAL_VENTAS, ID_TOTAL_COMPRAS,
  ID_IGV_VENTAS, ID_IGV_COMPRAS, ID_IGV_POR_PAGAR,
  ID_RENTA_PRELIQ, ID_IGV_PRELIQ,
  ID_TOTAL_PAGAR,
  33, 34, 35, 36
]);

// 21 y 22 eliminados — se calculan dinámicamente por fecha
const DEFAULTS_FIJOS: Record<number, number> = {
  15: 66528,        // Corporación San Francisco
  16: 22176,        // Representaciones San Santiago
  27: 130272.01,    // INTERBANK
  28: 37903.02,     // PICHINCHA
  29: 31368.71,     // BCP
  30: 19928.59,     // CONTRATO MUTUO
};

const MOVILIDADES_DEFAULT = 61000;
const SALARIO_BASE = 820000;

interface Concepto {
  id: number;
  nombre: string;
  tipo_fila: string;
  indent: number;
  orden: number;
  seccion: string;
}

interface Columna { fecha: string; label: string; }

@Component({
  selector: 'app-egresos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './egresos.component.html',
  styleUrls: ['./egresos.component.css'],
})
export class EgresosComponent implements OnInit {

  conceptos: Concepto[] = [];
  columnas: Columna[] = [];
  datos: Record<number, Record<string, number | null>> = {};

  mostrarPanel = false;
  nuevaFecha = '';
  fechaExistente = false;
  guardandoFecha = false;
  cargandoFecha = false;
  cargando = true;
  error = '';

  editandoCelda: { concepto_id: number; fecha: string } | null = null;
  valorEditando = '';

  valoresPanel: Record<number, number | null> = {};
  editandoPanelId: number | null = null;

  filtroDesde = '';
  filtroHasta = '';

  readonly IDS_CALCULADOS = IDS_CALCULADOS;
  readonly IDS_SNACKS = new Set([5]);

  // ── Tab activo ─────────────────────────────────────────────
  tabActivo: 'tabla' | 'provisiones' = 'tabla';

  // ── Sueldo base ────────────────────────────────────────────
  sueldoBase = 820000;
  sueldoBaseSaved = false;
  private sueldoBaseRaw = '820000';

  constructor(
    private http: HttpClient,
    private zone: NgZone,
    private wkRefresh: WkRefreshService
  ) { }

  ngOnInit() {
    this.cargarConceptos();
    this.cargarSueldoBase();
  }

  // ── Columnas filtradas ────────────────────────────────────
  get columnasFiltradas(): Columna[] {
    if (!this.filtroDesde && !this.filtroHasta) return this.columnas;
    return this.columnas.filter(col => {
      const ok1 = !this.filtroDesde || col.fecha >= this.filtroDesde;
      const ok2 = !this.filtroHasta || col.fecha <= this.filtroHasta;
      return ok1 && ok2;
    });
  }

  // ── Exportar ──────────────────────────────────────────────
  exportar() {
    if (!this.columnasFiltradas.length) return;
    const fechas = this.columnasFiltradas.map(c => c.fecha).join(',');
    window.open(`${API}/exportar/egresos?fechas=${fechas}`, '_blank');
  }

  // ── Parseo seguro sin conversión de timezone ──────────────
  private parseFechaUTC(fecha: string): Date {
    const [y, m, d] = fecha.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  // ── Días acumulados para provisiones ─────────────────────

  /**
   * Días desde el inicio del semestre de Gratificación hasta `fecha` (inclusivo).
   * Semestre Ene–Jun → inicio 1 Ene
   * Semestre Jul–Dic → inicio 1 Jul
   */
  diasGratAcumulados(fecha: string): number {
    const [y, m] = fecha.split('-').map(Number); // m es 1-based
    const inicioMes = m <= 6 ? 1 : 7;            // 1=Ene, 7=Jul
    const d = this.parseFechaUTC(fecha);
    const ini = new Date(Date.UTC(y, inicioMes - 1, 1));
    const diff = Math.round((d.getTime() - ini.getTime()) / 86400000) + 1;
    return Math.max(diff, 1);
  }

  /**
   * Días desde el inicio del semestre de CTS hasta `fecha` (inclusivo).
   * Semestre Nov–Abr → inicio 1 Nov (año anterior si Ene–Abr)
   * Semestre May–Oct → inicio 1 May
   */
  diasCtsAcumulados(fecha: string): number {
    const [y, m] = fecha.split('-').map(Number); // m es 1-based
    let iniYear: number;
    let iniMes: number; // 1-based

    if (m >= 11) {
      // Nov o Dic: inicio = 1 Nov de este año
      iniYear = y;
      iniMes = 11;
    } else if (m <= 4) {
      // Ene–Abr: inicio = 1 Nov del año anterior
      iniYear = y - 1;
      iniMes = 11;
    } else {
      // May–Oct: inicio = 1 May de este año
      iniYear = y;
      iniMes = 5;
    }

    const d = this.parseFechaUTC(fecha);
    const ini = new Date(Date.UTC(iniYear, iniMes - 1, 1));
    const diff = Math.round((d.getTime() - ini.getTime()) / 86400000) + 1;
    return Math.max(diff, 1);
  }

  /** Provisión Gratificación acumulada hasta la fecha */
  provGratAcumulada(fecha: string): number {
    return Math.round(this.gratDiario * this.diasGratAcumulados(fecha) * 100) / 100;
  }

  /** Provisión CTS acumulada hasta la fecha */
  provCtsAcumulada(fecha: string): number {
    return Math.round(this.ctsDiario * this.diasCtsAcumulados(fecha) * 100) / 100;
  }

  // ── Defaults ──────────────────────────────────────────────
  aplicarDefaults() {
    if (!this.nuevaFecha) return;
    const [, , dStr] = this.nuevaFecha.split('-');
    const dia = parseInt(dStr);

    const sueldo = this.sueldoBase || 0;
    this.valoresPanel[ID_SALARIOS] =
      Math.round((sueldo / 30) * dia * 100) / 100;
    // Movilidades SOLO si es día 5
    if (dia === 5) {
      this.valoresPanel[ID_MOVILIDADES] = MOVILIDADES_DEFAULT;
    }

    // Provisiones calculadas según fecha
    this.valoresPanel[ID_PROV_CTS] = this.provCtsAcumulada(this.nuevaFecha);
    this.valoresPanel[ID_PROV_GRAT] = this.provGratAcumulada(this.nuevaFecha);

    // Fijos (21 y 22 ya no están aquí)
    for (const [id, valor] of Object.entries(DEFAULTS_FIJOS)) {
      const numId = parseInt(id);
      if (this.valoresPanel[numId] == null) {
        this.valoresPanel[numId] = valor;
      }
    }
  }

  // ── Cálculos automáticos ──────────────────────────────────

  recalcularBackus() {
    const facturas = this.valoresPanel[ID_FACTURAS] ?? 0;
    const envases = this.valoresPanel[ID_ENVASES] ?? 0;
    this.valoresPanel[ID_BACKUS] = Math.round((facturas + envases) * 100) / 100;
  }

  recalcularTrujillo() {
    const quala = this.valoresPanel[ID_QUALA] ?? 0;
    const homePeru = this.valoresPanel[ID_HOMEPERU] ?? 0;
    const papelera = this.valoresPanel[ID_PAPELERA] ?? 0;
    const softcar = this.valoresPanel[ID_SOFTCAR] ?? 0;
    this.valoresPanel[ID_TRUJILLO] = Math.round((quala + homePeru + papelera + softcar) * 100) / 100;
  }

  recalcularRenta() {
    const v = (id: number) => this.valoresPanel[id] || 0;

    const ventaCerrado = v(ID_VENTA_MES_CERRADO);
    const ventaCurso = v(ID_VENTA_MES_CURSO);
    const comprasCerrado = v(ID_COMPRAS_MES_CERRADO);
    const comprasCurso = v(ID_COMPRAS_MES_CURSO);
    const credRta = v(ID_CRED_RTA);
    const itan = v(ID_ITAN_RENTA);
    const percepciones = v(ID_PERCEPCIONES_RENTA);
    const rta2da = v(ID_RTA_2DA);

    const totalVentas = ventaCerrado + ventaCurso;
    const totalCompras = comprasCerrado + comprasCurso;

    const igvVentas = totalVentas * 0.18;
    const igvCompras = totalCompras * 0.18;
    const igvPorPagar = igvVentas - igvCompras;

    const rentaPreliq = (totalVentas * 0.015) - credRta;
    const igvPreliq = igvPorPagar;
    const totalPagar = igvPreliq + rentaPreliq + itan + percepciones + rta2da;

    const r = (n: number) => Math.round(n * 100) / 100;
    this.valoresPanel[ID_TOTAL_VENTAS] = r(totalVentas);
    this.valoresPanel[ID_TOTAL_COMPRAS] = r(totalCompras);
    this.valoresPanel[ID_IGV_VENTAS] = r(igvVentas);
    this.valoresPanel[ID_IGV_COMPRAS] = r(igvCompras);
    this.valoresPanel[ID_IGV_POR_PAGAR] = r(igvPorPagar);
    this.valoresPanel[ID_RENTA_3RA] = 0.015;
    this.valoresPanel[ID_RENTA_PRELIQ] = r(rentaPreliq);
    this.valoresPanel[ID_IGV_PRELIQ] = r(igvPreliq);
    this.valoresPanel[ID_TOTAL_PAGAR] = r(totalPagar);

    // Autocompletar sección IMPUESTOS desde RENTA
    this.valoresPanel[34] = r(igvPorPagar);
    this.valoresPanel[33] = r(itan);
    this.valoresPanel[35] = r(rentaPreliq + rta2da);
    this.valoresPanel[36] = r(percepciones);
  }

  // ── Carga ─────────────────────────────────────────────────

  cargarConceptos() {
    this.cargando = true;
    this.http.get<any>(`${API}/egresos/conceptos`).subscribe({
      next: r => {
        if (r.estado === 'OK') { this.conceptos = r.conceptos; this.cargarDatos(); }
        else { this.cargando = false; this.error = 'Error al cargar conceptos'; }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar conceptos'; }
    });
  }

  cargarDatos() {
    this.http.get<any>(`${API}/egresos/datos`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          const fechasSet = new Set<string>();
          for (const d of r.datos) fechasSet.add(d.fecha_corte);
          this.columnas = Array.from(fechasSet).sort().map(f => ({
            fecha: f, label: this.formatFechaCorta(f)
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

  abrirPanel() {
    this.mostrarPanel = true;
    this.nuevaFecha = '';
    this.fechaExistente = false;
    this.valoresPanel = {};
  }

  cerrarPanel() { this.mostrarPanel = false; }

  onFechaChange() {
    if (!this.nuevaFecha) return;
    this.cargandoFecha = true;
    this.fechaExistente = false;
    this.valoresPanel = {};

    this.http.get<any>(`${API}/egresos/datos?fecha_corte=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.cargandoFecha = false;
        if (r.estado === 'OK' && r.fecha_existente) {
          // Fecha existente: cargar valores guardados
          this.fechaExistente = true;
          for (const d of r.datos) this.valoresPanel[d.concepto_id] = d.valor;
          this.recalcularBackus();
          this.recalcularTrujillo();
          this.recalcularRenta();
        } else {
          this.aplicarDefaults();
          this.recalcularProvisiones();
        }
      },
      error: () => { this.cargandoFecha = false; }
    });
  }

  setValorPanel(concepto_id: number, val: string) {
    const clean = val.replace(/[^0-9.]/g, '');
    const num = clean === '' ? null : parseFloat(clean);
    this.valoresPanel[concepto_id] = num;

    if (concepto_id === ID_FACTURAS || concepto_id === ID_ENVASES) {
      this.recalcularBackus();
    }
    if (concepto_id === ID_QUALA || concepto_id === ID_HOMEPERU || concepto_id === ID_PAPELERA || concepto_id === ID_SOFTCAR) {
      this.recalcularTrujillo();
    }
    const RENTA_INPUTS = [
      ID_VENTA_MES_CERRADO, ID_VENTA_MES_CURSO,
      ID_COMPRAS_MES_CERRADO, ID_COMPRAS_MES_CURSO,
      ID_CRED_RTA, ID_ITAN_RENTA, ID_PERCEPCIONES_RENTA, ID_RTA_2DA
    ];
    if (RENTA_INPUTS.includes(concepto_id)) {
      this.recalcularRenta();
    }
  }

  onInputFocus(e: FocusEvent, concepto_id: number) {
    this.editandoPanelId = concepto_id;
    const v = this.valoresPanel[concepto_id];
    const input = e.target as HTMLInputElement;
    input.value = v !== null && v !== undefined ? v.toString() : '';
    setTimeout(() => input.select(), 0);
  }

  onInputBlur(e: FocusEvent, concepto_id: number) {
    this.editandoPanelId = null;
    const v = this.valoresPanel[concepto_id];
    const input = e.target as HTMLInputElement;
    input.value = v !== null && v !== undefined && !isNaN(v)
      ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
  }

  fmtInput(concepto_id: number): string {
    const v = this.valoresPanel[concepto_id];
    if (v === null || v === undefined || isNaN(v)) return '';
    if (this.editandoPanelId === concepto_id) return v.toString();
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getValorPanel(concepto_id: number): number | null {
    return this.valoresPanel[concepto_id] ?? null;
  }

  guardarFecha() {
    if (!this.nuevaFecha) return;
    this.guardandoFecha = true;

    this.recalcularRenta();
    this.recalcularBackus();

    const todosLosIds = this.conceptos.filter(c =>
      c.tipo_fila === 'item' || c.tipo_fila === 'subitem' || c.tipo_fila === 'total'
    );
    const payload = todosLosIds.map(c => ({
      concepto_id: c.id,
      valor: this.valoresPanel[c.id] ?? null
    }));

    this.http.post<any>(`${API}/egresos/guardar`, {
      fecha_corte: this.nuevaFecha,
      datos: payload
    }).subscribe({
      next: r => {
        this.guardandoFecha = false;
        if (r.estado === 'OK') {
          this.cerrarPanel();
          this.valoresPanel = {};
          this.cargarDatos();
          this.wkRefresh.notificarEgresosGuardado(this.nuevaFecha);
        }
      },
      error: () => { this.guardandoFecha = false; }
    });
  }

  // ── Tabla ─────────────────────────────────────────────────

  getValor(concepto_id: number, fecha: string): number | null {
    return this.datos[concepto_id]?.[fecha] ?? null;
  }

  getTotal(concepto: Concepto, fecha: string): number {
    const valorGuardado = this.getValor(concepto.id, fecha);
    if (valorGuardado !== null) return valorGuardado;

    const idx = this.conceptos.indexOf(concepto);
    let suma = 0;
    for (let i = idx - 1; i >= 0; i--) {
      const c = this.conceptos[i];
      if (c.tipo_fila === 'seccion') break;
      if (c.tipo_fila === 'total') break;
      if (c.tipo_fila === 'item') suma += this.getValor(c.id, fecha) || 0;
    }
    return suma;
  }

  calcularTotalPanel(concepto: Concepto): number {
    const idx = this.conceptos.indexOf(concepto);
    let suma = 0;
    for (let i = idx - 1; i >= 0; i--) {
      const c = this.conceptos[i];
      if (c.tipo_fila === 'seccion') break;
      if (c.tipo_fila === 'total') break;
      if (c.tipo_fila === 'item') suma += this.valoresPanel[c.id] || 0;
    }
    return suma;
  }

  getTotalPagar(fecha: string): number {
    const v = (id: number) => this.getValor(id, fecha) || 0;
    return v(ID_IGV_PRELIQ) + v(ID_RENTA_PRELIQ) + v(ID_ITAN_RENTA) +
      v(ID_PERCEPCIONES_RENTA) + v(ID_RTA_2DA);
  }

  esSeccion(c: Concepto) { return c.tipo_fila === 'seccion'; }
  esTotal(c: Concepto) { return c.tipo_fila === 'total'; }
  esItem(c: Concepto) { return c.tipo_fila === 'item'; }
  esSubitem(c: Concepto) { return c.tipo_fila === 'subitem'; }
  esCalculado(c: Concepto) { return IDS_CALCULADOS.has(c.id); }

  // ── Edición inline ────────────────────────────────────────

  iniciarEdicion(concepto_id: number, fecha: string) {
    if (this.editandoCelda) this.confirmarEdicion();
    const v = this.getValor(concepto_id, fecha);
    this.editandoCelda = { concepto_id, fecha };
    this.valorEditando = v !== null ? v.toString() : '';

    setTimeout(() => {
      const selector = `[data-cid="${concepto_id}"][data-fecha="${fecha}"] input`;
      const input = document.querySelector(selector) as HTMLInputElement;
      if (!input) return;
      input.value = this.valorEditando;
      input.focus();
      input.select();

      this.zone.runOutsideAngular(() => {
        const onInput = (e: Event) => {
          this.valorEditando = (e.target as HTMLInputElement).value;
        };
        const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Enter') { cleanup(); this.zone.run(() => this.confirmarEdicion()); }
          if (e.key === 'Escape') { cleanup(); this.zone.run(() => this.cancelarEdicion()); }
        };
        const cleanup = () => {
          input.removeEventListener('input', onInput);
          input.removeEventListener('keydown', onKey);
        };
        input.addEventListener('input', onInput);
        input.addEventListener('keydown', onKey);
      });
    }, 0);
  }

  confirmarEdicion() {
    if (!this.editandoCelda) return;
    const { concepto_id, fecha } = this.editandoCelda;
    const valor = this.valorEditando === '' ? null : parseFloat(this.valorEditando);
    if (!this.datos[concepto_id]) this.datos[concepto_id] = {};
    this.datos[concepto_id][fecha] = valor;
    this.editandoCelda = null;
    this.http.post<any>(`${API}/egresos/guardar`, {
      fecha_corte: fecha, datos: [{ concepto_id, valor }]
    }).subscribe();
  }

  cancelarEdicion() { this.editandoCelda = null; }

  esEditando(concepto_id: number, fecha: string): boolean {
    return this.editandoCelda?.concepto_id === concepto_id &&
      this.editandoCelda?.fecha === fecha;
  }

  // ── Utils ─────────────────────────────────────────────────

  formatFechaCorta(fecha: string): string {
    const m = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const [, mo, d] = fecha.split('-').map(Number);
    return `${String(d).padStart(2, '0')} ${m[mo - 1]}`;
  }

  fmt(n: number | null): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackById(_: number, c: Concepto) { return c.id; }
  trackByFecha(_: number, col: Columna) { return col.fecha; }

  conceptoAplicaEnFecha(concepto_id: number, fecha: string): boolean {
    if (!fecha) return true;
    const esAbrilOmas = fecha >= '2026-04-01';
    if (this.IDS_SNACKS.has(concepto_id) && esAbrilOmas) return false;
    return true;
  }

  mostrarFila(concepto_id: number): boolean {
    if (!this.IDS_SNACKS.has(concepto_id)) return true;
    return this.columnasFiltradas.some(col => this.conceptoAplicaEnFecha(concepto_id, col.fecha));
  }

  get kpis() {
    const suma = (id: number) =>
      this.columnasFiltradas.reduce((acc, col) => acc + (this.getValor(id, col.fecha) || 0), 0);

    return {
      totalProveedores: this.columnasFiltradas.reduce((acc, col) => {
        const c = this.conceptos.find(x => x.tipo_fila === 'total' && x.seccion === 'PROVEEDORES PRINCIPALES');
        return acc + (c ? this.getTotal(c, col.fecha) : 0);
      }, 0),
      igvPorPagar: suma(ID_IGV_POR_PAGAR),
      rentaPreliq: suma(ID_RENTA_PRELIQ),
      totalPagar: suma(57),
    };
  }

  // ── Modal eliminar ────────────────────────────────────────

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
    this.http.delete<any>(`${API}/egresos/eliminar/${this.fechaAEliminar}`).subscribe({
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

  // ── Sueldo base (BD) ──────────────────────────────────────

  cargarSueldoBase() {
    this.http.get<any>(`${API}/parametros/sueldo_base`).subscribe({
      next: r => {
        if (r.estado === 'OK' && r.valor !== null) {
          const val = parseFloat(r.valor);
          if (!isNaN(val) && val > 0) this.sueldoBase = val;
        }
      },
      error: () => { /* falla silenciosa, usa el valor por defecto 820000 */ }
    });
  }

  fmtProvBase(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  onProvBaseFocus(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    input.value = this.sueldoBase.toString();
    setTimeout(() => input.select(), 0);
  }

  onProvBaseBlur(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    const val = parseFloat(input.value.replace(/,/g, ''));
    if (!isNaN(val) && val > 0) this.sueldoBase = val;
    input.value = this.fmtProvBase(this.sueldoBase);
    this.sueldoBaseSaved = false;
    this.recalcularProvisiones();
  }

  onProvBaseInput(e: Event) {
    this.sueldoBaseRaw = (e.target as HTMLInputElement).value;
    this.sueldoBaseSaved = false;
  }

  guardarSueldoBase() {
    const val = parseFloat(this.sueldoBaseRaw.replace(/,/g, ''));
    if (!isNaN(val) && val > 0) this.sueldoBase = val;

    this.http.post<any>(`${API}/parametros/sueldo_base`, { valor: this.sueldoBase }).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.sueldoBaseSaved = true;
          setTimeout(() => this.sueldoBaseSaved = false, 2500);
        }
      },
      error: () => { /* falla silenciosa */ }
    });
  }

  // ── Cálculos Gratificación ────────────────────────────────

  get gratEssalud(): number {
    return Math.round(this.sueldoBase * 0.09 * 100) / 100;
  }

  get gratSemestral(): number {
    return Math.round((this.sueldoBase + this.gratEssalud) * 100) / 100;
  }

  get gratMensual(): number {
    return Math.round((this.gratSemestral / 6) * 100) / 100;
  }

  get gratDiario(): number {
    return Math.round((this.gratMensual / 30) * 100) / 100;
  }

  // ── Cálculos CTS ─────────────────────────────────────────

  get ctsSemestral(): number {
    return Math.round((this.sueldoBase / 2) * 100) / 100;
  }

  get ctsMensual(): number {
    return Math.round((this.ctsSemestral / 6) * 100) / 100;
  }

  get ctsDiario(): number {
    return Math.round((this.ctsMensual / 30) * 100) / 100;
  }

  // ── Totales combinados ────────────────────────────────────

  get totalDiario(): number {
    return Math.round((this.gratDiario + this.ctsDiario) * 100) / 100;
  }

  get totalMensual(): number {
    return Math.round((this.gratMensual + this.ctsMensual) * 100) / 100;
  }


  recalcularProvisiones() {
    if (!this.nuevaFecha) return;

    this.valoresPanel[ID_PROV_CTS] =
      Math.round(this.ctsDiario * this.diasCtsAcumulados(this.nuevaFecha) * 100) / 100;

    this.valoresPanel[ID_PROV_GRAT] =
      Math.round(this.gratDiario * this.diasGratAcumulados(this.nuevaFecha) * 100) / 100;
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