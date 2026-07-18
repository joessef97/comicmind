import mongoose, { Schema, Document } from "mongoose";

// ── User ────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  subscription: {
    plan: "free" | "starter" | "pro" | "creator";
    status: "inactive" | "active" | "paused" | "past_due";
    subscriptionId: string;
    customerId: string;
    priceId: string;
    nextBillingDate: Date | null;
  };
  usage: {
    monthlyComicLimit: number;
    comicsGeneratedThisMonth: number;
  };
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 60,
    },
    avatar: {
      type: String,
      default: undefined,
    },
    bio: {
      type: String,
      default: undefined,
      maxlength: 300,
    },
    subscription: {
      plan: {
        type: String,
        enum: ["free", "starter", "pro", "creator"],
        default: "free",
      },
      status: {
        type: String,
        enum: ["inactive", "active", "paused", "past_due"],
        default: "inactive",
      },
      subscriptionId: { type: String, default: "" },
      customerId: { type: String, default: "" },
      priceId: { type: String, default: "" },
      nextBillingDate: { type: Date, default: null },
    },
    usage: {
      monthlyComicLimit: { type: Number, default: 0 },
      comicsGeneratedThisMonth: { type: Number, default: 0 },
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

export const UserModel = mongoose.model<IUser>("User", userSchema);

// ── Password Reset ──────────────────────────────────────────────────────

export interface IPasswordReset extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    userId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

passwordResetSchema.index({ tokenHash: 1 });
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetModel = mongoose.model<IPasswordReset>("PasswordReset", passwordResetSchema);
