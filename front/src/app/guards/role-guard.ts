import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { LocalStorageService } from '../../services/localStorage.service';

export const roleGuard = (roles: string[]): CanActivateFn => {
    return () => {

        const storage = inject(LocalStorageService);
        const router = inject(Router);

        const user = storage.getUserData();

        if (!user || !roles.includes((user as any).rol)) {
            router.navigate(['/']);
            return false;
        }

        return true;
    };
};
