// @vitest-environment jsdom
/**
 * The messages surface is repository-backed — enforced structurally, not by review.
 *
 * WHY THIS GATE EXISTS TWICE OVER
 *
 * `messagesDatasetRegression.test.tsx` pins the DATA behaviour: the view loads a
 * migrated dataset, an empty dataset is not an error, a genuine failure is still
 * reported. It cannot see the shape of the code, and the shape is what a
 * fixture-only data path is made of: a view can render a stub repository
 * faithfully and still keep a fixture import beside it.
 *
 * The scheduling surface learned the second half of this the hard way. Its gate
 * scanned `Scheduling.tsx` and missed the write forms that M4/CP2 moved into
 * `src/views/scheduling/` — a gate that reads one file stops being a gate the
 * moment the code grows a directory. So the scan here is discovered from
 * `src/views/messages/` at run time, and the files are then named explicitly: a
 * rename or a move shrinks the gate loudly instead of leaving it passing over
 * one file, and the attachment files added by M6/CP3 are covered by construction
 * rather than by someone remembering to add them.
 *
 * THE ONE STATIC, NAMED
 *
 * `Messages.tsx` reads `messageTemplates` from `./messages/composerTemplates`:
 * canned message copy («یادآوری پرداخت», «لغو کلاس»…) rendered as buttons that
 * fill the composer. It is copy, not a data path — nothing about it is
 * presented as a record, and it never reaches a write. M10 gave the templates
 * their honest owner (the surface itself) and dissolved the fixture module
 * they came from. The rule is pinned here in both directions: the import must
 * be exactly that one name from exactly that in-surface module, it must be
 * used only to fill the composer, and NO seeded dataset export may appear
 * anywhere in the surface. The list of forbidden names is read from
 * `src/domains/demo/academySeed.ts` itself, so a collection added to the seed
 * later is forbidden here automatically — including the `conversations`
 * collection, which is asserted to exist precisely so this rule cannot become
 * vacuous.
 *
 * M6/CP4 added the export, and the same rule applies to it: the transcript is
 * built from repository reads and handed to the browser through the export
 * domain's own `downloadBlob`. So the attachment rules above are joined by the
 * ones a text export needs — no fixture transcript, no browser storage, no
 * second download implementation, no HTML serialization of user content, no
 * attachment bytes, and no console output of anything read.
 *
 * Comments are stripped before the identifier checks (the files document what
 * they do, and prose about a rule must not satisfy it), and no line numbers are
 * used anywhere: they drift, and a gate that breaks on an unrelated edit gets
 * deleted.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** Strips comments so prose about a rule cannot satisfy (or trip) it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const VIEWS = join(ROOT, "src", "views");
const MESSAGES_DIR = join(VIEWS, "messages");
const MESSAGES_VIEW = code(readFileSync(join(VIEWS, "Messages.tsx"), "utf8"));

/**
 * The whole messages surface: the view plus every file beside it.
 *
 * Read from the directory on purpose — see the header.
 */
const MESSAGES_SURFACE = [
  { name: "views/Messages.tsx", source: MESSAGES_VIEW },
  ...readdirSync(MESSAGES_DIR)
    .filter((file) => /\.tsx?$/.test(file))
    .sort()
    .map((file) => ({
      name: `views/messages/${file}`,
      source: code(readFileSync(join(MESSAGES_DIR, file), "utf8")),
    })),
];

/** Every data name the demo seed exports, read from the module itself. */
const FIXTURE_EXPORTS = [
  ...readFileSync(join(ROOT, "src", "domains", "demo", "academySeed.ts"), "utf8").matchAll(
    /^export\s+(?:const|function|interface|type|class)\s+([A-Za-z_$][\w$]*)/gm,
  ),
].map((match) => match[1]);

/** The single static the view may read, and only as composer copy. */
const ALLOWED_TEMPLATE = "messageTemplates";

/**
 * Claims this build cannot support: there is no upload endpoint, no server-side
 * storage, no scanning and no server download in the media or chat contracts.
 * Each phrase below asserts one of them. The honest negations («روی سرور نگهداری
 * نمی‌شود») are deliberately not in this list — they are the point.
 */
const FABRICATED_CLAIMS = [
  "آپلود شد",
  "در حال آپلود",
  "روی سرور ذخیره",
  "در سرور ذخیره",
  "به سرور فرستاده",
  "دانلود از سرور",
  "اسکن شد",
  "ویروس‌زدایی شد",
];

