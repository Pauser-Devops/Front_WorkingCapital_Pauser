import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Output, EventEmitter } from '@angular/core';
import * as XLSX from 'xlsx';

const API = environment.apiUrl;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

@Component({
  selector: 'app-registro-ingresos-bancarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro-ingresos-bancarios.component.html',
  styleUrls: ['./registro-ingresos-bancarios.component.css'],
})
export class RegistroIngresosBancariosComponent {
  meses = MESES;
  anioActual = new Date().getFullYear();

  mesSeleccionado: string | null = null;
  mesesConData: string[] = [];
  totalDifMonto = 0;
  registros: any[] = [];
  registrosFiltrados: any[] = [];

  // Filtros
  filtroEstado: 'todos' | 'conciliado' | 'pendiente' | 'dif_monto' = 'todos';
  filtroComprobante: 'todos' | 'pauser' | 'no_pauser' | 'sin_comprobante' = 'todos';
  filtroEntidad = 'todas';
  filtroBanco = 'todos';
  filtroIdPopMin = '';
  filtroIdPopMax = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';
  busqueda = '';

  entidades: string[] = [];
  bancos: string[] = [];

  // KPIs
  totalRegistros = 0;
  conciliados = 0;
  sinConciliar = 0;
  pct = 0;
  montoTotal = 0;
  montoConciliado = 0;
  montoPendiente = 0;

  // KPIs IA
  totalPauser = 0;
  totalNoPauser = 0;
  totalSinComprobante = 0;
  indiceComprobantes: Record<string, boolean> = {};

  // Sync
  ultimaSync = '';
  usuarioSync = '';

  // Flags
  cargando = false;
  cargandoSync = false;
  cargandoConciliar = false;
  cargandoIA = false;
  mensajeAccion = '';
  errorAccion = false;

  // Modal
  modalAbierto = false;
  modalIdPop = '';
  modalImgUrl = '';
  modalDatosIA: any = null;
  modalCargando = false;
  @Output() navegarA = new EventEmitter<string>();

  constructor(private http: HttpClient) {
    this.cargarMeses();
    this.cargarSync();
  }

  // ── Sync ─────────────────────────────────────────────

