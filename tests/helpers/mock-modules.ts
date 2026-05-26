import { vi } from "vitest";
import path from "path";

const testMocks = vi.hoisted(() => ({
  storage: {
    getUserByUsername: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    createPasswordReset: vi.fn(),
    findValidPasswordReset: vi.fn(),
    markResetUsed: vi.fn(),
    deleteActiveResetsForUser: vi.fn(),
    updatePassword: vi.fn(),
    createComic: vi.fn(),
    getComic: vi.fn(),
    getComicsByUser: vi.fn(),
    deleteComic: vi.fn(),
    updateComic: vi.fn(),
    publishComic: vi.fn(),
    getComicPublic: vi.fn(),
    getAverageRating: vi.fn(),
    getCommentsByComic: vi.fn(),
    getPublicComicPreviews: vi.fn(),
    incrementShareCount: vi.fn(),
    incrementDownloadCount: vi.fn(),
    createComment: vi.fn(),
    getRatingsWithUserByComic: vi.fn(),
    getUserRatingForComic: vi.fn(),
    upsertRating: vi.fn(),
  },
  authService: {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateToken: vi.fn(),
  },
  aiService: {
    generateStory: vi.fn(),
    generateAllPanelImages: vi.fn(),
    retryPanelGeneration: vi.fn(),
    generateCharacterReference: vi.fn(),
    getImageProvider: vi.fn(),
  },
  imageStorage: {
    persistImage: vi.fn(),
    persistImageBuffer: vi.fn(),
    isPersistedUrl: vi.fn(),
    deleteComicImages: vi.fn(),
    getStorageProviderName: vi.fn(() => "local-disk"),
    getUploadsRoot: vi.fn(() => path.resolve(process.cwd(), "uploads")),
  },
  userModel: {
    findById: vi.fn(),
    updateOne: vi.fn(),
  },
  emailService: {
    sendResetEmail: vi.fn(),
  },
}));

export { testMocks };