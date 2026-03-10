import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

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

const TABLAS_SOLO_MONTO = ['ibk_usd_1', 'pichincha_1', 'bn_1'];

const TODAS_TABLAS = ['bcp_1', 'bcp_tru_1', 'bcp_ln_1', 'bbva_1', 'bbva_lm_1', 'ibk_1', 'caja_arequipa_1'];

const TODAS_TABLAS_COMPLETO = [...TODAS_TABLAS, ...TABLAS_SOLO_MONTO];

const ENTIDADES: Record<string, string[]> = {
    'BCP':           ['bcp_1', 'bcp_tru_1', 'bcp_ln_1'],
    'BBVA':          ['bbva_1', 'bbva_lm_1'],
    'Interbank':     ['ibk_1'],
    'Caja Arequipa': ['caja_arequipa_1'],
    'IBK USD':       ['ibk_usd_1'],
    'Pichincha':     ['pichincha_1'],
    'B. Nación':     ['bn_1'],
};

const TABLAS_LABELS: Record<string, string> = {
    bcp_1: 'BCP', bcp_tru_1: 'BCP TRU', bcp_ln_1: 'BCP LN',
    bbva_1: 'BBVA', bbva_lm_1: 'BBVA LM',
    ibk_1: 'Interbank', caja_arequipa_1: 'Caja Arequipa',
    ibk_usd_1: 'IBK USD', pichincha_1: 'Pichincha', bn_1: 'B. Nación',
};

const TODAS_TABLAS_LABELS_CONCIL = ['bcp_1', 'bcp_tru_1', 'bcp_ln_1', 'bbva_1', 'bbva_lm_1', 'ibk_1', 'caja_arequipa_1'];

const COLORES_BANCO: Record<string, string> = {
    bcp_1: '#003F8A', bcp_tru_1: '#1565C0', bcp_ln_1: '#1976D2',
    bbva_1: '#004B95', bbva_lm_1: '#0057A8',
    ibk_1: '#007C5E', caja_arequipa_1: '#B91C1C',
    ibk_usd_1: '#00896B', pichincha_1: '#E65100', bn_1: '#1A237E',
};

const COLORES_ENTIDAD: Record<string, string> = {
    'BCP': '#1565C0', 'BBVA': '#004B95', 'Interbank': '#007C5E', 'Caja Arequipa': '#B91C1C',
    'IBK USD': '#00896B', 'Pichincha': '#E65100', 'B. Nación': '#1A237E',
};

interface PeriodoItem { mes: string; anio: number; label: string; }
interface FilaNorm {
    tabla: string; entidad: string;
    fecha: string; dia: number;
    descripcion: string; detalle: string;
    ingreso: number; egreso: number;
    id_pop: string; clasificacion: string; sede: string;
    categoria: string; conciliado: boolean;
}

@Component({
    selector: 'app-reportes-bancarios',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './reportes-bancarios.component.html',
    styleUrls: ['./reportes-bancarios.component.css'],
})
export class ReportesBancariosComponent implements OnInit, OnDestroy, AfterViewInit {

    periodos: PeriodoItem[] = [];
    periodoActivo: PeriodoItem | null = null;

    filtroEntidad = 'todas';
    filtroBanco   = 'todos';

    entidades = Object.keys(ENTIDADES);
    bancos    = TODAS_TABLAS_COMPLETO;

    cargando = false;
    error    = '';
    datosRaw: Record<string, any[]> = {};

    filas: FilaNorm[] = [];
    filasFiltradas: FilaNorm[] = [];

    kpis = {
        totalIngresos: 0, totalEgresos: 0, neto: 0,
        conciliados: 0, pendientes: 0, pctConciliado: 0,
        sinIdPop: 0, montoSinId: 0, idPopDuplicados: 0,
    };

    topDuplicados: { id_pop: string, count: number, monto: number }[] = [];
    sinIdPorBanco: { banco: string, count: number, monto: number }[] = [];
    evolucionDias: { dia: number, ingresos: number, egresos: number }[] = [];

