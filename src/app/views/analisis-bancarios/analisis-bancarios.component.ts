import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

const ORDEN_MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

const TABLAS = [
    { key: 'bcp_1', label: 'BCP', color: '#003F8A' },
    { key: 'bcp_tru_1', label: 'BCP TRU', color: '#1565C0' },
    { key: 'bcp_ln_1', label: 'BCP LN', color: '#1976D2' },
    { key: 'bbva_1', label: 'BBVA', color: '#004B95' },
    { key: 'bbva_lm_1', label: 'BBVA LM', color: '#0057A8' },
    { key: 'ibk_1', label: 'Interbank', color: '#007C5E' },
    { key: 'caja_arequipa_1', label: 'Caja Arequipa', color: '#B91C1C' },
];

type CatKey = 'prosegur' | 'ventas_credito' | 'ingresos_id' | 'sin_id' | 'otros';

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
    imports: [CommonModule],
    templateUrl: './analisis-bancarios.component.html',
    styleUrls: ['./analisis-bancarios.component.css']
})
export class AnalisisBancariosComponent implements OnInit {
    cargando = false;
    error = '';

    meses: string[] = [];
    mesActivo = '';
    tablaActiva = 'bcp_1';

    tablas = TABLAS;
    todos: any[] = [];

    // Categorizados
    categorias: Record<CatKey, CategorizadoRow[]> = {
        prosegur: [],
        ventas_credito: [],
        ingresos_id: [],
        sin_id: [],
        otros: [],
    };

    catActiva: CatKey = 'sin_id';

    // KPIs
    kpis: Record<CatKey, { total: number, monto: number }> = {
        prosegur: { total: 0, monto: 0 },
        ventas_credito: { total: 0, monto: 0 },
        ingresos_id: { total: 0, monto: 0 },
        sin_id: { total: 0, monto: 0 },
        otros: { total: 0, monto: 0 },
    };

    // Modal inactivos
    modalAbierto = false;
    modalRegistros: CategorizadoRow[] = [];
    catKeys: CatKey[] = ['sin_id', 'prosegur', 'ventas_credito', 'ingresos_id', 'otros'];
    constructor(private http: HttpClient) { }

    ngOnInit() {
        this.cargarMeses();
    }

    cargarMeses() {
        this.http.get<any>(`${API}/bancos/meses`).subscribe({
            next: r => {
                if (r.estado === 'OK') {
                    const set = new Set<string>();
                    r.meses.forEach((m: any) => set.add(m.mes));
                    this.meses = [...set].sort((a, b) =>
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
        this.cargarTabla();
    }

    seleccionarTabla(tabla: string) {
        this.tablaActiva = tabla;
        this.cargarTabla();
    }

    cargarTabla() {
        this.cargando = true;
        this.error = '';
        this.http.get<any>(`${API}/bancos/${this.tablaActiva}?mes=${this.mesActivo}`).subscribe({
            next: r => {
                this.cargando = false;
                if (r.estado === 'OK') {
                    this.todos = r.registros;
                    this.categorizar();
                }
            },
            error: () => { this.cargando = false; this.error = 'Error al cargar datos'; }
        });
    }

    categorizar() {
        const cats: Record<CatKey, CategorizadoRow[]> = {
            prosegur: [],
            ventas_credito: [],
            ingresos_id: [],
            sin_id: [],
            otros: [],
        };

        const tablaLabel = TABLAS.find(t => t.key === this.tablaActiva)?.label || this.tablaActiva;
        const esIBK = this.tablaActiva === 'ibk_1';
        const esBBVA = this.tablaActiva === 'bbva_1' || this.tablaActiva === 'bbva_lm_1';

        for (const r of this.todos) {
            const desc = (r.descripcion || '').toUpperCase();
            const clasi = (r.clasificacion || '').toUpperCase();
            const idPop = (r.id_pop || '').trim();

            const fila: CategorizadoRow = {
                categoria: 'otros',
                nro_cheque: r.nro_cheque || '',
                fecha: r.fecha || '',
                descripcion: r.descripcion || '',
                detalle: r.detalle || '',
                ingreso: r.ingreso || 0,
                egreso: r.egreso || 0,
                sede: r.sede || '',
                id_pop: idPop,
                clasificacion: r.clasificacion || '',
                banco: tablaLabel,
            };

            // Prosegur
            if ((esIBK && desc.includes('ABONO MAQUINA RECAU')) ||
                (esBBVA && desc.includes('PROSEGUR'))) {
                fila.categoria = 'prosegur';
                cats.prosegur.push(fila);
                continue;
            }

            // Ventas al crédito
            const clasiLower = clasi.toLowerCase();

            if (clasiLower.includes('ventas al credito') || clasiLower.includes('ventas al crédito') || fila.sede?.includes('©')) {
                fila.categoria = 'ventas_credito';
                cats.ventas_credito.push(fila);
                continue;
            }

            // Sin ID POP
            if (!idPop || idPop === 'null' || idPop === 'None') {
                fila.categoria = 'sin_id';
                cats.sin_id.push(fila);
                continue;
            }

            // Con ID POP (ingresos identificados)
            if (idPop) {
                fila.categoria = 'ingresos_id';
                cats.ingresos_id.push(fila);
                continue;
            }

            cats.otros.push(fila);
        }

        this.categorias = cats;

        // KPIs
        for (const cat of Object.keys(cats) as CatKey[]) {
            this.kpis[cat] = {
                total: cats[cat].length,
                monto: cats[cat].reduce((s, r) => s + r.ingreso, 0)
            };
        }
    }

    setCatActiva(cat: CatKey) { this.catActiva = cat; }

    get registrosActivos(): CategorizadoRow[] {
        return this.categorias[this.catActiva] || [];
    }

    get tablaActivaLabel(): string {
        return TABLAS.find(t => t.key === this.tablaActiva)?.label || this.tablaActiva;
    }

    get tablaActivaColor(): string {
        return TABLAS.find(t => t.key === this.tablaActiva)?.color || '#1e3a5f';
    }

    fmt(n: number) {
        return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    fmtK(n: number) {
        if (n >= 1_000_000) return 'S/ ' + (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return 'S/ ' + (n / 1_000).toFixed(0) + 'K';
        return 'S/ ' + n.toFixed(0);
    }

    catLabels: Record<CatKey, { label: string, icon: string, color: string }> = {
        sin_id: { label: 'Sin ID POP', icon: '❓', color: '#dc2626' },
        prosegur: { label: 'Prosegur', icon: '🔒', color: '#7c3aed' },
        ventas_credito: { label: 'Ventas al Crédito', icon: '💳', color: '#0891b2' },
        ingresos_id: { label: 'Con ID POP', icon: '✅', color: '#16a34a' },
        otros: { label: 'Otros', icon: '📦', color: '#64748b' },
    };
}