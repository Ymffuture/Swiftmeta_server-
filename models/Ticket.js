import mongoose from "mongoose";

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
    },
  },
  { timestamps: true }
);

const TicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      index: true,
    },
    email: String,
    subject: String,
    status: {
      type: String,
      enum: ["open", "pending", "closed"],
      default: "open",
    },
    messages: [MessageSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Ticket", TicketSchema);