    private charts: any[] = [];
    private chartsCreados = false;

    @ViewChild('chartCategoria')  chartCategoriaRef!: ElementRef;
    @ViewChild('chartConciliado') chartConciliadoRef!: ElementRef;
    @ViewChild('chartEvolucion')  chartEvolucionRef!: ElementRef;
    @ViewChild('chartBancos')     chartBancosRef!: ElementRef;

    constructor(private http: HttpClient) {}

    ngOnInit()        { this.cargarPeriodos(); }
    ngAfterViewInit() {}
    ngOnDestroy()     { this.destruirCharts(); }

    destruirCharts() {
        this.charts.forEach(c => c.destroy());
        this.charts = [];
        this.chartsCreados = false;
    }

    cargarPeriodos() {
        this.http.get<any>(`${API}/bancos/meses`).subscribe({
            next: r => {
                if (r.estado !== 'OK') return;
                const vistos = new Set<string>();
                const lista: PeriodoItem[] = [];
                for (const m of r.meses) {
                    const key = `${m.mes}-${m.anio}`;
                    if (!vistos.has(key)) {
                        vistos.add(key);
                        lista.push({
                            mes: m.mes, anio: m.anio,
                            label: `${MESES_CORTOS[m.mes.toLowerCase()] || m.mes} ${m.anio}`
                        });
                    }
                }
                this.periodos = lista.sort((a, b) =>
                    a.anio !== b.anio ? a.anio - b.anio
                    : (ORDEN_MESES[a.mes.toLowerCase()] || 99) - (ORDEN_MESES[b.mes.toLowerCase()] || 99)
                );
                if (this.periodos.length) this.seleccionarPeriodo(this.periodos[this.periodos.length - 1]);
            },
            error: () => this.error = 'No se pudo conectar'
        });
    }

    seleccionarPeriodo(p: PeriodoItem) {
        this.periodoActivo = p;
        this.filtroEntidad = 'todas';
        this.filtroBanco   = 'todos';
        this.destruirCharts();
        this.cargarTodosLosBancos();
    }

    cargarTodosLosBancos() {
        if (!this.periodoActivo) return;
        this.cargando = true;
        this.error    = '';
        this.datosRaw = {};
        const { mes, anio } = this.periodoActivo;

        this.http.get<any>(`${API}/bancos/consolidado?mes=${mes}&anio=${anio}`).subscribe({
            next: r => {
                this.cargando = false;
                if (r.estado === 'OK') {
                    for (const tabla of TODAS_TABLAS_COMPLETO) {
                        this.datosRaw[tabla] = r.registros.filter((x: any) => x.tabla === tabla);
                    }
                    this.procesar();
                }
            },
            error: () => { this.cargando = false; this.error = 'Error al cargar datos'; }
        });
    }

