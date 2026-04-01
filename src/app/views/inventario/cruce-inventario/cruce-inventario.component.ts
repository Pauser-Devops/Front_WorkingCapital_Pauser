import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const API = environment.apiUrl;

export interface CruceLinea {
  fac_id: string;
  rem_id: string;
  proveedor_filtro: string;
  sucursal_filtro: string;
  numero_doc: string;
  codigo_articulo: string;
  nombre_articulo: string;
  fecha_ref: string;
  cant_factura: number;
  cant_remito: number;
  importe_factura: number;
  importe_remito: number;
  estado: 'COINCIDE' | 'DIFERENCIA' | 'SOLO_FACTURA' | 'SOLO_REMITO';
}

export interface CruceResumen {
  proveedor: string;
  total_lineas: number;
  coincide: number;
  diferencia: number;
  solo_factura: number;
  solo_remito: number;
  pct_coincide: number;
  total_importe_factura: number;
  total_importe_remito: number;
  total_diferencia: number;
}

@Component({
  selector: 'app-cruce-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cruce-inventario.component.html',
  styleUrls: ['./cruce-inventario.component.css'],
})
export class CruceInventarioComponent implements OnInit {

  // ── Datos
  lineas: CruceLinea[]     = [];
  resumen: CruceResumen[]  = [];
  total       = 0;
  cargando    = false;
  cargandoKpi = false;

  // ── Filtros
  filtroProveedor  = '';
  filtroSucursal   = '';
  filtroEstado     = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';
  limit            = 500;
  offset           = 0;

  proveedores = ['BACKUS', 'CBC', 'MONDELEZ', 'NESTLE', 'PEPSICO'];
  estados     = ['COINCIDE', 'DIFERENCIA', 'SOLO_FACTURA', 'SOLO_REMITO'];

