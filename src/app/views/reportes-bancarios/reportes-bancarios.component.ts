import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
const API = environment.apiUrl;

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const BANCOS = [
  { key: 'bcp_1',           label: 'BCP',           color: '#003087' },
  { key: 'bcp_tru_1',       label: 'BCP TRU',       color: '#0052cc' },
  { key: 'bcp_ln_1',        label: 'BCP LN',         color: '#0066ff' },
  { key: 'bbva_1',          label: 'BBVA',           color: '#004481' },
  { key: 'bbva_lm_1',       label: 'BBVA LM',        color: '#1464a5' },
  { key: 'ibk_1',           label: 'Interbank',      color: '#e8650a' },
  { key: 'caja_arequipa_1', label: 'Caja Arequipa',  color: '#c0392b' },
];

@Component({
  selector: 'app-reportes-bancarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes-bancarios.component.html',
  styleUrls: ['./reportes-bancarios.component.css'],
})
export class ReportesBancariosComponent implements OnInit {
  meses = MESES;
  bancos = BANCOS;
  anioActual = new Date().getFullYear();

  mesSeleccionado: string | null = null;
  bancoSeleccionado = BANCOS[0];

  mesesConData: string[] = [];
  registros: any[] = [];
  columnas: string[] = [];

  totalIngreso = 0;
  totalEgreso  = 0;
  totalRegistros = 0;

  cargandoSync   = false;
  cargandoTabla  = false;
  mensajeSync    = '';
  errorSync      = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarMesesDisponibles();
  }

  cargarMesesDisponibles() {
    this.http.get<any>(`${API}/bancos/meses`).subscribe({
      next: (res) => {
        if (res.estado === 'OK') {
          this.mesesConData = res.meses
            .filter((m: any) => m.anio === this.anioActual)
            .map((m: any) => m.mes);
        }
      },
      error: () => {}
    });
  }

  tieneDatos(mes: string): boolean {
    return this.mesesConData.includes(mes);
  }

  seleccionarMes(mes: string) {
    this.mesSeleccionado = mes;
    this.cargarTabla();
  }

  seleccionarBanco(banco: any) {
    this.bancoSeleccionado = banco;
    if (this.mesSeleccionado) this.cargarTabla();
  }

  cargarTabla() {
    if (!this.mesSeleccionado) return;
    this.cargandoTabla = true;
    this.registros = [];

    const url = `${API}/bancos/${this.bancoSeleccionado.key}?mes=${this.mesSeleccionado}&anio=${this.anioActual}`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.cargandoTabla = false;
        if (res.estado === 'OK' && res.registros.length > 0) {
          this.registros = res.registros;
          this.totalRegistros = res.total;
          // Columnas: excluir mes, anio, archivo_origen
          const excluir = ['mes', 'anio', 'archivo_origen', 'index'];
          this.columnas = Object.keys(res.registros[0]).filter(c => !excluir.includes(c));
          // KPIs
          this.totalIngreso = res.registros.reduce((s: number, r: any) => s + (r.ingreso || 0), 0);
          this.totalEgreso  = res.registros.reduce((s: number, r: any) => s + (r.egreso  || 0), 0);
        } else {
          this.registros = [];
          this.columnas = [];
          this.totalIngreso = 0;
          this.totalEgreso  = 0;
          this.totalRegistros = 0;
        }
      },
      error: () => { this.cargandoTabla = false; }
    });
  }

  sincronizar() {
    if (!this.mesSeleccionado) return;
    this.cargandoSync = true;
    this.mensajeSync  = '';
    this.errorSync    = false;

    this.http.post<any>(`${API}/bancos/sync?mes=${this.mesSeleccionado}`, {}).subscribe({
      next: (res) => {
        this.cargandoSync = false;
        this.mensajeSync  = res.mensaje || res.detalle;
        this.errorSync    = res.estado !== 'OK';
        if (res.estado === 'OK') {
          this.cargarMesesDisponibles();
          this.cargarTabla();
        }
      },
      error: (err) => {
        this.cargandoSync = false;
        this.mensajeSync  = 'Error de conexión con el servidor';
        this.errorSync    = true;
      }
    });
  }

  formatNum(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  esCifra(col: string): boolean {
    return ['ingreso','egreso','saldo'].includes(col);
  }

  esFecha(col: string): boolean {
    return col === 'fecha';
  }

  formatFecha(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('es-PE');
  }
}