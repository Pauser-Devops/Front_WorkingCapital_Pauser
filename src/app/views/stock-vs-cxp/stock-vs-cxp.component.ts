import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  DatoStockCxp,
  SemanaStockCxp,
  PROVEEDORES_STOCK,
  COLUMNAS_STOCK,
  SEMANAS_DEFAULT
} from '../../shared/models/stock-cxp.models';
import { API_BASE_URL } from '../../core/constants/api.constants';

@Component({
  selector: 'app-stock-vs-cxp',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './stock-vs-cxp.component.html',
  styleUrls: ['./stock-vs-cxp.component.css']
})
export class StockVsCxpComponent {
  cargando = false;
  datosApi: any = null;
  error = '';

  semanaSeleccionada = 0;

  readonly columnas = COLUMNAS_STOCK;

  constructor(private http: HttpClient) {}

  get semanas(): SemanaStockCxp[] {
    if (this.datosApi?.semanas) return this.datosApi.semanas;
    // Datos vacíos por defecto
    return SEMANAS_DEFAULT.map(fecha => ({
      fecha,
      filas: PROVEEDORES_STOCK.map(p => ({
        ...p,
        stock: null, porPagar: null, diferencia: null,
        diasPiso: null, loQueDebeSer: null,
        exceso: null, loQueDeberíamosTener: null
      }))
    }));
  }

  get semanaActual(): SemanaStockCxp {
    return this.semanas[this.semanaSeleccionada];
  }

  get fechas(): string[] { return this.semanas.map(s => s.fecha); }

  selectSemana(i: number) { this.semanaSeleccionada = i; }

  onFile(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.cargando = true; this.error = ''; this.datosApi = null;
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>(`${API_BASE_URL}/procesar-stock-cxp`, fd).subscribe({
      next: (r) => { this.cargando = false; r.estado === 'OK' ? this.datosApi = r : this.error = r.detalle || 'Error'; },
      error: () => { this.cargando = false; this.error = 'Error al conectar con el servidor'; }
    });
  }

  exportar() { window.open(`${API_BASE_URL}/exportar-stock-cxp`, '_blank'); }

  fmt(n: number | null, decimales = 0): string {
    if (n === null || n === undefined) return '—';
    if (n === 0) return '-';
    return n.toLocaleString('es-PE', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    });
  }

  fmtDias(n: number | null): string {
    if (n === null || n === undefined) return '—';
    return n.toFixed(1) + ' d';
  }

  esNegativo(n: number | null): boolean { return n !== null && n < 0; }
  esPositivo(n: number | null): boolean { return n !== null && n > 0; }
}