import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
    return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {

        const authService = inject(AuthService);
        const router = inject(Router);

        // Verificar si está autenticado
        if (!authService.isAuthenticated()) {
            router.navigate(['/login'], {
                queryParams: { returnUrl: state.url }
            });
            return false;
        }

        // Obtener el rol del usuario
        const userRole = authService.getRole();

        // Verificar si el rol está en los permitidos
        if (userRole && allowedRoles.includes(userRole)) {
            return true;
        }

        // Si no tiene el rol, refrescar desde el backend por si cambió
        return authService.refreshUserRole().pipe(
            map(user => {
                if (user && allowedRoles.includes(user.rol)) {
                    return true;
                }

                // Redirigir según el rol que tiene
                if (user) {
                    redirectBasedOnRole(user.rol, router);
                } else {
                    router.navigate(['/']);
                }

                return false;
            }),
            catchError(() => {
                router.navigate(['/']);
                return of(false);
            })
        );
    };
};

// Función auxiliar para redirigir según el rol
function redirectBasedOnRole(role: string, router: Router) {
    switch (role) {
        case 'admin':
            router.navigate(['/admin/dashboard']);
            break;
        case 'moderator':
            router.navigate(['/moderator/panel']);
            break;
        default:
            router.navigate(['/']);
    }
}