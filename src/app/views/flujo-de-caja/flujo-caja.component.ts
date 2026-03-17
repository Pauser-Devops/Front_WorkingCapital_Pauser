import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

interface GrupoClasificacion {
  clasificacion: string;
  total: number;
  cantidad: number;
}

interface ResumenFlujo {
  estado: string;
  periodo: string;
  ingresos: GrupoClasificacion[];
  egresos: GrupoClasificacion[];
  total_ingresos: number;
  total_egresos: number;
  neto: number;
}

interface MesItem { mes: string; anio: number; }

interface DetalleRegistro {
  fecha: string;
  banco: string;
  descripcion: string;
  sede: string;
  monto: number;
}

interface DetalleResp {
  estado: string;
  clasificacion: string;
  tipo: string;
  total: number;
  cantidad: number;
  registros: DetalleRegistro[];
}

const BANCOS_DISPONIBLES = [
  { tabla: 'bcp_1',           nombre: 'BCP' },
  { tabla: 'bcp_tru_1',       nombre: 'BCP TRU' },
  { tabla: 'bcp_ln_1',        nombre: 'BCP LN' },
  { tabla: 'bbva_1',          nombre: 'BBVA' },
  { tabla: 'bbva_lm_1',       nombre: 'BBVA LM' },
  { tabla: 'ibk_1',           nombre: 'Interbank' },
  { tabla: 'caja_arequipa_1', nombre: 'Caja Arequipa' },
  { tabla: 'ibk_usd_1',       nombre: 'IBK USD' },
  { tabla: 'pichincha_1',     nombre: 'Pichincha' },
  { tabla: 'bn_1',            nombre: 'B. Nacion' },
];

@Component({
  selector: 'app-flujo-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flujo-caja.component.html',
  styleUrls: ['./flujo-caja.component.css'],
})
export class FlujoCajaComponent implements OnInit {

  // Filtros
  modoFiltro: 'mes' | 'rango' = 'mes';
  mesesDisponibles: MesItem[] = [];
  mesSeleccionado  = '';
  anioSeleccionado = 0;
  fechaDesde       = '';
  fechaHasta       = '';
  bancosDisponibles = BANCOS_DISPONIBLES;
  // Vacío = todos; si tiene elementos = solo esos bancos DESACTIVADOS
  bancosExcluidos: string[] = [];

  // Datos
  resumen: ResumenFlujo | null = null;
  cargando = false;
  error    = '';

  // Detalle (modal drill-down)
  detalle: DetalleResp | null = null;
  cargandoDetalle = false;
  mostrarDetalle  = false;

  constructor(private http: HttpClient) {}

  ngOnInit() { this.cargarMeses(); }

  cargarMeses() {
    this.http.get<any>(`${API}/flujo-caja/meses`).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.mesesDisponibles = r.meses;
          if (r.meses.length) {
            const ultimo = r.meses[r.meses.length - 1];
            this.mesSeleccionado  = ultimo.mes;
            this.anioSeleccionado = ultimo.anio;
            this.cargarResumen();
          }
        }
      }
    });
  }

  // Construye los query params comunes (filtros de fecha + bancos)
  private buildParams(): string[] {
    const params: string[] = [];
    if (this.modoFiltro === 'mes') {
      if (this.mesSeleccionado)  params.push(`mes=${encodeURIComponent(this.mesSeleccionado)}`);
      if (this.anioSeleccionado) params.push(`anio=${this.anioSeleccionado}`);
    } else {
      if (this.fechaDesde) params.push(`fecha_desde=${this.fechaDesde}`);
      if (this.fechaHasta) params.push(`fecha_hasta=${this.fechaHasta}`);
    }
    const activos = this.bancosActivos();
    if (activos.length < BANCOS_DISPONIBLES.length)
      params.push(`bancos=${activos.join(',')}`);
    return params;
  }

  cargarResumen() {
    this.cargando = true;
    this.error    = '';
    this.resumen  = null;
    const params = this.buildParams();
    const url = `${API}/flujo-caja/resumen${params.length ? '?' + params.join('&') : ''}`;
    this.http.get<any>(url).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') this.resumen = r;
        else this.error = r.detalle || 'Error al cargar';
      },
      error: () => { this.cargando = false; this.error = 'Error de conexion'; }
    });
  }

  onMesChange() {
    const found = this.mesesDisponibles.find(
      m => m.mes === this.mesSeleccionado
    );
    if (found) this.anioSeleccionado = found.anio;
    this.cargarResumen();
  }

  onModoChange() { this.resumen = null; }

  // Chips de bancos: click alterna entre activo/excluido
  toggleBanco(tabla: string) {
    const idx = this.bancosExcluidos.indexOf(tabla);
    if (idx >= 0) this.bancosExcluidos.splice(idx, 1);
    else          this.bancosExcluidos.push(tabla);
  }

  isBancoActivo(tabla: string): boolean {
    return !this.bancosExcluidos.includes(tabla);
  }

  bancosActivos(): string[] {
    return BANCOS_DISPONIBLES
      .map(b => b.tabla)
      .filter(t => !this.bancosExcluidos.includes(t));
  }

  // Drill-down: pasa todos los filtros activos al endpoint de detalle
  verDetalle(clasificacion: string, tipo: 'ingreso' | 'egreso') {
    this.cargandoDetalle = true;
    this.mostrarDetalle  = true;
    this.detalle         = null;

    const params = this.buildParams();
    params.push(`clasificacion=${encodeURIComponent(clasificacion)}`);
    params.push(`tipo=${tipo}`);
    const url = `${API}/flujo-caja/detalle?${params.join('&')}`;

    this.http.get<any>(url).subscribe({
      next: r => {
        this.cargandoDetalle = false;
        if (r.estado === 'OK') this.detalle = r;
      },
      error: () => { this.cargandoDetalle = false; }
    });
  }

  cerrarDetalle() { this.mostrarDetalle = false; this.detalle = null; }

  // Utilidades
  fmt(n: number | null | undefined): string {
    if (n == null) return '-';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  pct(parte: number, total: number): string {
    if (!total) return '0%';
    return (parte / total * 100).toFixed(1) + '%';
  }

  pctNum(parte: number, total: number): number {
    if (!total) return 0;
    return Math.min(100, parte / total * 100);
  }

  get labelPeriodo(): string {
    return this.resumen?.periodo ?? '-';
  }

  trackByClasi(_: number, g: GrupoClasificacion) { return g.clasificacion; }
}