import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const API = environment.apiUrl;

interface FilaCruce {
  fecha_ibk: string;
  nro_cheque: string;
  detalle: string;
  codigo: string | null;
  sede: string | null;
  tipo: string | null;
  monto_ibk: number;
  fecha_prosegur_ini: string | null;
  fecha_prosegur_fin: string | null;
  monto_prosegur: number;
  diferencia: number;
  descuadre: boolean;
  descripcion: string;
}

interface ResumenCruce {
  estado: string;
  mes: number;
  anio: number;
  total_filas: number;
  total_ibk: number;
  total_prosegur: number;
  diferencia_total: number;
  total_descuadres: number;
  filas: FilaCruce[];
}

@Component({
  selector: 'app-conciliacion-prosegur',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conciliacion-prosegur.component.html',
  styleUrls: ['./conciliacion-prosegur.component.css'],
})
export class ConciliacionProsegurComponent implements OnInit {

  // ── Selectores ─────────────────────────────────────
  bancoSeleccionado: 'IBK' | 'BBVA' | '' = '';
  mesSeleccionado = new Date().getMonth() + 1;
  anioSeleccionado = new Date().getFullYear();

  meses = [
    { v: 1, n: 'Enero' }, { v: 2, n: 'Febrero' },
    { v: 3, n: 'Marzo' }, { v: 4, n: 'Abril' },
    { v: 5, n: 'Mayo' }, { v: 6, n: 'Junio' },
    { v: 7, n: 'Julio' }, { v: 8, n: 'Agosto' },
    { v: 9, n: 'Septiembre' }, { v: 10, n: 'Octubre' },
    { v: 11, n: 'Noviembre' }, { v: 12, n: 'Diciembre' },
  ];

  // ── Estado ─────────────────────────────────────────
  cargando = false;
  error = '';
  resultado: ResumenCruce | null = null;
  exportando = false;

  // ── Filtro tabla ───────────────────────────────────
  soloDescuadres = false;
  filtroCodigo = '';

  sincronizando = false;
  syncMensaje = '';
  syncTipo: 'ok' | 'info' | '' = '';

  constructor(private http: HttpClient) { }

  ngOnInit() { }

  get endpoint(): string {
    return this.bancoSeleccionado === 'IBK'
      ? `${API}/cruce/ibk-prosegur`
      : `${API}/cruce/bbva-prosegur`;
  }

  get endpointExport(): string {
    return this.bancoSeleccionado === 'IBK'
      ? `${API}/cruce/ibk-prosegur/exportar`
      : `${API}/cruce/bbva-prosegur/exportar`;
  }

  cargar() {
    this.cargando = true;
    this.error = '';
    this.resultado = null;

    this.http.get<ResumenCruce>(
      `${this.endpoint}?mes=${this.mesSeleccionado}&anio=${this.anioSeleccionado}`
    ).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') this.resultado = r;
        else this.error = 'Error al cargar datos';
      },
      error: () => { this.cargando = false; this.error = 'Error de conexión'; }
    });
  }

  exportar() {
    this.exportando = true;
    const url = `${this.endpointExport}?mes=${this.mesSeleccionado}&anio=${this.anioSeleccionado}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        this.exportando = false;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Cruce_${this.bancoSeleccionado}_PROSEGUR_${this.mesNombre}_${this.anioSeleccionado}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      error: () => { this.exportando = false; }
    });
  }

  get mesNombre(): string {
    return this.meses.find(m => m.v === this.mesSeleccionado)?.n || '';
  }

  get filasFiltradas(): FilaCruce[] {
    if (!this.resultado) return [];
    return this.resultado.filas.filter(f => {
      if (this.soloDescuadres && !f.descuadre) return false;
      if (this.filtroCodigo && f.codigo !== this.filtroCodigo) return false;
      return true;
    });
  }

  get codigosDisponibles(): string[] {
    if (!this.resultado) return [];
    const set = new Set(this.resultado.filas.map(f => f.codigo).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }

  get resumenPorSede(): { sede: string; tipo: string; total_ibk: number; total_prosegur: number; diferencia: number }[] {
    if (!this.resultado) return [];
    const map: Record<string, any> = {};
    for (const f of this.resultado.filas) {
      if (!f.sede) continue;
      const key = `${f.sede}__${f.tipo}`;
      if (!map[key]) map[key] = { sede: f.sede, tipo: f.tipo || '', total_ibk: 0, total_prosegur: 0, diferencia: 0 };
      map[key].total_ibk += f.monto_ibk;
      map[key].total_prosegur += f.monto_prosegur;
      map[key].diferencia += f.diferencia;
    }
    return Object.values(map).map(r => ({
      ...r,
      total_ibk: round2(r.total_ibk),
      total_prosegur: round2(r.total_prosegur),
      diferencia: round2(r.diferencia),
    })).sort((a, b) => a.sede.localeCompare(b.sede));
  }

  fmt(n: number | null): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtFecha(f: string | null): string {
    if (!f) return '—';
    const d = new Date(f + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  sincronizarProsegur() {
    this.sincronizando = true;
    this.syncMensaje = '';
    this.http.post<any>(`${API}/wk/prosegur-sync`, {}).subscribe({
      next: r => {
        this.sincronizando = false;
        if (r.estado === 'OK') {
          const r1 = r.resultado?.anio_actual;
          const r2 = r.resultado?.anio_anterior;
          const total = (r1?.insertados || 0) + (r2?.insertados || 0);
          if (total > 0) {
            this.syncMensaje = `✓ ${total} filas nuevas agregadas`;
            this.syncTipo = 'ok';
          } else {
            this.syncMensaje = 'Sin filas nuevas — Está al día';
            this.syncTipo = 'info';
          }
        } else {
          this.syncMensaje = 'Error al sincronizar';
          this.syncTipo = 'info';
        }
        // Oculta el mensaje después de 4 segundos
        setTimeout(() => { this.syncMensaje = ''; this.syncTipo = ''; }, 4000);
      },
      error: () => {
        this.sincronizando = false;
        this.syncMensaje = 'Error al sincronizar';
        this.syncTipo = 'info';
        setTimeout(() => { this.syncMensaje = ''; }, 4000);
      }
    });
  }
  exportarProsegur() {
    const url = `${API}/cruce/prosegur-exportar-unificado?mes=${this.mesSeleccionado}&anio=${this.anioSeleccionado}`;
    this.http.get(url, { responseType: 'blob' }).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `PROSEGUR_Conciliado_${this.mesNombre}_${this.anioSeleccionado}.xlsx`;
      a.click();
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
