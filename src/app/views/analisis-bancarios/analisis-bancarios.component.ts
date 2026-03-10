import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as XLSX from 'xlsx';
const API = environment.apiUrl;

const ORDEN_MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

const MESES_CORTOS: Record<string, string> = {
    enero: 'Ene', febrero: 'Feb', marzo: 'Mar', abril: 'Abr',
    mayo: 'May', junio: 'Jun', julio: 'Jul', agosto: 'Ago',
    septiembre: 'Sep', octubre: 'Oct', noviembre: 'Nov', diciembre: 'Dic'
};

const TABLAS = [
    { key: 'bcp_1', label: 'BCP', color: '#003F8A' },
    { key: 'bcp_tru_1', label: 'BCP TRU', color: '#1565C0' },
    { key: 'bcp_ln_1', label: 'BCP LN', color: '#1976D2' },
    { key: 'bbva_1', label: 'BBVA', color: '#004B95' },
    { key: 'bbva_lm_1', label: 'BBVA LM', color: '#0057A8' },
    { key: 'ibk_1', label: 'Interbank', color: '#007C5E' },
    { key: 'caja_arequipa_1', label: 'Caja Arequipa', color: '#B91C1C' },
    { key: 'ibk_usd_1', label: 'IBK USD', color: '#00896B' },
    { key: 'pichincha_1', label: 'Pichincha', color: '#E65100' },
    { key: 'bn_1', label: 'B. Nación', color: '#1A237E' },
];

type CatKey = 'prosegur' | 'ventas_credito' | 'ingresos_id' | 'sin_id';
type ViewKey = CatKey | 'todos';

interface PeriodoItem { mes: string; anio: number; label: string; }

interface CategorizadoRow {
    categoria: CatKey;
    nro_cheque: string;
    fecha: string;
    descripcion: string;
    detalle: string;
    ingreso: number;
    egreso: number;
    sede: string;
    id_pop: string;
    clasificacion: string;
    banco: string;
}

@Component({
    selector: 'app-analisis-bancarios',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './analisis-bancarios.component.html',
    styleUrls: ['./analisis-bancarios.component.css']
})
export class AnalisisBancariosComponent implements OnInit {
    cargando = false;
    cargandoSync = false;
    error = '';
    mensajeSync = '';
    errorSync = false;

    periodos: PeriodoItem[] = [];
    periodoActivo: PeriodoItem | null = null;

    tablaActiva = 'bcp_1';
    tablas = TABLAS;

    // Cache por periodo: guarda los datos raw de todas las tablas
    // key: "mes-anio", value: Record<tabla, rows[]>
    private cache: Record<string, Record<string, any[]>> = {};

    // Datos raw de la tabla activa (ya desde cache)
    todos: any[] = [];
    todasFilas: CategorizadoRow[] = [];

    categorias: Record<CatKey, CategorizadoRow[]> = {
        prosegur: [], ventas_credito: [], ingresos_id: [], sin_id: [],
    };

    catActiva: ViewKey = 'todos';

    kpiGeneral = {
        registros: 0, totalIngresos: 0, totalEgresos: 0, neto: 0,
        conIdPop: 0, sinIdPop: 0, montoConId: 0, montoSinId: 0,
    };

    kpis: Record<CatKey, { total: number, monto: number }> = {
        prosegur: { total: 0, monto: 0 },
        ventas_credito: { total: 0, monto: 0 },
        ingresos_id: { total: 0, monto: 0 },
        sin_id: { total: 0, monto: 0 },
    };

    sinIdDesglose = {
        ingresos: { total: 0, monto: 0 },
        egresos: { total: 0, monto: 0 },
    };

    sinIdFiltro: 'todos' | 'ingresos' | 'egresos' = 'todos';
    busqueda = '';
    fechaDesde = '';
    fechaHasta = '';

    catKeys: ViewKey[] = ['todos', 'sin_id', 'prosegur', 'ventas_credito', 'ingresos_id'];

    catLabels: Record<ViewKey, { label: string, color: string }> = {
        todos: { label: 'Todos', color: '#1e3a5f' },
        sin_id: { label: 'Sin ID POP', color: '#dc2626' },
        prosegur: { label: 'Prosegur', color: '#7c3aed' },
        ventas_credito: { label: 'Ventas al Crédito', color: '#0891b2' },
        ingresos_id: { label: 'Con ID POP', color: '#16a34a' },
    };

