import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Output, EventEmitter } from '@angular/core';
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

  registros: any[] = [];
  registrosFiltrados: any[] = [];

  // Filtros
  filtroEstado: 'todos' | 'conciliado' | 'pendiente' = 'todos';
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

  // KPIs (reactivos al filtro)
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

  constructor(private http: HttpClient) { this.cargarMeses(); }

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

    // Estado conciliación
    if (this.filtroEstado === 'conciliado') data = data.filter(r => r.conciliado);
    else if (this.filtroEstado === 'pendiente') data = data.filter(r => !r.conciliado);

    // Comprobante IA
    if (this.filtroComprobante === 'pauser')
      data = data.filter(r => this.indiceComprobantes[String(r.id_pop)] === true);
    else if (this.filtroComprobante === 'no_pauser')
      data = data.filter(r => this.indiceComprobantes[String(r.id_pop)] === false);
    else if (this.filtroComprobante === 'sin_comprobante')
      data = data.filter(r => !(String(r.id_pop) in this.indiceComprobantes));

    // Entidad y banco
    if (this.filtroEntidad !== 'todas') data = data.filter(r => r.entidad === this.filtroEntidad);
    if (this.filtroBanco !== 'todos') data = data.filter(r => r.banco_tabla === this.filtroBanco);

    // Rango ID POP
    if (this.filtroIdPopMin) data = data.filter(r => Number(r.id_pop) >= Number(this.filtroIdPopMin));
    if (this.filtroIdPopMax) data = data.filter(r => Number(r.id_pop) <= Number(this.filtroIdPopMax));

    // Rango fecha
    if (this.filtroFechaDesde)
      data = data.filter(r => r.fecha_registro && String(r.fecha_registro).slice(0, 10) >= this.filtroFechaDesde);
    if (this.filtroFechaHasta)
      data = data.filter(r => r.fecha_registro && String(r.fecha_registro).slice(0, 10) <= this.filtroFechaHasta);

    // Búsqueda libre
    if (this.busqueda.trim()) {
      const q = this.busqueda.trim().toLowerCase();
      data = data.filter(r =>
        Object.values(r).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q))
      );
    }

    this.registrosFiltrados = data;
    this.calcularKPIs(data);
    this.calcularKPIsIA(data);
  }

  calcularKPIs(data: any[]) {
    this.totalRegistros = data.length;
    this.conciliados = data.filter(r => r.conciliado).length;
    this.sinConciliar = this.totalRegistros - this.conciliados;
    this.pct = this.totalRegistros ? Math.round(this.conciliados / this.totalRegistros * 100) : 0;
    this.montoTotal = data.reduce((s, r) => s + (r.monto || 0), 0);
    this.montoConciliado = data.filter(r => r.conciliado).reduce((s, r) => s + (r.monto || 0), 0);
    this.montoPendiente = this.montoTotal - this.montoConciliado;
  }

  calcularKPIsIA(data: any[]) {
    this.totalPauser = 0; this.totalNoPauser = 0; this.totalSinComprobante = 0;
    for (const r of data) {
      const id = String(r.id_pop);
      if (!(id in this.indiceComprobantes)) this.totalSinComprobante++;
      else if (this.indiceComprobantes[id]) this.totalPauser++;
      else this.totalNoPauser++;
    }
  }

  get tieneFiltrosActivos(): boolean {
    return this.filtroEstado !== 'todos' || this.filtroComprobante !== 'todos' ||
      this.filtroEntidad !== 'todas' || this.filtroBanco !== 'todos' ||
      !!this.filtroIdPopMin || !!this.filtroIdPopMax ||
      !!this.filtroFechaDesde || !!this.filtroFechaHasta || !!this.busqueda.trim();
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
        if (r.estado === 'OK') { this.cargarMeses(); this.cargarDatos(); }
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
    const data = this.registrosFiltrados;
    if (!data.length) return;

    const headers = ['ID POP', 'Fecha Registro', 'Fecha Voucher', 'Sucursal', 'Negocio',
      'Entidad', 'Transporte', 'Monto', 'Cod. Operación', 'Nro Op. Banco', 'Banco', 'Estado', 'Comprobante IA'];

    const rows = data.map(r => [
      r.id_pop || '',
      this.formatFecha(r.fecha_registro),
      this.formatFecha(r.fecha_voucher),
      r.sucursal || '',
      r.negocio || '',
      r.entidad || '',
      r.transporte || '',
      r.monto || 0,
      r.cod_operacion || '',
      r.nro_operacion_banco || '',
      r.banco_tabla || '',
      r.estado || '',
      this.getEstadoIALabel(r.id_pop)
    ]);

    let csv = headers.join(',') + '\n';
    for (const row of rows) {
      csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ingresos_bancarios_${this.mesSeleccionado}_${this.anioActual}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    if (!(id in this.indiceComprobantes)) return 'sin_comprobante';
    return this.indiceComprobantes[id] ? 'pauser' : 'no_pauser';
  }

  getEstadoIALabel(id_pop: any): string {
    const s = this.getEstadoIA(id_pop);
    return s === 'pauser' ? 'Pauser' : s === 'no_pauser' ? 'No Pauser' : 'Sin comprobante';
  }

  bancosPorEntidad(e: string) {
    const mapa: Record<string, { total: number, conciliados: number }> = {};
    for (const r of this.registros.filter(r => r.entidad === e)) {
      const b = r.banco_tabla || 'Sin banco';
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

  get pctBar() { return Math.min(this.pct, 100); }


  abrirComparador() {
    this.navegarA.emit('comparadorIngresos');
  }
}