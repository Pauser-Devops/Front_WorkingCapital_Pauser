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

// RENTA (renombrados)
const ID_VENTA_MES_CERRADO = 33;
const ID_VENTA_MES_CURSO = 34;
const ID_TOTAL_VENTAS = 35;  // calc = 33+34
const ID_COMPRAS_MES_CERRADO = 36;
const ID_COMPRAS_MES_CURSO = 37;
const ID_TOTAL_COMPRAS = 38;  // calc = 36+37
const ID_IGV_VENTAS = 39;  // calc = 35×18%
const ID_IGV_COMPRAS = 40;  // calc = 38×18%
const ID_IGV_POR_PAGAR = 41;  // calc = 39−40
const ID_RENTA_3RA = 42;  // fijo 0.015
const ID_CRED_RTA = 43;
const ID_RENTA_PRELIQ = 44;  // calc = 35×1.5%−43
const ID_IGV_PRELIQ = 45;  // calc = igual a 41
const ID_ITAN_RENTA = 46;
const ID_PERCEPCIONES_RENTA = 47;
const ID_RTA_2DA = 48;
const ID_TOTAL_PAGAR = 49;  // calc

// IMPUESTOS (nuevos)
const ID_IMP_ITAN = 50; // ajusta según los IDs que genere el INSERT
const ID_IMP_IGV = 51;
const ID_IMP_RENTA = 52;
const ID_IMP_PERCEPCIONES = 53;
const ID_IMP_ESSALUD = 54;
const ID_IMP_AFP = 55;

// IDs calculados automáticamente (no editables)
const IDS_CALCULADOS = new Set([
  ID_BACKUS,
  ID_TOTAL_VENTAS, ID_TOTAL_COMPRAS,
  ID_IGV_VENTAS, ID_IGV_COMPRAS, ID_IGV_POR_PAGAR,
  ID_RENTA_PRELIQ, ID_IGV_PRELIQ,
  ID_TOTAL_PAGAR
]);



const DEFAULTS_FIJOS: Record<number, number> = {
  15: 66528,          // Corporación San Francisco
  16: 22176,          // Representaciones San Santiago
  21: 205000,         // Provisión CTS
  22: 148966.67,      // Provisión Gratificación
  27: 130272.01,      // INTERBANK
  28: 37903.02,       // PICHINCHA
  29: 31368.71,       // BCP
  30: 19928.59,       // CONTRATO MUTUO
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

  constructor(
    private http: HttpClient,
    private zone: NgZone,
    private wkRefresh: WkRefreshService
  ) { }

  ngOnInit() { this.cargarConceptos(); }
  // Después de:  columnas: Columna[] = [];
  get columnasFiltradas(): Columna[] {
    if (!this.filtroDesde && !this.filtroHasta) return this.columnas;
    return this.columnas.filter(col => {
      const ok1 = !this.filtroDesde || col.fecha >= this.filtroDesde;
      const ok2 = !this.filtroHasta || col.fecha <= this.filtroHasta;
      return ok1 && ok2;
    });
  }
  // ── Defaults ──────────────────────────────────────────
  exportar() {
    if (!this.columnasFiltradas.length) return;
    const fechas = this.columnasFiltradas.map(c => c.fecha).join(',');
    window.open(`${API}/exportar/egresos?fechas=${fechas}`, '_blank');
  }
  aplicarDefaults() {
    if (!this.nuevaFecha) return;
    const d = new Date(this.nuevaFecha + 'T00:00:00');
    const dia = d.getDate();
    const diasMes = dia;

    // Salarios proporcional
    this.valoresPanel[ID_SALARIOS] = Math.round((SALARIO_BASE / 30) * diasMes * 100) / 100;

    // Movilidades SOLO si es día 5
    if (dia === 5) {
      this.valoresPanel[ID_MOVILIDADES] = MOVILIDADES_DEFAULT;
    }

    // Fijos
    for (const [id, valor] of Object.entries(DEFAULTS_FIJOS)) {
      const numId = parseInt(id);
      if (this.valoresPanel[numId] == null) {
        this.valoresPanel[numId] = valor;
      }
    }
  }

  // ── Cálculos automáticos ──────────────────────────────

  recalcularBackus() {
    const facturas = this.valoresPanel[ID_FACTURAS] ?? 0;
    const envases = this.valoresPanel[ID_ENVASES] ?? 0;
    this.valoresPanel[ID_BACKUS] = Math.round((facturas + envases) * 100) / 100;
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

    // Totales
    const totalVentas = ventaCerrado + ventaCurso;
    const totalCompras = comprasCerrado + comprasCurso;

    // IGV
    const igvVentas = totalVentas * 0.18;
    const igvCompras = totalCompras * 0.18;
    const igvPorPagar = igvVentas - igvCompras;

    // Renta
    const renta3ra = 0.015;  // solo el factor, no se calcula
    const rentaPreliq = (totalVentas * 0.015) - credRta;

    // IGV Preliq = igual a IGV por Pagar
    const igvPreliq = igvPorPagar;

    // Total a Pagar
    const totalPagar = igvPreliq + rentaPreliq + itan + percepciones + rta2da;

    const r = (n: number) => Math.round(n * 100) / 100;

    this.valoresPanel[ID_TOTAL_VENTAS] = r(totalVentas);
    this.valoresPanel[ID_TOTAL_COMPRAS] = r(totalCompras);
    this.valoresPanel[ID_IGV_VENTAS] = r(igvVentas);
    this.valoresPanel[ID_IGV_COMPRAS] = r(igvCompras);
    this.valoresPanel[ID_IGV_POR_PAGAR] = r(igvPorPagar);
    this.valoresPanel[ID_RENTA_3RA] = renta3ra;
    this.valoresPanel[ID_RENTA_PRELIQ] = r(rentaPreliq);
    this.valoresPanel[ID_IGV_PRELIQ] = r(igvPreliq);
    this.valoresPanel[ID_TOTAL_PAGAR] = r(totalPagar);
  }
  // ── Carga ─────────────────────────────────────────────

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
          this.fechaExistente = true;
          for (const d of r.datos) this.valoresPanel[d.concepto_id] = d.valor;
        } else {
          this.aplicarDefaults();
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

    // Recalcular todo antes de guardar
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
      if (c.tipo_fila === 'item') suma += this.valoresPanel[c.id] || 0;
    }
    return suma;
  }

  esSeccion(c: Concepto) { return c.tipo_fila === 'seccion'; }
  esTotal(c: Concepto) { return c.tipo_fila === 'total'; }
  esItem(c: Concepto) { return c.tipo_fila === 'item'; }
  esSubitem(c: Concepto) { return c.tipo_fila === 'subitem'; }
  esCalculado(c: Concepto) { return IDS_CALCULADOS.has(c.id); }

  // ── Edición inline ────────────────────────────────────

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

  // ── Utils ──────────────────────────────────────────────

  formatFechaCorta(fecha: string): string {
    const m = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const d = new Date(fecha + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${m[d.getMonth()]}`;
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
      totalPagar: suma(ID_TOTAL_PAGAR),
    };
  }
}
