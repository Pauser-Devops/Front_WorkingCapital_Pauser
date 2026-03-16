import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WkRefreshService } from './../../shared/services/wk-refresh.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

const API = environment.apiUrl;

interface FilaStock {
  proveedor: string;
  stock: number;
  porPagar: number;
  diferencia: number;
  diasPiso: number;
  loQueDebeSer: number;
  exceso: number;
  loQueDeberiamostener: number;
  ventasMensuales: number;
}

interface ConfigFila {
  proveedor: string;
  ventasMensuales: number;
  diasObjetivo: number;
}

interface Columna { fecha: string; label: string; }

@Component({
  selector: 'app-stock-vs-cxp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-vs-cxp.component.html',
  styleUrls: ['./stock-vs-cxp.component.css'],
})
export class StockVsCxpComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  columnas: Columna[] = [];
  datos: Record<string, FilaStock[]> = {};
  cargando = true;
  error = '';

  // ── Navegación por fecha (una a la vez) ──────────────────────────
  indiceActivo = 0;

  get columnaActiva(): Columna | null {
    return this.columnas[this.indiceActivo] ?? null;
  }

  irAnterior() {
    if (this.indiceActivo > 0) this.indiceActivo--;
  }

  irSiguiente() {
    if (this.indiceActivo < this.columnas.length - 1) this.indiceActivo++;
  }

  irAFecha(i: number) {
    this.indiceActivo = i;
  }

  // Modal nueva fecha
  mostrarModal = false;
  nuevaFecha = '';
  cargandoFecha = false;
  guardandoFecha = false;
  previewDatos: FilaStock[] = [];
  configFilas: ConfigFila[] = [];

  // Valores por defecto editables
  private VM_DEFAULT: Record<string, number> = {
    'CBC': 2652546,
    'SNACKS TRUX': 1124019,
    'SNACKS CHIMBOTE': 856272,
    'BACKUS': 7277433,
    'MONDELEZ': 5164709,
  };

  // Modal editar config
  mostrarModalConfig = false;
  fechaConfigActiva = '';
  configExistente: ConfigFila[] = [];
  guardandoConfig = false;

  constructor(private http: HttpClient, private wkRefresh: WkRefreshService) { }

  ngOnInit() {
    this.wkRefresh.ingresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(fecha => {
      this.recargarConFecha(fecha);
    });
    this.wkRefresh.egresosGuardado$.pipe(takeUntil(this.destroy$)).subscribe(fecha => {
      this.recargarConFecha(fecha);
    });
    this.cargarDatos();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  recargarConFecha(fecha: string) {
    const existe = this.columnas.find(c => c.fecha === fecha);
    if (existe) {
      this.cargarFecha(fecha);
    } else {
      const label = this.formatFecha(fecha);
      this.columnas = [...this.columnas, { fecha, label }]
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      this.cargarFecha(fecha);
    }
  }

  cargarDatos() {
    this.cargando = true;
    this.http.get<any>(`${API}/stock-cxp/fechas`).subscribe({
      next: r => {
        this.cargando = false;
        if (r.estado === 'OK') {
          const fechasOrdenadas: string[] = [...r.fechas].sort((a: string, b: string) => a.localeCompare(b));
          this.columnas = fechasOrdenadas.map((f: string) => ({ fecha: f, label: this.formatFecha(f) }));
          // Mostrar la última fecha por defecto
          this.indiceActivo = Math.max(0, this.columnas.length - 1);
          for (const col of this.columnas) this.cargarFecha(col.fecha);
        }
      },
      error: () => { this.cargando = false; this.error = 'Error al cargar datos'; }
    });
  }

  // recalcular=true: el backend recalcula desde ingresos/egresos SOLO si la fecha ya existe en BD
  cargarFecha(fecha: string) {
    this.http.get<any>(`${API}/stock-cxp/resumen?fecha_corte=${fecha}&recalcular=true`).subscribe({
      next: r => { if (r.estado === 'OK') this.datos[fecha] = r.datos; }
    });
  }

  get proveedores(): string[] {
    const f = this.columnaActiva?.fecha;
    return (f && this.datos[f]) ? this.datos[f].map(x => x.proveedor) : [];
  }

  getFila(fecha: string, prov: string): FilaStock | null {
    return this.datos[fecha]?.find(f => f.proveedor === prov) ?? null;
  }

  getTotal(fecha: string, campo: keyof FilaStock): number {
    return (this.datos[fecha] ?? []).reduce((s, f) => s + (f[campo] as number), 0);
  }

  // ── Modal nueva fecha ──────────────────────────────────────────────
  abrirModal() {
    this.mostrarModal = true;
    this.nuevaFecha = '';
    this.previewDatos = [];
    this.configFilas = [];
  }

  cerrarModal() { this.mostrarModal = false; }

  onFechaChange() {
    if (!this.nuevaFecha) return;
    this.cargandoFecha = true;
    this.previewDatos = [];
    // Usar /preview: calcula desde ingresos/egresos SIN guardar en BD
    this.http.get<any>(`${API}/stock-cxp/preview?fecha_corte=${this.nuevaFecha}`).subscribe({
      next: r => {
        this.cargandoFecha = false;
        if (r.estado === 'OK') {
          this.previewDatos = r.datos;
          this.configFilas = r.datos.map((f: FilaStock) => ({
            proveedor: f.proveedor,
            ventasMensuales: f.ventasMensuales || this.VM_DEFAULT[f.proveedor] || 0,
            diasObjetivo: f.loQueDebeSer || 0,
          }));
          this.recalcularPreview();
        }
      },
      error: () => { this.cargandoFecha = false; }
    });
  }

  recalcularPreview() {
    this.previewDatos = this.previewDatos.map(fila => {
      const cfg = this.configFilas.find(c => c.proveedor === fila.proveedor);
      if (!cfg) return fila;
      const vm = cfg.ventasMensuales || 0;
      const dias = cfg.diasObjetivo || 0;
      const diasMes = new Date(new Date(this.nuevaFecha).getFullYear(), new Date(this.nuevaFecha).getMonth() + 1, 0).getDate();
      const vd = vm / diasMes;
      const dp = vd > 0 ? +(fila.stock / vd).toFixed(2) : 0;
      const exc = dp > 0 ? +(fila.stock - (fila.stock / dp) * dias).toFixed(2) : 0;
      const lqdt = dp !== dias ? +(Math.abs(exc) / Math.abs(dp - dias) * dias).toFixed(2) : 0;
      return { ...fila, ventasMensuales: vm, loQueDebeSer: dias, diasPiso: dp, exceso: exc, loQueDeberiamostener: lqdt };
    });
  }

  guardarFecha() {
    if (!this.nuevaFecha || !this.previewDatos.length) return;
    this.guardandoFecha = true;
    const payload = {
      fecha_corte: this.nuevaFecha,
      datos: this.previewDatos.map(f => ({
        proveedor: f.proveedor, stock: f.stock, por_pagar: f.porPagar,
        diferencia: f.diferencia, dias_piso: f.diasPiso, lo_que_debe_ser: f.loQueDebeSer,
        exceso: f.exceso, lo_que_deberiamos_tener: f.loQueDeberiamostener,
        ventas_mensuales: f.ventasMensuales,
      }))
    };
    this.http.post<any>(`${API}/stock-cxp/guardar`, payload).subscribe({
      next: r => {
        this.guardandoFecha = false;
        if (r.estado === 'OK') {
          this.cerrarModal();
          // Agregar nueva columna y navegar a ella
          const yaExiste = this.columnas.find(c => c.fecha === this.nuevaFecha);
          if (!yaExiste) {
            this.columnas = [...this.columnas, { fecha: this.nuevaFecha, label: this.formatFecha(this.nuevaFecha) }]
              .sort((a, b) => a.fecha.localeCompare(b.fecha));
          }
          this.datos[this.nuevaFecha] = this.previewDatos;
          this.indiceActivo = this.columnas.findIndex(c => c.fecha === this.nuevaFecha);
        } else {
          alert('Error al guardar: ' + r.detalle);
        }
      },
      error: () => { this.guardandoFecha = false; alert('Error de conexión'); }
    });
  }

  get diasDelMes(): number {
    if (!this.nuevaFecha) return 31;
    const d = new Date(this.nuevaFecha + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  // ── Modal config fecha existente ───────────────────────────────────
  abrirConfig(fecha: string) {
    this.fechaConfigActiva = fecha;
    this.configExistente = (this.datos[fecha] ?? []).map(f => ({
      proveedor: f.proveedor,
      ventasMensuales: f.ventasMensuales,
      diasObjetivo: f.loQueDebeSer,
    }));
    this.mostrarModalConfig = true;
  }

  cerrarConfig() { this.mostrarModalConfig = false; }

  guardarConfig() {
    this.guardandoConfig = true;
    const body = this.configExistente.map(c => ({
      proveedor: c.proveedor,
      ventas_mensuales: c.ventasMensuales,
      dias_objetivo: c.diasObjetivo,
    }));
    this.http.put<any>(`${API}/stock-cxp/config?fecha_corte=${this.fechaConfigActiva}`, body).subscribe({
      next: r => {
        this.guardandoConfig = false;
        if (r.estado === 'OK') { this.cerrarConfig(); this.cargarFecha(this.fechaConfigActiva); }
      },
      error: () => { this.guardandoConfig = false; }
    });
  }

  // ── Utils ──────────────────────────────────────────────────────────
  formatFecha(fecha: string): string {
    const m = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const d = new Date(fecha + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${m[d.getMonth()]} ${d.getFullYear()}`;
  }

  fmt(n: number | null | undefined): string {
    if (n == null) return '—';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  colorDif(n: number): string {
    return n > 0 ? 'text-green' : n < 0 ? 'text-red' : '';
  }

  fmtInput(n: number | null | undefined): string {
    if (n == null || n === 0) return '';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  onInputVentas(cfg: ConfigFila, event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(raw);
    cfg.ventasMensuales = isNaN(num) ? 0 : num;
    this.recalcularPreview();
    setTimeout(() => {
      input.value = cfg.ventasMensuales > 0 ? this.fmtInput(cfg.ventasMensuales) : '';
    }, 0);
  }

  onInputVentasExistente(cfg: ConfigFila, event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(raw);
    cfg.ventasMensuales = isNaN(num) ? 0 : num;
    setTimeout(() => {
      input.value = cfg.ventasMensuales > 0 ? this.fmtInput(cfg.ventasMensuales) : '';
    }, 0);
  }

  trackByFecha(_: number, col: Columna) { return col.fecha; }
  trackByProv(_: number, p: string) { return p; }

  // ── Exportar Excel ─────────────────────────────────────────────────
  exportar() {
    const col = this.columnaActiva;   // ← fecha visible en pantalla
    if (!col) return;
    window.open(`${API}/exportar/stock-cxp?fecha_corte=${col.fecha}`, '_blank');
  }
}