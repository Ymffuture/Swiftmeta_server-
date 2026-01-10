import mongoose, { Schema } from "mongoose";

/* ----------------------------------------
   Message Schema (Chat-safe)
----------------------------------------- */
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
      maxlength: [5000, "Message too long (max 5000 characters)"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    _id: false,
  }
);

/* ----------------------------------------
   Ticket Schema
----------------------------------------- */
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
      trim: true,
      lowercase: true,
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
      enum: ["open", "pending", "in-progress", "on-hold", "closed"],
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

    /* ---------------------------
       Admin / Ops fields
    ---------------------------- */
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ----------------------------------------
   Virtuals
----------------------------------------- */
TicketSchema.virtual("messageCount").get(function () {
  return this.messages.length;
});

TicketSchema.virtual("needsReply").get(function () {
  return this.status !== "closed" && this.lastReplyBy === "user";
});

/* ----------------------------------------
   Middleware (VERY IMPORTANT)
----------------------------------------- */
TicketSchema.pre("save", function (next) {
  if (this.isModified("messages") && this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];

    this.lastReplyBy = lastMessage.sender;
    this.lastMessageAt = lastMessage.createdAt;

    // Auto-status logic
    if (lastMessage.sender === "user") {
      this.status = "pending";
    } else if (lastMessage.sender === "admin") {
      this.status = "open";
    }
  }

  if (this.status === "closed" && !this.closedAt) {
    this.closedAt = new Date();
  }

  next();
});

/* ----------------------------------------
   Indexes (Admin performance)
----------------------------------------- */
TicketSchema.index({ status: 1, lastMessageAt: -1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ priority: 1, status: 1 });

TicketSchema.index(
  {
    subject: "text",
    email: "text",
    "messages.message": "text",
  },
  {
    name: "TicketSearchIndex",
    weights: {
      subject: 5,
      email: 3,
      "messages.message": 1,
    },
    default_language: "english",
  }
);

export default mongoose.model("Ticket", TicketSchema);
