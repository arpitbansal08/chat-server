import mongoose, { model, Schema } from "mongoose";
const schema = mongoose.Schema(
  {
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "approved", "rejected"],
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Request = mongoose.model.Request || model("Request", schema);
