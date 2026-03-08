import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;
const ORDEN_MESES: Record<string, number> = {
  enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
  julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12
};

const BANCO_COLORES: Record<string, {color: string, bg: string, light: string}> = {
  'BCP':           { color: '#003F8A', bg: '#003F8A', light: '#e8f0fa' },
  'BCP TRU':       { color: '#1565C0', bg: '#1565C0', light: '#e3eefa' },
  'BCP LN':        { color: '#1976D2', bg: '#1976D2', light: '#e1eefb' },
  'BBVA':          { color: '#004B95', bg: '#004B95', light: '#e0ecfa' },
  'BBVA LM':       { color: '#0057A8', bg: '#0057A8', light: '#e0eefb' },
  'Interbank':     { color: '#007C5E', bg: '#007C5E', light: '#e0f5ee' },
  'Caja Arequipa': { color: '#B91C1C', bg: '#B91C1C', light: '#fde8e8' },
};

@Component({
  selector: 'app-ingresos-bancarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ingresos-bancarios.component.html',
  styleUrls: ['./ingresos-bancarios.component.css']
})
export class IngresosBancariosComponent implements OnInit {
  cargando = false;
  error    = '';

  meses:    string[] = [];
  mesActivo = '';

  todos:      any[] = [];
  filtrados:  any[] = [];

  // Filtros activos
  filtroSucursal = 'TODAS';
  filtroBanco    = 'TODOS';
  filtroEntidad  = 'TODAS';
  filtroEstado   = 'activos'; // 'activos' | 'inactivos' | 'todos'

  // Listas únicas para dropdowns
  sucursales: string[] = [];
  bancos:     string[] = [];
  entidades:  string[] = [];

  // KPIs
  totalMonto    = 0;
  totalRegistros = 0;
  totalConc     = 0;
  totalSinConc  = 0;
  pctConc       = 0;

  // Charts
  porBanco:    {label:string, monto:number, pct:number, color:string}[] = [];
  porSucursal: {label:string, monto:number, pct:number}[] = [];
  porEntidad:  {label:string, monto:number, pct:number}[] = [];
  porDia:      {fecha:string, monto:number, pct:number}[] = [];
  maxDia = 1;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarMeses();
  }

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
    this.mesActivo     = mes;
    this.filtroSucursal = 'TODAS';
    this.filtroBanco    = 'TODOS';
    this.filtroEntidad  = 'TODAS';
    this.cargarDatos();
  }

  cargarDatos() {
    this.cargando = true;
    this.error    = '';
    this.http.get<any>(`${API}/ingresos/bancarios?mes=${this.mesActivo}`).subscribe({
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
      // Sucursal: Chimbote se separa por negocio
      const suc = this.getSucursalDisplay(r);
      if (suc) setSuc.add(suc);
      if (r.banco_tabla) setBan.add(r.banco_tabla);
      if (r.entidad)     setEnt.add(r.entidad);
    }

    this.sucursales = [...setSuc].sort();
    this.bancos     = [...setBan].sort();
    this.entidades  = [...setEnt].sort();
  }

  getSucursalDisplay(r: any): string {
    const suc = (r.sucursal || '').toUpperCase();
    if (suc.includes('CHIMBOTE')) {
      const neg = (r.negocio || '').toUpperCase();
      if (neg.includes('SNACK')) return 'CHIMBOTE SNACKS';
      return 'CHIMBOTE';
    }
    return r.sucursal || '';
  }

  aplicarFiltros() {
    let data = [...this.todos];

    // Filtro estado
    if (this.filtroEstado === 'activos') {
      data = data.filter(r => !r.estado || r.estado.toLowerCase() !== 'inactivo');
    } else if (this.filtroEstado === 'inactivos') {
      data = data.filter(r => r.estado && r.estado.toLowerCase() === 'inactivo');
    }

    if (this.filtroSucursal !== 'TODAS') {
      data = data.filter(r => this.getSucursalDisplay(r) === this.filtroSucursal);
    }
    if (this.filtroBanco !== 'TODOS') {
      data = data.filter(r => r.banco_tabla === this.filtroBanco);
    }
    if (this.filtroEntidad !== 'TODAS') {
      data = data.filter(r => r.entidad === this.filtroEntidad);
    }

    this.filtrados = data;
    this.calcularKPIs();
    this.calcularCharts();
  }

  calcularKPIs() {
    this.totalMonto     = this.filtrados.reduce((s, r) => s + (r.monto || 0), 0);
    this.totalRegistros = this.filtrados.length;
    this.totalConc      = this.filtrados.filter(r => r.conciliado).length;
    this.totalSinConc   = this.totalRegistros - this.totalConc;
    this.pctConc        = this.totalRegistros ? Math.round(this.totalConc / this.totalRegistros * 100) : 0;
  }

  calcularCharts() {
    // Por banco
    const mapBan: Record<string, number> = {};
    for (const r of this.filtrados) {
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

    // Por sucursal
    const mapSuc: Record<string, number> = {};
    for (const r of this.filtrados) {
      const k = this.getSucursalDisplay(r) || 'Sin sucursal';
      mapSuc[k] = (mapSuc[k] || 0) + (r.monto || 0);
    }
    const totalSuc = Object.values(mapSuc).reduce((a, b) => a + b, 0) || 1;
    this.porSucursal = Object.entries(mapSuc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, monto]) => ({
        label, monto, pct: Math.round(monto / totalSuc * 100)
      }));

    // Por entidad
    const mapEnt: Record<string, number> = {};
    for (const r of this.filtrados) {
      const k = r.entidad || 'Sin entidad';
      mapEnt[k] = (mapEnt[k] || 0) + (r.monto || 0);
    }
    const totalEnt = Object.values(mapEnt).reduce((a, b) => a + b, 0) || 1;
    this.porEntidad = Object.entries(mapEnt)
      .sort((a, b) => b[1] - a[1])
      .map(([label, monto]) => ({
        label, monto, pct: Math.round(monto / totalEnt * 100)
      }));

    // Por día
    const mapDia: Record<string, number> = {};
    for (const r of this.filtrados) {
      const f = r.fecha_registro ? String(r.fecha_registro).slice(0, 10) : null;
      if (!f) continue;
      mapDia[f] = (mapDia[f] || 0) + (r.monto || 0);
    }
    const maxVal = Math.max(...Object.values(mapDia), 1);
    this.maxDia = maxVal;
    this.porDia = Object.entries(mapDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, monto]) => ({
        fecha: fecha.slice(5), // MM-DD
        monto,
        pct: Math.round(monto / maxVal * 100)
      }));
  }

  setFiltroSucursal(s: string) { this.filtroSucursal = s; this.aplicarFiltros(); }
  setFiltroBanco(b: string)    { this.filtroBanco    = b; this.aplicarFiltros(); }
  setFiltroEntidad(e: string)  { this.filtroEntidad  = e; this.aplicarFiltros(); }
  setFiltroEstado(e: string)   { this.filtroEstado   = e; this.aplicarFiltros(); }

  getBancoColor(label: string)  { return BANCO_COLORES[label]?.color || '#64748b'; }
  getBancoBg(label: string)     { return BANCO_COLORES[label]?.light || '#f1f5f9'; }

  fmt(n: number) {
    return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  fmtK(n: number) {
    if (n >= 1_000_000) return 'S/ ' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return 'S/ ' + (n / 1_000).toFixed(0) + 'K';
    return 'S/ ' + n.toFixed(0);
  }

  get mesLabel() { return this.mesActivo || '—'; }
  get pctBar()   { return Math.max(2, this.pctConc); }
}