//import seedAdminData from './admin.seeder.js';
import connectDB from '../db/index.js';
import dotenv from 'dotenv';
// import seedMerchandiserData from './merchandiser.seeder.js';
import seedDimensionData from './dimensionSeeder.js';

dotenv.config({
  path: './.env',
});
async function seedAllData() {
  await connectDB();
  // await seedAdminData();
  // await seedMerchandiserData();
  await seedDimensionData();
  console.log('Seeding completed');

  process.exit(0);
}

seedAllData().catch((error) => {
  console.error('Error during seeding:', error);
});
