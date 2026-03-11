import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

interface FilaStock {
  proveedor: string;
  stock: number;
  porPagar: number;
  diferencia: number;
  diasPiso: number;
  loQueDebeSer: number;      // días objetivo (G)
  exceso: number;
  loQueDeberiamostener: number;
  ventasMensuales: number;   // columna L
}

interface ConfigFila {
  proveedor: string;
  ventasMensuales: number;
  diasObjetivo: number;
}

interface Columna {
  fecha: string;
  label: string;
}

@Component({
  selector: 'app-stock-vs-cxp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-vs-cxp.component.html',
  styleUrls: ['./stock-vs-cxp.component.css'],
})
export class StockVsCxpComponent implements OnInit {

  columnas: Columna[] = [];
  datos: Record<string, FilaStock[]> = {};
  cargando = true;
  error = '';

  // Panel nueva fecha
  mostrarPanel = false;
  nuevaFecha = '';
  cargandoFecha = false;
  guardandoFecha = false;
  previewDatos: FilaStock[] = [];

  // Config editable (L y días objetivo) — se muestra en preview
  configFilas: ConfigFila[] = [];
  guardandoConfig = false;

  // Panel config (editar fecha existente)
  mostrarPanelConfig = false;
  fechaConfigActiva = '';
  configExistente: ConfigFila[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() { this.cargarDatos(); }

  cargarDatos() {
    this.cargando = true;
    this.http.get<any>(`${API}/stock-cxp/fechas`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          this.columnas = r.fechas.map((f: string) => ({
            fecha: f,
            label: this.formatFechaCorta(f),
          }));
          for (const col of this.columnas) this.cargarFecha(col.fecha);
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar fechas'; }
    });
  }

  cargarFecha(fecha: string) {
    this.http.get<any>(`${API}/stock-cxp/resumen?fecha_corte=${fecha}`).subscribe({
      next: r => { if (r.estado === 'OK') this.datos[fecha] = r.datos; }
    });
  }

  get proveedores(): string[] {
    const f = this.columnas[0]?.fecha;
    if (!f || !this.datos[f]) return [];
    return this.datos[f].map(x => x.proveedor);
  }

  getFila(fecha: string, proveedor: string): FilaStock | null {
    return this.datos[fecha]?.find(f => f.proveedor === proveedor) ?? null;
  }

  // ── Totales por fecha ──────────────────────────────────────────────────────
  getTotal(fecha: string, campo: keyof FilaStock): number {
    return (this.datos[fecha] ?? []).reduce((s, f) => s + (f[campo] as number), 0);
  }

  // ── Panel nueva fecha ──────────────────────────────────────────────────────
  abrirPanel() {
    this.mostrarPanel = true;
    this.nuevaFecha = '';
    this.previewDatos = [];
    this.configFilas = [];
  }

  cerrarPanel() { this.mostrarPanel = false; }

  onFechaChange() {
    if (!this.nuevaFecha) return;
    this.cargandoFecha = true;
    this.previewDatos = [];
    this.http.get<any>(`${API}/stock-cxp/resumen?fecha_corte=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.cargandoFecha = false;
        if (r.estado === 'OK') {
          this.previewDatos = r.datos;
          // Inicializar config editable con valores heredados
          this.configFilas = r.datos.map((f: FilaStock) => ({
            proveedor: f.proveedor,
            ventasMensuales: f.ventasMensuales,
            diasObjetivo: f.loQueDebeSer,
          }));
        }
      },
      error: () => { this.cargandoFecha = false; }
    });
  }

  // Recalcula preview localmente al editar L o días objetivo
  recalcularPreview() {
    this.previewDatos = this.previewDatos.map(fila => {
      const cfg = this.configFilas.find(c => c.proveedor === fila.proveedor);
      if (!cfg) return fila;
      const vm   = cfg.ventasMensuales || 0;
      const dias = cfg.diasObjetivo || 0;
      const vd   = vm / 31;
      const dp   = vd > 0 ? +(fila.stock / vd).toFixed(2) : 0;
      const exc  = dp > 0 ? +(fila.stock - (fila.stock / dp) * dias).toFixed(2) : 0;
      const lqdt = dp > dias ? +(exc / (dp - dias) * dias).toFixed(2) : 0;
      return { ...fila, ventasMensuales: vm, loQueDebeSer: dias, diasPiso: dp, exceso: exc, loQueDeberiamostener: lqdt };
    });
  }

  guardarFecha() {
    if (!this.nuevaFecha) return;
    this.guardandoFecha = true;
    const payload = {
      fecha_corte: this.nuevaFecha,
      datos: this.previewDatos.map(f => ({
        proveedor: f.proveedor,
        stock: f.stock,
        por_pagar: f.porPagar,
        diferencia: f.diferencia,
        dias_piso: f.diasPiso,
        lo_que_debe_ser: f.loQueDebeSer,
        exceso: f.exceso,
        lo_que_deberiamos_tener: f.loQueDeberiamostener,
        ventas_mensuales: f.ventasMensuales,
      }))
    };
    this.http.post<any>(`${API}/stock-cxp/guardar`, payload).subscribe({
      next: r => {
        this.guardandoFecha = false;
        if (r.estado === 'OK') { this.cerrarPanel(); this.cargarDatos(); }
      },
      error: () => { this.guardandoFecha = false; }
    });
  }

  // ── Panel config (editar fecha existente) ─────────────────────────────────
  abrirConfig(fecha: string) {
    this.fechaConfigActiva = fecha;
    const filas = this.datos[fecha] ?? [];
    this.configExistente = filas.map(f => ({
      proveedor: f.proveedor,
      ventasMensuales: f.ventasMensuales,
      diasObjetivo: f.loQueDebeSer,
    }));
    this.mostrarPanelConfig = true;
  }

  cerrarConfig() { this.mostrarPanelConfig = false; }

  guardarConfig() {
    this.guardandoConfig = true;
    const body = this.configExistente.map(c => ({
      proveedor: c.proveedor,
      ventas_mensuales: c.ventasMensuales,
      dias_objetivo: c.diasObjetivo,
    }));
    this.http.put<any>(`${API}/stock-cxp/config?fecha_corte=${this.fechaConfigActiva}`, body).subscribe({
      next: r => {
        this.guardandoConfig = false;
        if (r.estado === 'OK') { this.cerrarConfig(); this.cargarFecha(this.fechaConfigActiva); }
      },
      error: () => { this.guardandoConfig = false; }
    });
  }

  // ── Utils ─────────────────────────────────────────────────────────────────
  formatFechaCorta(fecha: string): string {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const d = new Date(fecha + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]}`;
  }

  fmt(n: number | null): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  colorDif(n: number): string {
    return n > 0 ? 'text-green' : n < 0 ? 'text-red' : '';
  }

  trackByFecha(_: number, col: Columna) { return col.fecha; }
  trackByProveedor(_: number, p: string) { return p; }
}