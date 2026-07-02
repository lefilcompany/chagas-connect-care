import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createHandler,
  DEFAULT_LIMITS,
  type HandlerDeps,
  type TemplateRow,
  type UserContext,
} from "./handler.ts";

type Overrides = Partial<HandlerDeps> & {
  user?: UserContext | null;
  template?: TemplateRow | null;
  session?: Awaited<ReturnType<HandlerDeps["createUploadSession"]>>;
  bytes?: Awaited<ReturnType<HandlerDeps["uploadBytes"]>>;
};

function makeDeps(o: Overrides = {}) {
  const sessions: Array<Parameters<HandlerDeps["createUploadSession"]>[0]> = [];
  const uploads: Array<Parameters<HandlerDeps["uploadBytes"]>[0]> = [];
  const persisted: Array<Parameters<HandlerDeps["persistMedia"]>[0]> = [];
  const templateUpdates: Array<Parameters<HandlerDeps["updateTemplateHeader"]>[0]> = [];
  const deps: HandlerDeps = {
    loadUser:
      o.loadUser ??
      (async () =>
        o.user ?? {
          userId: "u-1",
          isSuperadmin: false,
          isAdmin: true,
          institution: "Inst A",
        }),
    loadTemplate:
      o.loadTemplate ??
      (async () =>
        "template" in o
          ? o.template ?? null
          : { id: "tpl-1", institution: "Inst A", meta_status: "not_submitted" }),
    createUploadSession:
      o.createUploadSession ??
      (async (input) => {
        sessions.push(input);
        return o.session ?? { ok: true, status: 200, sessionId: "sess-1" };
      }),
    uploadBytes:
      o.uploadBytes ??
      (async (input) => {
        uploads.push(input);
        return o.bytes ?? { ok: true, status: 200, handle: "HDL-xyz" };
      }),
    persistMedia:
      o.persistMedia ??
      (async (input) => {
        persisted.push(input);
        return { id: "media-1", header_handle: input.header_handle, format: input.format };
      }),
    updateTemplateHeader:
      o.updateTemplateHeader ??
      (async (input) => {
        templateUpdates.push(input);
      }),
  };
  return { deps, sessions, uploads, persisted, templateUpdates };
}

function makeReq(opts: {
  file?: Blob | null;
  fileName?: string;
  templateId?: string | null;
  headers?: Record<string, string>;
}) {
  const form = new FormData();
  if (opts.templateId !== null) form.append("local_template_id", opts.templateId ?? "tpl-1");
  if (opts.file) form.append("file", opts.file, opts.fileName ?? "amostra.png");
  const headers: Record<string, string> = { Authorization: "Bearer jwt", ...(opts.headers ?? {}) };
  return new Request("http://x/functions/v1/upload-whatsapp-template-media", {
    method: "POST",
    headers,
    body: form,
  });
}

function pngBlob(size = 1024): Blob {
  return new Blob([new Uint8Array(size)], { type: "image/png" });
}

Deno.test("happy path: admin uploads a PNG and receives handle", async () => {
  const { deps, sessions, uploads, persisted, templateUpdates } = makeDeps();
  const res = await createHandler(deps)(makeReq({ file: pngBlob(1024) }));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.ok, true);
  assertEquals(j.format, "IMAGE");
  assertEquals(j.header_handle, "HDL-xyz");
  assertEquals(j.media_id, "media-1");
  assertEquals(sessions.length, 1);
  assertEquals(sessions[0].mimeType, "image/png");
  assertEquals(uploads.length, 1);
  assertEquals(uploads[0].sessionId, "sess-1");
  assertEquals(persisted[0].institution, "Inst A");
  assertEquals(persisted[0].uploaded_by, "u-1");
  assertEquals(templateUpdates[0], {
    templateId: "tpl-1", format: "IMAGE", handle: "HDL-xyz", mediaId: "media-1",
  });
});