  // ── Detalle modal
  mostrarModal    = false;
  modalTipo: 'factura' | 'remito' = 'factura';
  modalDoc        = '';
  modalProveedor  = '';
  modalLineas: any[] = [];
  cargandoModal   = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarResumen();
    this.buscar();
  }

  // ── KPIs resumen ──────────────────────────────────────────────────────────
  cargarResumen(): void {
    this.cargandoKpi = true;
    let params = new HttpParams();
    if (this.filtroFechaDesde) params = params.set('fecha_desde', this.filtroFechaDesde);
    if (this.filtroFechaHasta) params = params.set('fecha_hasta', this.filtroFechaHasta);

    this.http.get<any>(`${API}/inventario/cruce-resumen`, { params }).subscribe({
      next: r => { this.resumen = r.resumen ?? []; this.cargandoKpi = false; },
      error: () => { this.cargandoKpi = false; }
    });
  }

  // ── Totales globales para cards superiores
  get totalLineas():      number { return this.resumen.reduce((a, r) => a + (r.total_lineas ?? 0), 0); }
  get totalCoincide():    number { return this.resumen.reduce((a, r) => a + (r.coincide ?? 0), 0); }
  get totalDiferencia():  number { return this.resumen.reduce((a, r) => a + (r.diferencia ?? 0), 0); }
  get totalSoloFac():     number { return this.resumen.reduce((a, r) => a + (r.solo_factura ?? 0), 0); }
  get totalSoloRem():     number { return this.resumen.reduce((a, r) => a + (r.solo_remito ?? 0), 0); }
  get pctCoincideGlobal(): number {
    return this.totalLineas > 0 ? Math.round(100 * this.totalCoincide / this.totalLineas) : 0;
  }
  get totalDifImporte(): number {
    return this.resumen.reduce((a, r) => a + (r.total_diferencia ?? 0), 0);
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────────
  buscar(resetOffset = true): void {
    if (resetOffset) this.offset = 0;
    this.cargando = true;

    let params = new HttpParams()
      .set('limit',  String(this.limit))
      .set('offset', String(this.offset));

    if (this.filtroProveedor)  params = params.set('proveedor',   this.filtroProveedor);
    if (this.filtroSucursal)   params = params.set('sucursal',    this.filtroSucursal);
    if (this.filtroEstado)     params = params.set('estado',      this.filtroEstado);
    if (this.filtroFechaDesde) params = params.set('fecha_desde', this.filtroFechaDesde);
    if (this.filtroFechaHasta) params = params.set('fecha_hasta', this.filtroFechaHasta);

    this.http.get<any>(`${API}/inventario/cruce-inventario`, { params }).subscribe({
      next: r => { this.lineas = r.datos ?? []; this.total = r.total ?? 0; this.cargando = false; },
      error: () => { this.cargando = false; }
    });
  }

  aplicarFiltros(): void {
    this.cargarResumen();
    this.buscar();
  }

  limpiarFiltros(): void {
    this.filtroProveedor  = '';
    this.filtroSucursal   = '';
    this.filtroEstado     = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.offset           = 0;
    this.cargarResumen();
    this.buscar();
  }

  // ── Filtro rápido por estado (click en KPI card)
  filtrarPorEstado(estado: string): void {
    this.filtroEstado = this.filtroEstado === estado ? '' : estado;
    this.buscar();
  }

  // ── Paginación ────────────────────────────────────────────────────────────
  get paginaActual(): number { return Math.floor(this.offset / this.limit) + 1; }
  get totalPaginas(): number { return Math.max(1, Math.ceil(this.total / this.limit)); }
  siguiente(): void { if (this.paginaActual < this.totalPaginas) { this.offset += this.limit; this.buscar(false); } }
  anterior():  void { if (this.offset > 0) { this.offset = Math.max(0, this.offset - this.limit); this.buscar(false); } }

  // ── Modal detalle ─────────────────────────────────────────────────────────
  verDetalle(linea: CruceLinea, tipo: 'factura' | 'remito'): void {
    if (tipo === 'factura' && !linea.fac_id) return;
    if (tipo === 'remito'  && !linea.rem_id) return;

    this.mostrarModal   = true;
    this.modalTipo      = tipo;
    this.modalDoc       = linea.numero_doc;
    this.modalProveedor = linea.proveedor_filtro;
    this.modalLineas    = [];
    this.cargandoModal  = true;

    const url = tipo === 'factura'
      ? `${API}/inventario/cruce-detalle-factura/${encodeURIComponent(linea.numero_doc)}`
      : `${API}/inventario/cruce-detalle-remito/${encodeURIComponent(linea.numero_doc)}`;

    let params = new HttpParams().set('proveedor', linea.proveedor_filtro);
    this.http.get<any>(url, { params }).subscribe({
      next: r => { this.modalLineas = r.datos ?? []; this.cargandoModal = false; },
      error: () => { this.cargandoModal = false; }
    });
  }

  cerrarModal(): void { this.mostrarModal = false; }

  // ── Helpers ───────────────────────────────────────────────────────────────
  fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtCant(n: number | null | undefined): string {
    if (n == null || n === 0) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatFecha(f: string | null): string {
    if (!f) return '—';
    const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const d = new Date(f);
    return `${String(d.getDate()).padStart(2,'0')} ${m[d.getMonth()]} ${d.getFullYear()}`;
  }

  diffImporte(linea: CruceLinea): number {
    return (linea.cant_factura ?? 0) - (linea.cant_remito ?? 0);
  }

  badgeEstado(e: string): string {
    const map: Record<string,string> = {
      COINCIDE:     'estado-coincide',
      DIFERENCIA:   'estado-diferencia',
      SOLO_FACTURA: 'estado-solo-fac',
      SOLO_REMITO:  'estado-solo-rem',
    };
    return map[e] ?? '';
  }

  labelEstado(e: string): string {
    const map: Record<string,string> = {
      COINCIDE:     '✓ Coincide',
      DIFERENCIA:   '⚠ Diferencia',
      SOLO_FACTURA: '📄 Solo Factura',
      SOLO_REMITO:  '📦 Solo Remito',
    };
    return map[e] ?? e;
  }

  badgeProv(p: string): string {
    const map: Record<string,string> = {
      BACKUS:'badge-backus', CBC:'badge-cbc',
      MONDELEZ:'badge-mondelez', NESTLE:'badge-nestle', PEPSICO:'badge-pepsico'
    };
    return map[p] ?? 'badge-default';
  }

  barWidth(val: number, total: number): string {
    if (!total) return '0%';
    return Math.round(100 * val / total) + '%';
  }
}