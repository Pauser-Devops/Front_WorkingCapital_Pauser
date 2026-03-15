import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];



interface Fila {
  id_pop: string;
  fecha_ib: string;
  sucursal: string;
  entidad: string;
  banco_ib: string;
  nro_op: string;
  monto_ib: number;
  fecha_rb: string;
  banco_rb: string;
  mes_rb: string
  monto_rb: number;
  diferencia: number;
  estado: 'ok' | 'dif_monto' | 'no_encontrado';
}

interface ChartDia {
  fecha: string;
  ok: number;
  dif: number;
  no_enc: number;
  monto_ib: number;
  monto_rb: number;
}

interface Totales {
  total: number;
  ok: number;
  dif_monto: number;
  no_encontrado: number;
  monto_ib: number;
  monto_rb: number;
  dif_total: number;
}


@Component({
  selector: 'app-comparador-bancario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comparador-bancario.component.html',
  styleUrls: ['./comparador-bancario.component.css']
})
export class ComparadorBancarioComponent implements OnInit {
  meses = MESES;
  mesActivo = new Date().toLocaleString('es-PE', { month: 'long' }).toLowerCase();

  cargando = false;
  error = '';

  filas: Fila[] = [];
  filasFiltradas: Fila[] = [];
  chart: ChartDia[] = [];
  totales: Totales | null = null;

  sucursales: string[] = [];
  entidades: string[] = [];
  bancos: string[] = [];

