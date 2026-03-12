import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';

const API = environment.apiUrl;

const IDS_AUTO = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10]);

const BANCO_KEY: Record<number, string> = {
  2: 'BCP LN', 3: 'BCP TRU', 4: 'BCP SEDES', 5: 'BCP',
  6: 'INTERBANK', 7: 'BBVA', 8: 'CAJA AREQUIPA', 9: 'PICHINCHA', 10: 'BNACION',
};

const VALORES_DEFAULT: Record<number, number> = {
  49: 567027.27,
  52: 366400.00
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
  bancosCalculados: Record<string, number> = {};
  guardandoFecha = false;

  cargando = true;
  error = '';

  // Edición inline — sin blur, controlada por clicks
  editandoCelda: { concepto_id: number; fecha: string } | null = null;
  valorEditando = '';

  valoresManualesPanel: Record<number, number | null> = {};

  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) {}

  ngOnInit() { this.cargarConceptos(); }

  cargarConceptos() {
    this.cargando = true;
    this.http.get<any>(`${API}/wk/ingresos-conceptos`).subscribe({
      next: r => {
        if (r.estado === 'OK') { this.conceptos = r.conceptos; this.buildManualesAgrupados(); this.cargarDatos(); }
        else { this.cargando = false; this.error = 'Error al cargar conceptos'; }
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

  get conceptosBancoAuto(): Concepto[] {
    return this.conceptos.filter(c => IDS_AUTO.has(c.id));
  }

  get conceptosManuales(): Concepto[] {
    return this.conceptos.filter(c =>
      !IDS_AUTO.has(c.id) && c.tipo_fila !== 'seccion' && c.tipo_fila !== 'total'
    );
  }

  abrirPanel() {
    this.mostrarPanel = true;
    this.nuevaFecha = '';
    this.fechaExistente = false;
    this.cargandoFecha = false;
    this.bancosCalculados = {};
    this.valoresManualesPanel = { ...VALORES_DEFAULT };
  }

  cerrarPanel() { this.mostrarPanel = false; }

  onFechaChange() {
    if (!this.nuevaFecha) return;
    this.cargandoFecha = true;
    this.fechaExistente = false;
    this.bancosCalculados = {};
    this.valoresManualesPanel = { ...VALORES_DEFAULT };
    this.http.get<any>(`${API}/wk/ingresos-datos?fecha_corte=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.cargandoFecha = false;
        if (r.estado === 'OK' && r.datos && Object.keys(r.datos).length > 0) {
          this.fechaExistente = true;
          for (const [idStr, valor] of Object.entries(r.datos)) {
            const id = parseInt(idStr);
            const key = BANCO_KEY[id];
            if (key) this.bancosCalculados[key] = valor as number;
            else this.valoresManualesPanel[id] = valor as number;
          }
        } else {
          this.calcularBancos();
        }
      },
      error: () => { this.cargandoFecha = false; this.calcularBancos(); }
    });
  }

  calcularBancos() {
    if (!this.nuevaFecha) return;
    this.calculandoBancos = true;
    this.bancosCalculados = {};
    this.http.get<any>(`${API}/wk/calcular-bancos?fecha=${this.nuevaFecha}`).subscribe({
      next: r => { this.calculandoBancos = false; if (r.estado === 'OK') this.bancosCalculados = r.bancos; },
      error: () => { this.calculandoBancos = false; }
    });
  }

  valorBancoCalculado(concepto_id: number): number {
    const key = BANCO_KEY[concepto_id];
    return key ? (this.bancosCalculados[key] || 0) : 0;
  }

  editandoManualId: number | null = null;

  fmtPanel(concepto_id: number): string {
    const v = this.valoresManualesPanel[concepto_id];
    if (v === null || v === undefined) return '';
    if (this.editandoManualId === concepto_id) return v.toString();
    // Formato: punto como separador de miles, sin decimales si son .00
    return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  setValorManualPanel(concepto_id: number, val: string) {
    const clean = val.replace(/\./g, '').replace(',', '.');
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
    input.value = v !== null && v !== undefined
      ? v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : '';
  }

  manualesAgrupados: [string, Concepto[]][] = [];

  private buildManualesAgrupados() {
    const grupos: Record<string, Concepto[]> = {};
    this.conceptos.forEach(c => {
      if (this.esItem(c) && !this.esAuto(c)) {
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
    for (const c of this.conceptosManuales)
      payload.push({ concepto_id: c.id, valor: this.valoresManualesPanel[c.id] ?? null });
    this.http.post<any>(`${API}/wk/ingresos-guardar`, {
      fecha_corte: this.nuevaFecha, datos: payload
    }).subscribe({
      next: r => {
        this.guardandoFecha = false;
        if (r.estado === 'OK') { this.cerrarPanel(); this.valoresManualesPanel = {}; this.cargarDatos(); this.wkRefresh.notificarIngresosGuardado(this.nuevaFecha); }
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

  esSeccion(c: Concepto) { return c.tipo_fila === 'seccion'; }
  esTotal(c: Concepto)   { return c.tipo_fila === 'total'; }
  esItem(c: Concepto)    { return c.tipo_fila === 'item'; }
  esAuto(c: Concepto)    { return IDS_AUTO.has(c.id); }

  // ── Edición inline — SIN blur ──────────────────────────
  // Se abre con doble click, se cierra con Enter, Escape,
  // o haciendo click en otra celda (manejado en onClickTabla)

  iniciarEdicion(concepto_id: number, fecha: string) {
    if (this.editandoCelda) this.confirmarEdicion();
    const v = this.getValor(concepto_id, fecha);
    this.editandoCelda = { concepto_id, fecha };
    this.valorEditando = v !== null ? v.toString() : '';
  }

  // Click en la tabla fuera de un input → confirma edición abierta
  onClickTabla(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT') return; // click dentro del input, no hacer nada
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

  // ── Utils ──────────────────────────────────────────────

  formatFechaCorta(fecha: string): string {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const d = new Date(fecha + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]}`;
  }

  fmt(n: number | null): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackById(_: number, c: Concepto) { return c.id; }
  trackByFecha(_: number, col: Columna) { return col.fecha; }
}