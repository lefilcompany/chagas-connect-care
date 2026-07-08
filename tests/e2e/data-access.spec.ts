import { randomUUID } from "node:crypto";
import {
  accounts,
  createSignedInClient,
  expect,
  institutions,
  patients,
  test,
} from "./fixtures";

test("RLS isola pacientes entre instituições reais", async () => {
  const clientA = await createSignedInClient(accounts.adminA);
  const clientB = await createSignedInClient(accounts.adminB);

  const [{ data: rowsA, error: errorA }, { data: rowsB, error: errorB }] = await Promise.all([
    clientA.from("patients").select("id,full_name,institution").order("full_name"),
    clientB.from("patients").select("id,full_name,institution").order("full_name"),
  ]);

  expect(errorA).toBeNull();
  expect(errorB).toBeNull();
  expect(rowsA).toEqual([
    expect.objectContaining({ id: patients.a.id, full_name: patients.a.name, institution: institutions.a }),
  ]);
  expect(rowsB).toEqual([
    expect.objectContaining({ id: patients.b.id, full_name: patients.b.name, institution: institutions.b }),
  ]);
});

test("admin persiste paciente na própria instituição", async () => {
  const clientA = await createSignedInClient(accounts.adminA);
  const { data: authData } = await clientA.auth.getUser();
  const id = randomUUID();

  const { error: insertError } = await clientA.from("patients").insert({
    id,
    full_name: "Paciente criado pelo E2E funcional",
    institution: institutions.a,
    owner_id: authData.user?.id ?? null,
    stage: "diagnostico",
    status: "ativo",
    channel_pref: "whatsapp",
    phone: "5581999990101",
    email: "novo.paciente@example.test",
    city: "Recife",
    state: "PE",
  });

  expect(insertError).toBeNull();

  const { data: persisted, error: readError } = await clientA
    .from("patients")
    .select("id,full_name,institution")
    .eq("id", id)
    .single();

  expect(readError).toBeNull();
  expect(persisted).toEqual({
    id,
    full_name: "Paciente criado pelo E2E funcional",
    institution: institutions.a,
  });
});

test("admin não grava registro em outra instituição", async () => {
  const clientA = await createSignedInClient(accounts.adminA);

  const { error } = await clientA.from("patients").insert({
    id: randomUUID(),
    full_name: "Tentativa cross-tenant E2E",
    institution: institutions.b,
    stage: "diagnostico",
    status: "ativo",
    channel_pref: "whatsapp",
  });

  expect(error).not.toBeNull();
});

test("superadmin consulta instituições distintas pelo backend real", async () => {
  const superadmin = await createSignedInClient(accounts.superadmin);
  const { data, error } = await superadmin.from("profiles").select("institution");

  expect(error).toBeNull();
  expect(new Set((data ?? []).map((row) => row.institution))).toEqual(
    new Set([institutions.a, institutions.b, institutions.platform]),
  );
});