    constructor(private http: HttpClient) { }

    ngOnInit() { this.cargarMeses(); }

    // ── carga de meses ───────────────────────────────────

    cargarMeses() {
        this.http.get<any>(`${API}/bancos/meses`).subscribe({
            next: r => {
                if (r.estado === 'OK') {
                    const vistos = new Set<string>();
                    const lista: PeriodoItem[] = [];
                    for (const m of r.meses) {
                        const key = `${m.mes}-${m.anio}`;
                        if (!vistos.has(key)) {
                            vistos.add(key);
                            const mesLower = (m.mes || '').toLowerCase();
                            lista.push({
                                mes: m.mes, anio: m.anio,
                                label: `${MESES_CORTOS[mesLower] || m.mes} ${m.anio}`
                            });
                        }
                    }
                    this.periodos = lista.sort((a, b) =>
                        a.anio !== b.anio
                            ? a.anio - b.anio
                            : (ORDEN_MESES[a.mes.toLowerCase()] || 99) - (ORDEN_MESES[b.mes.toLowerCase()] || 99)
                    );
                    if (this.periodos.length) this.seleccionarPeriodo(this.periodos[this.periodos.length - 1]);
                }
            },
            error: () => this.error = 'No se pudo conectar a la API'
        });
    }

    // ── selección de periodo: carga TODO en paralelo ─────

    seleccionarPeriodo(p: PeriodoItem) {
        this.periodoActivo = p;
        this.resetFiltros();
        this.cargarTodasLasTablas();
    }

    /**
     * Cambia de tabla SIN hacer ningún request —
     * los datos ya están en cache desde la carga inicial.
     */
    seleccionarTabla(tabla: string) {
        this.tablaActiva = tabla;
        this.resetFiltros();
        this.usarCacheParaTablaActiva();
    }

    resetFiltros() {
        this.fechaDesde = '';
        this.fechaHasta = '';
        this.busqueda = '';
        this.sinIdFiltro = 'todos';
        this.catActiva = 'todos';
        this.mensajeSync = '';
        this.todos = [];
        this.todasFilas = [];
    }

    /**
     * Carga las 7 tablas en paralelo con forkJoin.
     * Si ya están en cache, las usa directo sin llamar al backend.
     */
    cargarTodasLasTablas() {
        if (!this.periodoActivo) return;
        const { mes, anio } = this.periodoActivo;
        const cacheKey = `${mes}-${anio}`;

        // Si ya está en cache, usar directo
        if (this.cache[cacheKey]) {
            this.usarCacheParaTablaActiva();
            return;
        }

        this.cargando = true;
        this.error = '';

        // forkJoin lanza los 7 requests en paralelo y espera a que todos terminen
        const requests: Record<string, any> = {};
        for (const t of TABLAS) {
            requests[t.key] = this.http.get<any>(
                `${API}/bancos/${t.key}?mes=${mes}&anio=${anio}`
            ).pipe(catchError(() => of({ estado: 'ERROR', registros: [] })));
        }

        forkJoin(requests).subscribe({
            next: (resultados: any) => {
                this.cargando = false;
                const datosCache: Record<string, any[]> = {};
                for (const t of TABLAS) {
                    datosCache[t.key] = resultados[t.key]?.registros || [];
                }
                this.cache[cacheKey] = datosCache;
                this.usarCacheParaTablaActiva();
            },
            error: () => { this.cargando = false; this.error = 'Error al cargar datos'; }
        });
    }

    /**
     * Toma los datos de la tabla activa desde el cache y categoriza.
     * No hace ningún request HTTP.
     */
    private usarCacheParaTablaActiva() {
        if (!this.periodoActivo) return;
        const cacheKey = `${this.periodoActivo.mes}-${this.periodoActivo.anio}`;
        const datosCache = this.cache[cacheKey];
        if (!datosCache) return;
        this.todos = datosCache[this.tablaActiva] || [];
        this.categorizar();
    }

    // ── sincronizar (invalida cache del periodo) ─────────

