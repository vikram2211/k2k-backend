// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import connectDB from './db/index.js';
import mainRouter from './routes/index.js'; // Centralized router
import errorHandler from './middlewares/errorHandler.js';
import mongoose from 'mongoose';

const app = express();



// Middleware setup
app.use(morgan('combined'));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Debug middleware for request body
// app.use((req, res, next) => {
//   console.log('Request Body:', req.body);
//   next();
// });

// async function dropPhoneNumberIndex() {
//   try {
//     await mongoose.connection.collection("users").dropIndex("phoneNumber_1");
//     console.log("Dropped phoneNumber_1 index");
//   } catch (err) {
//     console.log("Error dropping index:", err);
//   }
// }
// dropPhoneNumberIndex();


app.get('/', (req, res) => {
  res.status(200).json("K2K LIVE - 12-05-2025")
})
// Routes
app.use('/', mainRouter);

// Error handler middleware
app.use(errorHandler);

// Connect to the database and start the server
connectDB()
  .then(() => {
    app.listen(process.env.PORT || 4000, () => {
      console.log(`Server is running at port: ${process.env.PORT ?? 8000}`);
    });
  })
  .catch((err) => {
    console.log('MONGO DB connection failed !!!', err);
  });
