import mongoose from "mongoose";

const ReplySchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const CommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    text: {
      type: String,
      required: true,
      trim: true
    },

    media: [
      {
        type: String // URL (Cloudinary or local uploads)
      }
    ],

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    replies: [ReplySchema] // Nested replies
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// --------------------------------------------------
// VIRTUAL: Reply Count
// --------------------------------------------------
CommentSchema.virtual("replyCount").get(function () {
  return this.replies?.length || 0;
});

// --------------------------------------------------
// INDEXES for speed
// --------------------------------------------------
CommentSchema.index({ post: 1, createdAt: 1 });
CommentSchema.index({ author: 1 });

export default mongoose.model("Comment", CommentSchema);
