import mongoose, { Schema } from "mongoose";

const MessageSchema = new Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin", "system"], // ← added "system" (common for auto-messages)
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, "Message too long (max 5000 characters)"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true, // ← good practice for audit
    },
  },
  { _id: false }
);

const TicketSchema = new Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true, // explicit index (faster lookups)
    },
    email: {
      type: String,
      required: [true, "Customer email is required"],
      trim: true,
      lowercase: true,
      index: true, // ← very useful when searching by email
    },
    subject: {
      type: String,
      default: "No subject",
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ["open", "pending", "in-progress", "closed", "on-hold"], // ← more realistic states
      default: "open",
      index: true, // helps with dashboard filtering
    },
    lastReplyBy: {
      type: String,
      enum: ["user", "admin", "system"],
      default: "user",
    },
    messages: [MessageSchema],

    // Optional but very useful later
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Optional: Virtual for message count (useful in list views)
TicketSchema.virtual("messageCount").get(function () {
  return this.messages?.length || 0;
});

// Text index for full-text search (if you need it)
TicketSchema.index(
  {
    subject: "text",
    email: "text",
    "messages.message": "text",
  },
  {
    name: "TicketSearchIndex",
    weights: { subject: 5, email: 3, "messages.message": 1 },
    default_language: "english",
  }
);

export default mongoose.model("Ticket", TicketSchema);