    procesar() {
        const allFilas: FilaNorm[] = [];

        for (const tabla of TODAS_TABLAS_COMPLETO) {
            const esSoloMonto = TABLAS_SOLO_MONTO.includes(tabla);
            const entidad = Object.keys(ENTIDADES).find(e => ENTIDADES[e].includes(tabla)) || tabla;
            const rows    = this.datosRaw[tabla] || [];
            const esIBK   = tabla === 'ibk_1';
            const esBBVA  = tabla === 'bbva_1' || tabla === 'bbva_lm_1';

            for (const r of rows) {
                const desc    = (r.descripcion   || '').toUpperCase();
                const clasi   = (r.clasificacion || '').toLowerCase().trim();
                const idPop   = (r.id_pop        || '').trim();
                const sede    = (r.sede          || '').toLowerCase();
                const ingreso = parseFloat(r.ingreso) || 0;
                const egreso  = Math.abs(parseFloat(r.egreso) || 0);
                const fechaStr = r.fecha ? r.fecha.toString().slice(0, 10) : '';
                const dia      = fechaStr ? new Date(fechaStr).getDate() : 0;

                let categoria = 'egreso';

                if (esSoloMonto) {
                    categoria = ingreso > 0 ? 'solo_monto' : 'egreso';
                } else if (ingreso > 0) {
                    if ((esIBK  && (desc.includes('ABONO MAQUINA RECAU') || desc.includes('N/A VARIOS'))) ||
                        (esBBVA && desc.includes('PROSEGUR'))) {
                        categoria = 'prosegur';
                    } else if (['ventas al credito', 'ventas al crédito'].includes(clasi) || sede.includes('©')) {
                        categoria = 'ventas_credito';
                    } else if (idPop && idPop !== 'null' && idPop !== 'None' && idPop !== '') {
                        categoria = 'ingresos_id';
                    } else {
                        categoria = 'sin_id';
                    }
                }

                allFilas.push({
                    tabla, entidad, fecha: fechaStr, dia,
                    descripcion:   r.descripcion   || '',
                    detalle:       r.detalle        || '',
                    ingreso, egreso,
                    id_pop:        esSoloMonto ? '' : idPop,
                    clasificacion: r.clasificacion  || '',
                    sede:          r.sede           || '',
                    categoria,
                    conciliado: ['ingresos_id', 'prosegur', 'ventas_credito'].includes(categoria),
                });
            }
        }

        this.filas = allFilas;
        this.aplicarFiltro();
    }

    aplicarFiltro() {
        let data = [...this.filas];

        if (this.filtroBanco !== 'todos') {
            data = data.filter(r => r.tabla === this.filtroBanco);
        } else if (this.filtroEntidad !== 'todas') {
            const tablas = ENTIDADES[this.filtroEntidad] || [];
            data = data.filter(r => tablas.includes(r.tabla));
        }

        this.filasFiltradas = data;
        this.calcularKpis();
        this.calcularDuplicados();
        this.calcularSinIdPorBanco();
        this.calcularEvolucion();
        this.renderCharts();
    }

    setFiltroEntidad(e: string) {
        this.filtroEntidad = e;
        this.filtroBanco   = 'todos';
        this.aplicarFiltro();
    }

    setFiltroBanco(b: string) {
        this.filtroBanco   = b;
        this.filtroEntidad = b === 'todos' ? 'todas'
            : Object.keys(ENTIDADES).find(e => ENTIDADES[e].includes(b)) || 'todas';
        this.aplicarFiltro();
    }

    calcularKpis() {
        const d = this.filasFiltradas;

        const totalIngresos = d.reduce((s, r) => s + r.ingreso, 0);
        const totalEgresos  = d.reduce((s, r) => s + r.egreso,  0);

        // Conciliación solo sobre bancos que participan
        const paraConc    = d.filter(r => r.categoria !== 'egreso' && r.categoria !== 'solo_monto');
        const conciliados = paraConc.filter(r => r.conciliado).length;
        const pendientes  = paraConc.filter(r => r.categoria === 'sin_id').length;
        const sinId       = d.filter(r => r.categoria === 'sin_id');

        this.kpis = {
            totalIngresos, totalEgresos,
            neto: totalIngresos - totalEgresos,
            conciliados, pendientes,
            pctConciliado: (conciliados + pendientes) > 0
                ? Math.round(conciliados / (conciliados + pendientes) * 100) : 0,
            sinIdPop:   sinId.length,
            montoSinId: sinId.reduce((s, r) => s + r.ingreso, 0),
            idPopDuplicados: 0,
        };
    }

