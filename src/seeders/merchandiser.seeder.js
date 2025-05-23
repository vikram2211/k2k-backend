import { Merchandiser } from '../models/merchandiser.model.js';
import bcrypt from 'bcrypt';

export default async function seedMerchandiserData() {
  try {
    // Check if admin user already exists
    const existingAdmin = await Merchandiser.findOne({ userType: 'Merchandiser' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      // Create admin user if not exists
      await Merchandiser.create({
        fullName: 'Merchandiser',
        phoneNumber: '9999988887',
        email: 'merchandiser@gmail.com',
        password: hashedPassword,
        // Add other admin-specific fields
      });
      console.log('Merchandiser user created successfully');
    } else {
      console.log('Merchandiser user already exists');
    }
  } catch (error) {
    console.error('Error seeding Merchandiser data:', error);
  }
}
