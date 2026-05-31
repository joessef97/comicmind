import { describe, it, expect, beforeEach } from "vitest";
import type { Comic, Draft, InsertComic, InsertDraft } from "../shared/schema";
import type { IStorage } from "../backend/src/services/storage.service";

// ─── Minimal in-memory storage stub ────────────────────────────────────

class InMemoryStorage implements Pick<
  IStorage,
  | "createDraft"
  | "getDraft"
  | "getDraftsByUser"
  | "deleteDraft"
  | "createComic"
  | "getComic"
  | "getComicsByUser"
  | "publishComic"
> {
  private drafts: Draft[] = [];
  private comics: Comic[] = [];
  private nextId = 1;

  private id(): string {
    return String(this.nextId++);
  }

  async createDraft(userId: string, draft: InsertDraft): Promise<Draft> {
    const now = new Date();
    const d: Draft = {
      id: this.id(),
      userId,
      title: draft.title,
      style: draft.style,
      idea: draft.idea,
      panels: draft.panels ?? [],
      characterSheet: draft.characterSheet,
      characterRefUrl: draft.characterRefUrl,
      status: draft.status ?? "DRAFT",
      createdAt: now,
      updatedAt: now,
    };
    this.drafts.push(d);
    return d;
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    return this.drafts.find((d) => d.id === id);
  }

  async getDraftsByUser(userId: string): Promise<Draft[]> {
    return this.drafts.filter((d) => d.userId === userId);
  }

  async deleteDraft(id: string, userId: string): Promise<boolean> {
    const idx = this.drafts.findIndex((d) => d.id === id && d.userId === userId);
    if (idx === -1) return false;
    this.drafts.splice(idx, 1);
    return true;
  }

  async createComic(userId: string, comic: InsertComic): Promise<Comic> {
    const c: Comic = {
      id: this.id(),
      userId,
      title: comic.title,
      style: comic.style,
      idea: comic.idea,
      panels: comic.panels ?? [],
      characterSheet: comic.characterSheet,
      characterRefUrl: comic.characterRefUrl,
      published: false,
      shares: 0,
      downloads: 0,
      createdAt: new Date(),
    };
    this.comics.push(c);
    return c;
  }

  async getComic(id: string): Promise<Comic | undefined> {
    return this.comics.find((c) => c.id === id);
  }

  async getComicsByUser(userId: string): Promise<Comic[]> {
    return this.comics.filter((c) => c.userId === userId);
  }

  async publishComic(id: string, userId: string, publish: boolean): Promise<Comic | undefined> {
    const c = this.comics.find((c) => c.id === id && c.userId === userId);
    if (!c) return undefined;
    c.published = publish;
    return c;
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe("Draft disappears after publish", () => {
  let storage: InMemoryStorage;
  const userId = "user-1";
  const draftInput: InsertDraft = {
    title: "My Comic",
    style: "manga",
    idea: "A robot who learns to paint",
    panels: [{ number: 1, description: "Panel 1", dialogue: "Hello", narration: "" }],
    characterSheet: "Robot: brass body, paint-splattered apron | Setting: rooftop studio",
    characterRefUrl: "/uploads/panels/1/character-ref.png",
    status: "COMPLETED",
  };

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it("draft exists before publish", async () => {
    const draft = await storage.createDraft(userId, draftInput);
    expect(await storage.getDraft(draft.id)).toBeDefined();
    expect((await storage.getDraftsByUser(userId)).length).toBe(1);
  });

  it("publishing a draft creates a comic and removes the draft", async () => {
    // 1. User creates a draft
    const draft = await storage.createDraft(userId, draftInput);
    expect(await storage.getDraft(draft.id)).toBeDefined();

    // 2. User publishes: first save as comic …
    const comic = await storage.createComic(userId, {
      title: draft.title,
      style: draft.style,
      idea: draft.idea,
      panels: draft.panels,
      characterSheet: draft.characterSheet,
      characterRefUrl: draft.characterRefUrl,
    });

    // … then delete the draft (mirrors frontend handlePublish)
    const deleted = await storage.deleteDraft(draft.id, userId);
    expect(deleted).toBe(true);

    // … then mark the comic as published
    const published = await storage.publishComic(comic.id, userId, true);
    expect(published).toBeDefined();
    expect(published!.published).toBe(true);

    // 3. Verify: draft is gone
    expect(await storage.getDraft(draft.id)).toBeUndefined();
    expect((await storage.getDraftsByUser(userId)).length).toBe(0);

    // 4. Verify: comic exists and is published
    const saved = await storage.getComic(comic.id);
    expect(saved).toBeDefined();
    expect(saved!.published).toBe(true);
    expect(saved!.title).toBe(draftInput.title);
    expect(saved!.characterSheet).toBe(draftInput.characterSheet);
    expect(saved!.characterRefUrl).toBe(draftInput.characterRefUrl);
  });

  it("deleting a draft that doesn't belong to the user returns false", async () => {
    const draft = await storage.createDraft(userId, draftInput);
    const deleted = await storage.deleteDraft(draft.id, "other-user");
    expect(deleted).toBe(false);
    // Draft should still exist
    expect(await storage.getDraft(draft.id)).toBeDefined();
  });

  it("draft list shows nothing after all drafts are published", async () => {
    const d1 = await storage.createDraft(userId, { ...draftInput, title: "Draft 1" });
    const d2 = await storage.createDraft(userId, { ...draftInput, title: "Draft 2" });

    expect((await storage.getDraftsByUser(userId)).length).toBe(2);

    // Publish both
    for (const draft of [d1, d2]) {
      await storage.createComic(userId, {
        title: draft.title,
        style: draft.style,
        idea: draft.idea,
        panels: draft.panels,
      });
      await storage.deleteDraft(draft.id, userId);
    }

    expect((await storage.getDraftsByUser(userId)).length).toBe(0);
    expect((await storage.getComicsByUser(userId)).length).toBe(2);
  });
});