    calcularDuplicados() {
        const mapa: Record<string, { count: number, monto: number }> = {};
        // Solo bancos de conciliación
        for (const r of this.filasFiltradas.filter(f => !TABLAS_SOLO_MONTO.includes(f.tabla))) {
            if (!r.id_pop || r.id_pop === 'null' || r.id_pop === 'None' || r.id_pop === '') continue;
            if (!mapa[r.id_pop]) mapa[r.id_pop] = { count: 0, monto: 0 };
            mapa[r.id_pop].count++;
            mapa[r.id_pop].monto += r.ingreso;
        }
        this.topDuplicados = Object.entries(mapa)
            .filter(([, v]) => v.count > 1)
            .map(([id_pop, v]) => ({ id_pop, ...v }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        this.kpis.idPopDuplicados = this.topDuplicados.length;
    }

    calcularSinIdPorBanco() {
        const mapa: Record<string, { count: number, monto: number }> = {};
        for (const r of this.filasFiltradas) {
            if (r.categoria !== 'sin_id') continue;
            if (!mapa[r.tabla]) mapa[r.tabla] = { count: 0, monto: 0 };
            mapa[r.tabla].count++;
            mapa[r.tabla].monto += r.ingreso;
        }
        this.sinIdPorBanco = Object.entries(mapa)
            .map(([tabla, v]) => ({ banco: TABLAS_LABELS[tabla] || tabla, ...v }))
            .sort((a, b) => b.monto - a.monto);
    }

    calcularEvolucion() {
        const mapa: Record<number, { ingresos: number, egresos: number }> = {};
        for (const r of this.filasFiltradas) {
            if (!r.dia) continue;
            if (!mapa[r.dia]) mapa[r.dia] = { ingresos: 0, egresos: 0 };
            mapa[r.dia].ingresos += r.ingreso;
            mapa[r.dia].egresos  += r.egreso;
        }
        this.evolucionDias = Object.entries(mapa)
            .map(([dia, v]) => ({ dia: +dia, ...v }))
            .sort((a, b) => a.dia - b.dia);
    }

    renderCharts() {
        if (this.chartsCreados) {
            this.actualizarCharts();
            return;
        }
        setTimeout(() => this.crearCharts(), 50);
    }

    crearCharts() {
        this.destruirCharts();

        // 1. Categorías
        if (this.chartCategoriaRef?.nativeElement) {
            const cats    = ['sin_id', 'ingresos_id', 'prosegur', 'ventas_credito', 'solo_monto'];
            const labels  = ['Ingresos Pendientes', 'Ingresos Conciliados', 'Prosegur', 'Ventas Crédito', 'Otros Bancos'];
            const colores = ['#dc2626', '#16a34a', '#e6e204', '#0891b2', '#94a3b8'];
            this.charts[0] = new Chart(this.chartCategoriaRef.nativeElement, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: cats.map(c => this.filasFiltradas.filter(r => r.categoria === c).reduce((s, r) => s + r.ingreso, 0)),
                        backgroundColor: colores, borderWidth: 2, borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 400 },
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
                        tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.label}: S/ ${(ctx.raw as number).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` } }
                    },
                    cutout: '65%',
                }
            });
        }

        // 2. Conciliado
        if (this.chartConciliadoRef?.nativeElement) {
            this.charts[1] = new Chart(this.chartConciliadoRef.nativeElement, {
                type: 'doughnut',
                data: {
                    labels: ['Conciliados', 'Pendientes'],
                    datasets: [{
                        data: [this.kpis.conciliados, this.kpis.pendientes],
                        backgroundColor: ['#16a34a', '#dc2626'],
                        borderWidth: 2, borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 400 },
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
                        tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} registros` } }
                    },
                    cutout: '65%',
                }
            });
        }

        // 3. Evolución
        if (this.chartEvolucionRef?.nativeElement && this.evolucionDias.length) {
            this.charts[2] = new Chart(this.chartEvolucionRef.nativeElement, {
                type: 'line',
                data: {
                    labels: this.evolucionDias.map(d => `${d.dia}`),
                    datasets: [
                        { label: 'Ingresos', data: this.evolucionDias.map(d => d.ingresos), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.1)', fill: true, tension: 0.4, pointRadius: 3 },
                        { label: 'Egresos',  data: this.evolucionDias.map(d => d.egresos),  borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.08)', fill: true, tension: 0.4, pointRadius: 3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 400 },
                    plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
                    scales: {
                        x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: (v: any) => 'S/ ' + Number(v).toLocaleString('es-PE') } }
                    }
                }
            });
        }

        // 4. Bancos
        if (this.chartBancosRef?.nativeElement) {
            const tablasFiltradas = this.filtroBanco !== 'todos' ? [this.filtroBanco]
                : this.filtroEntidad !== 'todas' ? ENTIDADES[this.filtroEntidad]
                : TODAS_TABLAS_COMPLETO;
            this.charts[3] = new Chart(this.chartBancosRef.nativeElement, {
                type: 'bar',
                data: {
                    labels: tablasFiltradas.map(t => TABLAS_LABELS[t] || t),
                    datasets: [
                        { label: 'Ingresos', data: tablasFiltradas.map(t => this.filasFiltradas.filter(r => r.tabla === t).reduce((s, r) => s + r.ingreso, 0)), backgroundColor: tablasFiltradas.map(t => COLORES_BANCO[t] || '#1e3a5f'), borderRadius: 4 },
                        { label: 'Egresos',  data: tablasFiltradas.map(t => this.filasFiltradas.filter(r => r.tabla === t).reduce((s, r) => s + r.egreso,  0)), backgroundColor: 'rgba(220,38,38,.6)', borderRadius: 4 },
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 400 },
                    plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: (v: any) => 'S/ ' + Number(v).toLocaleString('es-PE') } }
                    }
                }
            });
        }

        this.chartsCreados = true;
    }

    actualizarCharts() {
        const cats = ['sin_id', 'ingresos_id', 'prosegur', 'ventas_credito', 'solo_monto'];

        if (this.charts[0]) {
            this.charts[0].data.datasets[0].data = cats.map((c: string) =>
                this.filasFiltradas.filter(r => r.categoria === c).reduce((s, r) => s + r.ingreso, 0)
            );
            this.charts[0].update('none');
        }

        if (this.charts[1]) {
            this.charts[1].data.datasets[0].data = [this.kpis.conciliados, this.kpis.pendientes];
            this.charts[1].update('none');
        }

        if (this.charts[2]) {
            this.charts[2].data.labels = this.evolucionDias.map(d => `${d.dia}`);
            this.charts[2].data.datasets[0].data = this.evolucionDias.map(d => d.ingresos);
            this.charts[2].data.datasets[1].data = this.evolucionDias.map(d => d.egresos);
            this.charts[2].update('none');
        }

        if (this.charts[3]) {
            const tablasFiltradas = this.filtroBanco !== 'todos' ? [this.filtroBanco]
                : this.filtroEntidad !== 'todas' ? ENTIDADES[this.filtroEntidad]
                : TODAS_TABLAS_COMPLETO;
            this.charts[3].data.labels = tablasFiltradas.map((t: string) => TABLAS_LABELS[t] || t);
            this.charts[3].data.datasets[0].data = tablasFiltradas.map((t: string) =>
                this.filasFiltradas.filter(r => r.tabla === t).reduce((s, r) => s + r.ingreso, 0)
            );
            this.charts[3].data.datasets[1].data = tablasFiltradas.map((t: string) =>
                this.filasFiltradas.filter(r => r.tabla === t).reduce((s, r) => s + r.egreso, 0)
            );
            this.charts[3].update('none');
        }
    }

    get periodoLabel(): string { return this.periodoActivo?.label || ''; }

    get bancosDeEntidad(): string[] {
        if (this.filtroEntidad === 'todas') return TODAS_TABLAS_COMPLETO;
        return ENTIDADES[this.filtroEntidad] || [];
    }

    labelBanco(tabla: string):  string { return TABLAS_LABELS[tabla]  || tabla; }
    colorBanco(tabla: string):  string { return COLORES_BANCO[tabla]  || '#1e3a5f'; }
    colorEntidad(e: string):    string { return COLORES_ENTIDAD[e]    || '#1e3a5f'; }

    fmt(n: number) {
        return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    fmtK(n: number) {
        if (n >= 1_000_000) return 'S/ ' + (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000)     return 'S/ ' + (n / 1_000).toFixed(0) + 'K';
        return 'S/ ' + n.toFixed(0);
    }
}