import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';

const API = environment.apiUrl;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface RegistroComp {
  id_pop:         string;
  fecha_registro: string;
  sucursal:       string;
  entidad:        string;
  monto:          number;
  banco_tabla:    string;
  conciliado:     boolean;
  estado:         'igual' | 'eliminado' | 'nuevo' | 'modificado';
  diferencias?:   string[];
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

  paso: 1 | 2 | 3 = 1;
  archivoNombre = '';
  cargandoArchivo = false;
  errorArchivo    = '';

  registrosExcel: any[] = [];
  registrosBD:    any[] = [];
  cargandoBD      = false;

  resultados: RegistroComp[] = [];
  filtroVista: 'todos' | 'eliminado' | 'nuevo' | 'modificado' | 'igual' = 'todos';

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
    this.reiniciar();
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
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        this.registrosExcel = XLSX.utils.sheet_to_json(worksheet, { range: 3 });
        this.cargandoArchivo = false;
        this.paso = 2;
      } catch (err) {
        this.cargandoArchivo = false;
        this.errorArchivo = 'Error al procesar el Excel. Usa el archivo exportado de la App.';
      }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
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
      const id = String(r['ID POP'] || r['id_pop'] || '').trim();
      if (id && id !== 'undefined') mapExcel.set(id, r);
    }

    const mapBD = new Map<string, any>();
    for (const r of this.registrosBD) {
      const id = String(r.id_pop || '').trim();
      if (id) mapBD.set(id, r);
    }

    const resultado: RegistroComp[] = [];

    for (const [id, excelRow] of mapExcel) {
      const bdRow = mapBD.get(id);
      
      const eMonto    = parseFloat(excelRow['MONTO (S/)'] || excelRow['monto'] || 0);
      const eSucursal = String(excelRow['SUCURSAL'] || excelRow['sucursal'] || '').trim();
      const eEntidad  = String(excelRow['ENTIDAD']  || excelRow['entidad']  || '').trim();
      const eBanco    = String(excelRow['BANCO']    || excelRow['banco_tabla'] || '').trim();
      const eFecha    = excelRow['FECHA REGISTRO'] || excelRow['fecha_voucher'] || '—';

      if (!bdRow) {
        resultado.push({
          id_pop: id,
          fecha_registro: eFecha,
          sucursal: eSucursal,
          entidad: eEntidad,
          monto: eMonto,
          banco_tabla: eBanco,
          conciliado: excelRow['CONCILIADO'] === 'Sí',
          estado: 'eliminado',
        });
      } else {
        const diffs: string[] = [];
        const montoBD = bdRow.monto || 0;

        if (Math.abs(eMonto - montoBD) > 0.01)
          diffs.push(`Monto: ${eMonto} → ${montoBD}`);
        if (eSucursal !== (bdRow.sucursal || '').trim())
          diffs.push(`Sucursal: ${eSucursal} → ${bdRow.sucursal}`);
        if (eEntidad !== (bdRow.entidad || '').trim())
          diffs.push(`Entidad: ${eEntidad} → ${bdRow.entidad}`);
        if (eBanco !== (bdRow.banco_tabla || '').trim())
          diffs.push(`Banco: ${eBanco} → ${bdRow.banco_tabla}`);

        resultado.push({
          id_pop: id,
          fecha_registro: bdRow.fecha_registro ? String(bdRow.fecha_registro).slice(0,10) : eFecha,
          sucursal: bdRow.sucursal || '—',
          entidad: bdRow.entidad || '—',
          monto: montoBD,
          banco_tabla: bdRow.banco_tabla || '—',
          conciliado: bdRow.conciliado,
          estado: diffs.length > 0 ? 'modificado' : 'igual',
          diferencias: diffs,
        });
      }
    }

    for (const [id, bdRow] of mapBD) {
      if (!mapExcel.has(id)) {
        resultado.push({
          id_pop: id,
          fecha_registro: bdRow.fecha_registro ? String(bdRow.fecha_registro).slice(0,10) : '—',
          sucursal: bdRow.sucursal || '—',
          entidad: bdRow.entidad || '—',
          monto: bdRow.monto || 0,
          banco_tabla: bdRow.banco_tabla || '—',
          conciliado: bdRow.conciliado,
          estado: 'nuevo',
        });
      }
    }

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
    this.errorArchivo   = '';
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