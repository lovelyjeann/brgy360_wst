
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Upload folder
const uploadDirectory = path.join(__dirname, "../uploads");

// Create uploads folder if it does not exist
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Where uploaded files will be stored
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname).toLowerCase();

        cb(null, uniqueName);
    }
});

// Accept JPG, JPEG, PNG, WEBP, and PDF files only
const fileFilter = (req, file, cb) => {
    const allowedTypes = {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
        "application/pdf": [".pdf"]
    };

    const extension = path.extname(file.originalname).toLowerCase();
    const validExtensions = allowedTypes[file.mimetype];

    if (validExtensions && validExtensions.includes(extension)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, JPEG, PNG, WEBP, and PDF files are allowed."));
    }
};

// Upload configuration
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB maximum per file
    }
});

module.exports = upload;