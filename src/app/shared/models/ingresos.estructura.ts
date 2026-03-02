export type TipoFilaIngresos = 'seccion' | 'subheader' | 'item' | 'total';

export interface FilaIngresos {
  nombre: string;
  tipo: TipoFilaIngresos;
  indent: number;
}

export interface FilaDatoIngresos extends FilaIngresos {
  montos: (number | null)[];
  variacion: number | null;
}

// Fechas por defecto (semanal igual que WK Semanal)
export const FECHAS_DEFAULT_INGRESOS: string[] = [
  '31/12/25', '08/01/26', '15/01/26', '22/01/26', '29/01/26', '05/02/26', '12/02/26'
];

export const ESTRUCTURA_INGRESOS: FilaIngresos[] = [

  // ── SALDOS BANCOS ──────────────────────────────────────────
  { nombre: 'SALDOS BANCOS',          tipo: 'seccion',   indent: 0 },
  { nombre: 'Bcp Ln',                  tipo: 'item',      indent: 1 },
  { nombre: 'Bcp Trux',                tipo: 'item',      indent: 1 },
  { nombre: 'Bcp Sedes',               tipo: 'item',      indent: 1 },
  { nombre: 'BCP',                     tipo: 'item',      indent: 1 },
  { nombre: 'INTERBANK',               tipo: 'item',      indent: 1 },
  { nombre: 'BBVA',                    tipo: 'item',      indent: 1 },
  { nombre: 'CAJA AREQUIPA',           tipo: 'item',      indent: 1 },
  { nombre: 'PICHINCHA',               tipo: 'item',      indent: 1 },
  { nombre: 'BNACION',                 tipo: 'item',      indent: 1 },
  { nombre: 'TOTAL',                   tipo: 'total',     indent: 0 },

  // ── PROSEGUR ───────────────────────────────────────────────
  { nombre: 'PROSEGUR',                tipo: 'seccion',   indent: 0 },
  { nombre: 'PUNO',                    tipo: 'item',      indent: 1 },
  { nombre: 'HUARAZ',                  tipo: 'item',      indent: 1 },
  { nombre: 'TRUJILLO',                tipo: 'item',      indent: 1 },
  { nombre: 'INGRESOS EN EL DÍA',      tipo: 'item',      indent: 1 },
  { nombre: 'TOTAL',                   tipo: 'total',     indent: 0 },

  // ── INVENTARIOS ────────────────────────────────────────────
  { nombre: 'INVENTARIOS',             tipo: 'seccion',   indent: 0 },
  { nombre: 'CHIMBOTE BEBIDAS',        tipo: 'item',      indent: 1 },
  { nombre: 'CHIMBOTE SNACKS',         tipo: 'item',      indent: 1 },
  { nombre: 'HUARAZ',                  tipo: 'item',      indent: 1 },
  { nombre: 'HUARAZ PURINA',           tipo: 'item',      indent: 1 },
  { nombre: 'PUNO',                    tipo: 'item',      indent: 1 },
  { nombre: 'TRUJILLO',                tipo: 'item',      indent: 1 },
  { nombre: 'LIMA MONDELEZ',           tipo: 'item',      indent: 1 },
  { nombre: 'TOTAL',                   tipo: 'total',     indent: 0 },

  // ── VENTAS AL CONTADO DEL DÍA (REPARTO) ───────────────────
  { nombre: 'VENTAS AL CONTADO DEL DÍA (REPARTO)', tipo: 'seccion', indent: 0 },
  { nombre: 'CHIMBOTE BEBIDAS',        tipo: 'item',      indent: 1 },
  { nombre: 'CHIMBOTE SNACKS',         tipo: 'item',      indent: 1 },
  { nombre: 'HUARAZ',                  tipo: 'item',      indent: 1 },
  { nombre: 'HUARAZ PURINA',           tipo: 'item',      indent: 1 },
  { nombre: 'PUNO',                    tipo: 'item',      indent: 1 },
  { nombre: 'TRUJILLO',                tipo: 'item',      indent: 1 },
  { nombre: 'LIMA MONDELEZ',           tipo: 'item',      indent: 1 },
  { nombre: 'TOTAL',                   tipo: 'total',     indent: 0 },

  // ── VENTAS AL CRÉDITO (3 A 10 DÍAS) ───────────────────────
  { nombre: 'VENTAS AL CRÉDITO (3 A 10 DÍAS)', tipo: 'seccion', indent: 0 },
  { nombre: 'CHIMBOTE',                tipo: 'item',      indent: 1 },
  { nombre: 'HUARAZ',                  tipo: 'item',      indent: 1 },
  { nombre: 'TRUJILLO',                tipo: 'item',      indent: 1 },
  { nombre: 'CHIMBOTE SNACKS',         tipo: 'item',      indent: 1 },
  { nombre: 'HUARAZ PURINA',           tipo: 'item',      indent: 1 },
  { nombre: 'TOTAL',                   tipo: 'total',     indent: 0 },

  // ── FACTURACIÓN AL CRÉDITO (90 DÍAS) ──────────────────────
  { nombre: 'FACTURACIÓN AL CRÉDITO (90 DÍAS)', tipo: 'seccion', indent: 0 },
  { nombre: 'CBC MARKET',              tipo: 'item',      indent: 1 },
  { nombre: 'TS LOGISTIC',             tipo: 'item',      indent: 1 },
  { nombre: 'POR FACTURAR',            tipo: 'item',      indent: 1 },
  { nombre: 'TOTAL',                   tipo: 'total',     indent: 0 },

  // ── DVM ────────────────────────────────────────────────────
  { nombre: 'DVM',                     tipo: 'seccion',   indent: 0 },
  { nombre: 'TOTAL',                   tipo: 'total',     indent: 0 },

  // ── BACKUS (CxC) ───────────────────────────────────────────
  { nombre: 'CUENTAS POR COBRAR BACKUS', tipo: 'seccion', indent: 0 },
  { nombre: 'BACKUS',                  tipo: 'item',      indent: 1 },
];