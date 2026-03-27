import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const MESES: Record<number, string> = {
  1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',
  7:'Julio',8:'Agosto',9:'Setiembre',10:'Octubre',11:'Noviembre',12:'Diciembre',
};

const CANALES_OFF  = ['OFF', 'OFF TOP', 'TELSELL'];
const CANALES_MAYO = ['MAYO', 'SUB'];

// ── Interfaces existentes ──────────────────────────────────────────────────
export interface CanalOptimo {
  canal:          string;
  precio_base:    number;
  tipo_accion:    string;
  accion_texto:   string;
  rango_texto:    string;
  rango_min:      number;
  rango_max:      number | null;
  ts_por_paquete: number;
  paq_max:        number | null;
  ttv_potencial:  number | null;
  ingreso_neto:   number | null;
}

export interface SkuOptimo {
  politica_id:   number;
  cd_pauser:     number;
  sku_gerencial: string;
  nombre:        string;
  negocio:       string;
  mc:            number;
  flete:         number;
  und_x_pqt:    number;
  canales:       CanalOptimo[];
  mejor_canal:   string;
  paq_max_mejor: number | null;
  ttv_potencial: number | null;
}

export interface SimuladorOptimoData {
  agencia:        string;
  agencia_codigo: string;
  anio:           number;
  mes:            number;
  limite_ts_pct:  number;
  estado_actual: {
    fact_teorica: number;
    fact_real:    number;
    ts_soles:     number;
    ts_pct:       number;
    ya_excede:    boolean;
    semaforo:     string;
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

export interface HistorialPrecio {
  agencia:     string;
  mes:         number;
  anio:        number;
  skus_count:  number;
  fecha_carga: string;
  archivo:     string;
}

export interface HistorialChess {
  agencia:        string;
  agencia_codigo: string;
  anio:           number;
  mes:            number;
  total_filas:    number;
  paquetes_total: number;
  ttv_total:      number;
  ultimo_sync:    string;
  negocios_count: number;
}

// ── Interfaces Cierre CP ───────────────────────────────────────────────────
export interface SkuCierre {
  cod_sku:       number;
  sku:           string;
  sku_gerencial: string;
  negocio:       string;
  mc:            number;
  flete:         number;
  // OFF+TELSELL
  off_cfs:   number;
  off_pqts:  number;
  off_ttv:   number;   // precio promedio real
  off_gap:   number;
  off_peso:  number;   // % sobre TT
  // MAYO+SUB
  mayo_cfs:  number;
  mayo_pqts: number;
  mayo_ttv:  number;
  mayo_gap:  number;
  mayo_peso: number;
  // TT total
  tt_cfs:    number;
  tt_pqts:   number;
  tt_ttv:    number;
  tt_gap:    number;
  // Resumen motor s/igv
  por_precio:  number;
  por_canal:   number;
  ttv_tp:      number;
  ttv_real:    number;
  ts_soles:    number;
  ts_pct:      number;
  // Equivalente Excel c/igv (×K)
  excel_ttv_tp:   number;
  excel_ttv_real: number;
  excel_ts_soles: number;
  excel_ts_pct:   number;
}

export interface CierreResumen {
  off_pqts:  number;
  mayo_pqts: number;
  tt_pqts:   number;
  off_gap:   number;
  mayo_gap:  number;
  tt_gap:    number;
  ttv_tp:    number;
  ttv_real:  number;
  ts_soles:  number;
  ts_pct:    number;
  excel_ttv_tp:   number;
  excel_ttv_real: number;
  excel_ts_soles: number;
  excel_ts_pct:   number;
}

type Tab = 'simulador' | 'precios' | 'chess' | 'cierre';

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
  formAgencia  = 'CHM';
  formAnio     = new Date().getFullYear();
  formMes      = new Date().getMonth() + 1;
  formNegocio  = '';
  filtroNegocioTabla = '';

  data:    SimuladorOptimoData | null = null;
  cargando = false;
  error:   string | null = null;

  // ── Precios ────────────────────────────────────────────────────────────────
  historialPrecios: HistorialPrecio[] = [];
  cargandoPrecios  = false;

  // ── Chess ──────────────────────────────────────────────────────────────────
  historialChess: HistorialChess[] = [];
  cargandoChess  = false;

  // ── Cierre CP ──────────────────────────────────────────────────────────────
  cierreAgencia  = 'CHM';
  cierreAnio     = new Date().getFullYear();
  cierreMes      = new Date().getMonth() + 1;
  cierreNegocio  = '';
  cierreRows:    SkuCierre[]     = [];
  cierreResumen: CierreResumen | null = null;
  cargandoCierre = false;
  errorCierre:   string | null   = null;
  modoTTV: 'sigv' | 'cigv'       = 'sigv';  // toggle s/igv ↔ c/igv Excel
  filtroCierreNegocio = '';
  limiteTs = 0;

  readonly mesesOpciones = Object.entries(MESES).map(([n,l])=>({num:Number(n),label:l}));
  readonly aniosOpciones = [new Date().getFullYear(), new Date().getFullYear()-1];
  readonly mesesLabels   = MESES;

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.cargar(); }

