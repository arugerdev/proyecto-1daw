export interface MediaItem {
    publication_year: string;
    id: number;
    title: string;
    description: string | null;
    recording_year: number | null;
    duration: string | null;
    media_path: string;

    media_type_id: number;

    // Campos provenientes de JOIN
    media_type?: string;
    tags?: Tag[];
    // Relaciones
    authors_ids?: Number[];
    authors?: Author[];

    date_updated?: string;
    date_added?: string;
}

export interface Author {
    id: number;
    name: string;
    role: string;
}

export interface ContentType {
    id: number;
    name: string;
}

export interface Tag {
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
    videos: number;
    imagenes: number;
    audio: number;
    documentos: number;
    otros: number;
    storage: {
        bytes: number;
        formatted: string;
        total: number;
        free: number;
        usedPercentage: number;
    }
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