  cargarSync() {
    if (!this.mesSeleccionado) return;
    const anio = new Date().getFullYear();
    this.http.get<any>(
      `${API}/sync/ultima?modulo=registro_ingresos&mes=${this.mesSeleccionado}&anio=${anio}`
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
      next: r => { if (r.estado === 'OK') this.mesesConData = r.meses; }
    });
  }

  tieneDatos(mes: string) {
    return this.mesesConData.some(m => m.toLowerCase() === mes.toLowerCase());
  }

  seleccionarMes(mes: string) {
    this.mesSeleccionado = mes;
    this.resetFiltros();
    this.cargarDatos();
    this.cargarSync();
  }

  resetFiltros() {
    this.filtroEstado = 'todos';
    this.filtroComprobante = 'todos';
    this.filtroEntidad = 'todas';
    this.filtroBanco = 'todos';
    this.filtroIdPopMin = '';
    this.filtroIdPopMax = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.busqueda = '';
    this.indiceComprobantes = {};
  }

  cargarDatos() {
    if (!this.mesSeleccionado) return;
    this.cargando = true;
    this.registros = [];
    this.http.get<any>(`${API}/ingresos/bancarios?mes=${this.mesSeleccionado}`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          this.registros = r.registros;
          const setEnt = new Set<string>();
          const setBan = new Set<string>();
          for (const reg of this.registros) {
            if (reg.entidad) setEnt.add(reg.entidad);
            if (reg.banco_tabla) setBan.add(reg.banco_tabla);
          }
          this.entidades = [...setEnt].sort();
          this.bancos = [...setBan].sort();
          this.aplicarFiltro();
          this.cargarResumenIA();
        }
      },
      error: () => { this.cargando = false; }
    });
  }

  cargarResumenIA() {
    this.cargandoIA = true;
    this.http.get<any>(`${API}/comprobante/resumen-ia`).subscribe({
      next: r => {
        this.cargandoIA = false;
        if (r.estado === 'OK') {
          this.indiceComprobantes = r.indice;
          this.aplicarFiltro();
        }
      },
      error: () => { this.cargandoIA = false; }
    });
  }

  aplicarFiltro() {
    let data = [...this.registros];

    if (this.filtroEstado === 'conciliado') data = data.filter(r => r.conciliado);
    else if (this.filtroEstado === 'pendiente') data = data.filter(r => !r.conciliado);

    if (this.filtroComprobante === 'pauser')
      data = data.filter(r => this.indiceComprobantes[String(r.id_pop)] === true);
    else if (this.filtroComprobante === 'no_pauser')
      data = data.filter(r => this.indiceComprobantes[String(r.id_pop)] === false);
    else if (this.filtroComprobante === 'sin_comprobante')
      data = data.filter(r => !(String(r.id_pop) in this.indiceComprobantes));

    if (this.filtroEntidad !== 'todas') data = data.filter(r => r.entidad === this.filtroEntidad);
    if (this.filtroBanco !== 'todos') data = data.filter(r => r.banco_tabla === this.filtroBanco);

    if (this.filtroIdPopMin) data = data.filter(r => Number(r.id_pop) >= Number(this.filtroIdPopMin));
    if (this.filtroIdPopMax) data = data.filter(r => Number(r.id_pop) <= Number(this.filtroIdPopMax));

    if (this.filtroFechaDesde)
      data = data.filter(r => r.fecha_registro && String(r.fecha_registro).slice(0, 10) >= this.filtroFechaDesde);
    if (this.filtroFechaHasta)
      data = data.filter(r => r.fecha_registro && String(r.fecha_registro).slice(0, 10) <= this.filtroFechaHasta);

    if (this.busqueda.trim()) {
      const q = this.busqueda.replace(/\s+/g, '').toLowerCase();
      data = data.filter(r =>
        Object.values(r).some(v =>
          v !== null && v !== undefined &&
          String(v).replace(/\s+/g, '').toLowerCase().includes(q)
        )
      );
    }
    if (this.filtroEstado === 'dif_monto')
      data = data.filter(r => r.conciliado && r.dif_monto !== null && r.dif_monto !== 0);
    this.registrosFiltrados = data;
    this.calcularKPIs(data);
    this.calcularKPIsIA(data);
  }

  calcularKPIs(data: any[]) {
    // KPIs sobre lo filtrado
    this.totalRegistros = data.length;
    this.conciliados = data.filter(r => r.conciliado).length;
    this.sinConciliar = data.filter(r => !r.conciliado).length;
    this.montoTotal = data.reduce((s, r) => s + (r.monto || 0), 0);
    this.montoConciliado = data.filter(r => r.conciliado).reduce((s, r) => s + (r.monto || 0), 0);
    this.montoPendiente = this.montoTotal - this.montoConciliado;

    // % siempre sobre el total real sin filtro
    const totalReal = this.registros.length || 1;
    const conciliadosReal = this.registros.filter(r => r.conciliado).length;
    this.pct = Math.floor((conciliadosReal / totalReal) * 1000) / 10;
    this.totalDifMonto = this.registros.filter(r =>
      r.conciliado && r.dif_monto !== null && r.dif_monto !== 0
    ).length;
  }

  calcularKPIsIA(data: any[]) {
    this.totalPauser = 0; this.totalNoPauser = 0; this.totalSinComprobante = 0;
    for (const r of data) {
      const id = String(r.id_pop);
      if (this.indiceComprobantes[id] === true) this.totalPauser++;
      else this.totalNoPauser++;
    }
  }

  get tieneFiltrosActivos(): boolean {
    return this.filtroEstado !== 'todos'
      || this.filtroComprobante !== 'todos'
      || this.filtroEntidad !== 'todas'
      || this.filtroBanco !== 'todos'
      || !!this.filtroIdPopMin || !!this.filtroIdPopMax
      || !!this.filtroFechaDesde || !!this.filtroFechaHasta

      || !!this.busqueda.trim();
  }

  limpiarFiltros() {
    this.filtroEstado = 'todos';
    this.filtroComprobante = 'todos';
    this.filtroEntidad = 'todas';
    this.filtroBanco = 'todos';
    this.filtroIdPopMin = '';
    this.filtroIdPopMax = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.busqueda = '';
    this.aplicarFiltro();
  }

  sincronizar() {
    if (!this.mesSeleccionado) return;
    this.cargandoSync = true; this.mensajeAccion = '';
    this.http.post<any>(`${API}/ingresos/sync?mes=${this.mesSeleccionado}`, {}).subscribe({
      next: r => {
        this.cargandoSync = false;
        this.mensajeAccion = r.mensaje || r.detalle;
        this.errorAccion = r.estado !== 'OK';
        if (r.estado === 'OK') {
          this.cargarMeses();
          this.cargarDatos();
          this.cargarSync(); // ← refresca el badge de sync
        }
      },
      error: () => { this.cargandoSync = false; this.mensajeAccion = 'Error de conexión'; this.errorAccion = true; }
    });
  }

  conciliar() {
    if (!this.mesSeleccionado) return;
    this.cargandoConciliar = true; this.mensajeAccion = '';
    this.http.post<any>(`${API}/ingresos/conciliar?mes=${this.mesSeleccionado}`, {}).subscribe({
      next: r => {
        this.cargandoConciliar = false;
        this.mensajeAccion = r.mensaje || r.detalle;
        this.errorAccion = r.estado !== 'OK';
        if (r.estado === 'OK') this.cargarDatos();
      },
      error: () => { this.cargandoConciliar = false; this.mensajeAccion = 'Error de conexión'; this.errorAccion = true; }
    });
  }

  exportarExcel() {
    if (!this.mesSeleccionado) return;
    let url = `${API}/ingresos/bancarios/exportar-excel?mes=${this.mesSeleccionado}`;
    if (this.filtroFechaDesde) url += `&fecha_desde=${this.filtroFechaDesde}`;
    if (this.filtroFechaHasta) url += `&fecha_hasta=${this.filtroFechaHasta}`;
    if (this.filtroIdPopMin) url += `&id_pop_min=${this.filtroIdPopMin}`;
    if (this.filtroIdPopMax) url += `&id_pop_max=${this.filtroIdPopMax}`;
    window.open(url, '_blank');
  }

  verComprobante(r: any) {
    if (!r.id_pop) return;
    this.modalIdPop = r.id_pop; this.modalImgUrl = '';
    this.modalDatosIA = null; this.modalCargando = true; this.modalAbierto = true;
    this.http.get<any>(`${API}/comprobante/${r.id_pop}`).subscribe({
      next: res => {
        if (res.estado === 'OK') {
          this.modalDatosIA = res.ia;
          this.modalImgUrl = res.imagen_directa || `${API}/comprobante/${r.id_pop}/imagen`;
        }
        this.modalCargando = false;
      },
      error: () => { this.modalCargando = false; }
    });
  }

  cerrarModal() { this.modalAbierto = false; this.modalImgUrl = ''; this.modalDatosIA = null; }

  getEstadoIA(id_pop: any): 'pauser' | 'no_pauser' | 'sin_comprobante' {
    const id = String(id_pop);
    if (!(id in this.indiceComprobantes)) return 'no_pauser';
    return this.indiceComprobantes[id] ? 'pauser' : 'no_pauser';
  }

  bancosPorEntidad(e: string) {
    const mapa: Record<string, { total: number, conciliados: number }> = {};
    for (const r of this.registros.filter(r => r.entidad === e)) {
      const b = r.banco_tabla || 'Pendiente';
      if (!mapa[b]) mapa[b] = { total: 0, conciliados: 0 };
      mapa[b].total++;
      if (r.conciliado) mapa[b].conciliados++;
    }
    return Object.entries(mapa).map(([banco, v]) => ({ banco, ...v }));
  }

  setFiltroEntidad(e: string) { this.filtroEntidad = e; this.aplicarFiltro(); }
  setFiltroBanco(b: string) { this.filtroBanco = b; this.aplicarFiltro(); }
  setFiltro(f: any) { this.filtroEstado = f; this.aplicarFiltro(); }
  setFiltroComp(f: any) { this.filtroComprobante = f; this.aplicarFiltro(); }

  formatNum(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    const n = parseFloat(v);
    return isNaN(n) ? String(v) : n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatFecha(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE');
  }

  get pctBar() {
    if (this.filtroEstado === 'pendiente') {
      const totalReal = this.registros.length || 1;
      const pendientesReal = this.registros.filter(r => !r.conciliado).length;
      return Math.floor((pendientesReal / totalReal) * 1000) / 10;
    }
    return Math.min(this.pct, 100);
  }
  abrirComparador() { this.navegarA.emit('comparadorIngresos'); }

  marcarPauser(id: number, esPauser: boolean) {
    this.http.post<any>(`${API}/comprobante/revisar`, {
      id_pop: id, es_pauser: esPauser
    }).subscribe({
      next: res => {
        if (res.ok) {
          this.indiceComprobantes = { ...this.indiceComprobantes, [String(id)]: esPauser };
          this.aplicarFiltro();
        }
      },
      error: err => console.error('Error al marcar comprobante:', err)
    });
  }
  get totalConciliadosReal() { return this.registros.filter(r => r.conciliado).length; }
  get totalPendientesReal() { return this.registros.filter(r => !r.conciliado).length; }
}