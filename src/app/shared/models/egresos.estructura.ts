export type TipoFilaEgresos = 'seccion' | 'subgrupo' | 'item' | 'subitem' | 'total';

export interface FilaEgresos {
  nombre: string;
  tipo: TipoFilaEgresos;
  indent: number;
}

export interface FilaDatoEgresos extends FilaEgresos {
  montos: (number | null)[];
  variacion: number | null;
}

export const FECHAS_DEFAULT_EGRESOS: string[] = [
  '31/12/25', '08/01/26', '15/01/26', '22/01/26', '29/01/26', '05/02/26', '12/02/26'
];

export const ESTRUCTURA_EGRESOS: FilaEgresos[] = [

  // ── PROVEEDORES PRINCIPALES ────────────────────────────────
  { nombre: 'PROVEEDORES PRINCIPALES',            tipo: 'seccion',  indent: 0 },
  { nombre: 'CBC NORTE/CENTRO',                   tipo: 'item',     indent: 1 },
  { nombre: 'SNACKS Trux',                        tipo: 'item',     indent: 1 },
  { nombre: 'NESTLE',                             tipo: 'item',     indent: 1 },
  { nombre: 'SNACKS Chimbote',                    tipo: 'item',     indent: 1 },
  { nombre: 'MONDELEZ',                           tipo: 'item',     indent: 1 },
  { nombre: 'BACKUS',                             tipo: 'item',     indent: 1 },
  { nombre: 'Facturas',                           tipo: 'subitem',  indent: 2 },
  { nombre: 'Envases',                            tipo: 'subitem',  indent: 2 },
  { nombre: 'TOTAL',                              tipo: 'total',    indent: 0 },

  // ── DETRACCIONES ───────────────────────────────────────────
  { nombre: 'DETRACCIONES',                       tipo: 'seccion',  indent: 0 },
  { nombre: 'PROVEEDORES VARIOS',                 tipo: 'item',     indent: 1 },
  { nombre: 'TOTAL',                              tipo: 'total',    indent: 0 },

  // ── COMODATO ENVASES EN GARANTÍA ───────────────────────────
  { nombre: 'COMODATO — ENVASES EN GARANTÍA',     tipo: 'seccion',  indent: 0 },
  { nombre: 'CORPORACIÓN SAN FRANCISCO DE BORJA', tipo: 'item',     indent: 1 },
  { nombre: 'REPRESENTACIONES SAN SANTIAGO',      tipo: 'item',     indent: 1 },
  { nombre: 'TOTAL',                              tipo: 'total',    indent: 0 },

  // ── PROVISIONES — GENTE Y GESTIÓN ─────────────────────────
  { nombre: 'PROVISIONES — GENTE Y GESTIÓN',      tipo: 'seccion',  indent: 0 },
  { nombre: 'SALARIOS',                           tipo: 'item',     indent: 1 },
  { nombre: 'MOVILIDADES',                        tipo: 'item',     indent: 1 },
  { nombre: 'PROVISIÓN CTS',                      tipo: 'item',     indent: 1 },
  { nombre: 'PROVISIÓN GRATIFICACIÓN',            tipo: 'item',     indent: 1 },
  { nombre: 'BONO ANUAL',                         tipo: 'item',     indent: 1 },
  { nombre: 'UTILIDADES',                         tipo: 'item',     indent: 1 },

  // ── PRÉSTAMOS / OBLIGACIONES FINANCIERAS ──────────────────
  { nombre: 'PRÉSTAMOS / OBLIGACIONES FINANCIERAS', tipo: 'seccion', indent: 0 },
  { nombre: 'INTERBANK',                          tipo: 'item',     indent: 1 },
  { nombre: 'PICHINCHA',                          tipo: 'item',     indent: 1 },
  { nombre: 'BCP',                                tipo: 'item',     indent: 1 },
  { nombre: 'CONTRATO MUTUO',                     tipo: 'item',     indent: 1 },
  { nombre: 'TOTAL',                              tipo: 'total',    indent: 0 },
];