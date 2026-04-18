const { parse } = require('csv-parse/sync');
const path = require('path');
const mime = require('mime-types');
const { getFileExtension, getMediaCategory, getStorageType } = require('../utils/helpers');

const EXPECTED_COLUMNS = ['title', 'file_path', 'description'];
const OPTIONAL_COLUMNS = ['publication_year', 'category', 'tags', 'author'];

function parseCSV(buffer) {
    const records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_quotes: true
    });
    return records;
}

function validateRecord(record, index) {
    const errors = [];
    if (!record.title && !record.nombre && !record['Nombre']) {
        errors.push(`Fila ${index + 2}: falta el título (columna "title" o "nombre")`);
    }
    if (!record.file_path && !record.path && !record['Ruta'] && !record['Path']) {
        errors.push(`Fila ${index + 2}: falta la ruta del archivo (columna "file_path" o "path")`);
    }
    return errors;
}

function normalizeRecord(record) {
    const title = record.title || record.nombre || record['Nombre'] || record['Title'] || '';
    const filePath = record.file_path || record.path || record['Ruta'] || record['Path'] || record['ruta'] || '';
    const description = record.description || record.descripcion || record['Descripción'] || record['Description'] || '';
    const year = parseInt(record.publication_year || record.año || record['Año'] || record['Year'] || '') || null;
    const category = record.category || record.categoria || record['Categoría'] || record['Category'] || '';
    const tagsRaw = record.tags || record.etiquetas || record['Etiquetas'] || record['Tags'] || '';
    const author = record.author || record.autor || record['Autor'] || record['Author'] || '';

    const filename = path.basename(filePath) || title;
    const extension = getFileExtension(filename);
    const mimeType = mime.lookup(filename) || 'application/octet-stream';
    const mediaKind = getMediaCategory(mimeType, extension);
    const storageType = getStorageType(filePath);

    const tags = tagsRaw
        ? tagsRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean)
        : [];

    return { title, filePath, description, year, category, tags, author, filename, extension, mimeType, mediaKind, storageType };
}

function processCSV(buffer) {
    const records = parseCSV(buffer);
    const errors = [];
    const normalized = [];

    records.forEach((record, i) => {
        const recordErrors = validateRecord(record, i);
        if (recordErrors.length > 0) {
            errors.push(...recordErrors);
        } else {
            normalized.push(normalizeRecord(record));
        }
    });

    return { records: normalized, errors, total: records.length, valid: normalized.length };
}

module.exports = { processCSV, parseCSV, normalizeRecord };
