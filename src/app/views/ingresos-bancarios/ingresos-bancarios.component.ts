import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;
const ORDEN_MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

const BANCO_COLORES: Record<string, { color: string, light: string }> = {
  'BCP': { color: '#003F8A', light: '#e8f0fa' },
  'BCP TRU': { color: '#1565C0', light: '#e3eefa' },
  'BCP LN': { color: '#1976D2', light: '#e1eefb' },
  'BBVA': { color: '#004B95', light: '#e0ecfa' },
  'BBVA LM': { color: '#0057A8', light: '#e0eefb' },
  'Interbank': { color: '#007C5E', light: '#e0f5ee' },
  'Caja Arequipa': { color: '#B91C1C', light: '#fde8e8' },
};

@Component({
  selector: 'app-ingresos-bancarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ingresos-bancarios.component.html',
  styleUrls: ['./ingresos-bancarios.component.css']
})
export class IngresosBancariosComponent implements OnInit {
  cargando = false;
  error = '';

  meses: string[] = [];
  mesActivo = '';
  anioActual = new Date().getFullYear();

  todos: any[] = [];
  filtrados: any[] = [];

  // Filtros
  filtroBanco = 'TODOS';
  filtroSucursal = 'TODAS';
  filtroEntidad = 'TODAS';
  fechaDesde = '';
  fechaHasta = '';

  // Filtro rango ID POP
  idPopDesde = '';
  idPopHasta = '';

  // Listas únicas
  sucursales: string[] = [];
  bancos: string[] = [];
  entidades: string[] = [];

  // KPIs
  totalMonto = 0;
  totalRegistros = 0;
  totalConc = 0;
  totalSinConc = 0;
  pctConc = 0;
  montoConciliado = 0;
  montoSinConc = 0;
  ultimaSync = '';
  usuarioSync = '';
  // Charts
  porBanco: { label: string, monto: number, pct: number, color: string }[] = [];
  porSucursal: { label: string, monto: number, pct: number }[] = [];
  porEntidad: { label: string, monto: number, pct: number }[] = [];
  porDia: { fecha: string, fechaFull: string, monto: number, pct: number, alto: number }[] = [];

  // Tooltip
  tooltipDia: { fecha: string, monto: number } | null = null;
  tooltipX = 0;

  constructor(private http: HttpClient) {
    this.cargarSync();
  }

