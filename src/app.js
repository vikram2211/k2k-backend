import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();
import morgan from 'morgan';
import mainRouter from './routes/index.js'; // Centralized router

// const { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } = pkg;
// import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } from '@copilotkit/runtime';
const app = express();

// Middleware
app.use(morgan('combined'));
// app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(cors({ origin: ['https://k2k-iot.kods.app'], credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
console.log("inside app file!!!");


// Debug middleware for request body
app.use((req, res, next) => {
  console.log('Request Body:', req.body);
  next();
});

// const serviceAdapter = new OpenAIAdapter({
//   apiKey: process.env.OPENAI_API_KEY, // Explicitly set API key
// });


// Middleware to handle /copilotkit route
// app.use('/copilotkit', (req, res, next) => {
//   const runtime = new CopilotRuntime();
//   const handler = copilotRuntimeNodeHttpEndpoint({
//     endpoint: '/copilotkit', // Define the endpoint
//     runtime,                 // Pass the runtime instance
//     serviceAdapter,          // Pass the service adapter
//   });

//   return handler(req, res, next); // Pass request, response, and next to the handler
// });

//CORS - 

// const corsOptions = {
//   origin: process.env.CORS_ORIGINS?.split(',') || true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
//   maxAge: 86400,
// };

// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions));


//Routes
//the main route is coming form the routes index.js file
app.use('/', mainRouter);

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint is working!' });
});
export { app };


//the codebase has been created from the scratch.
//images middleware are present, but the connection the cloudinary or AWS s3 bucket is pending.

//routes are created and working. 
//##routing name should be fixed.

//recently copilot was added, it will just works a open ai in a limited version.

//database integration done.
//backend opreaation starts for clients
//still understanding of cookies or localstorage authentication keys are pending.
//## jwt expiry is giving problems.

//learn the format of writing in comments, term name: 
