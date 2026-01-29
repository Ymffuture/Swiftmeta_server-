import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema({
  name: { type: String },
  url: { type: String },
  publicId: { type: String },
});

const ApplicationSchema = new mongoose.Schema(
  {
    // Personal
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    idNumber: { type: String, required: true, unique: true },
    gender: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String, unique: true },
    location: { type: String },

    // Professional
    qualification: { type: String },
    experience: { type: String },
    currentRole: { type: String },
    portfolio: { type: String, unique:true },

    // Documents
    documents: {
      cv: DocumentSchema,
      doc1: DocumentSchema,
      doc2: DocumentSchema,
      doc3: DocumentSchema,
      doc4: DocumentSchema,
      doc5: DocumentSchema,
    },

    // Status
    status: {
      type: String,
      enum: ["PENDING", "SUCCESSFUL", "UNSUCCESSFUL", "SECOND_INTAKE"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Application", ApplicationSchema);
