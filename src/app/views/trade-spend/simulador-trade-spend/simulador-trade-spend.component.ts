import { Component, OnInit, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface ResumenTS {
  ttv_real: number; ttv_teorico: number;
  ts_soles: number; ts_pct: number;
  skus_count: number; skus_exceden: number;
}
export interface NegocioTS {
  negocio: string; skus_count: number;
  paquetes: number; paquetes_bonif: number; pct_bonif: number;
  ttv_real: number; ttv_teorico: number;
  ts_soles: number; ts_pct: number; gap: number;
  supera_limite: boolean; semaforo: 'verde' | 'amarillo' | 'rojo';
}
export interface SkuTS {
  cod_sku: number; sku: string; sku_gerencial: string;
  negocio: string; canal: string;
  paquetes_total: number; paquetes_pagados: number;
  paquetes_bonif: number; pct_bonif: number;
  ttv_paquete: number; precio_prom: number;
  ttv_real: number; ttv_teorico: number;
  gap: number; ts_pct: number; ts_soles: number;
  supera_limite: boolean; flete: number; mc: number;
  politica_id?: number; tipo_accion?: string;
  accion_texto?: string; rango_texto?: string;
  margen_pct?: number; paquetes?: number;
}
export interface ResultadoTS {
  agencia: string; agencia_codigo: string;
  anio: number; mes: number;
  modo: 'cierre_real' | 'proyeccion';
  limite_ts_pct: number; supera_limite: boolean;
  resumen: ResumenTS; negocios: NegocioTS[]; skus: SkuTS[];
  nombre?: string; canal?: string;
}
export interface RangoPolitica {
  politica_id: number; rango_min: number; rango_max: number | null;
  rango_texto: string; tipo_accion: string; accion_texto: string;
  precio_lista: number; precio_final: number; descuento_pct: number;
  bonif_und: number; venta_paq: number; und_x_pqt: number; margen_pct: number;
}
export interface SkuPolitica {
  cd_pauser: number; sku_gerencial: string;
  nombre_completo: string; marca: string; negocio: string;
  rangos: RangoPolitica[];
  seleccionado?: boolean; rangoElegido?: RangoPolitica | null; paqEstimados?: number;
}
export interface SimulacionGuardada {
  id: number; nombre: string; agencia: string; agencia_codigo: string;
  mes: number; anio: number; canal: string; modo: string;
  ts_pct_total: number; ttv_total: number; limite_ts_pct: number;
  supera_limite: boolean; estado: string; created_at: string;
}
export interface ResumenAgenciaTS {
  agencia: string; agencia_codigo: string;
  anio: number; mes: number; limite_ts_pct: number;
  supera_limite: boolean; ts_pct_total: number;
  ttv_real_total: number; ts_soles_total: number;
  negocios: NegocioTS[];
}
export interface ChessHistorial {
  agencia: string; agencia_codigo: string;
  anio: number; mes: number; total_filas: number;
  paquetes_total: number; ttv_total: number;
  ultimo_sync: string; negocios_count: number;
}

type Vista = 'lista' | 'nueva' | 'resultado' | 'resumen' | 'chess';
type Paso = 1 | 2 | 3;

const MESES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

@Component({
  selector: 'app-simulador-trade-spend',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulador-trade-spend.component.html',
  styleUrls: ['./simulador-trade-spend.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class SimuladorTradeSpendComponent implements OnInit {

  vistaActual: Vista = 'lista';
  pasoActual: Paso = 1;
  ddSkuOpen = false;
  simulaciones: SimulacionGuardada[] = [];
  cargandoLista = false;
  filtroAgenciaLista = '';

  formNombre = '';
  formAgencia = 'CHM';
  formAnio = new Date().getFullYear();
  formMes = new Date().getMonth() + 1;
  formCanal = 'OFF';
  formModo: 'cierre_real' | 'proyeccion' = 'cierre_real';

  skusPolitica: SkuPolitica[] = [];
  cargandoPolitica = false;
  filtroNegocio = '';

  resultado: ResultadoTS | null = null;
  cargandoResultado = false;
  errorResultado: string | null = null;
  vistaResultado: 'negocios' | 'skus' = 'negocios';
  filtroSkuNegocio = '';

  guardando = false;
  guardadoOk = false;
  errorGuardar: string | null = null;

  resumenCHM: ResumenAgenciaTS | null = null;
  resumenHRZ: ResumenAgenciaTS | null = null;
  cargandoResumen = false;
  resumenAnio = new Date().getFullYear();
  resumenMes = new Date().getMonth() + 1;

  @HostListener('document:click')
  closeDropdowns() {
    this.ddSkuOpen = false;
  }
  
  chessHistorial: ChessHistorial[] = [];
  cargandoChess = false;

  readonly agencias = [{ codigo: 'CHM', nombre: 'Chimbote' }, { codigo: 'HRZ', nombre: 'Huaraz' }];
  readonly canales = ['OFF', 'TELSELL', 'OFF TOP', 'MAYO', 'SUB/DISTRIBUIDOR', 'OFF+TELSELL'];
  readonly mesesOpciones = Object.entries(MESES).map(([n, l]) => ({ num: Number(n), label: l }));
  readonly aniosOpciones = [new Date().getFullYear(), new Date().getFullYear() - 1];
  readonly mesesLabels = MESES;

  constructor(private http: HttpClient) { }
  ngOnInit(): void { this.cargarLista(); }

  cargarLista(): void {
    this.cargandoLista = true;
    const q = this.filtroAgenciaLista ? `?agencia_codigo=${this.filtroAgenciaLista}` : '';
    this.http.get<SimulacionGuardada[]>(`${environment.apiUrl}/trade-spend/simulaciones${q}`).subscribe({
      next: d => { this.simulaciones = d; this.cargandoLista = false; },
      error: () => { this.simulaciones = []; this.cargandoLista = false; },
    });
  }

  get simulacionesFiltradas(): SimulacionGuardada[] { return this.simulaciones; }

  verSimulacion(s: SimulacionGuardada): void {
    this.formNombre = s.nombre;
    this.formAgencia = s.agencia_codigo;
    this.formAnio = s.anio;
    this.formMes = s.mes;
    this.formModo = s.modo as any;
    this.calcularCierreReal();
  }

  eliminarSimulacion(id: number, e: Event): void {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta simulación?')) return;
    this.http.delete(`${environment.apiUrl}/trade-spend/simulaciones/${id}`)
      .subscribe({ next: () => this.cargarLista() });
  }

  nuevaSimulacion(): void {
    this.formNombre = ''; this.formAgencia = 'CHM';
    this.formAnio = new Date().getFullYear();
    this.formMes = new Date().getMonth() + 1;
    this.formCanal = 'OFF'; this.formModo = 'cierre_real';
    this.skusPolitica = []; this.resultado = null;
    this.guardadoOk = false; this.errorGuardar = null;
    this.pasoActual = 1; this.vistaActual = 'nueva';
  }

  avanzarPaso1(): void {
    if (!this.formNombre.trim()) return;
    this.formModo === 'cierre_real' ? this.calcularCierreReal() : (this.pasoActual = 2, this.cargarPolitica());
  }

  cargarPolitica(): void {
    this.cargandoPolitica = true;
    this.http.get<{ skus: SkuPolitica[] }>(`${environment.apiUrl}/trade-spend/politica/${this.formAgencia}/${this.formAnio}/${this.formMes}`).subscribe({
      next: res => {
        this.skusPolitica = res.skus.map(s => ({ ...s, seleccionado: false, rangoElegido: s.rangos[0] ?? null, paqEstimados: 0 }));
        this.cargandoPolitica = false;
      },
      error: () => { this.cargandoPolitica = false; },
    });
  }

  get skusFiltrados(): SkuPolitica[] { return this.filtroNegocio ? this.skusPolitica.filter(s => s.negocio === this.filtroNegocio) : this.skusPolitica; }
  get skusSeleccionados(): SkuPolitica[] { return this.skusPolitica.filter(s => s.seleccionado); }
  get negociosDisponibles(): string[] { return [...new Set(this.skusPolitica.map(s => s.negocio).filter(Boolean))]; }
  toggleSku(s: SkuPolitica): void { s.seleccionado = !s.seleccionado; if (s.seleccionado && !s.paqEstimados) s.paqEstimados = 0; }
  onRangoChange(s: SkuPolitica, id: number): void { s.rangoElegido = s.rangos.find(r => r.politica_id === id) ?? null; }
  avanzarPaso2(): void { if (this.skusSeleccionados.length > 0) this.pasoActual = 3; }

  calcularCierreReal(): void {
    this.cargandoResultado = true; this.errorResultado = null; this.guardadoOk = false;
    this.http.get<ResultadoTS>(`${environment.apiUrl}/trade-spend/resultado/${this.formAgencia}/${this.formAnio}/${this.formMes}`).subscribe({
      next: res => {
        this.resultado = { ...res, nombre: this.formNombre };
        this.cargandoResultado = false; this.vistaActual = 'resultado'; this.vistaResultado = 'negocios';
      },
      error: err => { this.errorResultado = err.error?.detail ?? 'Error al calcular'; this.cargandoResultado = false; },
    });
  }

  calcularProyeccion(): void {
    const payload = this.skusSeleccionados.filter(s => s.rangoElegido).map(s => ({
      politica_id: s.rangoElegido!.politica_id, cd_pauser: s.cd_pauser, paquetes: s.paqEstimados ?? 0,
    }));
    if (!payload.length) return;
    this.cargandoResultado = true; this.errorResultado = null; this.guardadoOk = false;
    this.http.post<ResultadoTS>(`${environment.apiUrl}/trade-spend/proyeccion/${this.formAgencia}/${this.formAnio}/${this.formMes}`,
      { nombre: this.formNombre, canal: this.formCanal, skus: payload }).subscribe({
        next: res => { this.resultado = res; this.cargandoResultado = false; this.vistaActual = 'resultado'; this.vistaResultado = 'negocios'; },
        error: err => { this.errorResultado = err.error?.detail ?? 'Error al calcular'; this.cargandoResultado = false; },
      });
  }

  guardarSimulacion(): void {
    if (!this.resultado) return;
    this.guardando = true; this.errorGuardar = null;
    const r = this.resultado;
    this.http.post(`${environment.apiUrl}/trade-spend/simulaciones`, {
      nombre: r.nombre ?? this.formNombre, agencia_codigo: r.agencia_codigo,
      anio: r.anio, mes: r.mes, canal: r.canal ?? this.formCanal, modo: r.modo,
      ttv_total: r.resumen.ttv_real, ts_soles: r.resumen.ts_soles,
      ts_pct_total: r.resumen.ts_pct, supera_limite: r.supera_limite, skus_count: r.resumen.skus_count,
    }).subscribe({
      next: () => { this.guardando = false; this.guardadoOk = true; this.cargarLista(); },
      error: err => { this.guardando = false; this.errorGuardar = err.error?.detail ?? 'Error al guardar'; },
    });
  }

  verResumen(): void {
    this.vistaActual = 'resumen'; this.cargandoResumen = true;
    this.resumenCHM = null; this.resumenHRZ = null;
    let p = 2; const done = () => { if (--p === 0) this.cargandoResumen = false; };
    for (const ag of ['CHM', 'HRZ'] as const) {
      this.http.get<any>(`${environment.apiUrl}/trade-spend/resultado/${ag}/${this.resumenAnio}/${this.resumenMes}/negocios`).subscribe({
        next: res => { ag === 'CHM' ? (this.resumenCHM = res) : (this.resumenHRZ = res); done(); },
        error: () => done(),
      });
    }
  }


  verChessHistorial(): void {
    this.vistaActual = 'chess'; this.cargandoChess = true;
    this.http.get<ChessHistorial[]>(`${environment.apiUrl}/trade-spend/chess-historial`).subscribe({
      next: d => { this.chessHistorial = d; this.cargandoChess = false; },
      error: () => { this.cargandoChess = false; },
    });
  }

  get periodoLabel(): string { return `${MESES[this.formMes]} ${this.formAnio}`; }
  get agenciaNombre(): string { return this.agencias.find(a => a.codigo === this.formAgencia)?.nombre ?? ''; }
  get skusExceden(): SkuTS[] { return (this.resultado?.skus ?? []).filter(s => s.supera_limite); }
  get skusMostrados(): SkuTS[] { const s = this.resultado?.skus ?? []; return this.filtroSkuNegocio ? s.filter(x => x.negocio === this.filtroSkuNegocio) : s; }
  get negociosResultado(): string[] { return [...new Set((this.resultado?.skus ?? []).map(s => s.negocio).filter(Boolean))]; }

  colorSemaforo(s: string): string { return s === 'rojo' ? 'ts-rojo' : s === 'amarillo' ? 'ts-amarillo' : 'ts-verde'; }
  badgeAccion(t: string): string { return t === 'bonificacion' ? 'badge-boni' : t === 'descuento' ? 'badge-dscto' : 'badge-sin'; }
  pctFill(pct: number, lim: number): number { return Math.min((pct / lim) * 100, 100); }
  fmt(n: number): string { return n?.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? '0'; }
  fmtDec(n: number, d = 2): string { return n?.toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '0'; }
  fmtPct(n: number): string { return (n ?? 0).toFixed(2) + '%'; }
  fmtFecha(iso: string): string { return iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  usaTtvMayo(c: string): boolean { return (c ?? '').toUpperCase().includes('MAYO') || (c ?? '').toUpperCase().includes('SUB'); }


}