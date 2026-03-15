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

// IDs de PROSEGUR que se calculan automáticamente desde BD
const IDS_PROSEGUR_AUTO = new Set([13, 14, 15, 16]);

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

// Resultado de cada endpoint PROSEGUR
interface ProsegurResult {
  estado: string;
  total_puno?: number;
  total_huaraz?: number;
  total_trujillo?: number;
  total_ingresos_dia?: number;
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
  bancosCalculados: Record<string, number> = {};
  guardandoFecha = false;

  cargando = true;
  error = '';

  editandoCelda: { concepto_id: number; fecha: string } | null = null;
  valorEditando = '';

  valoresManualesPanel: Record<number, number | null> = {};

  // Detalle PROSEGUR para mostrar breakdown en el modal
  prosegurDetalle: {
    puno: number | null;
    huaraz: number | null;
    trujillo: number | null;
    ingresos_dia: number | null;
    error?: string;
  } = { puno: null, huaraz: null, trujillo: null, ingresos_dia: null };

  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) {}

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

  get conceptosBancoAuto(): Concepto[] {
    return this.conceptos.filter(c => IDS_AUTO.has(c.id));
  }

  get conceptosProsegurAuto(): Concepto[] {
    return this.conceptos.filter(c => IDS_PROSEGUR_AUTO.has(c.id));
  }

  get conceptosManuales(): Concepto[] {
    return this.conceptos.filter(c =>
      !IDS_AUTO.has(c.id) &&
      !IDS_PROSEGUR_AUTO.has(c.id) &&
      c.tipo_fila !== 'seccion' &&
      c.tipo_fila !== 'total'
    );
  }

  abrirPanel() {
    this.mostrarPanel = true;
    this.nuevaFecha = '';
    this.fechaExistente = false;
    this.cargandoFecha = false;
    this.bancosCalculados = {};
    this.prosegurDetalle = { puno: null, huaraz: null, trujillo: null, ingresos_dia: null };
    this.valoresManualesPanel = { ...VALORES_DEFAULT };
  }

  cerrarPanel() { this.mostrarPanel = false; }

  onFechaChange() {
    if (!this.nuevaFecha) return;
    this.cargandoFecha = true;
    this.fechaExistente = false;
    this.bancosCalculados = {};
    this.prosegurDetalle = { puno: null, huaraz: null, trujillo: null, ingresos_dia: null };
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
        } else {
          // Fecha nueva → calcula bancos y prosegur automáticamente
          this.calcularBancos();
          this.calcularProsegur();
        }
      },
      error: () => {
        this.cargandoFecha = false;
        this.calcularBancos();
        this.calcularProsegur();
      }
    });
  }

  calcularBancos() {
    if (!this.nuevaFecha) return;
    this.calculandoBancos = true;
    this.bancosCalculados = {};
    this.http.get<any>(`${API}/wk/calcular-bancos?fecha=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.calculandoBancos = false;
        if (r.estado === 'OK') this.bancosCalculados = r.bancos;
      },
      error: () => { this.calculandoBancos = false; }
    });
  }

  calcularProsegur() {
    if (!this.nuevaFecha) return;
    this.calculandoProsegur = true;
    this.prosegurDetalle = { puno: null, huaraz: null, trujillo: null, ingresos_dia: null };

    // Llama los 4 endpoints en paralelo
    forkJoin({
      puno:        this.http.get<ProsegurResult>(`${API}/wk/prosegur-puno?fecha=${this.nuevaFecha}`)
                       .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult))),
      huaraz:      this.http.get<ProsegurResult>(`${API}/wk/prosegur-huaraz?fecha=${this.nuevaFecha}`)
                       .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult))),
      trujillo:    this.http.get<ProsegurResult>(`${API}/wk/prosegur-trujillo?fecha=${this.nuevaFecha}`)
                       .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult))),
      ingresos_dia: this.http.get<ProsegurResult>(`${API}/wk/prosegur-ingresos-dia?fecha=${this.nuevaFecha}`)
                        .pipe(catchError(() => of({ estado: 'ERROR' } as ProsegurResult))),
    }).subscribe(results => {
      this.calculandoProsegur = false;

      const puno        = results.puno.estado        === 'OK' ? (results.puno.total_puno           ?? 0) : null;
      const huaraz      = results.huaraz.estado       === 'OK' ? (results.huaraz.total_huaraz        ?? 0) : null;
      const trujillo    = results.trujillo.estado     === 'OK' ? (results.trujillo.total_trujillo    ?? 0) : null;
      const ingresos_dia = results.ingresos_dia.estado === 'OK' ? (results.ingresos_dia.total_ingresos_dia ?? 0) : null;

      this.prosegurDetalle = { puno, huaraz, trujillo, ingresos_dia };

      // Setea en el panel como valores editables (pueden corregirse antes de guardar)
      this.valoresManualesPanel[13] = puno;
      this.valoresManualesPanel[14] = huaraz;
      this.valoresManualesPanel[15] = trujillo;
      this.valoresManualesPanel[16] = ingresos_dia;
    });
  }

  // Setea el detalle cuando se carga fecha existente
  private _setProsegurById(id: number, valor: number) {
    if (id === 13) this.prosegurDetalle.puno        = valor;
    if (id === 14) this.prosegurDetalle.huaraz      = valor;
    if (id === 15) this.prosegurDetalle.trujillo    = valor;
    if (id === 16) this.prosegurDetalle.ingresos_dia = valor;
    this.valoresManualesPanel[id] = valor;
  }

  valorBancoCalculado(concepto_id: number): number {
    const key = BANCO_KEY[concepto_id];
    return key ? (this.bancosCalculados[key] || 0) : 0;
  }

  valorProsegurCalculado(concepto_id: number): number | null {
    if (concepto_id === 13) return this.prosegurDetalle.puno;
    if (concepto_id === 14) return this.prosegurDetalle.huaraz;
    if (concepto_id === 15) return this.prosegurDetalle.trujillo;
    if (concepto_id === 16) return this.prosegurDetalle.ingresos_dia;
    return null;
  }

  editandoManualId: number | null = null;

  fmtPanel(concepto_id: number): string {
    const v = this.valoresManualesPanel[concepto_id];
    if (v === null || v === undefined) return '';
    if (this.editandoManualId === concepto_id) return v.toString();
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
      if (this.esItem(c) && !this.esAuto(c) && !IDS_PROSEGUR_AUTO.has(c.id)) {
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

    // Bancos automáticos
    for (const c of this.conceptosBancoAuto)
      payload.push({ concepto_id: c.id, valor: this.valorBancoCalculado(c.id) });

    // PROSEGUR automáticos (editables en el panel por si necesitan corrección)
    for (const c of this.conceptosProsegurAuto)
      payload.push({ concepto_id: c.id, valor: this.valoresManualesPanel[c.id] ?? null });

    // Manuales
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
      if (c.tipo_fila === 'item') suma += this.getValor(c.id, fecha) || 0;
    }
    return suma;
  }

  esSeccion(c: Concepto) { return c.tipo_fila === 'seccion'; }
  esTotal(c: Concepto)   { return c.tipo_fila === 'total'; }
  esItem(c: Concepto)    { return c.tipo_fila === 'item'; }
  esAuto(c: Concepto)    { return IDS_AUTO.has(c.id); }
  esProsegurAuto(c: Concepto) { return IDS_PROSEGUR_AUTO.has(c.id); }

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