import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const MESES: Record<number, string> = {
  1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',
  7:'Julio',8:'Agosto',9:'Setiembre',10:'Octubre',11:'Noviembre',12:'Diciembre',
};

export interface CanalOptimo {
  canal: string; precio_base: number;
  tipo_accion: string; accion_texto: string;
  rango_texto: string; rango_min: number; rango_max: number | null;
  ts_por_paquete: number; paq_max: number | null;
  ttv_potencial: number | null; ingreso_neto: number | null;
}

export interface SkuOptimo {
  politica_id: number; cd_pauser: number;
  sku_gerencial: string; nombre: string; negocio: string;
  mc: number; flete: number; und_x_pqt: number;
  canales: CanalOptimo[];
  mejor_canal: string; paq_max_mejor: number | null; ttv_potencial: number | null;
}

export interface SimuladorOptimoData {
  agencia: string; agencia_codigo: string; anio: number; mes: number;
  limite_ts_pct: number;
  estado_actual: {
    fact_teorica: number; fact_real: number;
    ts_soles: number; ts_pct: number;
    ya_excede: boolean; semaforo: string;
  };
  margen_disponible: {
    ts_maximo_soles: number; ts_gastado_soles: number;
    margen_soles: number; margen_pct: number; positivo: boolean;
  };
  skus: SkuOptimo[]; total_skus: number;
}

export interface NegocioResumen {
  negocio: string; skus_count: number; paquetes: number;
  ttv_real: number; ttv_teorico: number; ts_soles: number;
  ts_pct: number; gap: number; supera_limite: boolean;
  skus_bajo_minimo: number;
  semaforo: 'verde' | 'amarillo' | 'rojo';
}

export interface CierreData {
  agencia: string; agencia_codigo: string; anio: number; mes: number;
  limite_ts_pct: number; supera_limite: boolean;
  ts_pct_total: number; ttv_real_total: number; ts_soles_total: number;
  skus_bajo_minimo: number;
  negocios: NegocioResumen[];
}

export interface HistorialPrecio {
  agencia: string; mes: number; anio: number;
  skus_count: number; fecha_carga: string; archivo: string;
}

export interface HistorialChess {
  agencia: string; agencia_codigo: string; anio: number; mes: number;
  total_filas: number; paquetes_total: number; ttv_total: number;
  ultimo_sync: string; negocios_count: number;
}

type Tab = 'simulador' | 'cierre' | 'precios' | 'chess' | 'ttv';

@Component({
  selector: 'app-simulador-optimo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulador-optimo.component.html',
  styleUrls: ['./simulador-optimo.component.css'],
})
export class SimuladorOptimoComponent implements OnInit {

  // ── Tab ────────────────────────────────────────────────────────────────────
  tabActual: Tab = 'simulador';

  // ── Simulador ──────────────────────────────────────────────────────────────
  formAgencia = 'CHM';
  formAnio    = new Date().getFullYear();
  formMes     = new Date().getMonth() + 1;
  formNegocio = '';
  filtroNegocioTabla = '';
  canalActivo: 'Tradicional' | 'Mayorista' = 'Tradicional';

  data:    SimuladorOptimoData | null = null;
  cargando = false;
  error:   string | null = null;

  // Plan interactivo: politica_id → paquetes ingresados
  planPaquetes: Record<number, number> = {};

  // ── Cierre CP ──────────────────────────────────────────────────────────────
  cierreAgencia = 'CHM';
  cierreAnio    = new Date().getFullYear();
  cierreMes     = new Date().getMonth() + 1;
  dataCierre:    CierreData | null = null;
  cargandoCierre = false;

  // ── Precios ────────────────────────────────────────────────────────────────
  historialPrecios: HistorialPrecio[] = [];
  cargandoPrecios  = false;

  // ── Chess ──────────────────────────────────────────────────────────────────
  historialChess: HistorialChess[] = [];
  cargandoChess  = false;

  // ── TTV Mínimo ────────────────────────────────────────────────────────────
  ttvItems:      any[] = [];
  cargandoTtv  = false;
  guardandoTtv = false;
  copiandoTtv  = false;
  errorTtv:    string | null = null;
  mensajeTtvOk:string | null = null;
  ttvGuardadoEn = '';
  ttvModoEdicion = false;
  ttvFormMes  = new Date().getMonth() + 1;
  ttvFormAnio = new Date().getFullYear();
  ttvFiltroNegocio = '';