Deno.test("invalid MIME returns 400 INVALID_MIME and no Meta calls", async () => {
  const { deps, sessions } = makeDeps();
  const blob = new Blob([new Uint8Array(10)], { type: "image/gif" });
  const res = await createHandler(deps)(makeReq({ file: blob, fileName: "x.gif" }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error_code, "INVALID_MIME");
  assertEquals(sessions.length, 0);
});

Deno.test("PNG larger than 5MB returns 400 FILE_TOO_LARGE", async () => {
  const { deps, sessions } = makeDeps();
  const blob = new Blob([new Uint8Array(DEFAULT_LIMITS.IMAGE + 1)], { type: "image/png" });
  const res = await createHandler(deps)(makeReq({ file: blob }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error_code, "FILE_TOO_LARGE");
  assertEquals(sessions.length, 0);
});

Deno.test("MP4 larger than 16MB returns 400 FILE_TOO_LARGE", async () => {
  const { deps } = makeDeps();
  const blob = new Blob([new Uint8Array(DEFAULT_LIMITS.VIDEO + 1)], { type: "video/mp4" });
  const res = await createHandler(deps)(makeReq({ file: blob, fileName: "v.mp4" }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error_code, "FILE_TOO_LARGE");
});

Deno.test("PDF larger than 100MB returns 400 FILE_TOO_LARGE", async () => {
  const { deps } = makeDeps();
  const blob = new Blob([new Uint8Array(DEFAULT_LIMITS.DOCUMENT + 1)], {
    type: "application/pdf",
  });
  const res = await createHandler(deps)(makeReq({ file: blob, fileName: "x.pdf" }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error_code, "FILE_TOO_LARGE");
});

Deno.test("template from another institution returns 403", async () => {
  const { deps, sessions } = makeDeps({
    user: { userId: "u-1", isSuperadmin: false, isAdmin: true, institution: "Inst B" },
  });
  const res = await createHandler(deps)(makeReq({ file: pngBlob() }));
  assertEquals(res.status, 403);
  assertEquals(sessions.length, 0);
});

Deno.test("upload session failure returns 502 UPLOAD_SESSION_FAILED", async () => {
  const { deps, uploads } = makeDeps({
    session: { ok: false, status: 500, body: { error: { message: "boom", code: 190 } } },
  });
  const res = await createHandler(deps)(makeReq({ file: pngBlob() }));
  assertEquals(res.status, 502);
  const j = await res.json();
  assertEquals(j.error_code, "UPLOAD_SESSION_FAILED");
  assertEquals(j.error, "boom");
  assertEquals(uploads.length, 0);
});

Deno.test("upload bytes failure returns 502 UPLOAD_BYTES_FAILED", async () => {
  const { deps } = makeDeps({
    bytes: { ok: false, status: 500, body: { error: { message: "network" } } },
  });
  const res = await createHandler(deps)(makeReq({ file: pngBlob() }));
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error_code, "UPLOAD_BYTES_FAILED");
});

Deno.test("missing file returns 400 MISSING_FILE", async () => {
  const { deps } = makeDeps();
  const res = await createHandler(deps)(makeReq({ file: null }));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error_code, "MISSING_FILE");
});

Deno.test("missing auth returns 401", async () => {
  const { deps } = makeDeps();
  const req = new Request("http://x", {
    method: "POST",
    body: new FormData(),
  });
  const res = await createHandler(deps)(req);
  assertEquals(res.status, 401);
});

Deno.test("non-admin returns 403", async () => {
  const { deps } = makeDeps({
    user: { userId: "u-1", isSuperadmin: false, isAdmin: false, institution: "Inst A" },
  });
  const res = await createHandler(deps)(makeReq({ file: pngBlob() }));
  assertEquals(res.status, 403);
});

Deno.test("template not found returns 404", async () => {
  const { deps } = makeDeps({ template: null });
  const res = await createHandler(deps)(makeReq({ file: pngBlob() }));
  assertEquals(res.status, 404);
});

Deno.test("template already submitted returns 409", async () => {
  const { deps, sessions } = makeDeps({
    template: { id: "tpl-1", institution: "Inst A", meta_status: "submitted" },
  });
  const res = await createHandler(deps)(makeReq({ file: pngBlob() }));
  assertEquals(res.status, 409);
  assertEquals(sessions.length, 0);
  assert((await res.json()).error_code === "ALREADY_SUBMITTED");
});