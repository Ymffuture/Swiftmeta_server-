import cloudinary from "../config/cloudinary.js";
import Application from "../models/Application.js";

const uploadToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: "raw" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    ).end(file.buffer);
  });

export const submitApplication = async (req, res) => {
  try {
    const uploadedDocs = {};

    for (const key in req.files) {
      const file = req.files[key][0];
      const result = await uploadToCloudinary(file);

      uploadedDocs[key] = {
        name: file.originalname,
        url: result.secure_url,
        publicId: result.public_id,
      };
    }

    const application = await Application.create({
      ...req.body,
      documents: uploadedDocs,
    });

    res.status(201).json({
      message: "Application submitted successfully",
      applicationId: application._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to submit application" });
  }
};
