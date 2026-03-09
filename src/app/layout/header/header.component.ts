import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  @Input() vistaNombre = '';
  @Input() datosApi: any = null;
  @Output() exportar = new EventEmitter<void>();


  @Input() tituloModulo: string = 'Working Capital';
}