    sincronizar() {
        if (!this.periodoActivo) return;
        this.cargandoSync = true;
        this.mensajeSync = '';
        const { mes, anio } = this.periodoActivo;
        this.http.post<any>(`${API}/bancos/sync?mes=${mes}&anio=${anio}`, {}).subscribe({
            next: r => {
                this.cargandoSync = false;
                this.mensajeSync = r.mensaje || r.detalle || 'Sincronización completada';
                this.errorSync = r.estado !== 'OK';
                if (r.estado === 'OK') {
                    // Invalidar cache para forzar recarga fresca
                    const cacheKey = `${mes}-${anio}`;
                    delete this.cache[cacheKey];
                    this.cargarMeses();
                    this.cargarTodasLasTablas();
                }
            },
            error: () => { this.cargandoSync = false; this.mensajeSync = 'Error de conexión'; this.errorSync = true; }
        });
    }

    // ── filtro fecha ─────────────────────────────────────

    get todosFiltradosFecha(): any[] {
        if (!this.fechaDesde && !this.fechaHasta) return this.todos;
        const desde = this.fechaDesde ? new Date(this.fechaDesde) : null;
        const hasta = this.fechaHasta ? new Date(this.fechaHasta + 'T23:59:59') : null;
        return this.todos.filter(r => {
            if (!r.fecha) return true;
            const f = new Date(r.fecha);
            if (desde && f < desde) return false;
            if (hasta && f > hasta) return false;
            return true;
        });
    }

    // ── categorización ───────────────────────────────────

    categorizar() {
        const cats: Record<CatKey, CategorizadoRow[]> = {
            prosegur: [], ventas_credito: [], ingresos_id: [], sin_id: [],
        };
        const allFilas: CategorizadoRow[] = [];

        const tablaLabel = TABLAS.find(t => t.key === this.tablaActiva)?.label || this.tablaActiva;
        const esIBK = this.tablaActiva === 'ibk_1';
        const esBBVA = this.tablaActiva === 'bbva_1' || this.tablaActiva === 'bbva_lm_1';

        for (const r of this.todosFiltradosFecha) {
            const desc = (r.descripcion || '').toUpperCase();
            const clasi = (r.clasificacion || '').toUpperCase();
            const idPop = (r.id_pop || '').trim();
            const sede = (r.sede || '').trim();
            const ingreso = parseFloat(r.ingreso) || 0;
            const egreso = Math.abs(parseFloat(r.egreso) || 0);

            const fila: CategorizadoRow = {
                categoria: 'sin_id',
                nro_cheque: r.nro_cheque || '',
                fecha: r.fecha || '',
                descripcion: r.descripcion || '',
                detalle: r.detalle || '',
                ingreso, egreso, sede,
                id_pop: idPop,
                clasificacion: r.clasificacion || '',
                banco: tablaLabel,
            };

            // 1. Prosegur
            if ((esIBK && (desc.includes('ABONO MAQUINA RECAU') || desc.includes('N/A VARIOS'))) ||
                (esBBVA && desc.includes('PROSEGUR'))) {
                fila.categoria = 'prosegur';
                cats['prosegur'].push(fila);
                allFilas.push(fila);
                continue;
            }

            // 2. Ventas al crédito
            const clasiLower = clasi.toLowerCase();
            if (clasiLower.includes('ventas al credito') ||
                clasiLower.includes('ventas al crédito') ||
                fila.sede?.includes('©')) {
                fila.categoria = 'ventas_credito';
                cats['ventas_credito'].push(fila);
                allFilas.push(fila);
                continue;
            }

            // 3. Sin ID POP — solo si AMBOS id_pop Y sede están vacíos
            const sinIdPop = !idPop || idPop === 'null' || idPop === 'None';
            const sinSede = !sede || sede === 'null' || sede === 'None';

            if (sinIdPop && sinSede) {
                fila.categoria = 'sin_id';
                cats['sin_id'].push(fila);
                allFilas.push(fila);
                continue;
            }

            // 4. Con ID POP (tiene id_pop O tiene sede llena)
            fila.categoria = 'ingresos_id';
            cats['ingresos_id'].push(fila);
            allFilas.push(fila);
        }

        this.categorias = cats;
        this.todasFilas = allFilas;

        const catKeysList: CatKey[] = ['prosegur', 'ventas_credito', 'ingresos_id', 'sin_id'];
        for (const cat of catKeysList) {
            this.kpis[cat] = {
                total: cats[cat].length,
                monto: cats[cat].reduce((s, r) => s + r.ingreso, 0),
            };
        }

        const totalIngresos = allFilas.reduce((s, r) => s + r.ingreso, 0);
        const totalEgresos = allFilas.reduce((s, r) => s + r.egreso, 0);
        const conId = allFilas.filter(r => r.id_pop && r.id_pop !== 'null' && r.id_pop !== 'None' && r.id_pop !== '');
        const sinId = allFilas.filter(r => !r.id_pop || r.id_pop === 'null' || r.id_pop === 'None' || r.id_pop === '');

        this.kpiGeneral = {
            registros: allFilas.length,
            totalIngresos, totalEgresos,
            neto: totalIngresos - totalEgresos,
            conIdPop: conId.length,
            sinIdPop: sinId.length,
            montoConId: conId.reduce((s, r) => s + r.ingreso, 0),
            montoSinId: sinId.reduce((s, r) => s + r.ingreso, 0),
        };

        const sinIdRows = cats['sin_id'];
        const soloIngresos = sinIdRows.filter(r => r.ingreso > 0);
        const soloEgresos = sinIdRows.filter(r => r.egreso > 0);
        this.sinIdDesglose = {
            ingresos: { total: soloIngresos.length, monto: soloIngresos.reduce((s, r) => s + r.ingreso, 0) },
            egresos: { total: soloEgresos.length, monto: soloEgresos.reduce((s, r) => s + r.egreso, 0) },
        };
    }

