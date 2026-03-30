import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
 
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
 
export interface FacturasResponse {
  estado: string;
  total: number;
  limit: number;
  offset: number;
  datos: FacturaDetalle[];
}
 
export interface FiltrosFactura {
  proveedor?: string;
  sucursal?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  numero_factura?: string;
  limit?: number;
  offset?: number;
}
 
@Injectable({ providedIn: 'root' })
export class FacturasService {
  private base = `${environment.apiUrl}/inventario`;
 
  constructor(private http: HttpClient) {}
 
  /** Consulta detalle con filtros */
  getDetalle(filtros: FiltrosFactura = {}): Observable<FacturasResponse> {
    let params = new HttpParams();
    if (filtros.proveedor)     params = params.set('proveedor',     filtros.proveedor);
    if (filtros.sucursal)      params = params.set('sucursal',      filtros.sucursal);
    if (filtros.fecha_desde)   params = params.set('fecha_desde',   filtros.fecha_desde);
    if (filtros.fecha_hasta)   params = params.set('fecha_hasta',   filtros.fecha_hasta);
    if (filtros.numero_factura) params = params.set('numero_factura', filtros.numero_factura);
    params = params.set('limit',  String(filtros.limit  ?? 500));
    params = params.set('offset', String(filtros.offset ?? 0));
    return this.http.get<FacturasResponse>(`${this.base}/facturas-detalle`, { params });
  }
 
  /** Estado de BD por proveedor */
  getEstado(): Observable<any> {
    return this.http.get(`${this.base}/facturas-estado`);
  }
 
  /** Sucursales disponibles (para filtro) */
  getSucursales(proveedor?: string): Observable<any> {
    let params = new HttpParams();
    if (proveedor) params = params.set('proveedor', proveedor);
    return this.http.get(`${this.base}/facturas-sucursales`, { params });
  }
 
  /** Sync desde OneDrive (uno o todos) */
  syncOneDrive(proveedor?: string): Observable<any> {
    let params = new HttpParams();
    if (proveedor) params = params.set('proveedor', proveedor);
    return this.http.post(`${this.base}/facturas-sync`, null, { params });
  }
 
  /** Carga manual de Excel */
  uploadManual(proveedor: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.base}/facturas-upload/${proveedor}`, formData);
  }
}
 