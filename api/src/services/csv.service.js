const { parse } = require('csv-parse/sync');
const path = require('path');
const mime = require('mime-types');
const { getFileExtension, getMediaCategory, getStorageType } = require('../utils/helpers');

/*
 * ─── CSV import pipeline ──────────────────────────────────────────────────
 *
 * 1.  analyzeCSV(buffer)               →  headers + auto-suggested mapping + preview rows
 * 2.  processCSV(buffer, userMapping?) →  validated + normalized records ready to insert
 *
 * A "mapping" is an object like:
 *     { title: 'nombre_archivo',
 *       file_path: 'ruta',
 *       description: null,         // null/undefined = skip
 *       ...
 *     }
 *
 * Keys are the canonical field names our DB cares about.
 * Values are the raw CSV column names that should supply the data.
 *
 * If the user does not supply a mapping (or supplies a partial one),
 * we auto-detect using the aliases table below.
 * ─────────────────────────────────────────────────────────────────────── */

// Canonical fields we support, with the common aliases users may already have
// in their CSV headers. Matching is case-insensitive and trims / strips accents.
const FIELD_ALIASES = {
    title:            ['title', 'titulo', 'nombre', 'name', 'filename', 'archivo', 'fichero'],
    file_path:        ['file_path', 'filepath', 'path', 'ruta', 'route', 'location', 'ubicacion'],
    description:      ['description', 'descripcion', 'desc', 'summary', 'resumen', 'notes', 'notas'],
    publication_year: ['publication_year', 'year', 'year_published', 'ano', 'anio', 'fecha', 'date', 'published'],
    category:         ['category', 'categoria', 'cat', 'type', 'tipo', 'genre', 'genero'],
    tags:             ['tags', 'etiquetas', 'labels', 'keywords', 'palabras_clave', 'keywords'],
    author:           ['author', 'autor', 'creator', 'creador', 'by']
};

// Fields required to import a row (after mapping resolution)
const REQUIRED_FIELDS = ['title', 'file_path'];

// All supported canonical field names
const SUPPORTED_FIELDS = Object.keys(FIELD_ALIASES);

/** Lower-cases, strips accents, removes non-alphanumeric chars — for fuzzy alias matching. */
function normalizeKey(s) {
    return String(s || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/** Parse the CSV buffer into array-of-row-objects using headers from row 1. */
function parseCSV(buffer) {
    return parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_quotes: true,
        relax_column_count: true
    });
}

/**
 * Given the CSV headers, guess which header matches each canonical field.
 * Returns { title: 'Nombre', file_path: 'ruta', ... } (null if no match).
 */
function autoDetectMapping(headers) {
    const normToOriginal = new Map();
    headers.forEach(h => normToOriginal.set(normalizeKey(h), h));

    const mapping = {};
    for (const field of SUPPORTED_FIELDS) {
        mapping[field] = null;
        for (const alias of FIELD_ALIASES[field]) {
            const hit = normToOriginal.get(normalizeKey(alias));
            if (hit) { mapping[field] = hit; break; }
        }
    }
    return mapping;
}

/**
 * Analyze a CSV buffer without importing:
 *   - extracts the list of column headers
 *   - auto-detects which header matches each canonical field
 *   - returns a few sample rows so the user can preview before mapping
 */
function analyzeCSV(buffer, { previewRows = 5 } = {}) {
    let records;
    try {
        records = parseCSV(buffer);
    } catch (err) {
        throw new Error(`CSV inválido: ${err.message}`);
    }

    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    const suggested = autoDetectMapping(headers);
    const preview = records.slice(0, previewRows);

    return {
        headers,
        suggested,
        preview,
        total: records.length,
        supportedFields: SUPPORTED_FIELDS,
        requiredFields: REQUIRED_FIELDS
    };
}

/**
 * Resolve the final mapping used by processCSV:
 *   - starts from auto-detection
 *   - overrides with any user-provided values
 *   - validates that all REQUIRED_FIELDS have a mapping
 */
function resolveMapping(headers, userMapping) {
    const auto = autoDetectMapping(headers);
    const final = { ...auto };

    if (userMapping && typeof userMapping === 'object') {
        for (const field of SUPPORTED_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(userMapping, field)) {
                const v = userMapping[field];
                // Empty string / null / undefined = "skip this field"
                final[field] = (v === '' || v === null || v === undefined) ? null : v;
            }
        }
    }

    const missing = REQUIRED_FIELDS.filter(f => !final[f]);
    return { mapping: final, missing };
}

/** Pull a value from a record using the mapped column, or empty string. */
function getByMapping(record, mapping, field) {
    const col = mapping[field];
    if (!col) return '';
    const v = record[col];
    return (v === undefined || v === null) ? '' : String(v).trim();
}

function validateRecord(record, index, mapping) {
    const errors = [];
    for (const field of REQUIRED_FIELDS) {
        if (!getByMapping(record, mapping, field)) {
            const colName = mapping[field] || `(columna "${field}" sin asignar)`;
            errors.push(`Fila ${index + 2}: falta valor para "${field}" → ${colName}`);
        }
    }
    return errors;
}

function normalizeRecord(record, mapping) {
    const title       = getByMapping(record, mapping, 'title');
    const filePath    = getByMapping(record, mapping, 'file_path');
    const description = getByMapping(record, mapping, 'description');
    const yearRaw     = getByMapping(record, mapping, 'publication_year');
    const category    = getByMapping(record, mapping, 'category');
    const tagsRaw     = getByMapping(record, mapping, 'tags');
    const author      = getByMapping(record, mapping, 'author');

    const year = parseInt(yearRaw, 10) || null;

    const filename  = path.basename(filePath) || title;
    const extension = getFileExtension(filename);
    const mimeType  = mime.lookup(filename) || 'application/octet-stream';
    const mediaKind = getMediaCategory(mimeType, extension);
    const storageType = getStorageType(filePath);

    const tags = tagsRaw
        ? tagsRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean)
        : [];

    return { title, filePath, description, year, category, tags, author, filename, extension, mimeType, mediaKind, storageType };
}

/**
 * Process a CSV buffer into importable records.
 * @param {Buffer} buffer
 * @param {Object} [userMapping] optional { title: 'col_name', ... }
 */
function processCSV(buffer, userMapping) {
    const records = parseCSV(buffer);
    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    const { mapping, missing } = resolveMapping(headers, userMapping);

    // Hard failure: required fields cannot be mapped at all.
    if (missing.length > 0) {
        return {
            records: [],
            errors: [`No se pudo determinar la columna para los campos obligatorios: ${missing.join(', ')}`],
            total: records.length,
            valid: 0,
            mapping
        };
    }

    const errors = [];
    const normalized = [];

    records.forEach((record, i) => {
        const rowErrors = validateRecord(record, i, mapping);
        if (rowErrors.length > 0) {
            errors.push(...rowErrors);
        } else {
            normalized.push(normalizeRecord(record, mapping));
        }
    });

    return { records: normalized, errors, total: records.length, valid: normalized.length, mapping };
}

module.exports = {
    // New API
    analyzeCSV,
    autoDetectMapping,
    resolveMapping,
    SUPPORTED_FIELDS,
    REQUIRED_FIELDS,
    FIELD_ALIASES,
    // Existing API (kept for backwards compatibility)
    processCSV,
    parseCSV,
    normalizeRecord
};
