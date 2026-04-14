import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
}

export interface IPasswordReset extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IPanelGenerationMeta {
  model: string;
  prompt: string;
  style: string;
  createdAt: string;
  costEstimate: number;
}

export interface IPanel {
  number: number;
  description: string;
  dialogue: string;
  narration: string;
  imageUrl?: string;
  /** Cloud/disk storage identifier used for deletion (e.g. Cloudinary public ID) */
  storagePublicId?: string;
  error?: string;
  generationMeta?: IPanelGenerationMeta;
}

export interface IComic extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: IPanel[];
  published: boolean;
  createdAt: Date;
}

export interface IDraft extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: IPanel[];
  status: "DRAFT" | "GENERATING" | "COMPLETED" | "FAILED";
  createdAt: Date;
  updatedAt: Date;
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
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

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
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-delete

const comicSchema = new Schema<IComic>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    style: {
      type: String,
      required: true,
    },
    idea: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    panels: {
      type: Schema.Types.Mixed,
      required: true,
    },
    published: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

comicSchema.index({ userId: 1, createdAt: -1 });
comicSchema.index({ published: 1, createdAt: -1 });

const draftSchema = new Schema<IDraft>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    style: {
      type: String,
      required: true,
    },
    idea: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    panels: {
      type: Schema.Types.Mixed,
      default: [],
    },
    status: {
      type: String,
      enum: ["DRAFT", "GENERATING", "COMPLETED", "FAILED"],
      default: "DRAFT",
    },
  },
  {
    timestamps: true,
  }
);

draftSchema.index({ userId: 1, updatedAt: -1 });

// ── Rating ──────────────────────────────────────────────────────────────

export interface IRating extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  comicId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const ratingSchema = new Schema<IRating>(
  {
    userId: { type: String, required: true },
    comicId: { type: String, required: true },
    value: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

ratingSchema.index({ comicId: 1 });
ratingSchema.index({ userId: 1, comicId: 1 }, { unique: true }); // one rating per user per comic

// ── Comment ─────────────────────────────────────────────────────────────

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  comicId: string;
  text: string;
  createdAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    userId: { type: String, required: true },
    comicId: { type: String, required: true },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

commentSchema.index({ comicId: 1, createdAt: -1 });

export const UserModel = mongoose.model<IUser>("User", userSchema);
export const ComicModel = mongoose.model<IComic>("Comic", comicSchema);
export const DraftModel = mongoose.model<IDraft>("Draft", draftSchema);
export const RatingModel = mongoose.model<IRating>("Rating", ratingSchema);
export const CommentModel = mongoose.model<IComment>("Comment", commentSchema);
export const PasswordResetModel = mongoose.model<IPasswordReset>("PasswordReset", passwordResetSchema);
