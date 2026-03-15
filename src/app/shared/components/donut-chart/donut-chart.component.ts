import {
  Component, Input, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

export interface DonutSlice {
  name:  string;
  value: number;
  color: string;
}

interface ArcData {
  slice:      DonutSlice;
  path:       string;
  cx:         number;
  cy:         number;
  pct:        number;
  startAngle: number;
  endAngle:   number;
}

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './donut-chart.component.html',
  styleUrls: ['./donut-chart.component.css'],
})
export class DonutChartComponent implements OnChanges {
  @Input() slices:     DonutSlice[] = [];
  @Input() total:      number  = 0;
  @Input() label:      string  = '';
  @Input() showLegend: boolean = true;   // false → sin leyenda interna

  arcs:         ArcData[]  = [];
  hoveredIndex: number | null = null;
  hiddenSlices: Set<string>   = new Set();

  tooltip = {
    visible: false, x: 0, y: 0,
    slice: null as DonutSlice | null, pct: 0
  };

  ngOnChanges(changes: SimpleChanges) {
    if (changes['slices'] || changes['total']) {
      this.buildArcs();
    }
  }

  buildArcs() {
    const R = 90, r = 58, cx = 100, cy = 100;
    const visibles  = this.slices.filter(s => !this.hiddenSlices.has(s.name));
    const totalVis  = visibles.reduce((a, b) => a + b.value, 0) || 1;
    let angle = -Math.PI / 2;

    this.arcs = visibles.map(slice => {
      const pct   = slice.value / totalVis;
      const span  = pct * 2 * Math.PI;
      const start = angle;
      const end   = angle + span;
      angle       = end;
      const midA  = (start + end) / 2;
      return {
        slice, pct,
        path: this.arcPath(cx, cy, R, r, start, end),
        cx: cx + (R * 0.65) * Math.cos(midA),
        cy: cy + (R * 0.65) * Math.sin(midA),
        startAngle: start, endAngle: end,
      };
    });
  }

  arcPath(cx: number, cy: number, R: number, r: number, a1: number, a2: number): string {
    const gap   = 0.018;
    const s1    = a1 + gap, s2 = a2 - gap;
    const large = (s2 - s1) > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
    const [ox1, oy1] = p(s1, R); const [ox2, oy2] = p(s2, R);
    const [ix1, iy1] = p(s2, r); const [ix2, iy2] = p(s1, r);
    return [
      `M ${ox1} ${oy1}`,
      `A ${R} ${R} 0 ${large} 1 ${ox2} ${oy2}`,
      `L ${ix1} ${iy1}`,
      `A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2}`,
      'Z'
    ].join(' ');
  }

  onArcHover(arc: ArcData, i: number, event: MouseEvent) {
    this.hoveredIndex = i;
    const rect = (event.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 10,
      slice: arc.slice,
      pct: Math.round(arc.pct * 100),
    };
  }

  onArcLeave() {
    this.hoveredIndex = null;
    this.tooltip = { ...this.tooltip, visible: false };
  }

  toggleSlice(name: string) {
    if (this.hiddenSlices.has(name)) {
      this.hiddenSlices.delete(name);
    } else if (this.hiddenSlices.size < this.slices.length - 1) {
      this.hiddenSlices.add(name);
    }
    this.buildArcs();
  }

  fmt(n: number): string {
    if (n >= 1_000_000) return 'S/ ' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return 'S/ ' + (n / 1_000).toFixed(0) + 'K';
    return 'S/ ' + n.toFixed(0);
  }

  fmtFull(n: number): string {
    return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get totalVisible(): number {
    return this.slices
      .filter(s => !this.hiddenSlices.has(s.name))
      .reduce((a, b) => a + b.value, 0);
  }
}