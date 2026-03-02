export type TipoFila = 'seccion' | 'grupo' | 'item' | 'subitem' | 'total' | 'wk' | 'pago';

export interface FilaEstructura {
  nombre: string;
  tipo: TipoFila;
  indent: number;
}

export interface FilaDato extends FilaEstructura {
  montos: (number | null)[];
  variacion: number | null;
}

export interface KPIs {
  wk: number | null;
  activo: number | null;
  pasivo: number | null;
}

export interface RespuestaApi {
  estado: string;
  detalle?: string;
  filas: FilaDato[];
  fechas: string[];
  kpis: KPIs;
}