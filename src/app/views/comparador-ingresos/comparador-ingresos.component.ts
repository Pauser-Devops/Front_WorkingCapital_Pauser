import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface RegistroComp {
  id_pop:        string;
  fecha_registro: string;
  sucursal:      string;
  entidad:       string;
  monto:         number;
  banco_tabla:   string;
  conciliado:    boolean;
  estado:        'igual' | 'eliminado' | 'nuevo' | 'modificado';
  diferencias?:  string[];
}

@Component({
  selector: 'app-comparador-ingresos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comparador-ingresos.component.html',
  styleUrls: ['./comparador-ingresos.component.css'],
})
export class ComparadorIngresosComponent {
  meses = MESES;
  mesSeleccionado: string | null = null;
  mesesConData: string[] = [];

  // Estado del flujo
  paso: 1 | 2 | 3 = 1;

  // Archivo subido
  archivoNombre = '';
  cargandoArchivo = false;
  errorArchivo    = '';

  // Datos
  registrosExcel: any[] = [];   // del CSV subido (snapshot anterior)
  registrosBD:    any[] = [];   // de la BD actual
  cargandoBD      = false;

  // Resultado comparación
  resultados: RegistroComp[] = [];
  filtroVista: 'todos' | 'eliminado' | 'nuevo' | 'modificado' | 'igual' = 'todos';

  // Resumen
  totalElim = 0;
  totalNuev = 0;
  totalMod  = 0;
  totalIgual = 0;

  constructor(private http: HttpClient) { this.cargarMeses(); }

  cargarMeses() {
    this.http.get<any>(`${API}/ingresos/bancarios/meses`).subscribe({
      next: r => { if (r.estado === 'OK') this.mesesConData = r.meses; }
    });
  }

  tieneDatos(mes: string) {
    return this.mesesConData.some(m => m.toLowerCase() === mes.toLowerCase());
  }

