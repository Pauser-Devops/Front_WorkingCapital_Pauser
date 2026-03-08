import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class IngresosService {
  private readonly API = environment.apiUrl;

  // Caché en memoria por sesión (se limpia al recargar la página)
  private _datosIngresos = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient) {}

  /**
   * Retorna datos de ingresos.
   * Si ya fueron cargados en esta sesión, los sirve sin llamar al servidor.
   * Para forzar recarga: llamar a invalidar() primero.
   */
  getDatosIngresos(): Observable<any> {
    if (this._datosIngresos.value) {
      return of(this._datosIngresos.value);
    }
    return this.http.get(`${this.API}/datos-ingresos`).pipe(
      tap(data => this._datosIngresos.next(data))
    );
  }

  /**
   * Invalida la caché local Y la del servidor.
   * Útil para el botón "Actualizar datos".
   */
  invalidarCache(): Observable<any> {
    this._datosIngresos.next(null);
    return this.http.post(`${this.API}/invalidar-cache`, {});
  }

  /**
   * Solo invalida la caché local (sin tocar el servidor).
   */
  invalidarLocal(): void {
    this._datosIngresos.next(null);
  }

  /**
   * Consulta el estado de la caché del servidor.
   */
  getCacheStatus(): Observable<any> {
    return this.http.get(`${this.API}/cache-status`);
  }
}