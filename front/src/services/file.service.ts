import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class FileService {

    private API = "http://localhost:3000/api";

    constructor(private http: HttpClient) { }

    getFiles(tipo?: string, search?: string) {
        return this.http.get<any[]>(`${this.API}/files`, {
            params: { tipo: tipo || '', search: search || '' }
        });
    }

    upload(file: File) {
        const formData = new FormData();
        formData.append("file", file);

        return this.http.post(`${this.API}/upload-content`, formData);
    }

    delete(id: number) {
        return this.http.delete(`${this.API}/files/${id}`);
    }
}
