import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FilaDato, KPIs, RespuestaApi } from '../../shared/models/wk.models';
import { ESTRUCTURA_WK_SEMANAL, FECHAS_DEFAULT } from '../../shared/models/wk-semanal.estructura';
import { API_BASE_URL } from '../../core/constants/api.constants';

@Component({
  selector: 'app-wk-semanal',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './wk-semanal.component.html',
  styleUrls: ['./wk-semanal.component.css']
})
export class WkSemanalComponent {
  cargando = false;
  datosApi: RespuestaApi | null = null;
  error = '';
  private _filasOriginal: FilaDato[] = [];

  modoEdicion = false;
  cambiosPendientes: { concepto: string; fechaIndex: number; monto: number }[] = [];


  constructor(private http: HttpClient) { }

  private _filas: FilaDato[] = ESTRUCTURA_WK_SEMANAL.map(f => ({
    ...f,
    montos: FECHAS_DEFAULT.map(() => null),
    variacion: null
  }));

  get filas(): FilaDato[] {
    if (this.datosApi?.filas) return this.datosApi.filas;
    return this._filas;
  }

  get fechas(): string[] { return this.datosApi?.fechas || FECHAS_DEFAULT; }

  get kpis(): KPIs { return this.datosApi?.kpis || { wk: null, activo: null, pasivo: null }; }


  trackFila(index: number, fila: FilaDato): string {
    return fila.nombre;
  }

  trackIndice(index: number): number {
    return index;
  }
  onFile(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.cargando = true; this.error = ''; this.datosApi = null;
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<RespuestaApi>(`${API_BASE_URL}/procesar-excel`, fd).subscribe({
      next: (r) => { this.cargando = false; r.estado === 'OK' ? this.datosApi = r : this.error = r.detalle || 'Error'; },
      error: () => { this.cargando = false; this.error = 'Error al conectar con el servidor'; }
    });
  }

  exportar() { window.open(`${API_BASE_URL}/exportar-excel`, '_blank'); }

  fmt(n: number | null): string {
    if (n === null || n === undefined) return '';
    if (n === 0) return '-';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  fmtK(n: number | null): string {
    if (n === null) return '—';
    return 'S/ ' + Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }


  get hayCambios(): boolean { return this.cambiosPendientes.length > 0; }

  activarEdicion() {
    // Guardar copia profunda antes de editar
    this._filasOriginal = this._filas.map(f => ({
      ...f,
      montos: [...f.montos]
    }));
    this.modoEdicion = true;
  }


  cancelarEdicion() {
    // Restaurar valores originales
    this._filas = this._filasOriginal.map(f => ({
      ...f,
      montos: [...f.montos]
    }));
    this.modoEdicion = false;
    this.cambiosPendientes = [];
  }
  onCeldaChange(fila: FilaDato, fechaIndex: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const nuevoMonto = parseFloat(input.value);
    if (isNaN(nuevoMonto)) return;

    fila.montos[fechaIndex] = nuevoMonto;

    const existe = this.cambiosPendientes.findIndex(
      c => c.concepto === fila.nombre && c.fechaIndex === fechaIndex
    );
    if (existe >= 0) {
      this.cambiosPendientes[existe].monto = nuevoMonto;
    } else {
      this.cambiosPendientes.push({ concepto: fila.nombre, fechaIndex, monto: nuevoMonto });
    }
  }

  guardarCambios() {
    const payload = this.cambiosPendientes.map(c => ({
      concepto: c.concepto,
      fecha_corte: this.fechas[c.fechaIndex],
      monto: c.monto,
      periodicidad: 'semanal'
    }));

    this.http.post(`${API_BASE_URL}/wk/editar`, { cambios: payload }).subscribe({
      next: () => {
        this.modoEdicion = false;
        this.cambiosPendientes = [];
        // opcional: mostrar toast "Guardado correctamente"
      },
      error: () => { this.error = 'Error al guardar cambios'; }
    });
  }
  tieneCambio(nombre: string, fechaIndex: number): boolean {
    return this.cambiosPendientes.some(
      c => c.concepto === nombre && c.fechaIndex === fechaIndex
    );
  }
  onFocusInput(event: FocusEvent) {
    (event.target as HTMLInputElement).select();
  }
}