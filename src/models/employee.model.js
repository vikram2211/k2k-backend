import mongoose, { Schema } from "mongoose";

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

    },
    { timestamps: true }
);

export const Employee = mongoose.model("Employee", employeeSchema);
