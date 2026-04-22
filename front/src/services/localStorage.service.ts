import { Injectable } from '@angular/core';

/**
 * Dual-backend storage service.
 *
 * The "auth" bucket of keys (JWT, user payload) is stored in
 * `sessionStorage` by default — the session is dropped when the browser is
 * closed or the machine restarts. The user can opt into persistent storage
 * via the "Recordarme" checkbox on the login form, in which case we promote
 * the same keys to `localStorage` instead.
 *
 * A tiny `ec_persist` flag in `localStorage` remembers the user's choice
 * across sessions so the login form can pre-check the box.
 *
 * Non-auth keys (themes, preferences) continue to use `localStorage`.
 */

const PERSIST_FLAG_KEY = 'ec_persist';

/** Keys that live in the "auth" bucket (session-by-default). Everything else
 *  goes to localStorage as before. */
const AUTH_KEYS = new Set<string>(['ec_user', 'auth_token', 'refresh_token', 'user_data', 'token_expiry']);

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
    private memoryStorage = new Map<string, string>();
    private storageAvailable: boolean;

    private readonly TOKEN_KEY = 'auth_token';
    private readonly REFRESH_TOKEN_KEY = 'refresh_token';
    private readonly USER_KEY = 'user_data';
    private readonly TOKEN_EXPIRY_KEY = 'token_expiry';

    constructor() {
        this.storageAvailable = this.checkStorageAvailability();
    }

    private checkStorageAvailability(): boolean {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }

    // ── Persistence preference ───────────────────────────────────────────────

    /** Whether auth keys should survive a browser/OS restart. Default: false. */
    isPersistentAuth(): boolean {
        if (!this.storageAvailable) return false;
        return localStorage.getItem(PERSIST_FLAG_KEY) === '1';
    }

    /**
     * Switch the auth bucket between persistent (localStorage) and
     * session-only (sessionStorage). Migrates any already-stored keys to the
     * chosen backend so the current session isn't lost.
     */
    setPersistentAuth(persist: boolean): void {
        const wasPersistent = this.isPersistentAuth();
        if (wasPersistent === persist) return;

        // Migrate existing auth keys across backends
        const from = wasPersistent ? this.readLocal.bind(this) : this.readSession.bind(this);
        const to   = persist ? this.writeLocal.bind(this) : this.writeSession.bind(this);
        const del  = wasPersistent ? this.deleteLocal.bind(this) : this.deleteSession.bind(this);

        AUTH_KEYS.forEach(k => {
            const v = from(k);
            if (v !== null) { to(k, v); del(k); }
        });

        if (this.storageAvailable) {
            if (persist) localStorage.setItem(PERSIST_FLAG_KEY, '1');
            else         localStorage.removeItem(PERSIST_FLAG_KEY);
        }
    }

    /** Internal: resolve which Web Storage object should back a given key. */
    private backendFor(key: string): Storage | null {
        if (!this.storageAvailable) return null;
        if (AUTH_KEYS.has(key)) {
            return this.isPersistentAuth() ? localStorage : sessionStorage;
        }
        return localStorage;
    }

    // ── Raw per-backend helpers ─────────────────────────────────────────────

    private readLocal(k: string): string | null   { try { return localStorage.getItem(k); }   catch { return null; } }
    private readSession(k: string): string | null { try { return sessionStorage.getItem(k); } catch { return null; } }
    private writeLocal(k: string, v: string): void    { try { localStorage.setItem(k, v); }   catch {} }
    private writeSession(k: string, v: string): void  { try { sessionStorage.setItem(k, v); } catch {} }
    private deleteLocal(k: string): void   { try { localStorage.removeItem(k); }   catch {} }
    private deleteSession(k: string): void { try { sessionStorage.removeItem(k); } catch {} }

    // ── Internal storage primitives ─────────────────────────────────────────

    private setStorageItem(key: string, value: string): void {
        const backend = this.backendFor(key);
        if (backend) backend.setItem(key, value);
        else this.memoryStorage.set(key, value);
    }

    private getStorageItem(key: string): string | null {
        const backend = this.backendFor(key);
        if (backend) return backend.getItem(key);
        return this.memoryStorage.get(key) ?? null;
    }

    private removeStorageItem(key: string): void {
        const backend = this.backendFor(key);
        if (backend) backend.removeItem(key);
        else this.memoryStorage.delete(key);
    }

    private clearStorage(): void {
        if (this.storageAvailable) {
            try { sessionStorage.clear(); } catch {}
            try { localStorage.clear(); }   catch {}
        } else {
            this.memoryStorage.clear();
        }
    }

    // ── Token management ────────────────────────────────────────────────────

    setToken(token: string): void { this.setItem(this.TOKEN_KEY, token); }
    getToken(): string | null     { return this.getItem<string>(this.TOKEN_KEY); }
    removeToken(): void           { this.removeItem(this.TOKEN_KEY); }

    // Refresh Token management
    setRefreshToken(refreshToken: string): void { this.setItem(this.REFRESH_TOKEN_KEY, refreshToken); }
    getRefreshToken(): string | null { return this.getItem<string>(this.REFRESH_TOKEN_KEY); }
    removeRefreshToken(): void { this.removeItem(this.REFRESH_TOKEN_KEY); }

    // User data management
    setUserData<T>(userData: T): void { this.setItem(this.USER_KEY, userData); }
    getUserData<T>(): T | null { return this.getItem<T>(this.USER_KEY); }
    removeUserData(): void { this.removeItem(this.USER_KEY); }

    // Token expiry management
    setTokenExpiry(expiryTimestamp: number): void { this.setItem(this.TOKEN_EXPIRY_KEY, expiryTimestamp); }
    getTokenExpiry(): number | null { return this.getItem<number>(this.TOKEN_EXPIRY_KEY); }
    isTokenExpired(): boolean {
        const expiry = this.getTokenExpiry();
        if (!expiry) return true;
        return Date.now() >= expiry;
    }

    // ── Generic methods ─────────────────────────────────────────────────────

    setItem(key: string, value: any): void {
        try {
            const serializedValue = JSON.stringify(value);
            this.setStorageItem(key, serializedValue);
        } catch {}
    }

    getItem<T>(key: string): T | null {
        try {
            const item = this.getStorageItem(key);
            return item ? JSON.parse(item) as T : null;
        } catch {
            return null;
        }
    }

    removeItem(key: string): void {
        try { this.removeStorageItem(key); } catch {}
    }

    clear(): void {
        try { this.clearStorage(); } catch {}
    }

    // Auth session management
    setAuthSession(token: string, userData: any, expiresIn?: number): void {
        this.setToken(token);
        this.setUserData(userData);
        if (expiresIn) {
            const expiryTimestamp = Date.now() + (expiresIn * 1000);
            this.setTokenExpiry(expiryTimestamp);
        }
    }

    clearAuthSession(): void {
        // Wipe the keys in BOTH backends — the user might have toggled the
        // "remember me" flag without logging out first.
        for (const k of AUTH_KEYS) {
            this.deleteLocal(k);
            this.deleteSession(k);
            this.memoryStorage.delete(k);
        }
    }

    isAuthenticated(): boolean {
        return !!this.getToken() && !this.isTokenExpired();
    }

    // ── Utility ─────────────────────────────────────────────────────────────

    hasKey(key: string): boolean {
        const backend = this.backendFor(key);
        if (backend) return backend.getItem(key) !== null;
        return this.memoryStorage.has(key);
    }

    getKeys(): string[] {
        if (this.storageAvailable) {
            return [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
        }
        return Array.from(this.memoryStorage.keys());
    }

    get size(): number {
        if (this.storageAvailable) return localStorage.length + sessionStorage.length;
        return this.memoryStorage.size;
    }
}
