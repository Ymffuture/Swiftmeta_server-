import mongoose from "mongoose";

const { Schema } = mongoose;

/* ---------------------------
   Message Schema
---------------------------- */
const MessageSchema = new Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin", "system"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    _id: false, // messages don't need their own ObjectId
  }
);

/* ---------------------------
   Ticket Schema
---------------------------- */
const TicketSchema = new Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    subject: {
      type: String,
      default: "No subject",
      trim: true,
      maxlength: 200,
    },

    status: {
      type: String,
      enum: ["open", "pending", "closed"],
      default: "open",
      index: true,
    },

    lastReplyBy: {
      type: String,
      enum: ["user", "admin", "system"],
      default: "user",
      index: true,
    },

    messages: {
      type: [MessageSchema],
      default: [],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

/* ---------------------------
   Helpful Indexes
---------------------------- */
TicketSchema.index({ updatedAt: -1 });
TicketSchema.index({ status: 1, lastReplyBy: 1 });

export default mongoose.model("Ticket", TicketSchema);
