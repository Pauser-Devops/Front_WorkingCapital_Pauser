import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

interface Concepto {
  id: number;
  nombre: string;
  tipo_fila: string;
  indent: number;
  orden: number;
  seccion: string;
}

interface Columna {
  fecha: string;
  label: string;
}

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

  // datos[concepto_id][fecha] = valor
  datos: Record<number, Record<string, number | null>> = {};

  // Panel
  mostrarPanel = false;
  nuevaFecha = '';
  fechaExistente = false;
  guardandoFecha = false;
  cargandoFecha = false;

  cargando = true;
  error = '';

  // Edición inline
  editandoCelda: { concepto_id: number, fecha: string } | null = null;
  valorEditando = '';

  // Valores en panel
  valoresPanel: Record<number, number | null> = {};

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarConceptos();
  }

  cargarConceptos() {
    this.cargando = true;
    this.http.get<any>(`${API}/egresos/conceptos`).subscribe({
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
    this.http.get<any>(`${API}/egresos/datos`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          const fechasSet = new Set<string>();
          for (const d of r.datos) fechasSet.add(d.fecha_corte);
          this.columnas = Array.from(fechasSet).sort().map(f => ({
            fecha: f,
            label: this.formatFechaCorta(f),
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

  // ── Panel ──────────────────────────────────────────────

  abrirPanel() {
    this.mostrarPanel = true;
    this.nuevaFecha = '';
    this.fechaExistente = false;
    this.valoresPanel = {};
  }

  cerrarPanel() {
    this.mostrarPanel = false;
  }

  onFechaChange() {
    if (!this.nuevaFecha) return;
    this.cargandoFecha = true;
    this.fechaExistente = false;
    this.valoresPanel = {};

    // Verificar si ya hay datos para esta fecha
    this.http.get<any>(`${API}/egresos/datos?fecha_corte=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.cargandoFecha = false;
        if (r.estado === 'OK' && r.datos.length > 0) {
          this.fechaExistente = true;
          for (const d of r.datos) {
            this.valoresPanel[d.concepto_id] = d.valor;
          }
        }
      },
      error: () => { this.cargandoFecha = false; }
    });
  }

  getValorPanel(concepto_id: number): number | null {
    return this.valoresPanel[concepto_id] ?? null;
  }

  setValorPanel(concepto_id: number, val: string) {
    this.valoresPanel[concepto_id] = val === '' ? null : parseFloat(val);
  }

  get conceptosEditables(): Concepto[] {
    return this.conceptos.filter(c => c.tipo_fila === 'item' || c.tipo_fila === 'subitem');
  }

  guardarFecha() {
    if (!this.nuevaFecha) return;
    this.guardandoFecha = true;

    const payload: { concepto_id: number, valor: number | null }[] = [];
    for (const c of this.conceptosEditables) {
      const v = this.valoresPanel[c.id] ?? null;
      payload.push({ concepto_id: c.id, valor: v });
    }

    this.http.post<any>(`${API}/wk/egresos-guardar`, {
      fecha_corte: this.nuevaFecha,
      datos: payload
    }).subscribe({
      next: r => {
        this.guardandoFecha = false;
        if (r.estado === 'OK') {
          this.cerrarPanel();
          this.valoresPanel = {};
          this.cargarDatos();
        }
      },
      error: () => { this.guardandoFecha = false; }
    });
  }

  // ── Tabla principal ────────────────────────────────────

  getValor(concepto_id: number, fecha: string): number | null {
    return this.datos[concepto_id]?.[fecha] ?? null;
  }

  getTotal(concepto: Concepto, fecha: string): number {
    const idx = this.conceptos.indexOf(concepto);
    let suma = 0;
    for (let i = idx - 1; i >= 0; i--) {
      const c = this.conceptos[i];
      if (c.tipo_fila === 'seccion') break;
      if (c.tipo_fila === 'item') {
        suma += this.getValor(c.id, fecha) || 0;
      }
    }
    return suma;
  }

  esSeccion(c: Concepto): boolean  { return c.tipo_fila === 'seccion'; }
  esTotal(c: Concepto): boolean    { return c.tipo_fila === 'total'; }
  esItem(c: Concepto): boolean     { return c.tipo_fila === 'item'; }
  esSubitem(c: Concepto): boolean  { return c.tipo_fila === 'subitem'; }

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

    this.http.post<any>(`${API}/wk/egresos-guardar`, {
      fecha_corte: fecha,
      datos: [{ concepto_id, valor }]
    }).subscribe();
  }

  cancelarEdicion() { this.editandoCelda = null; }

  // Total en panel (suma items de la sección hasta este total)
  calcularTotalPanel(concepto: Concepto): number {
    const idx = this.conceptos.indexOf(concepto);
    let suma = 0;
    for (let i = idx - 1; i >= 0; i--) {
      const c = this.conceptos[i];
      if (c.tipo_fila === 'seccion') break;
      if (c.tipo_fila === 'item') {
        suma += this.valoresPanel[c.id] || 0;
      }
    }
    return suma;
  }

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
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  trackById(_: number, c: Concepto) { return c.id; }
  trackByFecha(_: number, col: Columna) { return col.fecha; }
}