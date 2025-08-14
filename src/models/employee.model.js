import mongoose, { Schema } from "mongoose";

const tabPermissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  enabled: { type: Boolean, required: true }
});
// Single permission schema
const permissionSchema = new Schema({
  module: { type: String, required: true },
  create: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  update: { type: Boolean, default: false },
  updateStatus: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  tabs: [tabPermissionSchema]
});


const employeeSchema = new Schema(
    {
        name: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        phoneNumber: { type: String, required: false, unique: true, sparse: true },
        emp_code: {
            type: String,
            required: true,
        },
        factory: { type: String, required: true },
        role: {
            type: String,
            required: true,
        },
        address: {
            type: String,
            required: true,

        },
        permissions: {
      type: [permissionSchema],
      default: []
    },

    },
    { timestamps: true }
);

export const Employee = mongoose.model("Employee", employeeSchema);
