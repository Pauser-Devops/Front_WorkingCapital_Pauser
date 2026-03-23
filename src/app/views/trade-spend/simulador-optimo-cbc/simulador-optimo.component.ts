import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const MESES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

export interface CanalOptimo {
  canal:              string;
  precio_base:        number;
  tipo_accion:        string;
  accion_texto:       string;
  rango_texto:        string;
  rango_min:          number;
  rango_max:          number | null;
  ts_por_paquete:     number;
  paq_max:            number | null;
  ttv_potencial:      number | null;
  ganancia_potencial: number | null;
}

export interface SkuOptimo {
  cd_pauser:     number;
  sku_gerencial: string;
  nombre:        string;
  negocio:       string;
  mc:            number;
  flete:         number;
  und_x_pqt:    number;
  canales:       CanalOptimo[];
  mejor_canal:   string;
}

export interface SimuladorOptimoData {
  agencia:        string;
  agencia_codigo: string;
  anio:           number;
  mes:            number;
  limite_ts_pct:  number;
  estado_actual: {
    fact_teorica:       number;
    ts_soles:           number;
    ts_pct:             number;
    ya_excede_limite:   boolean;
  };
  margen_disponible: {
    ts_maximo_soles:  number;
    ts_gastado_soles: number;
    margen_soles:     number;
    margen_pct:       number;
    positivo:         boolean;
  };
  skus:       SkuOptimo[];
  total_skus: number;
}

@Component({
  selector: 'app-simulador-optimo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulador-optimo.component.html',
  styleUrls: ['./simulador-optimo.component.css'],
})
export class SimuladorOptimoComponent implements OnInit {

  formAgencia  = 'CHM';
  formAnio     = new Date().getFullYear();
  formMes      = new Date().getMonth() + 1;
  formNegocio  = '';
  filtroNegocioTabla = '';

  data:     SimuladorOptimoData | null = null;
  cargando  = false;
  error:    string | null = null;

  readonly mesesOpciones = Object.entries(MESES).map(([n, l]) => ({ num: Number(n), label: l }));
  readonly aniosOpciones = [new Date().getFullYear(), new Date().getFullYear() - 1];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error    = null;

    const negocioParam = this.formNegocio ? `?negocio=${encodeURIComponent(this.formNegocio)}` : '';
    const url = `${environment.apiUrl}/trade-spend/simulador-optimo/${this.formAgencia}/${this.formAnio}/${this.formMes}${negocioParam}`;

    this.http.get<SimuladorOptimoData>(url).subscribe({
      next: d => {
        this.data     = d;
        this.cargando = false;
      },
      error: err => {
        this.error    = err.error?.detail ?? 'Error al calcular el simulador óptimo';
        this.cargando = false;
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  get negociosDisponibles(): string[] {
    if (!this.data) return [];
    return [...new Set(this.data.skus.map(s => s.negocio).filter(Boolean))].sort();
  }

  get skusFiltrados(): SkuOptimo[] {
    if (!this.data) return [];
    if (!this.filtroNegocioTabla) return this.data.skus;
    return this.data.skus.filter(s => s.negocio === this.filtroNegocioTabla);
  }

  getTrad(sku: SkuOptimo): CanalOptimo | null {
    return sku.canales.find(c => c.canal === 'Tradicional') ?? null;
  }

  getMayo(sku: SkuOptimo): CanalOptimo | null {
    return sku.canales.find(c => c.canal === 'Mayorista') ?? null;
  }

  barPct(valor: number, limite: number): number {
    if (!limite) return 0;
    return Math.min((valor / limite) * 100, 100);
  }

  badgeAccion(tipo: string): string {
    if (tipo === 'bonificacion') return 'sop-badge sop-badge-boni';
    if (tipo === 'descuento')    return 'sop-badge sop-badge-dscto';
    return 'sop-badge sop-badge-sin';
  }

  fmtMoney(n: number): string {
    return 'S/ ' + (n ?? 0).toLocaleString('es-PE', {
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    });
  }

  fmtPct(n: number): string {
    return (n ?? 0).toFixed(2) + '%';
  }

  fmtNum(n: number, dec = 0): string {
    return (n ?? 0).toLocaleString('es-PE', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }
}