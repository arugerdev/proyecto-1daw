// update.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, interval, switchMap, BehaviorSubject } from 'rxjs';
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
}

@Injectable({
    providedIn: 'root'
})
export class UpdateService {

    private API = (environment as any).API_URL;
    private updateStatusSubject = new BehaviorSubject<UpdateInfo | null>(null);
    private pollingSubscription: any = null;

    constructor(private http: HttpClient) {
        // Iniciar polling cuando el servicio se crea
        this.startStatusPolling();
    }

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }

    /**
     * Verifica si hay actualizaciones disponibles en GitHub
     */
    checkForUpdates(): Observable<UpdateInfo> {
        return this.http.get<{ success: boolean; data: UpdateInfo }>(
            `${this.API}/update/check`,
            { headers: this.getHeaders() }
        ).pipe(
            switchMap(response => {
                if (response.success && response.data) {
                    this.updateStatusSubject.next(response.data);
                }
                return [response.data];
            })
        );
    }

    /**
     * Obtiene el estado actual de la actualización
     */
    getUpdateStatus(): Observable<UpdateInfo> {
        return this.http.get<{ success: boolean; data: UpdateInfo }>(
            `${this.API}/update/status`,
            { headers: this.getHeaders() }
        ).pipe(
            switchMap(response => {
                if (response.success && response.data) {
                    this.updateStatusSubject.next(response.data);
                }
                return [response.data];
            })
        );
    }

    /**
     * Ejecuta la actualización del sistema
     */
    executeUpdate(): Observable<{ success: boolean; message: string }> {
        return this.http.post<{ success: boolean; message: string }>(
            `${this.API}/update/execute`,
            {},
            { headers: this.getHeaders() }
        );
    }

    /**
     * Inicia el polling para monitorear el estado de la actualización
     */
    private startStatusPolling() {
        // Polling cada 2 segundos cuando hay una actualización en progreso
        this.pollingSubscription = interval(2000).subscribe(() => {
            const currentStatus = this.updateStatusSubject.getValue();
            // Solo hacer polling si hay una actualización en progreso
            if (currentStatus?.currentStatus?.status === 'updating') {
                this.getUpdateStatus().subscribe({
                    error: (error) => console.error('Error polling update status:', error)
                });
            }
        });
    }

    /**
     * Detiene el polling (útil para limpiar recursos)
     */
    stopPolling() {
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = null;
        }
    }

    /**
     * Obtiene el observable del estado de actualización
     */
    getUpdateStatusObservable(): BehaviorSubject<UpdateInfo | null> {
        return this.updateStatusSubject;
    }

    /**
     * Limpia el estado actual
     */
    clearStatus() {
        this.updateStatusSubject.next(null);
    }
}