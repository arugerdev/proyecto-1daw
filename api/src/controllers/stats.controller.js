const db = require('../config/database');
const { formatBytes } = require('../utils/helpers');

async function getStats(req, res) {
    try {
        const [[total]] = await db.query('SELECT COUNT(*) as count, SUM(file_size) as size FROM media_items');
        const [byKind] = await db.query('SELECT media_kind, COUNT(*) as count FROM media_items GROUP BY media_kind');
        const [byYear] = await db.query('SELECT publication_year as year, COUNT(*) as count FROM media_items WHERE publication_year IS NOT NULL GROUP BY publication_year ORDER BY year DESC');
        const [topCategories] = await db.query(`
            SELECT c.name, c.color, COUNT(m.id) as count
            FROM categories c
            LEFT JOIN media_items m ON m.category_id = c.id
            GROUP BY c.id ORDER BY count DESC LIMIT 10`);
        const [topTags] = await db.query(`
            SELECT t.name, t.color, COUNT(mt.media_id) as count
            FROM tags t
            LEFT JOIN media_tags mt ON mt.tag_id = t.id
            GROUP BY t.id ORDER BY count DESC LIMIT 20`);
        const [recentMedia] = await db.query(
            'SELECT id, title, media_kind, created_at FROM media_items ORDER BY created_at DESC LIMIT 5'
        );
        const [[userCount]] = await db.query('SELECT COUNT(*) as count FROM users WHERE is_hidden = FALSE');
        const [[locationCount]] = await db.query('SELECT COUNT(*) as count FROM storage_locations');

        res.json({
            success: true,
            data: {
                total: total.count,
                totalSize: total.size || 0,
                totalSizeFormatted: formatBytes(total.size || 0),
                byKind,
                byYear,
                topCategories,
                topTags,
                recentMedia,
                userCount: userCount.count,
                locationCount: locationCount.count
            }
        });
    } catch (err) {
        console.error('[stats] error:', err);
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
    }
}

module.exports = { getStats };