describe("the messages surface reads from the domains", () => {
  it("scans the view and every file beside it", () => {
    const names = MESSAGES_SURFACE.map((file) => file.name);
    // Named so a rename or a move fails here instead of silently shrinking the scan.
    expect(names).toContain("views/Messages.tsx");
    expect(names).toContain("views/messages/useComposer.ts");
    expect(names).toContain("views/messages/ConversationManagerDialog.tsx");
    expect(names).toContain("views/messages/AttachmentField.tsx");
    expect(names).toContain("views/messages/MessageAttachment.tsx");
    expect(names).toContain("views/messages/attachmentRules.ts");
    expect(names).toContain("views/messages/conversationExport.ts");
    expect(names.length).toBeGreaterThanOrEqual(7);
  });

  it("imports nothing from the demo data plane, anywhere in the surface", () => {
    for (const file of MESSAGES_SURFACE) {
      const from = [...file.source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
      const dataPlane = from.filter((path) => path.startsWith("@/domains/demo/"));
      expect(dataPlane, `${file.name} imports from the demo data plane`).toEqual([]);
    }
  });

  it("takes exactly one name from the in-surface templates module, and uses it only as copy", () => {
    const imports = [...MESSAGES_VIEW.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/messages\/composerTemplates"/g)];
    expect(imports, "the composer templates module is imported once").toHaveLength(1);
    expect(
      imports[0][1]
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ).toEqual([ALLOWED_TEMPLATE]);
    // The import statement and one render site — not a second data path.
    expect((MESSAGES_VIEW.match(new RegExp(ALLOWED_TEMPLATE, "g")) ?? []).length).toBe(2);
    // And the templates module really is part of the surface this gate scans.
    expect(MESSAGES_SURFACE.map((file) => file.name)).toContain("views/messages/composerTemplates.ts");
  });

  it("carries no seed export anywhere in the surface", () => {
    const forbidden = FIXTURE_EXPORTS;
    expect(forbidden.length, "the seed module must export data to forbid").toBeGreaterThan(10);
    for (const file of MESSAGES_SURFACE) {
      for (const name of forbidden) {
        expect(
          new RegExp(`\\b${name}\\b`).test(file.source),
          `${file.name} reads the seeded 「${name}」`,
        ).toBe(false);
      }
    }
  });

  it("keeps the seeded conversation collection out of the surface entirely", () => {
    // Non-vacuity anchor: the seed module really does carry it, so the rule
    // above is testing something real.
    expect(FIXTURE_EXPORTS).toContain("conversations");
    for (const file of MESSAGES_SURFACE) {
      expect(file.source, `${file.name} names the seeded conversation collection`).not.toMatch(
        /\bconversations\b/,
      );
    }
  });
});

describe("the attachment surface is repository-backed", () => {
  it("picks files through a real input opened by a real button", () => {
    const field = MESSAGES_SURFACE.find((file) => file.name === "views/messages/AttachmentField.tsx")!;
    expect(field.source).toContain('type="file"');
    expect(field.source).toContain("accept={ATTACHMENT_ACCEPT}");
    // A labelled input and a labelled button: reachable without a mouse.
    expect(field.source).toContain('aria-label="انتخاب فایل پیوست"');
    expect(field.source).toContain('aria-label="افزودن پیوست"');
    expect(field.source).toContain("input.current?.click()");
  });

  it("derives its limits from the media contract instead of restating them", () => {
    const rules = MESSAGES_SURFACE.find((file) => file.name === "views/messages/attachmentRules.ts")!;
    expect(rules.source).toContain('from "@/domains/media/types"');
    expect(rules.source).toContain("allowedTypesFor(");
    expect(rules.source).toContain("maxBytesFor(");
    // No ceiling re-typed as a literal: a second copy of 5/20/25 MB is how two
    // layers start disagreeing about what "too big" means.
    expect(rules.source).not.toMatch(/5\s*\*\s*1024/);
    expect(rules.source).not.toMatch(/20\s*\*\s*1024/);
    expect(rules.source).not.toMatch(/25\s*\*\s*1024/);
    expect(rules.source).not.toMatch(/5242880|20971520|26214400/);
  });

  it("renders only what the repositories hold, and builds no URL of its own", () => {
    const card = MESSAGES_SURFACE.find((file) => file.name === "views/messages/MessageAttachment.tsx")!;
    expect(card.source).toContain("getMediaRepository()");
    // The sanctioned seam for stored bytes — it owns creation AND revocation.
    expect(card.source).toContain("useMediaObjectUrl(");
    // The reference comes off the STORED message, not from a pending local File.
    expect(MESSAGES_VIEW).toContain("message.mediaId");
    for (const file of MESSAGES_SURFACE) {
      expect(file.source, `${file.name} creates its own object URL`).not.toMatch(
        /URL\.(create|revoke)ObjectURL/,
      );
    }
  });

  it("makes no claim the contract cannot support", () => {
    // Non-vacuity anchor: this surface does make success claims after awaited
    // writes, so the absence below is a real constraint and not an empty file.
    expect(MESSAGES_VIEW).toContain("پیام و پیوست ثبت شد");
    for (const file of MESSAGES_SURFACE) {
      for (const claim of FABRICATED_CLAIMS) {
        expect(file.source, `${file.name} claims «${claim}»`).not.toContain(claim);
      }
    }
  });

  it("never reaches past the domain boundaries", () => {
    for (const file of MESSAGES_SURFACE) {
      // No store access, no browser storage, no second clock, no faked latency,
      // no test-only branch: each of these has a sanctioned seam elsewhere.
      expect(file.source, `${file.name} reads the demo store`).not.toContain("services/demoStore");
      expect(file.source, `${file.name} writes browser storage`).not.toContain("localStorage");
      expect(file.source, `${file.name} reads the wall clock`).not.toMatch(/new Date\(\s*\)/);
      expect(file.source, `${file.name} reads the wall clock`).not.toMatch(/Date\.now\(/);
      expect(file.source, `${file.name} fakes latency`).not.toMatch(/\bset(Timeout|Interval)\s*\(/);
      expect(file.source, `${file.name} branches on the test environment`).not.toContain("NODE_ENV");
    }
  });

  it("builds the export from repository reads and hands it to the existing download seam", () => {
    const exporter = MESSAGES_SURFACE.find((file) => file.name === "views/messages/conversationExport.ts")!;
    // Reads: the conversation by id and its messages, through the chat repository.
    expect(exporter.source).toContain("getChatRepository()");
    expect(exporter.source).toContain("getConversation(");
    expect(exporter.source).toContain("listMessages(");
    // The file is handed to the browser by the export domain's own utility —
    // not by a second, private implementation of the same browser dance.
    expect(exporter.source).toContain("downloadBlob(");
    expect(exporter.source).toContain('from "@/domains/export/exportService"');
    expect(exporter.source).not.toContain("createElement(");
    // A statement the artifact must carry: the bytes are not in the file.
    expect(exporter.source).toContain("خودِ فایل پیوست در خروجی نیست");
  });

  it("exports no attachment bytes and produces no markup", () => {
    const exporter = MESSAGES_SURFACE.find((file) => file.name === "views/messages/conversationExport.ts")!;
    // `mediaId` resolution reads METADATA only. The bytes live behind `getBlob`,
    // which belongs to the media card that renders an attachment, not to the
    // export — a transcript has no business reading a binary.
    expect(exporter.source).not.toContain("getBlob(");
    // Plain text, always: no HTML, no XML, no data URLs, no inline serialization.
    expect(exporter.source).toContain('"text/plain;charset=utf-8"');
    for (const file of MESSAGES_SURFACE) {
      expect(file.source, `${file.name} produces HTML`).not.toContain("text/html");
      expect(file.source, `${file.name} writes markup into the DOM`).not.toMatch(
        /innerHTML|dangerouslySetInnerHTML|outerHTML|insertAdjacentHTML/,
      );
      // Nothing read from the user is printed to a console or sent anywhere.
      expect(file.source, `${file.name} logs`).not.toMatch(/console\.(log|info|warn|error|debug)/);
    }
  });

  it("keeps every read and write on a repository seam", () => {
    for (const [seam, where] of [
      ["getChatRepository(", "views/Messages.tsx"],
      ["getMediaRepository(", "views/Messages.tsx"],
      ["useConversations(", "views/Messages.tsx"],
      ["useMessages(", "views/Messages.tsx"],
    ] as const) {
      const file = MESSAGES_SURFACE.find((entry) => entry.name === where)!;
      expect(file.source, `${where} must reach ${seam}`).toContain(seam);
    }
    // And the attachment card resolves metadata through the media repository.
    const card = MESSAGES_SURFACE.find((file) => file.name === "views/messages/MessageAttachment.tsx")!;
    expect(card.source).toContain("getBlob(");
  });
});
