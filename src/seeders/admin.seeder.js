import { Admin } from '../models/admin.model.js';
import bcrypt from 'bcrypt';

export default async function seedAdminData() {
  try {
    // Check if admin user already exists
    const existingAdmin = await Admin.findOne({ userType: 'Admin' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      // Create admin user if not exists
      await Admin.create({
        fullName: 'Admin',
        phoneNumber: '9999988888',
        email: 'admin@gmail.com',
        password: hashedPassword,
        username:"ravi",
        // Add other admin-specific fields
      });
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error seeding admin data:', error);
  }
}
