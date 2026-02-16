import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LocalStorageService } from '../../services/localStorage.service';

export const authGuard: CanActivateFn = (route, state) => {

  const storage = inject(LocalStorageService);
  const router = inject(Router);

  if (storage.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
