import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";


import AuthRoute from "./Routes/AuthRoute.js"

dotenv.config();


const app = express();
const Port = process.env.PORT || 4000;

// ✅ Enable CORS
app.use(
  cors({
    origin: "*", // Allow all origins — change to your frontend URL in production
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use("/",AuthRoute)

// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ✅ Start server
app.listen(Port, () => {
  console.log(`Server running on port ${Port}`);
});
