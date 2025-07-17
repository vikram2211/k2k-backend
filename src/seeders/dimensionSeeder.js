// src/seeders/dimensionSeeder.js

import mongoose from 'mongoose';
import { ironDimension } from '../models/ironSmith/helpers/ironDimension.model.js';
import dotenv from 'dotenv';

dotenv.config();

const seedDimensions = Array.from({ length: 26 }, (_, i) => ({
  dimension_name: String.fromCharCode(65 + i),
  dimension_count: i + 1,
}));

const seedDimensionData = async () => {
  try {
    // Connect only if not connected yet
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: process.env.DB_NAME,
      });
    }

    await ironDimension.deleteMany();
    const created = await ironDimension.insertMany(seedDimensions);

    console.log('✅ Dimension Data Imported:', created.length, 'documents');
  } catch (error) {
    console.error('❌ Error importing dimension data:', error);
    throw error;
  }
};

export default seedDimensionData;
