import mongoose from "mongoose";

const PostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      default: "",
      trim: true
    },

    body: {
      type: String,
      default: "",
    },

    images: [
      {
        type: String, // Cloudinary / local URL
      }
    ],

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }
    ],
  },
  {
    timestamps: true, // auto adds createdAt + updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ---------------------------------------------
// VIRTUAL: Comment Count (no DB storage needed)
// ---------------------------------------------
PostSchema.virtual("commentCount", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
  count: true, // returns number only
});

// ---------------------------------------------
// VIRTUAL: Latest comments preview (limit 2)
// ---------------------------------------------
PostSchema.virtual("latestComments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
  options: { sort: { createdAt: -1 }, limit: 2 },
});

// ---------------------------------------------
// PRE-SAVE HOOK: update updatedAt
// ---------------------------------------------
PostSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Post", PostSchema);