    onFechaChange() { this.categorizar(); }
    limpiarFechas() { this.fechaDesde = ''; this.fechaHasta = ''; this.categorizar(); }
    get hayFiltroFecha(): boolean { return !!(this.fechaDesde || this.fechaHasta); }

    setCatActiva(cat: ViewKey) {
        this.catActiva = cat;
        this.sinIdFiltro = 'todos';
        this.busqueda = '';
    }

    setSinIdFiltro(filtro: 'ingresos' | 'egresos') {
        this.sinIdFiltro = this.sinIdFiltro === filtro ? 'todos' : filtro;
        this.busqueda = '';
    }

    // ── registros visibles (búsqueda omite espacios) ─────

    get registrosActivos(): CategorizadoRow[] {
        let rows: CategorizadoRow[];
        if (this.catActiva === 'todos') {
            rows = [...this.todasFilas];
        } else {
            rows = this.categorias[this.catActiva as CatKey] || [];
            if (this.catActiva === 'sin_id') {
                if (this.sinIdFiltro === 'ingresos') rows = rows.filter(r => r.ingreso > 0);
                if (this.sinIdFiltro === 'egresos') rows = rows.filter(r => r.egreso > 0);
            }
        }

        const q = this.busqueda.replace(/\s+/g, '').toLowerCase();
        if (q) {
            rows = rows.filter(r =>
                [r.nro_cheque, r.fecha, r.descripcion, r.detalle,
                r.sede, r.id_pop, r.clasificacion, r.categoria,
                r.ingreso.toString(), r.egreso.toString()]
                    .some(v => (v || '').toString().replace(/\s+/g, '').toLowerCase().includes(q))
            );
        }
        return rows;
    }

    // ── exportar Excel ───────────────────────────────────

    exportarExcel() {
        if (!this.periodoActivo) return;
        const { mes, anio } = this.periodoActivo;
        const url = `${API}/bancos/exportar-excel?tabla=${this.tablaActiva}&mes=${mes}&anio=${anio}`;
        window.open(url, '_blank');
    }

    // ── utils ─────────────────────────────────────────────

    private formatFechaExcel(v: string): string {
        if (!v) return '—';
        const d = new Date(v);
        return isNaN(d.getTime()) ? v : d.toLocaleDateString('es-PE');
    }

    private fmtNum(n: number): string {
        return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    badgeMonto(cat: ViewKey): string {
        if (cat === 'todos') return this.fmtK(this.kpiGeneral.totalIngresos);
        return this.fmtK(this.kpis[cat as CatKey]?.monto || 0);
    }

    get periodoLabel(): string { return this.periodoActivo?.label || ''; }
    get tablaActivaLabel(): string {
        return TABLAS.find(t => t.key === this.tablaActiva)?.label || this.tablaActiva;
    }

    fmt(n: number): string {
        return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    fmtK(n: number): string {
        if (n >= 1_000_000) return 'S/ ' + (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return 'S/ ' + (n / 1_000).toFixed(0) + 'K';
        return 'S/ ' + n.toFixed(0);
    }

    get montoActivo(): number {
        return this.registrosActivos.reduce((s, r) => s + r.ingreso, 0);
    }
}