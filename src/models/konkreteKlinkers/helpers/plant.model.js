import mongoose from "mongoose";

const plantSchema = new mongoose.Schema(
    {
      plant_code: {
        type: String,
        required: true,
        unique: true,
      },
      plant_name: {
        type: String,
        required: true,
      },
       created_by: {
           type: mongoose.Schema.Types.ObjectId,
           ref: 'User',
           required: true,
         },
         isDeleted: {
          type: Boolean,
          default: false, // Default to false (not deleted)
        },
    },
    {
      timestamps: true,
    }
  );
  
  export const Plant = mongoose.model('Plant', plantSchema);
  