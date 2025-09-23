import mongoose from 'mongoose';
import { Admin } from '../models/admin.model.js';
import seedAdminData from '../seeders/admin.seeder.js';
import seedColors from '../seeders/color.seeder.js';
import dotenv from 'dotenv';
dotenv.config();

// const connectDB = async () => {
//   try {
//     const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`);
//     console.log(`MongoDB connected ! DB Host : ${connectionInstance.connection.host}`);
//     const existingAdmin = await Admin.findOne({ userType: 'Admin' });
//     // const existingMerchant = await Merchandiser.findOne({ userType: 'Merchandiser' });
//     if (!existingAdmin)  await seedAdminData();
//     // if (!existingMerchant) await seedMerchandiserData();
//   } catch (error) {
//     console.error('MONGODB connection Failed: ' + error);
//     process.exit(1);
//   }
// };

// export default connectDB;



//new db connection

// import mongoose from "mongoose";


const MONGODB_CONNECTION_STRING = process.env.MONGODB_URI;
console.log("MONGODB_CONNECTION_STRING",MONGODB_CONNECTION_STRING);

const dbConnect = async () => {
  try {
    mongoose.set("strictQuery", false); // Optional if you're using Mongoose 6+
    const conn = await mongoose.connect(MONGODB_CONNECTION_STRING);


    const existingAdmin = await Admin.findOne({ userType: 'Admin' });
    console.log("existingAdmin",existingAdmin);
    // const existingMerchant = await Merchandiser.findOne({ userType: 'Merchandiser' });
    if (!existingAdmin)  await seedAdminData();
    
    // const existingColors = await mongoose.model('Color').countDocuments();
    // if (existingColors === 0) await seedColors();

    console.log(`Database connected to host: ${conn.connection.host}`);

    // Listen for Mongoose connection events
    mongoose.connection.on("connected", () => {
      console.log("MongoDB connected.");
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Reconnecting...");
    });

    mongoose.connection.on("error", (error) => {
      console.error("MongoDB connection error:", error);
    });

    
    console.log(`Database connected to host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to database: ${error.message}`);
    process.exit(1); // Exit with failure
  }
};





export default dbConnect;
