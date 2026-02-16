import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
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
        } catch (e) {
            return false;
        }
    }

    private getStorage(): Storage | Map<string, string> {
        return this.storageAvailable ? localStorage : this.memoryStorage;
    }

    private setStorageItem(key: string, value: string): void {
        if (this.storageAvailable) {
            localStorage.setItem(key, value);
        } else {
            this.memoryStorage.set(key, value);
        }
    }

    private getStorageItem(key: string): string | null {
        if (this.storageAvailable) {
            return localStorage.getItem(key);
        } else {
            return this.memoryStorage.get(key) || null;
        }
    }

    private removeStorageItem(key: string): void {
        if (this.storageAvailable) {
            localStorage.removeItem(key);
        } else {
            this.memoryStorage.delete(key);
        }
    }

    private clearStorage(): void {
        if (this.storageAvailable) {
            localStorage.clear();
        } else {
            this.memoryStorage.clear();
        }
    }

    // Token management
    setToken(token: string): void {
        this.setItem(this.TOKEN_KEY, token);
    }

    getToken(): string | null {
        return this.getItem<string>(this.TOKEN_KEY);
    }

    removeToken(): void {
        this.removeItem(this.TOKEN_KEY);
    }

    // Refresh Token management
    setRefreshToken(refreshToken: string): void {
        this.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }

    getRefreshToken(): string | null {
        return this.getItem<string>(this.REFRESH_TOKEN_KEY);
    }

    removeRefreshToken(): void {
        this.removeItem(this.REFRESH_TOKEN_KEY);
    }

    // User data management
    setUserData<T>(userData: T): void {
        this.setItem(this.USER_KEY, userData);
    }

    getUserData<T>(): T | null {
        return this.getItem<T>(this.USER_KEY);
    }

    removeUserData(): void {
        this.removeItem(this.USER_KEY);
    }

    // Token expiry management
    setTokenExpiry(expiryTimestamp: number): void {
        this.setItem(this.TOKEN_EXPIRY_KEY, expiryTimestamp);
    }

    getTokenExpiry(): number | null {
        return this.getItem<number>(this.TOKEN_EXPIRY_KEY);
    }

    isTokenExpired(): boolean {
        const expiry = this.getTokenExpiry();
        if (!expiry) return true;
        return Date.now() >= expiry;
    }

    // Generic methods
    setItem(key: string, value: any): void {
        try {
            const serializedValue = JSON.stringify(value);
            this.setStorageItem(key, serializedValue);
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    getItem<T>(key: string): T | null {
        try {
            const item = this.getStorageItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('Error reading data:', error);
            return null;
        }
    }

    removeItem(key: string): void {
        try {
            this.removeStorageItem(key);
        } catch (error) {
            console.error('Error removing data:', error);
        }
    }

    clear(): void {
        try {
            this.clearStorage();
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    }

    // Auth session management
    setAuthSession(token: string, userData: any, expiresIn?: number): void {
        this.setToken(token);
        // this.setRefreshToken(refreshToken);
        this.setUserData(userData);

        if (expiresIn) {
            const expiryTimestamp = Date.now() + (expiresIn * 1000);
            this.setTokenExpiry(expiryTimestamp);
        }
    }

    clearAuthSession(): void {
        this.removeToken();
        this.removeRefreshToken();
        this.removeUserData();
        this.removeItem(this.TOKEN_EXPIRY_KEY);
    }

    isAuthenticated(): boolean {
        return !!this.getToken() && !this.isTokenExpired();
    }

    // Utility methods
    hasKey(key: string): boolean {
        if (this.storageAvailable) {
            return localStorage.getItem(key) !== null;
        } else {
            return this.memoryStorage.has(key);
        }
    }

    getKeys(): string[] {
        if (this.storageAvailable) {
            return Object.keys(localStorage);
        } else {
            return Array.from(this.memoryStorage.keys());
        }
    }

    get size(): number {
        if (this.storageAvailable) {
            return localStorage.length;
        } else {
            return this.memoryStorage.size;
        }
    }
}