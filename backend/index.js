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

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())

app.use(
    cors({
        origin: "http://localhost:3000", // frontend URL
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

    app.use("/api",UserRoute)

// // Test Route
// app.get("/", (req, res) => {
//     res.send("API Running 🎯")
// })

// Server
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server running on port localhost// ${PORT}`)
})