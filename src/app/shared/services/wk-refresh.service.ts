import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WkRefreshService {
  // Emite la fecha_corte que fue guardada
  private _ingresosGuardado = new Subject<string>();
  private _egresosGuardado  = new Subject<string>();

  ingresosGuardado$ = this._ingresosGuardado.asObservable();
  egresosGuardado$  = this._egresosGuardado.asObservable();

  notificarIngresosGuardado(fecha: string) { this._ingresosGuardado.next(fecha); }
  notificarEgresosGuardado(fecha: string)  { this._egresosGuardado.next(fecha); }
}