import mongoose from "mongoose";

/* -----------------------------
   Message Schema
------------------------------ */
const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

/* -----------------------------
   Ticket Schema
------------------------------ */
const TicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      index: true,
      required: true,
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
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["open", "pending", "closed"],
      index: true,
    },

    lastReplyBy: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },

    messages: {
      type: [MessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Ticket", TicketSchema);
