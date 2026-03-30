import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const API = environment.apiUrl;

export interface RemitoDetalle {
  id: number;
  fuente: string;
  proveedor: string;
  anio: number;
  fecha_movimiento: string;
  fecha_stock: string;
  fecha_emision: string;
  numero_remito: string;
  serie: string;
  secuencia: string;
  sucursal: string;
  deposito_id: string;
  codigo_articulo: string;
  nombre_articulo: string;
  unidad: string;
  bultos: number;
  unidades: number;
  cantidad: number;
  costo_unitario: number;
  costo_neto: number;
  subtotal: number;
  confirmado: string;
  anulado: string;
  tipo_movimiento: string;
}

@Component({
  selector: 'app-remitos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './remitos.component.html',
  styleUrls: ['./remitos.component.css'],
})
export class RemitosComponent implements OnInit {

  // ── Datos
  remitos: RemitoDetalle[] = [];
  total        = 0;
  cargando     = false;
  mensajeSync  = '';
  syncCargando = false;

  // ── Filtros
  filtroFuente        = '';
  filtroProveedor     = '';
  filtroSucursal      = '';
  filtroFechaDesde    = '';
  filtroFechaHasta    = '';
  filtroNumRemito     = '';
  filtroCodigoArticulo = '';
  limit               = 500;
  offset              = 0;

  fuentes     = ['REMITOS', 'BACKUS'];
  proveedores = ['BACKUS', 'CBC', 'MONDELEZ', 'NESTLE', 'PEPSICO', 'OTROS'];
  sucursales: string[] = [];

  // ── Upload manual
  mostrarUpload        = false;
  fuenteUpload         = 'REMITOS';
  archivoSeleccionado: File | null = null;
  nombreArchivo        = '';
  uploadCargando       = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarSucursales();
    this.buscar();
  }

  // ── Sucursales ────────────────────────────────────────────────────────────
  cargarSucursales(): void {
    let params = new HttpParams();
    if (this.filtroFuente)    params = params.set('fuente',    this.filtroFuente);
    if (this.filtroProveedor) params = params.set('proveedor', this.filtroProveedor);
    this.http.get<any>(`${API}/wk/remitos-sucursales`, { params }).subscribe({
      next: r => {
        const lista: string[] = (r.sucursales ?? [])
          .map((s: any) => s.sucursal as string)
          .filter((s: string) => !!s);
        this.sucursales = [...new Set(lista)];
      }
    });
  }

  onFiltroChange(): void {
    this.filtroSucursal = '';
    this.cargarSucursales();
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────────
  buscar(resetOffset = true): void {
    if (resetOffset) this.offset = 0;
    this.cargando = true;

    let params = new HttpParams()
      .set('limit',  String(this.limit))
      .set('offset', String(this.offset));

    if (this.filtroFuente)         params = params.set('fuente',          this.filtroFuente);
    if (this.filtroProveedor)      params = params.set('proveedor',       this.filtroProveedor);
    if (this.filtroSucursal)       params = params.set('sucursal',        this.filtroSucursal);
    if (this.filtroFechaDesde)     params = params.set('fecha_desde',     this.filtroFechaDesde);
    if (this.filtroFechaHasta)     params = params.set('fecha_hasta',     this.filtroFechaHasta);
    if (this.filtroNumRemito)      params = params.set('numero_remito',   this.filtroNumRemito);
    if (this.filtroCodigoArticulo) params = params.set('codigo_articulo', this.filtroCodigoArticulo);

    this.http.get<any>(`${API}/wk/remitos-detalle`, { params }).subscribe({
      next: r => {
        this.remitos  = r.datos ?? [];
        this.total    = r.total ?? 0;
        this.cargando = false;
      },
      error: () => { this.cargando = false; }
    });
  }

  limpiarFiltros(): void {
    this.filtroFuente         = '';
    this.filtroProveedor      = '';
    this.filtroSucursal       = '';
    this.filtroFechaDesde     = '';
    this.filtroFechaHasta     = '';
    this.filtroNumRemito      = '';
    this.filtroCodigoArticulo = '';
    this.offset               = 0;
    this.cargarSucursales();
    this.buscar();
  }

  // ── Paginación ────────────────────────────────────────────────────────────
  get paginaActual(): number { return Math.floor(this.offset / this.limit) + 1; }
  get totalPaginas(): number { return Math.max(1, Math.ceil(this.total / this.limit)); }

  siguiente(): void {
    if (this.paginaActual < this.totalPaginas) { this.offset += this.limit; this.buscar(false); }
  }
  anterior(): void {
    if (this.offset > 0) { this.offset = Math.max(0, this.offset - this.limit); this.buscar(false); }
  }

  // ── Sync OneDrive ─────────────────────────────────────────────────────────
  syncOneDrive(fuente?: string): void {
    this.syncCargando = true;
    this.mensajeSync  = 'Sincronizando con OneDrive...';
    let params = new HttpParams();
    if (fuente) params = params.set('fuente', fuente);

    this.http.post<any>(`${API}/wk/remitos-sync`, null, { params }).subscribe({
      next: r => {
        this.syncCargando = false;
        if (r.estado === 'OK') {
          const resumen = Object.entries(r.resultado)
            .map(([f, v]: any) => `${f}: ${v.insertados ?? 0} nuevos (${v.estado})`)
            .join(' | ');
          this.mensajeSync = '✅ ' + resumen;
        } else {
          this.mensajeSync = '❌ ' + r.detalle;
        }
        this.buscar();
      },
      error: e => { this.syncCargando = false; this.mensajeSync = '❌ ' + e.message; }
    });
  }

  // ── Carga manual ──────────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file) { this.archivoSeleccionado = file; this.nombreArchivo = file.name; }
  }

  subirArchivo(): void {
    if (!this.archivoSeleccionado) return;
    this.uploadCargando = true;
    this.mensajeSync    = '';
    const formData = new FormData();
    formData.append('file', this.archivoSeleccionado);

    this.http.post<any>(`${API}/wk/remitos-upload/${this.fuenteUpload}`, formData).subscribe({
      next: r => {
        this.uploadCargando = false; this.archivoSeleccionado = null; this.nombreArchivo = '';
        const ins = r.resultado?.insertados ?? 0;
        const est = r.resultado?.estado ?? '';
        this.mensajeSync = `✅ ${ins} filas insertadas (${est}) — ${this.fuenteUpload}`;
        this.buscar();
      },
      error: e => { this.uploadCargando = false; this.mensajeSync = '❌ ' + e.message; }
    });
  }

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

  badgeProvClass(p: string): string {
    const map: Record<string,string> = {
      BACKUS:'badge-backus', CBC:'badge-cbc',
      MONDELEZ:'badge-mondelez', NESTLE:'badge-nestle',
      PEPSICO:'badge-pepsico', OTROS:'badge-otros'
    };
    return map[p] ?? 'badge-default';
  }

  badgeFuenteClass(f: string): string {
    return f === 'BACKUS' ? 'badge-fuente-backus' : 'badge-fuente-remitos';
  }

  // Cantidad efectiva: BACKUS usa 'cantidad', REMITOS usa 'bultos'
  getCantidad(r: RemitoDetalle): number | null {
    if (r.fuente === 'BACKUS') return r.cantidad;
    return r.bultos;
  }
}