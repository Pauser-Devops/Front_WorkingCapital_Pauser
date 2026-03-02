import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FilaDatoIngresos, ESTRUCTURA_INGRESOS, FECHAS_DEFAULT_INGRESOS } from '../../shared/models/ingresos.estructura';
import { API_BASE_URL } from '../../core/constants/api.constants';

@Component({
  selector: 'app-ingresos',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './ingresos.component.html',
  styleUrls: ['./ingresos.component.css']
})
export class IngresosComponent {
  cargando = false;
  datosApi: any = null;
  error = '';

  constructor(private http: HttpClient) {}

  get filas(): FilaDatoIngresos[] {
    if (this.datosApi?.filas) return this.datosApi.filas;
    return ESTRUCTURA_INGRESOS.map(f => ({
      ...f,
      montos: FECHAS_DEFAULT_INGRESOS.map(() => null),
      variacion: null
    }));
  }

  get fechas(): string[] { return this.datosApi?.fechas || FECHAS_DEFAULT_INGRESOS; }

  onFile(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.cargando = true; this.error = ''; this.datosApi = null;
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>(`${API_BASE_URL}/procesar-ingresos`, fd).subscribe({
      next: (r) => { this.cargando = false; r.estado === 'OK' ? this.datosApi = r : this.error = r.detalle || 'Error'; },
      error: () => { this.cargando = false; this.error = 'Error al conectar con el servidor'; }
    });
  }

  exportar() { window.open(`${API_BASE_URL}/exportar-ingresos`, '_blank'); }

  fmt(n: number | null): string {
    if (n === null || n === undefined) return '';
    if (n === 0) return '-';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}