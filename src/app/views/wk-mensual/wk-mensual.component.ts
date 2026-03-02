import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FilaDato, KPIs, RespuestaApi } from '../../shared/models/wk.models';
import { ESTRUCTURA_WK_MENSUAL, FECHAS_DEFAULT_MENSUAL } from '../../shared/models/wk-mensual.estructura';
import { API_BASE_URL } from '../../core/constants/api.constants';

@Component({
  selector: 'app-wk-mensual',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './wk-mensual.component.html',
  styleUrls: ['./wk-mensual.component.css']
})
export class WkMensualComponent {
  cargando = false;
  datosApi: RespuestaApi | null = null;
  error = '';

  constructor(private http: HttpClient) {}

  get filas(): FilaDato[] {
    if (this.datosApi?.filas) return this.datosApi.filas;
    return ESTRUCTURA_WK_MENSUAL.map(f => ({
      ...f,
      montos: FECHAS_DEFAULT_MENSUAL.map(() => null),
      variacion: null
    }));
  }

  get fechas(): string[] { return this.datosApi?.fechas || FECHAS_DEFAULT_MENSUAL; }

  get kpis(): KPIs { return this.datosApi?.kpis || { wk: null, activo: null, pasivo: null }; }

  onFile(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.cargando = true; this.error = ''; this.datosApi = null;
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<RespuestaApi>(`${API_BASE_URL}/procesar-excel-mensual`, fd).subscribe({
      next: (r) => { this.cargando = false; r.estado === 'OK' ? this.datosApi = r : this.error = r.detalle || 'Error'; },
      error: () => { this.cargando = false; this.error = 'Error al conectar con el servidor'; }
    });
  }

  exportar() { window.open(`${API_BASE_URL}/exportar-excel-mensual`, '_blank'); }

  fmt(n: number | null): string {
    if (n === null || n === undefined) return '';
    if (n === 0) return '-';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  fmtK(n: number | null): string {
    if (n === null) return '—';
    return 'S/ ' + Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}