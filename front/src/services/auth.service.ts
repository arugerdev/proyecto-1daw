import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LocalStorageService } from './localStorage.service';
import { Observable, map, catchError, of, tap } from 'rxjs';

export interface UserPermissions {
    canUpload: boolean;
    canDelete: boolean;
    canEdit: boolean;
    canDownload: boolean;
    canManageUsers: boolean;
    canViewAllContent: boolean;
    role: string;
    level: number;
}

export interface UserData {
    id_user: number;
    nombre: string;
    rol: string;
    token?: string;
    permissions?: UserPermissions;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

    private API = "http://localhost:3000/api";
    private currentUser: UserData | null = null;

    constructor(
        private http: HttpClient,
        private storage: LocalStorageService,
        private router: Router
    ) {
        this.loadUserFromStorage();
    }

    private loadUserFromStorage() {
        const userData = this.storage.getUserData();
        if (userData) {
            (this.currentUser as any) = userData;
        }
    }

    login(username: string, password: string) {
        return this.http.post<any>(`${this.API}/login`, { username, password })
            .pipe(
                tap(response => {
                    if (response.success) {
                        this.storage.setUserData(response)
                        this.currentUser = response;
                    }
                })
            );
    }

    refreshUserRole(): Observable<UserData | null> {
        return this.http.get<any>(`${this.API}/user/role`, {
            headers: {
                'Authorization': `Bearer ${this.storage.getToken()}`
            }
        }).pipe(
            map(response => {
                if (response.success) {
                    const userData = {
                        ...response.user,
                        permissions: response.permissions,
                        token: this.storage.getToken()
                    };
                    this.storage.setUserData(userData);
                    this.currentUser = userData;
                    return userData;
                }
                return null;
            }),
            catchError(() => {
                return of(null);
            })
        );
    }

    checkSession(): Observable<boolean> {
        return this.http.get<any>(`${this.API}/user/session`, {
            headers: {
                'Authorization': `Bearer ${this.storage.getToken()}`
            }
        }).pipe(
            map(response => response.success),
            catchError(() => of(false))
        );
    }

    logout() {
        this.currentUser = null;
        this.storage.clearAuthSession();
        this.router.navigate(['/login']);
    }

    isAuthenticated(): boolean {
        return this.storage.isAuthenticated();
    }

    getRole(): string | null {
        const user = this.getCurrentUser();
        return user?.rol || null;
    }

    getCurrentUser(): UserData | null {
        if (this.currentUser) {
            return this.currentUser;
        }

        const userData = this.storage.getUserData();
        if (userData) {
            (this.currentUser as any) = userData;
            return userData as UserData;
        }

        return null;
    }

    hasRole(role: string | string[]): boolean {
        const userRole = this.getRole();

        if (!userRole) return false;

        if (Array.isArray(role)) {
            return role.includes(userRole);
        }

        return userRole === role;
    }

    hasPermission(permission: keyof UserPermissions): boolean {
        const user = this.getCurrentUser();

        if (!user || !user.permissions) {
            this.refreshUserRole().subscribe();
            return false;
        }

        return user.permissions[permission] === true;
    }

    hasAccessLevel(requiredLevel: number): boolean {
        const user = this.getCurrentUser();

        if (!user || !user.permissions) return false;

        return user.permissions.level >= requiredLevel;
    }

    isAdmin(): boolean {
        return this.hasRole('admin');
    }

    isModerator(): boolean {
        return this.hasRole('moderator');
    }

    isViewer(): boolean {
        return this.hasRole('viewer');
    }

    getPermissions(): UserPermissions | null {
        const user = this.getCurrentUser();
        return user?.permissions || null;
    }
}