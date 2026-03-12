import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';


const API = environment.apiUrl;

const ID_VENTAS_GRAV = 32;
const ID_COMPRAS_GRAV = 33;
const ID_IGV_CALC = 34;
const ID_RENTA_3RA = 35;
const ID_CRED_RTA = 36;
const ID_RENTA_PRELIQ = 37;
const ID_IGV_PRELIQ = 38;
const ID_ITAN = 39;
const ID_PERCEPCIONES = 40;
const ID_RTA_2DA = 41;
const ID_TOTAL_PAGAR = 42;
const ID_BACKUS = 7;   // item BACKUS
const ID_FACTURAS = 8;   // subitem Facturas
const ID_ENVASES = 9;   // subitem Envases

const IDS_CALCULADOS = new Set([
  ID_IGV_CALC, ID_RENTA_3RA, ID_RENTA_PRELIQ, ID_IGV_PRELIQ, ID_TOTAL_PAGAR,
  ID_BACKUS
]);

const DEFAULTS_FIJOS: Record<number, number> = {
  15: 66528,      // Corporación San Francisco
  16: 22176,      // Representaciones San Santiago
  20: 61000,      // Movilidades
  21: 205000,     // Provisión CTS
  22: 148966.67,  // Provisión Gratificación
  26: 130272.01,    // INTERBANK
  27: 37903.02,     // PICHINCHA
  28: 31368.71,     // BCP
  29: 19928.59,     // CONTRATO MUTUO
};

const ID_SALARIOS = 19;
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

  constructor(private http: HttpClient, private zone: NgZone, private wkRefresh: WkRefreshService) { }

  ngOnInit() { this.cargarConceptos(); }

  aplicarDefaults() {
    if (!this.nuevaFecha) return;

    // Días transcurridos del mes
    const d = new Date(this.nuevaFecha + 'T00:00:00');
    const diasMes = d.getDate();

    // Salarios = (820000 / 30) × días
    this.valoresPanel[ID_SALARIOS] = Math.round((SALARIO_BASE / 30) * diasMes * 100) / 100;

    // Fijos (solo si no hay valor ya cargado)
    for (const [id, valor] of Object.entries(DEFAULTS_FIJOS)) {
      if (this.valoresPanel[parseInt(id)] == null) {
        this.valoresPanel[parseInt(id)] = valor;
      }
    }
  }

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
          this.columnas = Array.from(fechasSet).sort().map(f => ({ fecha: f, label: this.formatFechaCorta(f) }));
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

  // ── Panel ──────────────────────────────────────────────

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
          // Fecha nueva → aplicar defaults
          this.aplicarDefaults();
        }
      },
      error: () => { this.cargandoFecha = false; }
    });
  }

  getValorPanel(concepto_id: number): number | null { return this.valoresPanel[concepto_id] ?? null; }

  recalcularBackus() {
    const facturas = this.valoresPanel[ID_FACTURAS] ?? 0;
    const envases = this.valoresPanel[ID_ENVASES] ?? 0;
    this.valoresPanel[ID_BACKUS] = Math.round((facturas + envases) * 100) / 100;
  }
  recalcularRenta() {
    const v = (id: number) => this.valoresPanel[id] || 0;

    const ventasGrav = v(ID_VENTAS_GRAV);
    const comprasGrav = v(ID_COMPRAS_GRAV);
    const credRta = v(ID_CRED_RTA);
    const itan = v(ID_ITAN);
    const percepciones = v(ID_PERCEPCIONES);
    const rta2da = v(ID_RTA_2DA);

    const igvCalc = ventasGrav * 0.18 - comprasGrav * 0.18;
    const renta3ra = ventasGrav * 0.015;
    const rentaPreliq = renta3ra - credRta;
    const igvPreliq = igvCalc;  // sin crédito percepciones por ahora
    const totalPagar = igvPreliq + rentaPreliq + itan + percepciones + rta2da;

    this.valoresPanel[ID_IGV_CALC] = Math.round(igvCalc * 100) / 100;
    this.valoresPanel[ID_RENTA_3RA] = Math.round(renta3ra * 100) / 100;
    this.valoresPanel[ID_RENTA_PRELIQ] = Math.round(rentaPreliq * 100) / 100;
    this.valoresPanel[ID_IGV_PRELIQ] = Math.round(igvPreliq * 100) / 100;
    this.valoresPanel[ID_TOTAL_PAGAR] = Math.round(totalPagar * 100) / 100;
  }
  get conceptosEditables(): Concepto[] {
    return this.conceptos.filter(c =>
      (c.tipo_fila === 'item' || c.tipo_fila === 'subitem' || c.tipo_fila === 'total') &&
      !IDS_CALCULADOS.has(c.id)  // excluir calculados del payload manual
    );
  }
  guardarFecha() {
    if (!this.nuevaFecha) return;
    this.guardandoFecha = true;

    // Recalcular antes de guardar
    this.recalcularRenta();
    this.recalcularBackus();
    // Guardar todos: manuales + calculados
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

  // ── Edición inline con NgZone ──────────────────────────

  iniciarEdicion(concepto_id: number, fecha: string) {
    if (this.editandoCelda) this.confirmarEdicion();
    const v = this.getValor(concepto_id, fecha);
    this.editandoCelda = { concepto_id, fecha };
    this.valorEditando = v !== null ? v.toString() : '';

    // Focus al input FUERA de zone para no disparar change detection
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
    return this.editandoCelda?.concepto_id === concepto_id && this.editandoCelda?.fecha === fecha;
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
  desformatear(val: string): string {
    // Quita puntos de miles, convierte coma decimal a punto
    return val.replace(/\./g, '').replace(',', '.');
  }

  fmtInput(concepto_id: number): string {
    const v = this.valoresPanel[concepto_id];
    if (v === null || v === undefined) return '';
    if (this.editandoPanelId === concepto_id) return v.toString();
    return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  editandoPanelId: number | null = null;

  setValorPanel(concepto_id: number, val: string) {
    let clean = val;

    if (val.includes(',')) {
      clean = val.replace(/\./g, '').replace(',', '.');
    }

    else if (val.includes('.')) {
      const dotPos = val.lastIndexOf('.');
      const afterDot = val.length - dotPos - 1;
      if (afterDot <= 2) {
        // Es decimal: 1234.56
        clean = val;
      } else {
        // Es separador de miles: 1.234
        clean = val.replace(/\./g, '');
      }
    }
    this.valoresPanel[concepto_id] = clean === '' ? null : parseFloat(clean);
    if (concepto_id === ID_FACTURAS || concepto_id === ID_ENVASES) {
      this.recalcularBackus();
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
    input.value = v !== null && v !== undefined
      ? v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : '';
  }
  trackById(_: number, c: Concepto) { return c.id; }
  trackByFecha(_: number, col: Columna) { return col.fecha; }


}