import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
    Observable,
    interval,
    timer,
    BehaviorSubject,
    filter,
    map,
    distinctUntilChanged,
    switchMap,
    tap,
    take,
    catchError,
    EMPTY,
    of
} from 'rxjs';
import { environment } from '../environments/environment';

export interface UpdateInfo {
    hasUpdates: boolean;
    currentCommit: string;
    remoteCommit: string;
    changes: string[];
    currentStatus: {
        status: 'idle' | 'updating' | 'success' | 'error';
        step: string;
        message: string;
        error: string | null;
        timestamp: string;
        lastUpdate: string | null;
    };
    remoteVersion: string;
    version: string;
}

@Injectable({
    providedIn: 'root'
})
export class UpdateService {

    private API = (environment as any).API_URL;
    private updateStatusSubject = new BehaviorSubject<UpdateInfo | null>(null);

    constructor(private http: HttpClient) {
        this.startStatusPolling();
    }

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    }

    /**
     * Comprueba actualizaciones y devuelve UpdateInfo completo (hasUpdates, commits, changes, status).
     * Es el único método que rellena el objeto entero — usar en checkForUpdates() y en el re-poll post-success.
     */
    checkForUpdates(): Observable<UpdateInfo> {
        return this.http.get<{ success: boolean; data: UpdateInfo }>(
            `${this.API}/update/check`,
            { headers: this.getHeaders() }
        ).pipe(
            map(response => {
                if (response.success && response.data) {
                    this.updateStatusSubject.next(response.data);
                    return response.data;
                }
                return null as any;
            })
        );
    }

    getUpdateStatus(): Observable<UpdateInfo> {
        return this.http.get<{ success: boolean; data: any }>(
            `${this.API}/update/status`,
            { headers: this.getHeaders() }
        ).pipe(
            map(response => {
                if (response.success && response.data) {
                    const current = this.updateStatusSubject.getValue();

                    // Merge: conserva hasUpdates/commits/changes del estado anterior
                    const merged: UpdateInfo = current
                        ? { ...current, currentStatus: response.data }
                        : {
                            hasUpdates: false,
                            currentCommit: '',
                            remoteCommit: '',
                            changes: [],
                            currentStatus: response.data,
                            version: '',
                            remoteVersion: ''
                        };

                    this.updateStatusSubject.next(merged);
                    return merged;
                }
                return null as any;
            })
        );
    }

    executeUpdate(): Observable<{ success: boolean; message: string }> {
        return this.http.post<{ success: boolean; message: string }>(
            `${this.API}/update/execute`,
            {},
            { headers: this.getHeaders() }
        ).pipe(
            tap(() => {
                const current = this.updateStatusSubject.getValue();
                if (current) {
                    this.updateStatusSubject.next({
                        ...current,
                        currentStatus: {
                            ...current.currentStatus,
                            status: 'updating',
                            message: 'Iniciando actualización...'
                        }
                    });
                }
            })
        );
    }

    private startStatusPolling() {
        this.updateStatusSubject.pipe(
            map(info => info?.currentStatus?.status ?? null),
            distinctUntilChanged(),

            switchMap(status => {
                if (status === 'updating') {
                    return interval(200).pipe(
                        switchMap(() =>
                            this.getUpdateStatus().pipe(
                                catchError(() => of(null))
                            )
                        )
                    );
                }

                if (status === 'success') {
                    return timer(4000, 2000).pipe(
                        switchMap(() =>
                            this.checkForUpdates().pipe(
                                catchError(() => of(null))
                            )
                        ),
                        filter(v => v !== null),
                        take(1)
                    );
                }

                return EMPTY;
            })
        ).subscribe({
            error: err => {/*console.error('[UpdateService] Polling error:', err)*/ }
        });
    }

    getVersion(): Observable<{ success: boolean; version: string }> {
        return this.http.get<{ success: boolean; version: string }>(
            `${this.API}/version`,
            { headers: this.getHeaders() }
        );
    }

    getUpdateStatusObservable(): BehaviorSubject<UpdateInfo | null> {
        return this.updateStatusSubject;
    }

    clearStatus() {
        this.updateStatusSubject.next(null);
    }
}