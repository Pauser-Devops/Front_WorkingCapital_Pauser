import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface ResumenTS {
  ttv_real: number;
  ttv_teorico: number;
  ts_soles: number;
  ts_pct: number;
  skus_count: number;
  skus_exceden: number;
}

export interface NegocioTS {
  negocio: string;
  skus_count: number;
  paquetes: number;
  paquetes_bonif: number;
  pct_bonif: number;
  ttv_real: number;
  ttv_teorico: number;
  ts_soles: number;
  ts_pct: number;
  gap: number;
  supera_limite: boolean;
  semaforo: 'verde' | 'amarillo' | 'rojo';
}

export interface SkuTS {
  cod_sku: number;
  sku: string;
  sku_gerencial: string;
  negocio: string;
  canal: string;
  paquetes_total: number;
  paquetes_bonif: number;
  pct_bonif: number;
  precio_lista: number;
  precio_real: number;
  ttv_real: number;
  ttv_teorico: number;
  gap: number;
  ts_pct: number;
  ts_soles: number;
  supera_limite: boolean;
  // proyección
  politica_id?: number;
  tipo_accion?: string;
  accion_texto?: string;
  rango_texto?: string;
  margen_pct?: number;
  paquetes?: number;
}

export interface ResultadoTS {
  agencia: string;
  agencia_codigo: string;
  anio: number;
  mes: number;
  modo: 'cierre_real' | 'proyeccion';
  limite_ts_pct: number;
  supera_limite: boolean;
  resumen: ResumenTS;
  negocios: NegocioTS[];
  skus: SkuTS[];
  nombre?: string;
  canal?: string;
}

export interface RangoPolitica {
  politica_id: number;
  rango_min: number;
  rango_max: number | null;
  rango_texto: string;
  tipo_accion: string;
  accion_texto: string;
  precio_lista: number;
  precio_final: number;
  descuento_pct: number;
  bonif_und: number;
  venta_paq: number;
  und_x_pqt: number;
  margen_pct: number;
}

export interface SkuPolitica {
  cd_pauser: number;
  sku_gerencial: string;
  nombre_completo: string;
  marca: string;
  negocio: string;
  rangos: RangoPolitica[];
  // estado local para proyección
  seleccionado?: boolean;
  rangoElegido?: RangoPolitica | null;
  paqEstimados?: number;
}

export interface SimulacionGuardada {
  id: number;
  nombre: string;
  agencia: string;
  mes: number;
  anio: number;
  canal: string;
  modo: string;
  ts_pct_total: number;
  ttv_total: number;
  supera_limite: boolean;
  estado: string;
  created_at: string;
}

export interface ResumenAgenciaTS {
  agencia: string;
  agencia_codigo: string;
  anio: number;
  mes: number;
  limite_ts_pct: number;
  supera_limite: boolean;
  ts_pct_total: number;
  ttv_real_total: number;
  ts_soles_total: number;
  negocios: NegocioTS[];
}


type Vista = 'lista' | 'nueva' | 'resultado' | 'resumen';
type Paso = 1 | 2 | 3;

const MESES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

// ── Componente ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-simulador-trade-spend',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulador-trade-spend.component.html',
  styleUrls: ['./simulador-trade-spend.component.css'],
})
export class SimuladorTradeSpendComponent implements OnInit {

  // ── Navegación ─────────────────────────────────────────────────────────────
  vistaActual: Vista = 'lista';
  pasoActual: Paso = 1;

  // ── Lista ──────────────────────────────────────────────────────────────────
  simulaciones: SimulacionGuardada[] = [];
  cargandoLista = false;
  filtroAgenciaLista = '';

  // ── Formulario nueva / proyección ──────────────────────────────────────────
  // Paso 1 — Contexto
  formNombre = '';
  formAgencia = 'CHM';
  formAnio = new Date().getFullYear();
  formMes = new Date().getMonth() + 1;
  formCanal = 'OFF';
  formModo: 'cierre_real' | 'proyeccion' = 'cierre_real';

  // Paso 2 — SKUs (solo para proyección)
  skusPolitica: SkuPolitica[] = [];
  cargandoPolitica = false;
  filtroNegocio = '';

  // Paso 3 — Volumen (proyección: confirmar paquetes)
  // Los paqEstimados se editan directo en skusPolitica