  // ── Tab ────────────────────────────────────────────────────────────────────
  cambiarTab(tab: Tab): void {
    this.tabActual = tab;
    if (tab === 'precios' && !this.historialPrecios.length) this.cargarPrecios();
    if (tab === 'chess'   && !this.historialChess.length)   this.cargarChess();
    if (tab === 'cierre'  && !this.cierreRows.length)       this.cargarCierre();
  }

  refrescar(): void {
    if (this.tabActual === 'simulador') this.cargar();
    if (this.tabActual === 'precios')   this.cargarPrecios();
    if (this.tabActual === 'chess')     this.cargarChess();
    if (this.tabActual === 'cierre')    this.cargarCierre();
  }

  // ── Simulador ──────────────────────────────────────────────────────────────
  cargar(): void {
    this.cargando = true;
    this.error    = null;
    const q = this.formNegocio ? `?negocio=${encodeURIComponent(this.formNegocio)}` : '';
    const url = `${environment.apiUrl}/trade-spend/simulador-optimo/${this.formAgencia}/${this.formAnio}/${this.formMes}${q}`;
    this.http.get<SimuladorOptimoData>(url).subscribe({
      next:  d   => { this.data = d; this.cargando = false; },
      error: err => { this.error = err.error?.detail ?? 'Error al calcular'; this.cargando = false; },
    });
  }

