export interface FilaStockCxp {
  proveedor: string;
  esTotal: boolean;
}

export interface DatoStockCxp {
  proveedor: string;
  esTotal: boolean;
  stock: number | null;
  porPagar: number | null;
  diferencia: number | null;
  diasPiso: number | null;
  loQueDebeSer: number | null;
  exceso: number | null;
  loQueDeberíamosTener: number | null;
}

export interface SemanaStockCxp {
  fecha: string;
  filas: DatoStockCxp[];
}

export const PROVEEDORES_STOCK: FilaStockCxp[] = [
  { proveedor: 'CBC',            esTotal: false },
  { proveedor: 'SNACKS TRUX',    esTotal: false },
  { proveedor: 'SNACKS CHIMBOTE',esTotal: false },
  { proveedor: 'BACKUS',         esTotal: false },
  { proveedor: 'MONDELEZ',       esTotal: false },
  { proveedor: 'TOTALES',        esTotal: true  },
];

export const COLUMNAS_STOCK = [
  { key: 'stock',                label: 'STOCK' },
  { key: 'porPagar',             label: 'POR PAGAR' },
  { key: 'diferencia',           label: 'DIFERENCIA' },
  { key: 'diasPiso',             label: 'DÍAS PISO' },
  { key: 'loQueDebeSer',         label: 'LO QUE DEBE SER' },
  { key: 'exceso',               label: 'EXCESO' },
  { key: 'loQueDeberíamosTener', label: 'LO QUE DEBER. TENER' },
] as const;

// Fechas semanas disponibles por defecto
export const SEMANAS_DEFAULT: string[] = [
  '31/12/25', '08/01/26', '15/01/26', '22/01/26', '29/01/26', '05/02/26', '12/02/26'
];