  // ── Resultado activo ───────────────────────────────────────────────────────
  resultado: ResultadoTS | null = null;
  cargandoResultado = false;
  errorResultado: string | null = null;
  vistaResultado: 'negocios' | 'skus' = 'negocios';
  filtroSkuNegocio = '';

  // ── Resumen por agencia ────────────────────────────────────────────────────
  resumenCHM: ResumenAgenciaTS | null = null;
  resumenHRZ: ResumenAgenciaTS | null = null;
  cargandoResumen = false;
  resumenAnio = new Date().getFullYear();
  resumenMes = new Date().getMonth() + 1;

  // ── Opciones ───────────────────────────────────────────────────────────────
  readonly agencias = [{ codigo: 'CHM', nombre: 'Chimbote' }, { codigo: 'HRZ', nombre: 'Huaraz' }];
  readonly canales = ['OFF', 'TELSELL', 'OFF TOP', 'MAYO', 'SUB/DISTRIBUIDOR', 'OFF+TELSELL'];
  readonly mesesOpciones = Object.entries(MESES).map(([n, l]) => ({ num: Number(n), label: l }));
  readonly aniosOpciones = [new Date().getFullYear(), new Date().getFullYear() - 1];
  readonly mesesLabels = MESES;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.cargarLista();
  }

  // ── Lista ──────────────────────────────────────────────────────────────────

  cargarLista(): void {
    // Por ahora mock — conectar a endpoint de simulaciones guardadas cuando exista
    this.simulaciones = [];
    this.cargandoLista = false;
  }

  get simulacionesFiltradas(): SimulacionGuardada[] {
    if (!this.filtroAgenciaLista) return this.simulaciones;
    return this.simulaciones.filter(s => s.agencia === this.filtroAgenciaLista);
  }

  // ── Nueva simulación ───────────────────────────────────────────────────────

  nuevaSimulacion(): void {
    this.formNombre = '';
    this.formAgencia = 'CHM';
    this.formAnio = new Date().getFullYear();
    this.formMes = new Date().getMonth() + 1;
    this.formCanal = 'OFF';
    this.formModo = 'cierre_real';
    this.skusPolitica = [];
    this.resultado = null;
    this.pasoActual = 1;
    this.vistaActual = 'nueva';
  }

  // ── Paso 1 → 2 ────────────────────────────────────────────────────────────

  avanzarPaso1(): void {
    if (!this.formNombre.trim()) return;

    if (this.formModo === 'cierre_real') {
      // Cierre real: calcular directo sin pasar por SKUs
      this.calcularCierreReal();
    } else {
      // Proyección: cargar política del mes para elegir SKUs
      this.pasoActual = 2;
      this.cargarPolitica();
    }
  }

  cargarPolitica(): void {
    this.cargandoPolitica = true;
    const url = `${environment.apiUrl}/trade-spend/politica/${this.formAgencia}/${this.formAnio}/${this.formMes}`;
    this.http.get<{ skus: SkuPolitica[] }>(url).subscribe({
      next: res => {
        this.skusPolitica = res.skus.map(s => ({
          ...s,
          seleccionado: false,
          rangoElegido: s.rangos[0] ?? null,
          paqEstimados: 0,
        }));
        this.cargandoPolitica = false;
      },
      error: () => { this.cargandoPolitica = false; },
    });
  }

  get skusFiltrados(): SkuPolitica[] {
    if (!this.filtroNegocio) return this.skusPolitica;
    return this.skusPolitica.filter(s => s.negocio === this.filtroNegocio);
  }

  get skusSeleccionados(): SkuPolitica[] {
    return this.skusPolitica.filter(s => s.seleccionado);
  }

  get negociosDisponibles(): string[] {
    return [...new Set(this.skusPolitica.map(s => s.negocio).filter(Boolean))];
  }

  toggleSku(sku: SkuPolitica): void {
    sku.seleccionado = !sku.seleccionado;
    if (sku.seleccionado && !sku.paqEstimados) sku.paqEstimados = 0;
  }

  onRangoChange(sku: SkuPolitica, politicaId: number): void {
    sku.rangoElegido = sku.rangos.find(r => r.politica_id === politicaId) ?? null;
  }

  // ── Paso 2 → 3 ────────────────────────────────────────────────────────────

  avanzarPaso2(): void {
    if (this.skusSeleccionados.length === 0) return;
    this.pasoActual = 3;
  }

  // ── Calcular ──────────────────────────────────────────────────────────────

  calcularCierreReal(): void {
    this.cargandoResultado = true;
    this.errorResultado = null;
    const url = `${environment.apiUrl}/trade-spend/resultado/${this.formAgencia}/${this.formAnio}/${this.formMes}`;
    this.http.get<ResultadoTS>(url).subscribe({
      next: res => {
        this.resultado = { ...res, nombre: this.formNombre };
        this.cargandoResultado = false;
        this.vistaActual = 'resultado';
        this.vistaResultado = 'negocios';
      },
      error: err => {
        this.errorResultado = err.error?.detail ?? 'Error al calcular';
        this.cargandoResultado = false;
      },
    });
  }

  calcularProyeccion(): void {
    const skusPayload = this.skusSeleccionados
      .filter(s => s.rangoElegido)
      .map(s => ({
        politica_id: s.rangoElegido!.politica_id,
        cd_pauser: s.cd_pauser,
        paquetes: s.paqEstimados ?? 0,
      }));

    if (!skusPayload.length) return;

    this.cargandoResultado = true;
    this.errorResultado = null;

    const url = `${environment.apiUrl}/trade-spend/proyeccion/${this.formAgencia}/${this.formAnio}/${this.formMes}`;
    this.http.post<ResultadoTS>(url, {
      nombre: this.formNombre,
      canal: this.formCanal,
      skus: skusPayload,
    }).subscribe({
      next: res => {
        this.resultado = res;
        this.cargandoResultado = false;
        this.vistaActual = 'resultado';
        this.vistaResultado = 'negocios';
      },
      error: err => {
        this.errorResultado = err.error?.detail ?? 'Error al calcular';
        this.cargandoResultado = false;
      },
    });
  }

  // ── Resumen por agencia ────────────────────────────────────────────────────

  verResumen(): void {
    this.vistaActual = 'resumen';
    this.cargandoResumen = true;
    this.resumenCHM = null;
    this.resumenHRZ = null;

    let pendiente = 2;
    const done = () => { if (--pendiente === 0) this.cargandoResumen = false; };

    for (const ag of ['CHM', 'HRZ'] as const) {
      const url = `${environment.apiUrl}/trade-spend/resultado/${ag}/${this.resumenAnio}/${this.resumenMes}/negocios`;
      this.http.get<any>(url).subscribe({
        next: res => {
          if (ag === 'CHM') this.resumenCHM = res as ResumenAgenciaTS;
          else this.resumenHRZ = res as ResumenAgenciaTS;
          done();
        },
        error: () => done(),
      });
    }
  }

  // ── Helpers de vista ───────────────────────────────────────────────────────

  get periodoLabel(): string {
    return `${MESES[this.formMes]} ${this.formAnio}`;
  }

  get agenciaNombre(): string {
    return this.agencias.find(a => a.codigo === this.formAgencia)?.nombre ?? '';
  }

  get skusExceden(): SkuTS[] {
    return (this.resultado?.skus ?? []).filter(s => s.supera_limite);
  }

  get skusMostrados(): SkuTS[] {
    const skus = this.resultado?.skus ?? [];
    if (!this.filtroSkuNegocio) return skus;
    return skus.filter(s => s.negocio === this.filtroSkuNegocio);
  }

  get negociosResultado(): string[] {
    return [...new Set((this.resultado?.skus ?? []).map(s => s.negocio).filter(Boolean))];
  }

  colorSemaforo(semaforo: string): string {
    return semaforo === 'rojo' ? 'ts-rojo' : semaforo === 'amarillo' ? 'ts-amarillo' : 'ts-verde';
  }

  badgeAccion(tipo: string): string {
    return tipo === 'bonificacion' ? 'badge-boni' : tipo === 'descuento' ? 'badge-dscto' : 'badge-sin';
  }

  pctFill(pct: number, limite: number): number {
    return Math.min((pct / limite) * 100, 100);
  }

  fmt(n: number): string {
    return n?.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? '0';
  }

  fmtDec(n: number, d = 2): string {
    return n?.toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '0';
  }

  fmtPct(n: number): string {
    return (n ?? 0).toFixed(2) + '%';
  }

  fmtFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}