  filtroSucursal = 'TODAS';
  filtroEntidad = 'TODAS';
  filtroBanco = 'TODOS';
  filtroEstado: 'todos' | 'ok' | 'dif_monto' | 'no_encontrado' = 'todos';
  busqueda = '';
  paginaActual = 1;
  porPagina = 50;
  totalesFiltrados: Totales | null = null;
  tooltipDia: any = null;
  Math = Math;
  chartFiltrado: ChartDia[] = [];
  constructor(private http: HttpClient) { }

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.error = '';
    this.http.get<any>(`${API}/comparador/resumen?mes=${this.mesActivo}`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          this.filas = r.filas;
          this.totales = r.totales;
          this.chart = r.chart;
          this.construirFiltros();
          this.aplicarFiltros();
          this.recalcularKpisChart();
        } else {
          this.error = r.detalle;
        }
      },
      error: () => { this.cargando = false; this.error = 'Error de conexión'; }
    });
  }

  construirFiltros() {
    this.sucursales = [...new Set(this.filas.map(f => f.sucursal))].sort();
    this.entidades = [...new Set(this.filas.map(f => f.entidad).filter(Boolean))].sort();
    this.bancos = [...new Set(this.filas.map(f => f.banco_ib).filter(Boolean))].sort();
  }

  aplicarFiltros() {
    let data = [...this.filas];

    if (this.filtroSucursal !== 'TODAS')
      data = data.filter(f => f.sucursal === this.filtroSucursal);
    if (this.filtroEntidad !== 'TODAS')
      data = data.filter(f => f.entidad === this.filtroEntidad);
    if (this.filtroBanco !== 'TODOS')
      data = data.filter(f => f.banco_ib === this.filtroBanco);
    if (this.filtroEstado !== 'todos')
      data = data.filter(f => f.estado === this.filtroEstado);
    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      data = data.filter(f =>
        f.id_pop.includes(q) || f.sucursal.toLowerCase().includes(q) ||
        f.entidad.toLowerCase().includes(q) || f.banco_ib.toLowerCase().includes(q)
      );
    }

    this.filasFiltradas = data;
    this.paginaActual = 1; // resetear al filtrar
    this.recalcularKpisChart();
  }

  seleccionarMes(mes: string) {
    this.mesActivo = mes;
    this.filtroSucursal = 'TODAS';
    this.filtroEntidad = 'TODAS';
    this.filtroBanco = 'TODOS';
    this.filtroEstado = 'todos';
    this.busqueda = '';
    this.cargar();
  }

  setFiltroEstado(e: 'todos' | 'ok' | 'dif_monto' | 'no_encontrado') {
    this.filtroEstado = e;
    this.aplicarFiltros();
  }
  barH(val: number): number {
    if (val <= 0) return 0;
    const pct = Math.round((val / this.maxChartMonto) * 100);
    return Math.max(pct, 3); // mínimo 3% para que siempre se vea
  }
  fmt(n: number) {
    return 'S/ ' + n.toLocaleString('es-PE', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  fmtK(n: number) {
    if (n >= 1_000_000) return 'S/ ' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return 'S/ ' + (n / 1_000).toFixed(0) + 'K';
    return 'S/ ' + n.toFixed(0);
  }

  fmtFecha(f: string) {
    if (!f) return '—';
    return f.slice(8) + '/' + f.slice(5, 7) + '/' + f.slice(0, 4);
  }

  get pctOk() {
    return this.totales ? Math.round(this.totales.ok / Math.max(this.totales.total, 1) * 100) : 0;
  }


  get filasPaginadas(): Fila[] {
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.filasFiltradas.slice(inicio, inicio + this.porPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.filasFiltradas.length / this.porPagina);
  }

  get paginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (actual <= 4) return [1, 2, 3, 4, 5, 0, total];
    if (actual >= total - 3) return [1, 0, total - 4, total - 3, total - 2, total - 1, total];
    return [1, 0, actual - 1, actual, actual + 1, 0, total];
  }

  irPagina(p: number) {
    if (p < 1 || p > this.totalPaginas) return;
    this.paginaActual = p;
  }
  recalcularKpisChart() {
    const data = this.filasFiltradas;

    this.totalesFiltrados = {
      total: data.length,
      ok: data.filter(f => f.estado === 'ok').length,
      dif_monto: data.filter(f => f.estado === 'dif_monto').length,
      no_encontrado: data.filter(f => f.estado === 'no_encontrado').length,
      monto_ib: data.reduce((s, f) => s + f.monto_ib, 0),
      monto_rb: data.reduce((s, f) => s + f.monto_rb, 0),
      dif_total: Math.round(data.reduce((s, f) => s + f.diferencia, 0) * 100) / 100,
    };

    // Chart dinámico
    const dias: Record<string, ChartDia> = {};
    for (const f of data) {
      const d = f.fecha_ib;
      if (!dias[d]) dias[d] = { fecha: d, ok: 0, dif: 0, no_enc: 0, monto_ib: 0, monto_rb: 0 };
      dias[d].monto_ib += f.monto_ib;
      dias[d].monto_rb += f.monto_rb;
      if (f.estado === 'ok') dias[d].ok++;
      else if (f.estado === 'dif_monto') dias[d].dif++;
      else dias[d].no_enc++;
    }
    this.chartFiltrado = Object.values(dias).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  get pctOkFiltrado(): number {
    if (!this.totalesFiltrados || !this.totales) return 0;
    return Math.floor((this.totalesFiltrados.ok / Math.max(this.totales.total, 1)) * 10000) / 100;
  }
  get pctDifFiltrado(): number {
    if (!this.totalesFiltrados || !this.totales) return 0;
    return Math.floor((this.totalesFiltrados.dif_monto / Math.max(this.totales.total, 1)) * 10000) / 100;
  }
  get pctBarraProgreso(): number {
    if (!this.totalesFiltrados || !this.totales) return 0;
    const base = this.totales.total || 1;
    if (this.filtroEstado === 'dif_monto')
      return Math.floor((this.totalesFiltrados.dif_monto / base) * 10000) / 100;
    if (this.filtroEstado === 'no_encontrado')
      return Math.floor((this.totalesFiltrados.no_encontrado / base) * 10000) / 100;
    // ok o todos → siempre % de exactos sobre total real
    return Math.floor((this.totales.ok / base) * 10000) / 100;
  }

  get labelBarra(): string {
    if (this.filtroEstado === 'dif_monto') return 'Diferencia de monto';
    if (this.filtroEstado === 'no_encontrado') return 'No encontrados';
    return 'Coincidencia exacta';
  }

  get colorBarra(): string {
    if (this.filtroEstado === 'dif_monto') return '#f59e0b';
    if (this.filtroEstado === 'no_encontrado') return '#dc2626';
    return '#16a34a';
  }
  get maxChartMonto() {
    return Math.max(...this.chartFiltrado.map(d => Math.max(d.monto_ib, d.monto_rb)), 1);
  }
  tooltipX = 0;
  tooltipY = 0;

  onBarEnter(d: ChartDia, event: MouseEvent) {
    this.tooltipDia = d;
    this.tooltipX = event.clientX;
    this.tooltipY = event.clientY;
  }

  onBarMove(event: MouseEvent) {
    if (this.tooltipDia) {
      this.tooltipX = event.clientX;
      this.tooltipY = event.clientY;
    }
  }
}