  seleccionarMes(mes: string) {
    this.mesSeleccionado = mes;
    this.paso = 1;
    this.archivoNombre   = '';
    this.registrosExcel  = [];
    this.registrosBD     = [];
    this.resultados      = [];
    this.errorArchivo    = '';
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    this.archivoNombre   = file.name;
    this.cargandoArchivo = true;
    this.errorArchivo    = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        this.registrosExcel = this.parsearCSV(text);
        this.cargandoArchivo = false;
        this.paso = 2;
      } catch (err) {
        this.cargandoArchivo = false;
        this.errorArchivo = 'No se pudo leer el archivo. Asegúrate de subir el CSV exportado desde esta app.';
      }
    };
    reader.readAsText(file, 'utf-8');
    input.value = '';
  }

  parsearCSV(text: string): any[] {
    // Remover BOM si existe
    const clean = text.startsWith('\ufeff') ? text.slice(1) : text;
    const lines  = clean.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV vacío');

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = this.splitCSVLine(lines[i]);
      const obj: any = {};
      headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
      rows.push(obj);
    }
    return rows;
  }

  splitCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  }

  cargarBDYComparar() {
    if (!this.mesSeleccionado) return;
    this.cargandoBD = true;
    this.http.get<any>(`${API}/ingresos/bancarios?mes=${this.mesSeleccionado}`).subscribe({
      next: r => {
        this.cargandoBD = false;
        if (r.estado === 'OK') {
          this.registrosBD = r.registros;
          this.comparar();
          this.paso = 3;
        }
      },
      error: () => { this.cargandoBD = false; }
    });
  }

  comparar() {
    const mapExcel = new Map<string, any>();
    for (const r of this.registrosExcel) {
      const id = String(r['ID POP'] || '').trim();
      if (id) mapExcel.set(id, r);
    }

    const mapBD = new Map<string, any>();
    for (const r of this.registrosBD) {
      const id = String(r.id_pop || '').trim();
      if (id) mapBD.set(id, r);
    }

    const resultado: RegistroComp[] = [];

    // Registros del Excel — comparar con BD
    for (const [id, excelRow] of mapExcel) {
      const bdRow = mapBD.get(id);
      if (!bdRow) {
        // Está en Excel pero NO en BD → fue eliminado
        resultado.push({
          id_pop:         id,
          fecha_registro: excelRow['Fecha Registro'] || '—',
          sucursal:       excelRow['Sucursal']        || '—',
          entidad:        excelRow['Entidad']         || '—',
          monto:          parseFloat(excelRow['Monto']) || 0,
          banco_tabla:    excelRow['Banco']           || '—',
          conciliado:     excelRow['Estado Conciliación'] === 'Conciliado',
          estado: 'eliminado',
        });
      } else {
        // Está en ambos — revisar diferencias clave
        const diffs: string[] = [];
        const montoExcel = parseFloat(excelRow['Monto']) || 0;
        const montoBD    = bdRow.monto || 0;
        if (Math.abs(montoExcel - montoBD) > 0.01)
          diffs.push(`Monto: ${montoExcel} → ${montoBD}`);
        if ((excelRow['Sucursal'] || '') !== (bdRow.sucursal || ''))
          diffs.push(`Sucursal: ${excelRow['Sucursal']} → ${bdRow.sucursal}`);
        if ((excelRow['Entidad'] || '') !== (bdRow.entidad || ''))
          diffs.push(`Entidad: ${excelRow['Entidad']} → ${bdRow.entidad}`);
        if ((excelRow['Banco'] || '') !== (bdRow.banco_tabla || ''))
          diffs.push(`Banco: ${excelRow['Banco']} → ${bdRow.banco_tabla}`);

        resultado.push({
          id_pop:         id,
          fecha_registro: bdRow.fecha_registro ? String(bdRow.fecha_registro).slice(0,10) : excelRow['Fecha Registro'] || '—',
          sucursal:       bdRow.sucursal    || '—',
          entidad:        bdRow.entidad     || '—',
          monto:          montoBD,
          banco_tabla:    bdRow.banco_tabla || '—',
          conciliado:     bdRow.conciliado,
          estado: diffs.length > 0 ? 'modificado' : 'igual',
          diferencias: diffs,
        });
      }
    }

    // Registros en BD que NO estaban en Excel → nuevos
    for (const [id, bdRow] of mapBD) {
      if (!mapExcel.has(id)) {
        resultado.push({
          id_pop:         id,
          fecha_registro: bdRow.fecha_registro ? String(bdRow.fecha_registro).slice(0,10) : '—',
          sucursal:       bdRow.sucursal    || '—',
          entidad:        bdRow.entidad     || '—',
          monto:          bdRow.monto       || 0,
          banco_tabla:    bdRow.banco_tabla || '—',
          conciliado:     bdRow.conciliado,
          estado: 'nuevo',
        });
      }
    }

    // Ordenar: eliminados primero, luego modificados, nuevos, igual
    const orden: Record<string,number> = { eliminado:0, modificado:1, nuevo:2, igual:3 };
    resultado.sort((a,b) => (orden[a.estado]||99) - (orden[b.estado]||99) || Number(a.id_pop) - Number(b.id_pop));

    this.resultados  = resultado;
    this.totalElim   = resultado.filter(r => r.estado === 'eliminado').length;
    this.totalNuev   = resultado.filter(r => r.estado === 'nuevo').length;
    this.totalMod    = resultado.filter(r => r.estado === 'modificado').length;
    this.totalIgual  = resultado.filter(r => r.estado === 'igual').length;
  }

  get resultadosFiltrados(): RegistroComp[] {
    if (this.filtroVista === 'todos') return this.resultados;
    return this.resultados.filter(r => r.estado === this.filtroVista);
  }

  setFiltro(f: any) { this.filtroVista = f; }

  reiniciar() {
    this.paso = 1;
    this.archivoNombre  = '';
    this.registrosExcel = [];
    this.registrosBD    = [];
    this.resultados     = [];
  }

  exportarEliminados() {
    const elim = this.resultados.filter(r => r.estado === 'eliminado');
    if (!elim.length) return;
    const headers = ['ID POP','Fecha Registro','Sucursal','Entidad','Monto','Banco','Conciliado'];
    let csv = headers.join(',') + '\n';
    for (const r of elim) {
      csv += [r.id_pop, r.fecha_registro, r.sucursal, r.entidad, r.monto, r.banco_tabla, r.conciliado ? 'Sí':'No']
        .map(v => `"${String(v).replace(/"/g,'""')}"`).join(',') + '\n';
    }
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `eliminados_${this.mesSeleccionado}.csv`; a.click();
  }

  formatNum(v: number) {
    return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}