  readonly mesesOpciones = Object.entries(MESES).map(([n,l])=>({num:Number(n),label:l}));
  readonly aniosOpciones = [new Date().getFullYear(), new Date().getFullYear()-1];
  readonly mesesLabels   = MESES;

  constructor(private http: HttpClient) {}
  ngOnInit(): void { this.cargar(); }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  cambiarTab(tab: Tab): void {
    this.tabActual = tab;
    if (tab==='precios' && !this.historialPrecios.length) this.cargarPrecios();
    if (tab==='chess'   && !this.historialChess.length)   this.cargarChess();
    if (tab==='ttv')                                       this.cargarTtv();
  }

  refrescar(): void {
    if (this.tabActual==='simulador') this.cargar();
    if (this.tabActual==='cierre')    this.cargarCierre();
    if (this.tabActual==='precios')   this.cargarPrecios();
    if (this.tabActual==='chess')     this.cargarChess();
  }

  // ── Simulador ──────────────────────────────────────────────────────────────

  cargar(): void {
    this.cargando = true; this.error = null;
    const q = this.formNegocio ? `?negocio=${encodeURIComponent(this.formNegocio)}` : '';
    this.http.get<SimuladorOptimoData>(
      `${environment.apiUrl}/trade-spend/simulador-optimo/${this.formAgencia}/${this.formAnio}/${this.formMes}${q}`
    ).subscribe({
      next:  d   => { this.data=d; this.cargando=false; this.planPaquetes={}; },
      error: err => { this.error=err.error?.detail??'Error al calcular'; this.cargando=false; },
    });
  }

  cambiarCanal(canal: 'Tradicional' | 'Mayorista'): void {
    this.canalActivo = canal;
    this.planPaquetes = {};  // limpiar plan al cambiar canal
  }

  // ── Plan interactivo ───────────────────────────────────────────────────────

