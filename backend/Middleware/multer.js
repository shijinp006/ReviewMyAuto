import multer from "multer";
import fs from "fs";
import path from "path";

// Create public/uploads folder automatically
const uploadPath = path.join(process.cwd(), "public", "uploads");

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log("public/uploads folder created");
}

// Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    },
});

// Accept All File Types
const fileFilter = (req, file, cb) => {
    cb(null, true);
};

// Optional File Size Limit (50MB)
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
});

export default upload;