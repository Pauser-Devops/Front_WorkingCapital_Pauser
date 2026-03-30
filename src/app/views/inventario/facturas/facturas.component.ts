import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const API = environment.apiUrl;

export interface FacturaDetalle {
  id: number;
  proveedor: string;
  fecha_emision: string;
  numero_factura: string;
  sucursal: string;
  ruc_pauser: string;
  nombre_pauser: string;
  codigo_articulo: string;
  nombre_articulo: string;
  um: string;
  cantidad: number;
  precio_unitario: number;
  valor_venta: number;
  descuento: number;
  isc: number;
  igv: number;
  importe_total: number;
  percepcion: number;
  importe_final: number;
  condicion_pago: string;
  fecha_vencimiento: string;
  tipo_venta: string;
}

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './facturas.component.html',
  styleUrls: ['./facturas.component.css'],
})
export class FacturasComponent implements OnInit {

  // ── Datos
  facturas: FacturaDetalle[] = [];
  total        = 0;
  cargando     = false;
  mensajeSync  = '';
  syncCargando = false;

  // ── Filtros
  filtroproveedor  = '';
  filtroSucursal   = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';
  filtroNumFactura = '';
  limit            = 500;
  offset           = 0;

  proveedores = ['BACKUS', 'CBC', 'MONDELEZ', 'NESTLE', 'PEPSICO'];
  sucursales: string[] = [];

  // ── Upload manual
  mostrarUpload        = false;
  proveedorUpload      = 'BACKUS';
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
    if (this.filtroproveedor) params = params.set('proveedor', this.filtroproveedor);
    this.http.get<any>(`${API}/wk/facturas-sucursales`, { params }).subscribe({
      next: r => {
        this.sucursales = (r.sucursales ?? [])
          .map((s: any) => s.sucursal)
          .filter((s: string) => !!s);
      }
    });
  }

  onProveedorChange(): void {
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

    if (this.filtroproveedor)  params = params.set('proveedor',      this.filtroproveedor);
    if (this.filtroSucursal)   params = params.set('sucursal',       this.filtroSucursal);
    if (this.filtroFechaDesde) params = params.set('fecha_desde',    this.filtroFechaDesde);
    if (this.filtroFechaHasta) params = params.set('fecha_hasta',    this.filtroFechaHasta);
    if (this.filtroNumFactura) params = params.set('numero_factura', this.filtroNumFactura);

    this.http.get<any>(`${API}/wk/facturas-detalle`, { params }).subscribe({
      next: r => {
        this.facturas = r.datos ?? [];
        this.total    = r.total ?? 0;
        this.cargando = false;
      },
      error: () => { this.cargando = false; }
    });
  }

  limpiarFiltros(): void {
    this.filtroproveedor  = '';
    this.filtroSucursal   = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.filtroNumFactura = '';
    this.offset           = 0;
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
  syncOneDrive(proveedor?: string): void {
    this.syncCargando = true;
    this.mensajeSync  = 'Sincronizando con OneDrive...';
    let params = new HttpParams();
    if (proveedor) params = params.set('proveedor', proveedor);

    this.http.post<any>(`${API}/wk/facturas-sync`, null, { params }).subscribe({
      next: r => {
        this.syncCargando = false;
        if (r.estado === 'OK') {
          const resumen = Object.entries(r.resultado)
            .map(([p, v]: any) => `${p}: ${v.insertados ?? 0} nuevas (${v.estado})`)
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

    this.http.post<any>(`${API}/wk/facturas-upload/${this.proveedorUpload}`, formData).subscribe({
      next: r => {
        this.uploadCargando = false; this.archivoSeleccionado = null; this.nombreArchivo = '';
        const ins = r.resultado?.insertados ?? 0;
        const est = r.resultado?.estado ?? '';
        this.mensajeSync = `✅ ${ins} filas insertadas (${est}) — ${this.proveedorUpload}`;
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

  formatFecha(f: string | null): string {
    if (!f) return '—';
    const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const d = new Date(f);
    return `${String(d.getDate()).padStart(2,'0')} ${m[d.getMonth()]} ${d.getFullYear()}`;
  }

  badgeClass(p: string): string {
    const map: Record<string,string> = {
      BACKUS:'badge-backus', CBC:'badge-cbc',
      MONDELEZ:'badge-mondelez', NESTLE:'badge-nestle', PEPSICO:'badge-pepsico'
    };
    return map[p] ?? 'badge-default';
  }
}