const multer = require('multer');
const path = require('path');

// Configure storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Folder where CSV files will be stored
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`); // Unique file name
    }
});

// File filter to allow only CSV files
const fileFilter = (req, file, cb) => {
    const fileTypes = /csv/;
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    if (extName) {
        return cb(null, true);
    } else {
        cb('Error: Only CSV files are allowed!');
    }
};

const upload = multer({
    storage,
    fileFilter
});

module.exports = upload;
