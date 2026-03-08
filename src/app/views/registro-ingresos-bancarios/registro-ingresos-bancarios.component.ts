import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:8000';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

@Component({
  selector: 'app-registro-ingresos-bancarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registro-ingresos-bancarios.component.html',
  styleUrls: ['./registro-ingresos-bancarios.component.css'],
})
export class RegistroIngresosBancariosComponent {
  meses = MESES;
  anioActual = new Date().getFullYear();

  mesSeleccionado: string | null = null;
  filtroEstado: 'todos' | 'conciliado' | 'pendiente' = 'todos';
  filtroComprobante: 'todos' | 'pauser' | 'no_pauser' | 'sin_comprobante' = 'todos';

  mesesConData: string[] = [];
  registros: any[] = [];
  registrosFiltrados: any[] = [];

  total = 0;
  conciliados = 0;
  sinConciliar = 0;
  pct = 0;
  montoTotal = 0;
  montoConciliado = 0;
  montoPendiente = 0;

  totalPauser = 0;
  totalNoPauser = 0;
  totalSinComprobante = 0;
  indiceComprobantes: Record<string, boolean> = {};
  cargandoIA = false;

  cargando = false;
  cargandoSync = false;
  cargandoConciliar = false;
  mensajeAccion = '';
  errorAccion = false;

  modalAbierto = false;
  modalIdPop = '';
  modalImgUrl = '';
  modalDatosIA: any = null;
  modalCargando = false;

  constructor(private http: HttpClient) {
    this.cargarMeses();
  }

  cargarMeses() {
    this.http.get<any>(`${API}/ingresos/bancarios/meses`).subscribe({
      next: (res) => {
        if (res.estado === 'OK') this.mesesConData = res.meses;
      }
    });
  }

  tieneDatos(mes: string): boolean {
    return this.mesesConData.some(m => m.toLowerCase() === mes.toLowerCase());
  }

  seleccionarMes(mes: string) {
    this.mesSeleccionado = mes;
    this.filtroEstado = 'todos';
    this.filtroComprobante = 'todos';
    this.indiceComprobantes = {};
    this.cargarDatos();
  }

  cargarDatos() {
    if (!this.mesSeleccionado) return;
    this.cargando = true;
    this.registros = [];

    this.http.get<any>(`${API}/ingresos/bancarios?mes=${this.mesSeleccionado}`).subscribe({
      next: (res) => {
        this.cargando = false;
        if (res.estado === 'OK') {
          this.registros = res.registros;
          this.total = res.total;
          this.conciliados = res.conciliados;
          this.sinConciliar = res.sin_conciliar;
          this.pct = res.pct;
          this.montoTotal = res.monto_total;
          this.montoConciliado = this.registros
            .filter(r => r.conciliado)
            .reduce((s, r) => s + (r.monto || 0), 0);
          this.montoPendiente = this.montoTotal - this.montoConciliado;
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
      next: (res) => {
        this.cargandoIA = false;
        if (res.estado === 'OK') {
          this.indiceComprobantes = res.indice;
          this.calcularKpisIA();
          this.aplicarFiltro();
        }
      },
      error: () => { this.cargandoIA = false; }
    });
  }

  calcularKpisIA() {
    this.totalPauser = 0;
    this.totalNoPauser = 0;
    this.totalSinComprobante = 0;
    for (const r of this.registros) {
      const idStr = String(r.id_pop);
      if (!(idStr in this.indiceComprobantes)) {
        this.totalSinComprobante++;
      } else if (this.indiceComprobantes[idStr]) {
        this.totalPauser++;
      } else {
        this.totalNoPauser++;
      }
    }
  }

  aplicarFiltro() {
    let data = [...this.registros];

    if (this.filtroEstado === 'conciliado') {
      data = data.filter(r => r.conciliado);
    } else if (this.filtroEstado === 'pendiente') {
      data = data.filter(r => !r.conciliado);
    }

    if (this.filtroComprobante === 'pauser') {
      data = data.filter(r => this.indiceComprobantes[String(r.id_pop)] === true);
    } else if (this.filtroComprobante === 'no_pauser') {
      data = data.filter(r => this.indiceComprobantes[String(r.id_pop)] === false);
    } else if (this.filtroComprobante === 'sin_comprobante') {
      data = data.filter(r => !(String(r.id_pop) in this.indiceComprobantes));
    }

    this.registrosFiltrados = data;
  }

  setFiltro(f: 'todos' | 'conciliado' | 'pendiente') {
    this.filtroEstado = f;
    this.aplicarFiltro();
  }

  setFiltroComprobante(f: 'todos' | 'pauser' | 'no_pauser' | 'sin_comprobante') {
    this.filtroComprobante = f;
    this.aplicarFiltro();
  }

  sincronizar() {
    if (!this.mesSeleccionado) return;
    this.cargandoSync = true;
    this.mensajeAccion = '';
    this.http.post<any>(`${API}/ingresos/sync?mes=${this.mesSeleccionado}`, {}).subscribe({
      next: (res) => {
        this.cargandoSync = false;
        this.mensajeAccion = res.mensaje || res.detalle;
        this.errorAccion = res.estado !== 'OK';
        if (res.estado === 'OK') { this.cargarMeses(); this.cargarDatos(); }
      },
      error: () => {
        this.cargandoSync = false;
        this.mensajeAccion = 'Error de conexión';
        this.errorAccion = true;
      }
    });
  }

  conciliar() {
    if (!this.mesSeleccionado) return;
    this.cargandoConciliar = true;
    this.mensajeAccion = '';
    this.http.post<any>(`${API}/ingresos/conciliar?mes=${this.mesSeleccionado}`, {}).subscribe({
      next: (res) => {
        this.cargandoConciliar = false;
        this.mensajeAccion = res.mensaje || res.detalle;
        this.errorAccion = res.estado !== 'OK';
        if (res.estado === 'OK') this.cargarDatos();
      },
      error: () => {
        this.cargandoConciliar = false;
        this.mensajeAccion = 'Error de conexión';
        this.errorAccion = true;
      }
    });
  }

  verComprobante(r: any) {
    if (!r.id_pop) return;
    this.modalIdPop = r.id_pop;
    this.modalImgUrl = '';
    this.modalDatosIA = null;
    this.modalCargando = true;
    this.modalAbierto = true;
    this.http.get<any>(`${API}/comprobante/${r.id_pop}`).subscribe({
      next: (res) => {
        if (res.estado === 'OK') {
          this.modalDatosIA = res.ia;
          this.modalImgUrl = res.imagen_directa || `${API}/comprobante/${r.id_pop}/imagen`;
        }
        this.modalCargando = false;
      },
      error: () => { this.modalCargando = false; }
    });
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.modalImgUrl = '';
    this.modalDatosIA = null;
  }

  formatNum(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatFecha(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-PE');
  }

  get pctBar(): number { return Math.min(this.pct, 100); }

  getEstadoIA(id_pop: any): 'pauser' | 'no_pauser' | 'sin_comprobante' {
    const idStr = String(id_pop);
    if (!(idStr in this.indiceComprobantes)) return 'sin_comprobante';
    return this.indiceComprobantes[idStr] ? 'pauser' : 'no_pauser';
  }
}