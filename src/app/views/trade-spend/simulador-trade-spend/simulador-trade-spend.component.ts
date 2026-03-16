import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Simulacion {
  id?: number;
  nombre: string;
  agencia: string;
  mes: string;
  canal: string;
  negocio: string;
  estado: 'borrador' | 'aprobado' | 'excede_limite';
  fecha: string;
  skus: SkuSimulado[];
  ttv_estimado?: number;
  costo_ts?: number;
  pct_ts?: number;
  gap?: number;
}

export interface SkuSimulado {
  cod_sku: number;
  nombre: string;
  negocio: string;
  precio_base: number;
  und_pqt: number;
  rango_seleccionado: string;
  accion: string;
  tipo_accion: 'Boni' | 'Descuento' | 'Sin Acción';
  bonif_und: number;
  venta_paq: number;
  dscto: number;
  precio_final: number;
  mg_pct: number;
  pqts_estimados: number;
  ttv: number;
  costo_ts: number;
  pct_ts: number;
  gap: number;
}

export interface ResumenAgencia {
  agencia: string;
  ttv_simulado: number;
  pct_ts: number;
  excede_limite: boolean;
  negocios: {
    negocio: string;
    pqts: number;
    ttv: number;
    pct_ts: number;
    gap: number;
  }[];
}

// ── Datos mock (se reemplazarán por llamadas HTTP al backend) ────────────────

const SIMULACIONES_MOCK: Simulacion[] = [
  {
    id: 1,
    nombre: 'Enero CHM – Pepsi + CC',
    agencia: 'Chimbote',
    mes: 'Enero 2026',
    canal: 'OFF + TELSELL',
    negocio: 'Todas',
    estado: 'aprobado',
    fecha: '08 Ene 2026',
    skus: [],
    ttv_estimado: 34210,
    costo_ts: 3147,
    pct_ts: 9.2,
    gap: 2340,
  },
  {
    id: 2,
    nombre: 'Enero CHM – Gatorade',
    agencia: 'Chimbote',
    mes: 'Enero 2026',
    canal: 'OFF',
    negocio: 'Gatorade',
    estado: 'aprobado',
    fecha: '08 Ene 2026',
    skus: [],
    ttv_estimado: 21800,
    costo_ts: 1700,
    pct_ts: 7.8,
    gap: 980,
  },
  {
    id: 3,
    nombre: 'Enero HRZ – Agua SC',
    agencia: 'Huaraz',
    mes: 'Enero 2026',
    canal: 'OFF + MAYO',
    negocio: 'Agua',
    estado: 'excede_limite',
    fecha: '09 Ene 2026',
    skus: [],
    ttv_estimado: 18420,
    costo_ts: 1860,
    pct_ts: 10.1,
    gap: -420,
  },
  {
    id: 4,
    nombre: 'Enero HRZ – Red Bull',
    agencia: 'Huaraz',
    mes: 'Enero 2026',
    canal: 'OFF TOP',
    negocio: 'Licores',
    estado: 'borrador',
    fecha: '10 Ene 2026',
    skus: [],
    ttv_estimado: 13000,
    costo_ts: 923,
    pct_ts: 7.1,
    gap: 340,
  },
];

const SKUS_MOCK: SkuSimulado[] = [
  {
    cod_sku: 21738,
    nombre: 'PEPSI CSD 355ml',
    negocio: 'CSD',
    precio_base: 12.5,
    und_pqt: 15,
    rango_seleccionado: '6 a 29 PAQ',
    accion: '6 PAQ + 10 BOT',
    tipo_accion: 'Boni',
    bonif_und: 10,
    venta_paq: 6,
    dscto: 0,
    precio_final: 11.25,
    mg_pct: 33.3,
    pqts_estimados: 686,
    ttv: 7716,
    costo_ts: 428,
    pct_ts: 5.5,
    gap: 312,
  },
  {
    cod_sku: 21741,
    nombre: 'PEPSI 750ml',
    negocio: 'CSD',
    precio_base: 26.18,
    und_pqt: 12,
    rango_seleccionado: '2 a 29 PAQ',
    accion: '2 PAQ + 2 BOT',
    tipo_accion: 'Boni',
    bonif_und: 2,
    venta_paq: 2,
    dscto: 0,
    precio_final: 24.17,
    mg_pct: 24.1,
    pqts_estimados: 1129,
    ttv: 9589,
    costo_ts: 1021,
    pct_ts: 10.6,
    gap: -456,
  },
  {
    cod_sku: 3724,
    nombre: 'CC 500ml (Fresa/Piña)',
    negocio: 'CSD',
    precio_base: 22.55,
    und_pqt: 15,
    rango_seleccionado: '6 a 29 PAQ',
    accion: '6 PAQ + 12 BOT',
    tipo_accion: 'Boni',
    bonif_und: 12,
    venta_paq: 6,
    dscto: 0,
    precio_final: 19.9,
    mg_pct: 35.7,
    pqts_estimados: 490,
    ttv: 9751,
    costo_ts: 892,
    pct_ts: 9.1,
    gap: 198,
  },
  {
    cod_sku: 22500,
    nombre: 'GATORADE 500ml',
    negocio: 'Isotónico',
    precio_base: 22.44,
    und_pqt: 12,
    rango_seleccionado: '6 a 49 PAQ',
    accion: '6 PAQ + 12 BOT',
    tipo_accion: 'Boni',
    bonif_und: 12,
    venta_paq: 6,
    dscto: 0,
    precio_final: 19.23,
    mg_pct: 37.3,
    pqts_estimados: 2282,
    ttv: 5274,
    costo_ts: 622,
    pct_ts: 11.8,
    gap: -140,
  },
  {
    cod_sku: 21746,
    nombre: 'PEPSI 3Lts',
    negocio: 'CSD',
    precio_base: 28.2,
    und_pqt: 4,
    rango_seleccionado: '60 a Más',
    accion: 'Dscto 12%',
    tipo_accion: 'Descuento',
    bonif_und: 0,
    venta_paq: 60,
    dscto: 0.12,
    precio_final: 24.5,
    mg_pct: 30.6,
    pqts_estimados: 956,
    ttv: 1880,
    costo_ts: 184,
    pct_ts: 9.8,
    gap: 89,
  },
];

// ── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-simulador-trade-spend',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulador-trade-spend.component.html',
  styleUrls: ['./simulador-trade-spend.component.css'],
})
export class SimuladorTradeSpendComponent implements OnInit {

  // ── Navegación entre pantallas ─────────────────────────────────────────────
  vistaActual: 'lista' | 'nueva' | 'resultado' | 'resumen' = 'lista';
  pasoActual = 2; // wizard: 1=contexto, 2=skus, 3=volumen, 4=resultado

  // ── Lista de simulaciones ──────────────────────────────────────────────────
  simulaciones: Simulacion[] = [];
  filtroAgencia = 'Todas las agencias';
  cargando = false;

  // ── Formulario nueva simulación ────────────────────────────────────────────
  formSimulacion: Simulacion = this.getSimulacionVacia();
  skusSimulados: SkuSimulado[] = [];

  // ── Resultado de la simulación activa ─────────────────────────────────────
  simulacionActiva: Simulacion | null = null;
  ttvBase = 37357;
  bonificaciones = 2441;
  descuentos = 706;

  // ── Resumen por agencia ────────────────────────────────────────────────────
  resumenAgencias: ResumenAgencia[] = [];

  // ── Opciones para selects ──────────────────────────────────────────────────
  readonly agencias = ['Chimbote', 'Huaraz'];
  readonly meses = ['Enero 2026', 'Febrero 2026', 'Marzo 2026'];
  readonly canales = ['OFF', 'TELSELL', 'OFF TOP', 'MAYO', 'SUB/DISTRIBUIDOR'];
  readonly negocios = ['Todas', 'CSD', 'Agua', 'Gatorade', 'Licores'];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarSimulaciones();
    this.cargarResumenAgencias();
  }

  // ── Navegación ─────────────────────────────────────────────────────────────

  irA(vista: 'lista' | 'nueva' | 'resultado' | 'resumen'): void {
    this.vistaActual = vista;
  }

  verSimulacion(sim: Simulacion): void {
    this.simulacionActiva = sim;
    this.skusSimulados = [...SKUS_MOCK]; // TODO: cargar desde API por sim.id
    this.irA('resultado');
  }

  nuevaSimulacion(): void {
    this.formSimulacion = this.getSimulacionVacia();
    this.skusSimulados = [...SKUS_MOCK];
    this.pasoActual = 2;
    this.irA('nueva');
  }

  // ── Carga de datos (se conectará al backend) ───────────────────────────────

  cargarSimulaciones(): void {
    this.cargando = true;
    // TODO: reemplazar por llamada real:
    // this.http.get<Simulacion[]>(`${environment.apiUrl}/trade-spend/simulaciones`)
    //   .subscribe(data => { this.simulaciones = data; this.cargando = false; });
    setTimeout(() => {
      this.simulaciones = [...SIMULACIONES_MOCK];
      this.cargando = false;
    }, 0);
  }

  cargarResumenAgencias(): void {
    // TODO: this.http.get<ResumenAgencia[]>(`${environment.apiUrl}/trade-spend/resumen`)
    this.resumenAgencias = [
      {
        agencia: 'Chimbote',
        ttv_simulado: 56010,
        pct_ts: 8.47,
        excede_limite: false,
        negocios: [
          { negocio: 'Agua',    pqts: 3338, ttv: 22280, pct_ts: 8.7,  gap: 890  },
          { negocio: 'CSD',     pqts: 2900, ttv: 19450, pct_ts: 8.2,  gap: 440  },
          { negocio: 'Gatorade',pqts: 1050, ttv: 9280,  pct_ts: 9.1,  gap: -320 },
          { negocio: 'Licores', pqts: 420,  ttv: 5000,  pct_ts: 7.1,  gap: 210  },
        ],
      },
      {
        agencia: 'Huaraz',
        ttv_simulado: 31420,
        pct_ts: 10.1,
        excede_limite: true,
        negocios: [
          { negocio: 'Agua',    pqts: 6906, ttv: 14360, pct_ts: 12.1, gap: -1200 },
          { negocio: 'CSD',     pqts: 1830, ttv: 8960,  pct_ts: 9.8,  gap: -180  },
          { negocio: 'Gatorade',pqts: 900,  ttv: 5100,  pct_ts: 8.2,  gap: 80    },
          { negocio: 'Licores', pqts: 200,  ttv: 3000,  pct_ts: 7.0,  gap: 95    },
        ],
      },
    ];
  }

  // ── Acciones del formulario ────────────────────────────────────────────────

  calcularResultado(): void {
    // Calcula TTV neto, costo TS y % TS sobre los skusSimulados
    const ttvNeto = this.skusSimulados.reduce((s, sku) => s + sku.ttv, 0);
    const costoTs = this.skusSimulados.reduce((s, sku) => s + sku.costo_ts, 0);
    this.formSimulacion.ttv_estimado = ttvNeto;
    this.formSimulacion.costo_ts = costoTs;
    this.formSimulacion.pct_ts = ttvNeto > 0 ? (costoTs / ttvNeto) * 100 : 0;
    this.simulacionActiva = { ...this.formSimulacion, skus: this.skusSimulados };
    this.irA('resultado');
  }

  guardarBorrador(): void {
    const payload = { ...this.formSimulacion, skus: this.skusSimulados, estado: 'borrador' };
    // TODO: this.http.post(`${environment.apiUrl}/trade-spend/simulaciones`, payload).subscribe(...)
    console.log('Guardar borrador:', payload);
  }

  aprobarSimulacion(): void {
    if (!this.simulacionActiva?.id) return;
    // TODO: this.http.patch(`${environment.apiUrl}/trade-spend/simulaciones/${this.simulacionActiva.id}/aprobar`, {}).subscribe(...)
    if (this.simulacionActiva) {
      this.simulacionActiva.estado = 'aprobado';
    }
  }

  // ── Helpers de vista ───────────────────────────────────────────────────────

  get simulacionesFiltradas(): Simulacion[] {
    if (this.filtroAgencia === 'Todas las agencias') return this.simulaciones;
    return this.simulaciones.filter(s => s.agencia === this.filtroAgencia);
  }

  get totalTTV(): number {
    return this.simulaciones.reduce((s, sim) => s + (sim.ttv_estimado ?? 0), 0);
  }

  get promPctTS(): number {
    const total = this.simulaciones.reduce((s, sim) => s + (sim.pct_ts ?? 0), 0);
    return this.simulaciones.length > 0 ? total / this.simulaciones.length : 0;
  }

  get ttvNeto(): number {
    return this.ttvBase - this.bonificaciones - this.descuentos;
  }

  get cantBonificaciones(): number {
    return this.skusSimulados.filter(s => s.tipo_accion === 'Boni').length;
  }

  get cantDescuentos(): number {
    return this.skusSimulados.filter(s => s.tipo_accion === 'Descuento').length;
  }

  get skusConProblema(): SkuSimulado[] {
    return this.skusSimulados.filter(s => s.pct_ts > 10);
  }

  badgeEstado(estado: string): string {
    const map: Record<string, string> = {
      aprobado: 'badge-pos',
      excede_limite: 'badge-neg',
      borrador: 'badge-sin',
    };
    return map[estado] ?? 'badge-sin';
  }

  labelEstado(estado: string): string {
    const map: Record<string, string> = {
      aprobado: 'Aprobado',
      excede_limite: 'Excede límite',
      borrador: 'Borrador',
    };
    return map[estado] ?? estado;
  }

  badgeGap(gap: number): string {
    return gap >= 0 ? 'badge-pos' : 'badge-neg';
  }

  labelGap(gap: number): string {
    return (gap >= 0 ? '+' : '') + 'S/ ' + Math.abs(gap).toLocaleString('es-PE');
  }

  pctFill(pct: number, max = 15): number {
    return Math.min((pct / max) * 100, 100);
  }

  formatCurrency(val: number): string {
    return 'S/ ' + val.toLocaleString('es-PE', { minimumFractionDigits: 0 });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getSimulacionVacia(): Simulacion {
    return {
      nombre: '',
      agencia: 'Chimbote',
      mes: 'Enero 2026',
      canal: 'OFF',
      negocio: 'Todas',
      estado: 'borrador',
      fecha: new Date().toLocaleDateString('es-PE'),
      skus: [],
    };
  }
}