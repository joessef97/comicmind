import { type User, type InsertUser, type Comic, type InsertComic, type Draft, type InsertDraft, type Rating, type RatingWithUser, type Comment } from "@shared/schema";
import { UserModel, PasswordResetModel } from "../modules/auth/auth.model";
import { ComicModel } from "../modules/comics/comic.model";
import { DraftModel } from "../modules/drafts/draft.model";
import { RatingModel } from "../modules/ratings/rating.model";
import { CommentModel } from "../modules/comments/comment.model";
import crypto from "crypto";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createPasswordReset(userId: string, token: string, expiresAt: Date): Promise<void>;
  findValidPasswordReset(token: string, email: string): Promise<{ userId: string } | null>;
  markResetUsed(token: string): Promise<void>;
  deleteActiveResetsForUser(userId: string): Promise<void>;
  updatePassword(userId: string, hashedPassword: string): Promise<void>;

  createComic(userId: string, comic: InsertComic): Promise<Comic>;
  getComic(id: string): Promise<Comic | undefined>;
  getComicsByUser(userId: string, limit?: number, offset?: number): Promise<Comic[]>;
  deleteComic(id: string, userId: string): Promise<boolean>;
  updateComic(id: string, userId: string, updates: Partial<InsertComic>): Promise<Comic | undefined>;
  publishComic(id: string, userId: string, publish: boolean): Promise<Comic | undefined>;

  // Draft methods
  createDraft(userId: string, draft: InsertDraft): Promise<Draft>;
  getDraft(id: string): Promise<Draft | undefined>;
  getDraftsByUser(userId: string, limit?: number, offset?: number): Promise<Draft[]>;
  updateDraft(id: string, userId: string, updates: Partial<InsertDraft>): Promise<Draft | undefined>;
  deleteDraft(id: string, userId: string): Promise<boolean>;
  cleanupStaleDrafts(userId: string, maxAgeMinutes?: number): Promise<number>;

  // Rating methods
  upsertRating(userId: string, comicId: string, value: number): Promise<Rating>;
  getUserRatingForComic(userId: string, comicId: string): Promise<Rating | undefined>;
  getRatingsByComic(comicId: string): Promise<Rating[]>;
  getRatingsWithUserByComic(comicId: string, limit?: number, page?: number): Promise<{ ratings: RatingWithUser[]; total: number }>;
  getAverageRating(comicId: string): Promise<{ average: number; count: number }>;

  // Comment methods
  createComment(userId: string, comicId: string, text: string): Promise<Comment>;
  getCommentsByComic(comicId: string, limit?: number, page?: number): Promise<{ comments: Comment[]; total: number }>;
  deleteComment(id: string, userId: string): Promise<boolean>;

  // Public comic access (no auth ownership check)
  getComicPublic(id: string): Promise<Comic | undefined>;
  getAllComicsPublic(limit?: number, offset?: number): Promise<Comic[]>;
  getPublicComicPreviews(limit?: number, offset?: number): Promise<Array<{
    id: string;
    userId: string;
    title: string;
    style: string;
    idea: string;
    panels: Array<{ imageUrl?: string }>;
    shares: number;
    downloads: number;
    createdAt: Date;
  }>>;

  // Share tracking
  incrementShareCount(id: string): Promise<number>;

  // Download tracking
  incrementDownloadCount(id: string): Promise<number>;
}

function toUser(doc: any): User {
  return {
    id: doc._id.toString(),
    username: doc.username,
    email: doc.email,
    password: doc.password,
    displayName: doc.displayName,
    avatar: doc.avatar,
    bio: doc.bio,
    createdAt: doc.createdAt,
  };
}

function toComic(doc: any): Comic {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    title: doc.title,
    style: doc.style,
    idea: doc.idea,
    panels: doc.panels,
    characterRefUrl: doc.characterRefUrl,
    published: doc.published ?? false,
    shares: doc.shares ?? 0,
    downloads: doc.downloads ?? 0,
    createdAt: doc.createdAt,
  };
}

