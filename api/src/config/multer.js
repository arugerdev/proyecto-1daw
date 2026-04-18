const multer = require('multer');
const os = require('os');
const path = require('path');

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE) || (50 * 1024 * 1024 * 1024); // 50 GB default

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}_${safeName}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => cb(null, true),
    limits: { fileSize: MAX_SIZE }
});

module.exports = upload;
