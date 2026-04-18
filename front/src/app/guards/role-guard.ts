import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

export const roleGuard = (): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) { router.navigate(['/login']); return false; }
    if (auth.hasPermission('canAccessAdmin')) return true;

    router.navigate(['/']);
    return false;
  };
};
