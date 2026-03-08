import { inject } from '@angular/core';
import { CanActivateFn} from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  
  if (!auth.isLoggedIn) {
  
    return false;
  }
  return true;
};

export const cambiarPasswordGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  
  if (!auth.isLoggedIn) {
   
    return false;
  }
  if (auth.usuarioActual?.debe_cambiar_password) {
   
    return false;
  }
  return true;
};