  // ── Precios ────────────────────────────────────────────────────────────────
  cargarPrecios(): void {
    this.cargandoPrecios = true;
    this.http.get<any[]>(`${environment.apiUrl}/trade-spend/cargas/`).subscribe({
      next: d => {
        this.historialPrecios = d
          .filter(c => c.tipo === 'precios' || c.tipo === 'tabla_precios')
          .map(c => ({
            agencia:     c.agencia,
            mes:         c.mes,
            anio:        c.anio,
            skus_count:  c.filas ?? c.filas_cargadas ?? 0,
            fecha_carga: c.fecha_carga ?? c.fecha,
            archivo:     c.archivo ?? c.nombre_archivo,
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
      next:  d  => { this.historialChess = d; this.cargandoChess = false; },
      error: () => { this.cargandoChess = false; },
    });
  }

  // ── Cierre CP ──────────────────────────────────────────────────────────────
  cargarCierre(): void {
    this.cargandoCierre  = true;
    this.errorCierre     = null;
    this.cierreRows      = [];
    this.cierreResumen   = null;

    const url = `${environment.apiUrl}/trade-spend/resultado/${this.cierreAgencia}/${this.cierreAnio}/${this.cierreMes}`;
    this.http.get<any>(url).subscribe({
      next: resp => {
        this.limiteTs   = resp.limite_ts_pct ?? 0;
        this.cierreRows = this.pivotarCierre(resp.skus ?? []);
        this.cierreResumen = this.calcularResumen(this.cierreRows);
        if (this.cierreResumen.ttv_tp > 0) {
          this.cierreResumen.ts_pct       = this.cierreResumen.ts_soles  / this.cierreResumen.ttv_tp  * 100;
          this.cierreResumen.excel_ts_pct = this.cierreResumen.excel_ts_soles / this.cierreResumen.excel_ttv_tp * 100;
        }
        this.cargandoCierre = false;
      },
      error: err => {
        this.errorCierre    = err.error?.detail ?? 'Error al cargar cierre';
        this.cargandoCierre = false;
      },
    });
  }

  private pivotarCierre(skus: any[]): SkuCierre[] {
    const map = new Map<number, any[]>();
    for (const s of skus) {
      const key = s.cod_sku;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    const resultado: SkuCierre[] = [];
    const K = 1.2036; // 1.18 * 1.02 factor IGV+Percepción

    map.forEach((filas, cod_sku) => {
      const base = filas[0];
      const offFilas  = filas.filter(f => CANALES_OFF.includes((f.canal||'').toUpperCase().trim()));
      const mayoFilas = filas.filter(f => CANALES_MAYO.includes((f.canal||'').toUpperCase().trim()));

      // OFF
      const off_pqts = offFilas.reduce((a, f) => a + (f.paquetes_total   ?? 0), 0);
      const off_cfs  = offFilas.reduce((a, f) => a + (f.paquetes_pagados ?? 0), 0);
      const off_real = offFilas.reduce((a, f) => a + (f.ttv_real         ?? 0), 0);
      const off_tp   = offFilas.reduce((a, f) => a + (f.ttv_teorico      ?? 0), 0);
      const off_gap  = off_real - off_tp;

      // MAYO
      const mayo_pqts = mayoFilas.reduce((a, f) => a + (f.paquetes_total   ?? 0), 0);
      const mayo_cfs  = mayoFilas.reduce((a, f) => a + (f.paquetes_pagados ?? 0), 0);
      const mayo_real = mayoFilas.reduce((a, f) => a + (f.ttv_real         ?? 0), 0);
      const mayo_tp   = mayoFilas.reduce((a, f) => a + (f.ttv_teorico      ?? 0), 0);
      const mayo_gap  = mayo_real - mayo_tp;

      // TT
      const tt_pqts = off_pqts + mayo_pqts;
      const tt_cfs  = off_cfs  + mayo_cfs;
      const tt_real = off_real + mayo_real;
      const tt_tp   = off_tp   + mayo_tp;
      const tt_gap  = tt_real  - tt_tp;

      // TS motor s/igv
      const ts_soles = -tt_gap;
      const ts_pct   = tt_tp > 0 ? (ts_soles / tt_tp) * 100 : 0;

      // Desglose por precio vs por canal
      const precio_off_base  = offFilas[0]?.ttv_paquete  ?? 0;
      const tp_todo_off      = tt_pqts * precio_off_base;   // Si todo fuera OFF
      const por_canal        = tt_tp - tp_todo_off;          // diferencia por mix de canal
      const por_precio       = tt_gap - por_canal;           // diferencia por precio real

      // Excel c/igv (aproximado)
      const excel_ttv_tp   = tt_tp   * K;
      const excel_ttv_real = tt_real * K;
      const excel_ts_soles = excel_ttv_tp - excel_ttv_real;
      const excel_ts_pct   = excel_ttv_tp > 0 ? (excel_ts_soles / excel_ttv_tp) * 100 : 0;

      resultado.push({
        cod_sku,
        sku:           base.sku           ?? '',
        sku_gerencial: base.sku_gerencial ?? '',
        negocio:       base.negocio       ?? '',
        mc:            base.mc            ?? 0,
        flete:         base.flete         ?? 0,
        off_cfs,
        off_pqts,
        off_ttv:  off_pqts  > 0 ? off_real  / off_pqts  : 0,
        off_gap,
        off_peso: tt_pqts   > 0 ? (off_pqts  / tt_pqts) * 100 : 0,
        mayo_cfs,
        mayo_pqts,
        mayo_ttv: mayo_pqts > 0 ? mayo_real / mayo_pqts : 0,
        mayo_gap,
        mayo_peso: tt_pqts  > 0 ? (mayo_pqts / tt_pqts) * 100 : 0,
        tt_cfs,
        tt_pqts,
        tt_ttv: tt_pqts > 0 ? tt_real / tt_pqts : 0,
        tt_gap,
        por_precio,
        por_canal,
        ttv_tp:   tt_tp,
        ttv_real: tt_real,
        ts_soles,
        ts_pct,
        excel_ttv_tp,
        excel_ttv_real,
        excel_ts_soles,
        excel_ts_pct,
      });
    });

    return resultado.sort((a, b) =>
      a.negocio.localeCompare(b.negocio) || b.ttv_real - a.ttv_real
    );
  }

  private calcularResumen(rows: SkuCierre[]): CierreResumen {
    const ttv_tp   = rows.reduce((a, r) => a + r.ttv_tp,         0);
    const ttv_real = rows.reduce((a, r) => a + r.ttv_real,       0);
    const ts_soles = rows.reduce((a, r) => a + r.ts_soles,       0);
    const e_tp     = rows.reduce((a, r) => a + r.excel_ttv_tp,   0);
    const e_real   = rows.reduce((a, r) => a + r.excel_ttv_real, 0);
    return {
      off_pqts:       rows.reduce((a, r) => a + r.off_pqts,  0),
      mayo_pqts:      rows.reduce((a, r) => a + r.mayo_pqts, 0),
      tt_pqts:        rows.reduce((a, r) => a + r.tt_pqts,   0),
      off_gap:        rows.reduce((a, r) => a + r.off_gap,   0),
      mayo_gap:       rows.reduce((a, r) => a + r.mayo_gap,  0),
      tt_gap:         rows.reduce((a, r) => a + r.tt_gap,    0),
      ttv_tp,
      ttv_real,
      ts_soles,
      ts_pct:         0,  // se calcula después
      excel_ttv_tp:   e_tp,
      excel_ttv_real: e_real,
      excel_ts_soles: e_tp - e_real,
      excel_ts_pct:   0,  // se calcula después
    };
  }

  // ── Computed: Cierre ───────────────────────────────────────────────────────
  get cierreRowsFiltradas(): SkuCierre[] {
    if (!this.filtroCierreNegocio) return this.cierreRows;
    return this.cierreRows.filter(r => r.negocio === this.filtroCierreNegocio);
  }

  get cierreNegociosDisponibles(): string[] {
    return [...new Set(this.cierreRows.map(r => r.negocio).filter(Boolean))].sort();
  }

  // Grupos por negocio para el subtotal entre negocios
  get cierreGrupos(): { negocio: string; rows: SkuCierre[]; sub: CierreResumen }[] {
    const negocios = this.cierreNegociosDisponibles;
    return negocios.map(n => {
      const rows = this.cierreRowsFiltradas.filter(r => r.negocio === n);
      const sub  = this.calcularResumen(rows);
      if (sub.ttv_tp > 0) {
        sub.ts_pct       = sub.ts_soles / sub.ttv_tp * 100;
        sub.excel_ts_pct = sub.excel_ts_soles / sub.excel_ttv_tp * 100;
      }
      return { negocio: n, rows, sub };
    });
  }

  semaforoCierre(ts_pct: number): string {
    const lim = this.limiteTs;
    if (ts_pct > lim)          return 'rojo';
    if (ts_pct > lim * 0.85)   return 'amarillo';
    return 'verde';
  }

  // ── Helpers tabla simulador ────────────────────────────────────────────────
  get negociosDisponibles(): string[] {
    if (!this.data) return [];
    return [...new Set(this.data.skus.map(s=>s.negocio).filter(Boolean))].sort();
  }

  get skusFiltrados(): SkuOptimo[] {
    if (!this.data) return [];
    return this.filtroNegocioTabla
      ? this.data.skus.filter(s=>s.negocio===this.filtroNegocioTabla)
      : this.data.skus;
  }

  getTrad(sku: SkuOptimo): CanalOptimo | null {
    return sku.canales.find(c=>c.canal==='Tradicional') ?? null;
  }

  getMayo(sku: SkuOptimo): CanalOptimo | null {
    return sku.canales.find(c=>c.canal==='Mayorista') ?? null;
  }

  barPct(valor: number, limite: number): number {
    return !limite ? 0 : Math.min((valor/limite)*100, 100);
  }

  badgeAccion(tipo: string): string {
    if (tipo==='bonificacion') return 'sop-badge sop-badge-boni';
    if (tipo==='descuento')    return 'sop-badge sop-badge-dscto';
    return 'sop-badge sop-badge-sin';
  }

  // ── Formateo ───────────────────────────────────────────────────────────────
  fmtMoney(n: number): string {
    return 'S/ '+(n??0).toLocaleString('es-PE',{minimumFractionDigits:0,maximumFractionDigits:0});
  }

  fmtPct(n: number): string { return (n??0).toFixed(2)+'%'; }

  fmtNum(n: number, dec=0): string {
    return (n??0).toLocaleString('es-PE',{minimumFractionDigits:dec,maximumFractionDigits:dec});
  }

  fmtFecha(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'});
  }

  fmtGap(n: number): string {
    if (n === 0) return '—';
    const abs = Math.abs(n).toLocaleString('es-PE', {minimumFractionDigits:0, maximumFractionDigits:0});
    return (n < 0 ? '-' : '+') + abs;
  }
}