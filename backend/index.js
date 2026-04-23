import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"


import UserRoute from "./User/routes/route.js"

dotenv.config()

const app = express()

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Permissive JSON Parser (Handles extra characters after JSON)
app.use(express.text({ type: 'application/json' }));
app.use((req, res, next) => {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
        try {
            const lastBrace = req.body.lastIndexOf('}');
            if (lastBrace !== -1) {
                req.body = JSON.parse(req.body.substring(0, lastBrace + 1));
            } else {
                req.body = JSON.parse(req.body);
            }
        } catch (e) {
            return res.status(400).json({ success: false, message: "Malformed JSON structure", error: e.message });
        }
    }
    next();
});

app.use(
    cors({
        origin: "*", // frontend URL
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    })
)

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected 🚀")
    })
    .catch((err) => {
        console.log("MongoDB Error:", err)
    })

app.use("/api", UserRoute)

// // Test Route
// app.get("/", (req, res) => {
//     res.send("API Running 🎯")
// })

// Server
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server running on port localhost// ${PORT}`)
})