  ngOnInit() {
    this.cargarMeses();

  }
  cargarSync() {
    if (!this.mesActivo) return;
    const anio = new Date().getFullYear();
    this.http.get<any>(
      `${API}/sync/ultima?modulo=registro_ingresos&mes=${this.mesActivo}&anio=${anio}`
    ).subscribe({
      next: r => {
        if (r.estado === 'OK' && r.ultima_sync) {
          const fecha = new Date(r.ultima_sync);
          this.ultimaSync = fecha.toLocaleDateString('es-PE', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
          this.usuarioSync = r.usuario || '';
        } else {
          this.ultimaSync = '';  // limpia si no hay sync para ese mes
          this.usuarioSync = '';
        }
      }
    });
  }
  // ── Meses ─────────────────────────────────────────────

  cargarMeses() {
    this.http.get<any>(`${API}/ingresos/bancarios/meses`).subscribe({
      next: r => {
        if (r.estado === 'OK') {
          this.meses = [...r.meses].sort((a, b) =>
            (ORDEN_MESES[a.toLowerCase()] || 99) - (ORDEN_MESES[b.toLowerCase()] || 99)
          );
          if (this.meses.length) this.seleccionarMes(this.meses[0]);
        }
      },
      error: () => this.error = 'No se pudo conectar a la API'
    });

  }

  seleccionarMes(mes: string) {
    this.mesActivo = mes;
    this.filtroBanco = 'TODOS';
    this.filtroSucursal = 'TODAS';
    this.filtroEntidad = 'TODAS';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.idPopDesde = '';
    this.idPopHasta = '';
    this.tooltipDia = null;
    this.cargarDatos();
    this.cargarSync();
  }

  // ── Carga ─────────────────────────────────────────────

  cargarDatos() {
    this.cargando = true;
    this.error = '';
    let url = `${API}/ingresos/bancarios?mes=${this.mesActivo}`;
    if (this.fechaDesde) url += `&fecha_desde=${this.fechaDesde}`;
    if (this.fechaHasta) url += `&fecha_hasta=${this.fechaHasta}`;

    this.http.get<any>(url).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          this.todos = r.registros;
          this.construirFiltros();
          this.aplicarFiltros();
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar datos'; }
    });
  }

  construirFiltros() {
    const setSuc = new Set<string>();
    const setBan = new Set<string>();
    const setEnt = new Set<string>();
    for (const r of this.todos) {
      const suc = this.getSucursalDisplay(r);
      if (suc) setSuc.add(suc);
      if (r.banco_tabla) setBan.add(r.banco_tabla);
      if (r.entidad) setEnt.add(r.entidad);
    }
    this.sucursales = [...setSuc].sort();
    this.bancos = [...setBan].sort();
    this.entidades = [...setEnt].sort();
  }

  getSucursalDisplay(r: any): string {
    const suc = (r.sucursal || '').toUpperCase();
    if (suc.includes('CHIMBOTE')) {
      return (r.negocio || '').toUpperCase().includes('SNACK') ? 'CHIMBOTE SNACKS' : 'CHIMBOTE';
    }
    return r.sucursal || '';
  }

  // ── Filtros ───────────────────────────────────────────

  aplicarFiltros() {
    let data = [...this.todos];

    if (this.filtroSucursal !== 'TODAS')
      data = data.filter(r => this.getSucursalDisplay(r) === this.filtroSucursal);
    if (this.filtroBanco !== 'TODOS')
      data = data.filter(r => r.banco_tabla === this.filtroBanco);
    if (this.filtroEntidad !== 'TODAS')
      data = data.filter(r => r.entidad === this.filtroEntidad);

    // Filtro rango ID POP — compara numéricamente
    if (this.idPopDesde || this.idPopHasta) {
      const desde = this.idPopDesde ? parseInt(this.idPopDesde, 10) : null;
      const hasta = this.idPopHasta ? parseInt(this.idPopHasta, 10) : null;
      data = data.filter(r => {
        const id = parseInt((r.id_pop || '').toString().trim(), 10);
        if (isNaN(id)) return false;          // sin ID POP queda excluido
        if (desde !== null && id < desde) return false;
        if (hasta !== null && id > hasta) return false;
        return true;
      });
    }

    this.filtrados = data;
    this.calcularKPIs();
    this.calcularCharts();
  }

  setFiltroBanco(b: string) { this.filtroBanco = b; this.aplicarFiltros(); }
  setFiltroSucursal(s: string) { this.filtroSucursal = s; this.aplicarFiltros(); }
  setFiltroEntidad(e: string) { this.filtroEntidad = e; this.aplicarFiltros(); }
  onIdPopChange() { this.aplicarFiltros(); }   // llamar en (ngModelChange)

  // Fechas libres — recarga backend sin límite de mes
  setFechaDesde(v: string) { this.fechaDesde = v; this.cargarDatos(); }
  setFechaHasta(v: string) { this.fechaHasta = v; this.cargarDatos(); }

  limpiarFiltros() {
    this.filtroBanco = 'TODOS';
    this.filtroSucursal = 'TODAS';
    this.filtroEntidad = 'TODAS';
    this.idPopDesde = '';
    this.idPopHasta = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.cargarDatos();
  }

  // ── KPIs ──────────────────────────────────────────────

  calcularKPIs() {
    const d = this.filtrados;
    this.totalMonto = d.reduce((s, r) => s + (r.monto || 0), 0);
    this.totalRegistros = d.length;
    this.totalConc = d.filter(r => r.conciliado).length;
    this.totalSinConc = d.filter(r => !r.conciliado).length;
    this.pctConc = this.totalRegistros
      ? Number((this.totalConc / this.totalRegistros * 100).toFixed(2))
      : 0;
    this.montoConciliado = d.filter(r => r.conciliado).reduce((s, r) => s + (r.monto || 0), 0);
    this.montoSinConc = this.totalMonto - this.montoConciliado;
  }

  // ── Charts ────────────────────────────────────────────

  calcularCharts() {
    const base = [...this.todos];

    const mapBan: Record<string, number> = {};
    for (const r of base) {
      const k = r.banco_tabla || 'Sin banco';
      mapBan[k] = (mapBan[k] || 0) + (r.monto || 0);
    }
    const totalBan = Object.values(mapBan).reduce((a, b) => a + b, 0) || 1;
    this.porBanco = Object.entries(mapBan)
      .sort((a, b) => b[1] - a[1])
      .map(([label, monto]) => ({
        label, monto,
        pct: Math.round(monto / totalBan * 100),
        color: BANCO_COLORES[label]?.color || '#64748b'
      }));

    const mapSuc: Record<string, number> = {};
    for (const r of base) {
      const k = this.getSucursalDisplay(r) || 'Sin sucursal';
      mapSuc[k] = (mapSuc[k] || 0) + (r.monto || 0);
    }
    const totalSuc = Object.values(mapSuc).reduce((a, b) => a + b, 0) || 1;
    this.porSucursal = Object.entries(mapSuc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, monto]) => ({ label, monto, pct: Math.round(monto / totalSuc * 100) }));

    const mapEnt: Record<string, number> = {};
    for (const r of base) {
      const k = r.entidad || 'Sin entidad';
      mapEnt[k] = (mapEnt[k] || 0) + (r.monto || 0);
    }
    const totalEnt = Object.values(mapEnt).reduce((a, b) => a + b, 0) || 1;
    this.porEntidad = Object.entries(mapEnt)
      .sort((a, b) => b[1] - a[1])
      .map(([label, monto]) => ({ label, monto, pct: Math.round(monto / totalEnt * 100) }));

    const baseDia = (this.fechaDesde || this.fechaHasta) ? [...this.filtrados] : [...this.todos];
    const mapDia: Record<string, number> = {};
    for (const r of baseDia) {
      const f = r.fecha_registro ? String(r.fecha_registro).slice(0, 10) : null;
      if (!f) continue;
      mapDia[f] = (mapDia[f] || 0) + (r.monto || 0);
    }
    const valores = Object.values(mapDia);
    const maxVal = Math.max(...valores, 1);
    const minVal = Math.min(...valores, 0);
    const rango = maxVal - minVal || 1;

    this.porDia = Object.entries(mapDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, monto]) => ({
        fechaFull: fecha,
        fecha: fecha.slice(8) + '/' + fecha.slice(5, 7),
        monto,
        pct: Math.round(monto / maxVal * 100),
        alto: Math.round(15 + ((monto - minVal) / rango) * 75)
      }));
  }

  // ── Tooltip ───────────────────────────────────────────

  showTooltip(d: any, event: MouseEvent) {
    this.tooltipDia = { fecha: d.fechaFull, monto: d.monto };
    this.tooltipX = (event.target as HTMLElement).getBoundingClientRect().left;
  }
  hideTooltip() { this.tooltipDia = null; }

  // ── Utils ─────────────────────────────────────────────

  getBancoColor(label: string) { return BANCO_COLORES[label]?.color || '#64748b'; }

  fmt(n: number) {
    return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  fmtK(n: number) {
    if (n >= 1_000_000) return 'S/ ' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return 'S/ ' + (n / 1_000).toFixed(0) + 'K';
    return 'S/ ' + n.toFixed(0);
  }

  get mesLabel() { return this.mesActivo || '—'; }
  get pctBar() { return Math.max(2, this.pctConc); }
  get tieneFiltros() {
    return this.filtroBanco !== 'TODOS'
      || this.filtroSucursal !== 'TODAS'
      || this.filtroEntidad !== 'TODAS'
      || !!this.idPopDesde
      || !!this.idPopHasta
      || !!this.fechaDesde
      || !!this.fechaHasta;
  }
}