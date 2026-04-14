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
    isActive: boolean;
    packageName: string;
    comicsLimit: number;
    comicsUsed: number;
    expiresAt: Date | null;
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
      isActive: { type: Boolean, default: false },
      packageName: { type: String, default: "Free" },
      comicsLimit: { type: Number, default: 0 },
      comicsUsed: { type: Number, default: 0 },
      expiresAt: { type: Date, default: null },
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