  onPaqInput(politicaId: number, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value) || 0;
    if (val <= 0) {
      delete this.planPaquetes[politicaId];
    } else {
      this.planPaquetes = { ...this.planPaquetes, [politicaId]: val };
    }
  }

  limpiarPlan(): void { this.planPaquetes = {}; }

  get hayPlan(): boolean { return Object.keys(this.planPaquetes).length > 0; }
  get skusConPlan(): number { return Object.keys(this.planPaquetes).length; }

  // TS que cuesta este SKU en el plan
  tsPorSku(sku: SkuOptimo): number {
    const paq   = this.planPaquetes[sku.politica_id] ?? 0;
    const canal = this.getCanalData(sku);
    if (!canal || paq<=0) return 0;
    return paq * canal.ts_por_paquete;
  }

  // TS excede el margen disponible individual
  tsExcede(sku: SkuOptimo): boolean {
    if (!this.data) return false;
    const ts = this.tsPorSku(sku);
    return ts > this.data.margen_disponible.margen_soles;
  }

  // Totales del plan
  get tsPlanSoles(): number {
    if (!this.data) return 0;
    return this.data.skus.reduce((acc, sku) => acc + this.tsPorSku(sku), 0);
  }

  get ttvTotalPlan(): number {
    if (!this.data) return 0;
    return this.data.skus.reduce((acc, sku) => {
      const paq   = this.planPaquetes[sku.politica_id] ?? 0;
      const canal = this.getCanalData(sku);
      return acc + (canal ? paq * canal.precio_base : 0);
    }, 0);
  }

  get totalPaqPlan(): number {
    return Object.values(this.planPaquetes).reduce((a,b)=>a+b, 0);
  }

  get margenRestante(): number {
    if (!this.data) return 0;
    return this.data.margen_disponible.margen_soles - this.tsPlanSoles;
  }

  get tsPlanPct(): number {
    if (!this.data || !this.data.margen_disponible.margen_soles) return 0;
    return (this.tsPlanSoles / this.data.margen_disponible.margen_soles) * 100;
  }

  get tsPctProyectado(): number {
    if (!this.data) return 0;
    const tsTotalProyectado = this.data.estado_actual.ts_soles + this.tsPlanSoles;
    const factTeorica       = this.data.estado_actual.fact_teorica;
    return factTeorica > 0 ? (tsTotalProyectado / factTeorica) * 100 : 0;
  }

  get barPlanPct(): number {
    if (!this.data) return 0;
    const margenTotal = this.data.margen_disponible.margen_soles;
    return margenTotal > 0 ? Math.min((this.tsPlanSoles / margenTotal) * 100, 100) : 100;
  }

  // ── Helpers tabla ──────────────────────────────────────────────────────────

  getCanalData(sku: SkuOptimo): CanalOptimo | null {
    return sku.canales.find(c=>c.canal===this.canalActivo) ?? null;
  }

  get negociosDisponibles(): string[] {
    if (!this.data) return [];
    return [...new Set(this.data.skus.map(s=>s.negocio).filter(Boolean))].sort();
  }

  get skusFiltrados(): SkuOptimo[] {
    if (!this.data) return [];
    const skus = this.data.skus.filter(s => this.getCanalData(s) !== null);
    return this.filtroNegocioTabla ? skus.filter(s=>s.negocio===this.filtroNegocioTabla) : skus;
  }

  barPct(valor: number, limite: number): number {
    return !limite ? 0 : Math.min((valor/limite)*100, 100);
  }

  badgeAccion(tipo: string): string {
    if (tipo==='bonificacion') return 'sop-badge sop-badge-boni';
    if (tipo==='descuento')    return 'sop-badge sop-badge-dscto';
    return 'sop-badge sop-badge-sin';
  }

  // ── Cierre CP ──────────────────────────────────────────────────────────────

  cargarCierre(): void {
    this.cargandoCierre = true;
    this.http.get<CierreData>(
      `${environment.apiUrl}/trade-spend/resultado/${this.cierreAgencia}/${this.cierreAnio}/${this.cierreMes}/negocios`
    ).subscribe({
      next:  d  => { this.dataCierre=d; this.cargandoCierre=false; },
      error: () => { this.cargandoCierre=false; },
    });
  }

  // ── Precios ────────────────────────────────────────────────────────────────

  cargarPrecios(): void {
    this.cargandoPrecios = true;
    this.http.get<any[]>(`${environment.apiUrl}/trade-spend/cargas/`).subscribe({
      next: d => {
        this.historialPrecios = d
          .filter(c => (c.tipo||'').toLowerCase().includes('precio'))
          .map(c => ({
            agencia:     c.agencia ?? c.agencia_codigo,
            mes:         c.mes,
            anio:        c.anio,
            skus_count:  c.filas ?? c.insertados ?? 0,
            fecha_carga: c.created_at ?? c.fecha ?? '',
            archivo:     c.archivo ?? c.nombre_archivo ?? '',
          }));
        this.cargandoPrecios = false;
      },
      error: () => { this.cargandoPrecios = false; },
    });
  }

  // ── Chess ──────────────────────────────────────────────────────────────────

  cargarChess(): void {
    this.cargandoChess = true;
    this.http.get<HistorialChess[]>(`${environment.apiUrl}/trade-spend/chess-historial`).subscribe({
      next:  d  => { this.historialChess=d; this.cargandoChess=false; },
      error: () => { this.cargandoChess=false; },
    });
  }

  // ── Formateo ───────────────────────────────────────────────────────────────

  fmtMoney(n: number): string {
    return 'S/ '+(n??0).toLocaleString('es-PE',{minimumFractionDigits:0,maximumFractionDigits:0});
  }
  fmtPct(n: number):        string { return (n??0).toFixed(2)+'%'; }
  fmtNum(n: number, d=0):   string {
    return (n??0).toLocaleString('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d});
  }
  // ── TTV Mínimo ────────────────────────────────────────────────────────────

  cargarTtv(): void {
    this.cargandoTtv = true; this.errorTtv = null; this.mensajeTtvOk = null;
    this.http.get<any>(
      `${environment.apiUrl}/trade-spend/ttv-minimo/${this.ttvFormAnio}/${this.ttvFormMes}`
    ).subscribe({
      next: d => {
        this.ttvItems = (d.items ?? []).map((i: any) => ({
          ...i, editando: false,
          _ttv_full: i.ttv_full, _ttv_min_off: i.ttv_min_off, _ttv_min_cnt: i.ttv_min_cnt,
        }));
        this.ttvGuardadoEn = d.guardado_en ?? '';
        this.cargandoTtv = false;
      },
      error: () => { this.cargandoTtv = false; },
    });
  }

  // Carga desde Excel
  ttvSubiendo = false;

  onTtvExcelChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.ttvSubiendo = true; this.errorTtv = null; this.mensajeTtvOk = null;
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>(
      `${environment.apiUrl}/trade-spend/ttv-minimo/${this.ttvFormAnio}/${this.ttvFormMes}/excel`,
      fd
    ).subscribe({
      next: d => {
        this.ttvSubiendo = false;
        this.mensajeTtvOk = d.mensaje;
        this.cargarTtv();
      },
      error: err => {
        this.ttvSubiendo = false;
        this.errorTtv = err.error?.detail ?? 'Error al cargar Excel';
      },
    });
    // Reset input
    (event.target as HTMLInputElement).value = '';
  }

  copiarTtvMesAnterior(): void {
    this.copiandoTtv = true; this.errorTtv = null;
    this.http.post<any>(
      `${environment.apiUrl}/trade-spend/ttv-minimo/${this.ttvFormAnio}/${this.ttvFormMes}/copiar`, {}
    ).subscribe({
      next: d => { this.copiandoTtv=false; this.mensajeTtvOk=d.mensaje; this.cargarTtv(); },
      error: err => { this.copiandoTtv=false; this.errorTtv=err.error?.detail??'Error al copiar'; },
    });
  }

  activarTtvEdicion(item: any): void {
    item._ttv_full=item.ttv_full; item._ttv_min_off=item.ttv_min_off;
    item._ttv_min_cnt=item.ttv_min_cnt; item.editando=true;
  }

  confirmarTtvEdicion(item: any): void {
    item.ttv_full=item._ttv_full; item.ttv_min_off=item._ttv_min_off;
    item.ttv_min_cnt=item._ttv_min_cnt; item.editando=false;
  }

  cancelarTtvEdicion(item: any): void {
    item._ttv_full=item.ttv_full; item._ttv_min_off=item.ttv_min_off;
    item._ttv_min_cnt=item.ttv_min_cnt; item.editando=false;
  }

  editarTodosTtv(): void {
    this.ttvModoEdicion=true; this.ttvItems.forEach(i=>this.activarTtvEdicion(i));
  }

  guardarTtv(): void {
    this.ttvItems.filter(i=>i.editando).forEach(i=>this.confirmarTtvEdicion(i));
    this.ttvModoEdicion=false; this.guardandoTtv=true; this.errorTtv=null;
    this.http.post<any>(
      `${environment.apiUrl}/trade-spend/ttv-minimo/${this.ttvFormAnio}/${this.ttvFormMes}`,
      { updated_by:'usuario', items: this.ttvItems.map(i=>({
          cd_pauser:i.cd_pauser, sku_nombre:i.sku_nombre,
          sku_gerencial:i.sku_gerencial, negocio:i.negocio,
          ttv_full:i.ttv_full, ttv_min_off:i.ttv_min_off, ttv_min_cnt:i.ttv_min_cnt,
        })) }
    ).subscribe({
      next: d => { this.guardandoTtv=false; this.mensajeTtvOk=d.mensaje; this.cargarTtv(); },
      error: err => { this.guardandoTtv=false; this.errorTtv=err.error?.detail??'Error'; },
    });
  }

  get ttvFiltrados(): any[] {
    return this.ttvFiltroNegocio
      ? this.ttvItems.filter(i=>i.negocio===this.ttvFiltroNegocio)
      : this.ttvItems;
  }

  get ttvNegociosDisponibles(): string[] {
    return [...new Set(this.ttvItems.map(i=>i.negocio).filter(Boolean))].sort() as string[];
  }

  get ttvHayEdiciones(): boolean { return this.ttvItems.some(i=>i.editando); }

  fmtFecha(iso: string):    string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'});
  }
}