function toDraft(doc: any): Draft {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    title: doc.title,
    style: doc.style,
    idea: doc.idea,
    panels: doc.panels,
    characterRefUrl: doc.characterRefUrl,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toRating(doc: any): Rating {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    comicId: doc.comicId,
    value: doc.value,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toComment(doc: any): Comment {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    username: "", // populated after join
    comicId: doc.comicId,
    text: doc.text,
    createdAt: doc.createdAt,
  };
}

export class MongoStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const doc = await UserModel.findById(id);
    return doc ? toUser(doc) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ username });
    return doc ? toUser(doc) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const doc = await UserModel.create(insertUser);
    return toUser(doc);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    return doc ? toUser(doc) : undefined;
  }

  async createPasswordReset(userId: string, token: string, expiresAt: Date): Promise<void> {
    const tokenHash = hashToken(token);
    await PasswordResetModel.create({ userId, tokenHash, expiresAt });
  }

  async findValidPasswordReset(token: string, email: string): Promise<{ userId: string } | null> {
    const tokenHash = hashToken(token);
    const reset = await PasswordResetModel.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!reset) return null;

    // Verify the email matches the user who owns this token
    const user = await UserModel.findById(reset.userId);
    if (!user || user.email.toLowerCase() !== email.toLowerCase()) return null;

    return { userId: reset.userId };
  }

  async markResetUsed(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await PasswordResetModel.findOneAndUpdate(
      { tokenHash },
      { $set: { usedAt: new Date() } }
    );
  }

  async deleteActiveResetsForUser(userId: string): Promise<void> {
    await PasswordResetModel.deleteMany({ userId, usedAt: null });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { password: hashedPassword });
  }

  async createComic(userId: string, comic: InsertComic): Promise<Comic> {
    const doc = await ComicModel.create({ ...comic, userId });
    return toComic(doc);
  }

  async getComic(id: string): Promise<Comic | undefined> {
    const doc = await ComicModel.findById(id);
    return doc ? toComic(doc) : undefined;
  }

  async getComicsByUser(userId: string, limit = 10, offset = 0): Promise<Comic[]> {
    const docs = await ComicModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
    return docs.map(toComic);
  }

  async deleteComic(id: string, userId: string): Promise<boolean> {
    const result = await ComicModel.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }

  async updateComic(id: string, userId: string, updates: Partial<InsertComic>): Promise<Comic | undefined> {
    const doc = await ComicModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true }
    );
    return doc ? toComic(doc) : undefined;
  }

  // Draft methods
  async createDraft(userId: string, draft: InsertDraft): Promise<Draft> {
    const doc = await DraftModel.create({ ...draft, userId });
    return toDraft(doc);
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    const doc = await DraftModel.findById(id);
    return doc ? toDraft(doc) : undefined;
  }

  async getDraftsByUser(userId: string, limit = 50, offset = 0): Promise<Draft[]> {
    const docs = await DraftModel.find({ userId })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit);
    return docs.map(toDraft);
  }

  async updateDraft(id: string, userId: string, updates: Partial<InsertDraft>): Promise<Draft | undefined> {
    const doc = await DraftModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true }
    );
    return doc ? toDraft(doc) : undefined;
  }

  async deleteDraft(id: string, userId: string): Promise<boolean> {
    const result = await DraftModel.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }

  async cleanupStaleDrafts(userId: string, maxAgeMinutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
    const result = await DraftModel.deleteMany({
      userId,
      status: "GENERATING",
      updatedAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }

  // ── Rating methods ──────────────────────────────────────────────────────

  async upsertRating(userId: string, comicId: string, value: number): Promise<Rating> {
    const doc = await RatingModel.findOneAndUpdate(
      { userId, comicId },
      { $set: { value, userId, comicId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return toRating(doc);
  }

  async getUserRatingForComic(userId: string, comicId: string): Promise<Rating | undefined> {
    const doc = await RatingModel.findOne({ userId, comicId });
    return doc ? toRating(doc) : undefined;
  }

  async getRatingsByComic(comicId: string): Promise<Rating[]> {
    const docs = await RatingModel.find({ comicId });
    return docs.map(toRating);
  }

  async getRatingsWithUserByComic(comicId: string, limit = 20, page = 1): Promise<{ ratings: RatingWithUser[]; total: number }> {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      RatingModel.find({ comicId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      RatingModel.countDocuments({ comicId }),
    ]);
    const userIds = Array.from(new Set(docs.map((d) => d.userId)));
    const users = await UserModel.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u._id.toString(), { username: u.username, avatar: u.avatar }]));
    const ratings: RatingWithUser[] = docs.map((d) => {
      const info = userMap.get(d.userId) || { username: "Unknown", avatar: undefined };
      return {
        ...toRating(d),
        username: info.username,
        avatar: info.avatar,
      };
    });
    return { ratings, total };
  }

  async getAverageRating(comicId: string): Promise<{ average: number; count: number }> {
    const result = await RatingModel.aggregate([
      { $match: { comicId } },
      { $group: { _id: null, average: { $avg: "$value" }, count: { $sum: 1 } } },
    ]);
    if (!result.length) return { average: 0, count: 0 };
    return { average: Math.round(result[0].average * 10) / 10, count: result[0].count };
  }

  // ── Comment methods ─────────────────────────────────────────────────────

  async createComment(userId: string, comicId: string, text: string): Promise<Comment> {
    const doc = await CommentModel.create({ comicId, text, userId });
    const user = await UserModel.findById(userId);
    const c = toComment(doc);
    c.username = user?.username || "Unknown";
    return c;
  }

  async getCommentsByComic(comicId: string, limit = 20, page = 1): Promise<{ comments: Comment[]; total: number }> {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      CommentModel.find({ comicId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      CommentModel.countDocuments({ comicId }),
    ]);
    // batch-fetch usernames
    const userIds = Array.from(new Set(docs.map((d) => d.userId)));
    const users = await UserModel.find({ _id: { $in: userIds } });
    const usernameMap = new Map(users.map((u) => [u._id.toString(), u.username]));
    const comments = docs.map((d) => {
      const c = toComment(d);
      c.username = usernameMap.get(d.userId) || "Unknown";
      return c;
    });
    return { comments, total };
  }

  async deleteComment(id: string, userId: string): Promise<boolean> {
    const result = await CommentModel.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }

  // ── Public comic access ─────────────────────────────────────────────────

  async publishComic(id: string, userId: string, publish: boolean): Promise<Comic | undefined> {
    const doc = await ComicModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { published: publish } },
      { new: true }
    );
    return doc ? toComic(doc) : undefined;
  }

  async getComicPublic(id: string): Promise<Comic | undefined> {
    const doc = await ComicModel.findOne({ _id: id, published: true });
    return doc ? toComic(doc) : undefined;
  }

  async getAllComicsPublic(limit = 20, offset = 0): Promise<Comic[]> {
    const docs = await ComicModel.find({ published: true })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
    return docs.map(toComic);
  }

  async getPublicComicPreviews(limit = 20, offset = 0): Promise<Array<{
    id: string;
    userId: string;
    title: string;
    style: string;
    idea: string;
    panels: Array<{ imageUrl?: string }>;
    shares: number;
    downloads: number;
    createdAt: Date;
  }>> {
    const docs = await ComicModel.find({ published: true })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .select("userId title style idea panels.imageUrl shares downloads createdAt");

    return docs.map((doc: any) => ({
      id: doc._id.toString(),
      userId: doc.userId,
      title: doc.title,
      style: doc.style,
      idea: doc.idea,
      // Keep only first panel image for list cards.
      panels: doc.panels?.length ? [{ imageUrl: doc.panels[0]?.imageUrl }] : [],
      shares: doc.shares ?? 0,
      downloads: doc.downloads ?? 0,
      createdAt: doc.createdAt,
    }));
  }

  async incrementShareCount(id: string): Promise<number> {
    const doc = await ComicModel.findByIdAndUpdate(
      id,
      { $inc: { shares: 1 } },
      { new: true }
    );
    return doc?.shares ?? 0;
  }

  async incrementDownloadCount(id: string): Promise<number> {
    const doc = await ComicModel.findByIdAndUpdate(
      id,
      { $inc: { downloads: 1 } },
      { new: true }
    );
    return doc?.downloads ?? 0;
  }
}

export const storage = new MongoStorage();
