import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

// ── Interfaces ────────────────────────────────────────────────────────────────

interface DetalleFila {
  banco:   string;
  fecha:   string;
  ingreso: number;
  egreso:  number;
  saldo:   number;
}

interface TotalBanco {
  banco:         string;
  total_ingreso: number;
  total_egreso:  number;
  saldo_final:   number;
  ultima_fecha:  string;
}

interface GranTotal {
  ingreso: number;
  egreso:  number;
  saldo:   number;
}

interface ResumenBancario {
  estado:              string;
  periodo:             string;
  moneda:              string;
  tipo_cambio_usd:     number;
  bancos_consultados:  string[];
  detalle:             DetalleFila[];
  totales:             TotalBanco[];
  gran_total:          GranTotal;
}

interface MesItem { mes: string; anio: number; }

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
  { tabla: 'bn_1',            nombre: 'B. Nación' },
];

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-resumen-bancario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resumen-bancario.component.html',
  styleUrls: ['./resumen-bancario.component.css'],
})
export class ResumenBancarioComponent implements OnInit {

  // Filtros
  modoFiltro: 'mes' | 'rango' = 'mes';
  mesesDisponibles: MesItem[] = [];
  mesSeleccionado   = '';
  anioSeleccionado  = 0;
  fechaDesde        = '';
  fechaHasta        = '';
  bancosDisponibles = BANCOS_DISPONIBLES;
  bancosExcluidos: string[] = [];

  // Datos
  resumen: ResumenBancario | null = null;
  cargando = false;
  error    = '';

  // Vista de detalle por banco (expandir filas)
  bancoExpandido: string | null = null;

  // Vista activa en tabla: 'totales' | 'detalle'
  vistaActiva: 'totales' | 'detalle' = 'totales';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.cargarMeses(); }

  // ── Carga de meses (reutiliza el mismo endpoint de flujo-caja) ──────────────
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

  // ── Params comunes ──────────────────────────────────────────────────────────
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

  // ── Carga principal ─────────────────────────────────────────────────────────
  cargarResumen() {
    this.cargando      = true;
    this.error         = '';
    this.resumen       = null;
    this.bancoExpandido = null;

    const params = this.buildParams();
    const url = `${API}/resumen-bancario/diario${params.length ? '?' + params.join('&') : ''}`;

    this.http.get<any>(url).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') this.resumen = r;
        else this.error = r.detalle || 'Error al cargar';
      },
      error: () => { this.cargando = false; this.error = 'Error de conexión'; }
    });
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────
  onMesChange() {
    const found = this.mesesDisponibles.find(m => m.mes === this.mesSeleccionado);
    if (found) this.anioSeleccionado = found.anio;
    this.cargarResumen();
  }

  onModoChange() { this.resumen = null; }

  toggleBanco(tabla: string) {
    const idx = this.bancosExcluidos.indexOf(tabla);
    if (idx >= 0) this.bancosExcluidos.splice(idx, 1);
    else          this.bancosExcluidos.push(tabla);
  }

  isBancoActivo(tabla: string): boolean {
    return !this.bancosExcluidos.includes(tabla);
  }

  bancosActivos(): string[] {
    return BANCOS_DISPONIBLES.map(b => b.tabla).filter(t => !this.bancosExcluidos.includes(t));
  }

  // ── Expandir detalle por banco ──────────────────────────────────────────────
  toggleBancoExpandido(banco: string) {
    this.bancoExpandido = this.bancoExpandido === banco ? null : banco;
  }

  filasDetallePorBanco(banco: string): DetalleFila[] {
    return this.resumen?.detalle.filter(f => f.banco === banco) ?? [];
  }

  // ── Helpers UI ──────────────────────────────────────────────────────────────
  fmt(n: number | null | undefined): string {
    if (n == null) return '-';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtFecha(f: string): string {
    if (!f) return '-';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  }

  pctNum(parte: number, total: number): number {
    if (!total) return 0;
    return Math.min(100, Math.abs(parte / total) * 100);
  }

  saldoClass(n: number): string {
    if (n > 0)  return 'positivo';
    if (n < 0)  return 'negativo';
    return '';
  }

  get maxIngreso(): number {
    return Math.max(...(this.resumen?.totales.map(t => t.total_ingreso) ?? [1]));
  }

  get maxEgreso(): number {
    return Math.max(...(this.resumen?.totales.map(t => t.total_egreso) ?? [1]));
  }

  get labelPeriodo(): string {
    return this.resumen?.periodo ?? '-';
  }

  trackByBanco(_: number, t: TotalBanco) { return t.banco; }
  trackByFila(_: number, f: DetalleFila) { return f.banco + f.fecha; }
}