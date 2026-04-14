import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LocalStorageService } from './localStorage.service';
import { Observable, map, catchError, of, tap } from 'rxjs';
import { environment } from '../environments/environment';

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
    private API = (environment as any).API_URL;

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

    register(username: string, password: string) {
        return this.http.post<any>(`${this.API}/register`, { username, password })
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

    // Funcion para obtener todos los usuarios y sus roles de la base de datos (para el dashboard de admin, permisos canManageUsers necesarios)
    getAllUsers(): Observable<{ id: number; name: string; rol: string; }[]> {
        return this.http.get<any>(`${this.API}/users`, {
            headers: {
                'Authorization': `Bearer ${this.storage.getToken()}`
            }
        }).pipe(
            map(response => {
                if (response.success) {
                    return response.data.map((user: any) => ({
                        id: user.id_user,
                        name: user.nombre,
                        rol: user.rol,
                        password: user.password
                    }));
                }
                return [];
            }),
            catchError(() => of([]))
        );
    }

    // Funcion para eliminar un usuario por su ID (solo si no es admin, permisos canManageUsers necesarios)

    deleteUser(userId: number): Observable<any> {
        // Validación local para admin (id 1)
        if (userId === 1) {
            return of({
                success: false,
                error: "No puedes eliminar al administrador principal del sistema."
            });
        }

        return this.http.delete<any>(`${this.API}/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${this.storage.getToken()}`
            }
        }).pipe(
            map(response => {
                // Si la respuesta es exitosa, la devolvemos
                return response;
            }),
            catchError(error => {
                // console.error('Error en deleteUser:', error);

                // Extraer mensaje de error de la respuesta
                let errorMessage = 'Error al eliminar el usuario';

                if (error.error && error.error.error) {
                    errorMessage = error.error.error;
                } else if (error.error && error.error.message) {
                    errorMessage = error.error.message;
                } else if (error.message) {
                    errorMessage = error.message;
                }

                // Devolver un objeto con el error
                return of({
                    success: false,
                    error: errorMessage,
                    status: error.status
                });
            })
        );
    }

    // Funcion para crear un nuevo usuario (permisos canManageUsers necesarios)
    createUser(userData: { username: string; password: string; role: string }): Observable<any> {
        return this.http.post<any>(`${this.API}/users`, userData, {
            headers: {
                'Authorization': `Bearer ${this.storage.getToken()}`
            }
        }).pipe(
            map(response => response),
            catchError(error => of({ success: false, error }))
        );
    }

    // Funcion para actualizar un usuario existente (permisos canManageUsers necesarios)
    updateUser(userId: number, userData: { username?: string; password?: string; role?: string }): Observable<any> {
        return this.http.put<any>(`${this.API}/users/${userId}`, userData, {
            headers: {
                'Authorization': `Bearer ${this.storage.getToken()}`
            }
        }).pipe(
            map(response => response),
            catchError(error => of({ success: false, error }))
        );
    }
}