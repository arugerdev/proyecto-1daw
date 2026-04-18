import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthUser, UserPermissions, UserRole } from '../app/models/file.model';
import { LocalStorageService } from './localStorage.service';

const API = (environment as any).API_URL;
const USER_KEY = 'ec_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user: AuthUser | null = null;

  constructor(
    private http: HttpClient,
    private storage: LocalStorageService,
    private router: Router
  ) {
    this._user = this.storage.getItem<AuthUser>(USER_KEY);
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${API}/auth/login`, { username, password }).pipe(
      tap(res => { if (res.success) this._persist(res); })
    );
  }

  register(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${API}/auth/register`, { username, password }).pipe(
      tap(res => { if (res.success) this._persist(res); })
    );
  }

  logout() {
    this.http.post(`${API}/auth/logout`, {}).pipe(catchError(() => of(null))).subscribe();
    this._user = null;
    this.storage.removeItem(USER_KEY);
    this.router.navigate(['/login']);
  }

  refreshRole(): Observable<AuthUser | null> {
    return this.http.get<any>(`${API}/auth/me`).pipe(
      map(res => {
        if (res.success) {
          const updated: AuthUser = { ...this._user!, ...res.user, permissions: res.permissions };
          this._user = updated;
          this.storage.setItem(USER_KEY, updated);
          return updated;
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  // ── State ───────────────────────────────────────────────────────────────────

  get user(): AuthUser | null { return this._user; }

  isAuthenticated(): boolean {
    return !!this._user?.token;
  }

  getToken(): string | null {
    return this._user?.token ?? null;
  }

  getRole(): UserRole | null {
    return this._user?.role ?? null;
  }

  hasPermission(p: keyof UserPermissions): boolean {
    return this._user?.permissions?.[p] === true;
  }

  hasRole(...roles: UserRole[]): boolean {
    return roles.includes(this._user?.role ?? 'viewer');
  }

  getPermissions(): UserPermissions | null {
    return this._user?.permissions ?? null;
  }

  // ── Users API ───────────────────────────────────────────────────────────────

  getUsers(): Observable<any> {
    return this.http.get<any>(`${API}/users`);
  }

  createUser(data: { username: string; password: string; role: UserRole }): Observable<any> {
    return this.http.post<any>(`${API}/users`, data);
  }

  updateUser(id: number, data: Partial<{ username: string; password: string; role: UserRole; is_active: boolean }>): Observable<any> {
    return this.http.put<any>(`${API}/users/${id}`, data);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete<any>(`${API}/users/${id}`);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _persist(res: any) {
    const user: AuthUser = {
      id: res.user.id,
      username: res.user.username,
      role: res.user.role,
      token: res.token,
      permissions: res.permissions
    };
    this._user = user;
    this.storage.setItem(USER_KEY, user);
  }
}
