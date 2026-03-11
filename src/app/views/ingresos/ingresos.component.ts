import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

const IDS_AUTO = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10]);

const BANCO_KEY: Record<number, string> = {
  2: 'BCP LN',
  3: 'BCP TRU',
  4: 'BCP SEDES',
  5: 'BCP',
  6: 'INTERBANK',
  7: 'BBVA',
  8: 'CAJA AREQUIPA',
  9: 'PICHINCHA',
  10: 'BNACION',
};
const VALORES_DEFAULT: Record<number, number> = {
  49: 567027.27, // Valor por defecto para DVM
  52: 366400.00  // Valor por defecto para BACKUS
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

  // Panel
  mostrarPanel = false;
  nuevaFecha = '';
  fechaExistente = false;
  cargandoFecha = false;
  calculandoBancos = false;
  bancosCalculados: Record<string, number> = {};
  guardandoFecha = false;

  cargando = true;
  error = '';

  // Edición inline
  editandoCelda: { concepto_id: number, fecha: string } | null = null;
  valorEditando = '';


  // Valores manuales del panel
  valoresManualesPanel: Record<number, number | null> = {};

  constructor(private http: HttpClient) { }

  ngOnInit() { this.cargarConceptos(); }

  cargarConceptos() {
    this.cargando = true;
    this.http.get<any>(`${API}/wk/ingresos-conceptos`).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.conceptos = r.conceptos;
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
            fecha: f,
            label: this.formatFechaCorta(f),
            guardado: true,
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

  // ── Getters ────────────────────────────────────────────

  get conceptosBancoAuto(): Concepto[] {
    return this.conceptos.filter(c => IDS_AUTO.has(c.id));
  }

  get conceptosManuales(): Concepto[] {
    return this.conceptos.filter(c =>
      !IDS_AUTO.has(c.id) && c.tipo_fila !== 'seccion' && c.tipo_fila !== 'total'
    );
  }

  // ── Panel ──────────────────────────────────────────────

  abrirPanel() {
    this.mostrarPanel = true;
    this.nuevaFecha = '';
    this.fechaExistente = false;
    this.cargandoFecha = false;
    this.bancosCalculados = {};
    this.valoresManualesPanel = {};
    this.valoresManualesPanel = { ...VALORES_DEFAULT };
  }

  cerrarPanel() {
    this.mostrarPanel = false;
  }

  onFechaChange() {
    if (!this.nuevaFecha) return;
    this.cargandoFecha = true;
    this.fechaExistente = false;
    this.bancosCalculados = {};
    this.valoresManualesPanel = {};
    this.valoresManualesPanel = { ...VALORES_DEFAULT };
    // Verificar si ya hay datos para esta fecha
    this.http.get<any>(`${API}/wk/ingresos-datos?fecha_corte=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.cargandoFecha = false;
        if (r.estado === 'OK' && r.datos && Object.keys(r.datos).length > 0) {
          this.fechaExistente = true;
          // Cargar valores existentes
          for (const [idStr, valor] of Object.entries(r.datos)) {
            const id = parseInt(idStr);
            const key = BANCO_KEY[id];
            if (key) {
              // Es banco auto → cargar en bancosCalculados
              this.bancosCalculados[key] = valor as number;
            } else {
              // Es manual → cargar en valoresManualesPanel
              this.valoresManualesPanel[id] = valor as number;
            }
          }
        } else {
          // Fecha nueva → calcular bancos automáticamente
          this.calcularBancos();
        }
      },
      error: () => {
        this.cargandoFecha = false;
        this.calcularBancos();
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

  valorBancoCalculado(concepto_id: number): number {
    const key = BANCO_KEY[concepto_id];
    return key ? (this.bancosCalculados[key] || 0) : 0;
  }

  getValorManualPanel(concepto_id: number): number | null {
    return this.valoresManualesPanel[concepto_id] ?? null;
  }

  setValorManualPanel(concepto_id: number, val: string) {
    this.valoresManualesPanel[concepto_id] = val === '' ? null : parseFloat(val);
  }
  get manualesAgrupados() {
    const grupos: Record<string, Concepto[]> = {};

    this.conceptos.forEach(c => {
      // Solo tomamos items que NO son automáticos (Bancos)
      if (this.esItem(c) && !this.esAuto(c)) {
        if (!grupos[c.seccion]) {
          grupos[c.seccion] = [];
        }
        grupos[c.seccion].push(c);
      }
    });
    return Object.entries(grupos);
  }
  guardarFecha() {
    if (!this.nuevaFecha) return;
    this.guardandoFecha = true;

    const payload: { concepto_id: number, valor: number | null }[] = [];

    for (const c of this.conceptosBancoAuto) {
      payload.push({ concepto_id: c.id, valor: this.valorBancoCalculado(c.id) });
    }
    for (const c of this.conceptosManuales) {
      payload.push({ concepto_id: c.id, valor: this.valoresManualesPanel[c.id] ?? null });
    }

    this.http.post<any>(`${API}/wk/ingresos-guardar`, {
      fecha_corte: this.nuevaFecha,
      datos: payload
    }).subscribe({
      next: r => {
        this.guardandoFecha = false;
        if (r.estado === 'OK') {
          this.cerrarPanel();
          this.valoresManualesPanel = {};
          this.cargarDatos();
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

  esSeccion(c: Concepto): boolean { return c.tipo_fila === 'seccion'; }
  esTotal(c: Concepto): boolean { return c.tipo_fila === 'total'; }
  esItem(c: Concepto): boolean { return c.tipo_fila === 'item'; }
  esAuto(c: Concepto): boolean { return IDS_AUTO.has(c.id); }

  // ── Edición inline ─────────────────────────────────────

  iniciarEdicion(concepto_id: number, fecha: string) {
    const v = this.getValor(concepto_id, fecha);
    this.editandoCelda = { concepto_id, fecha };
    this.valorEditando = v !== null ? v.toString() : '';
  }

  confirmarEdicion() {
    if (!this.editandoCelda) return;
    const { concepto_id, fecha } = this.editandoCelda;
    const valor = this.valorEditando === '' ? null : parseFloat(this.valorEditando);
    if (!this.datos[concepto_id]) this.datos[concepto_id] = {};
    this.datos[concepto_id][fecha] = valor;
    this.editandoCelda = null;
    this.http.post<any>(`${API}/wk/ingresos-guardar`, {
      fecha_corte: fecha,
      datos: [{ concepto_id, valor }]
    }).subscribe();
  }

  cancelarEdicion() { this.editandoCelda = null; }

  esEditando(concepto_id: number, fecha: string): boolean {
    return this.editandoCelda?.concepto_id === concepto_id &&
      this.editandoCelda?.fecha === fecha;
  }

  // ── Utils ──────────────────────────────────────────────

  formatFechaCorta(fecha: string): string {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const d = new Date(fecha + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${meses[d.getMonth()]}`;
  }

  fmt(n: number | null): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackById(_: number, c: Concepto) { return c.id; }
  trackByFecha(_: number, col: Columna) { return col.fecha; }
}