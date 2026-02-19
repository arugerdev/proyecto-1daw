export interface MediaItem {
    id: number;
    title: string;
    description: string | null;
    recording_year: number | null;
    duration: string | null;
    file_path: string;

    content_type_id: number;
    program_id: number;

    // Campos provenientes de JOIN
    content_type?: string;
    program?: string;

    // Relaciones
    staff?: StaffMember[];
}

export interface StaffMember {
    id: number;
    name: string;
    role: string;
}

export interface ContentType {
    id: number;
    name: string;
}

export interface Program {
    id: number;
    name: string;
}

export interface User {
    id_user: number;
    nombre: string;
    rol: 'admin' | 'moderator' | 'viewer';
}

export interface Stats {
    total: number;

    byType: {
        name: string;
        total: number;
    }[];

    byProgram: {
        name: string;
        total: number;
    }[];
}

export interface PaginatedResponse {
    success: boolean;
    data: MediaItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
