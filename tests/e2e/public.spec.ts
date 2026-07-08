import {
  backendConfig,
  createServiceClient,
  expect,
  institutions,
  onboardingInviteToken,
  test,
} from "./fixtures";

test("landing apresenta proposta e acesso ao sistema", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/ELO2.*Chagas Connect Care/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Conecte cada pessoa da rede de cuidado");
  await expect(page.getByRole("link", { name: "Acessar o sistema" })).toHaveAttribute("href", "/auth");
});

test("autenticação apresenta login e criação de conta", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "Acessar Chagas Cuidado Digital" })).toBeAttached();
  await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
  await expect(page.locator("#li-email")).toBeVisible();
  await page.getByRole("tab", { name: "Criar conta" }).click();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByLabel("Função")).toBeVisible();
});

for (const [path, heading] of [
  ["/politica-de-privacidade", "Política de Privacidade"],
  ["/termos-de-uso", "Termos de Uso"],
  ["/exclusao-de-dados", "Exclusão de Dados"],
] as const) {
  test(`documento legal ${path} permanece acessível`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}

test("visitante é redirecionado ao login ao abrir área autenticada", async ({ page }) => {
  await page.goto("/app/hoje");
  await expect(page).toHaveURL(/\/auth$/);
});

test("Edge Function pública lê convite e persiste onboarding real", async ({ request }) => {
  const { url, anonKey } = backendConfig();
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  const inviteResponse = await request.get(
    `${url}/functions/v1/public-onboarding?token=${onboardingInviteToken}`,
    { headers },
  );
  expect(inviteResponse.ok()).toBe(true);
  await expect(inviteResponse.json()).resolves.toMatchObject({
    ok: true,
    intended_role: "paciente",
    institution: institutions.a,
  });

  const submitResponse = await request.post(`${url}/functions/v1/public-onboarding`, {
    headers,
    data: {
      token: onboardingInviteToken,
      full_name: "Paciente Onboarding Funcional",
      birth_date: "1995-05-10",
      email: "onboarding.funcional@example.test",
      phone: "5581999990099",
      city: "Recife",
      state: "PE",
      consent: true,
    },
  });

  expect(submitResponse.ok()).toBe(true);
  await expect(submitResponse.json()).resolves.toMatchObject({ ok: true });

  const service = createServiceClient();
  const [{ data: patient, error: patientError }, { data: invite, error: inviteError }] = await Promise.all([
    service.from("patients").select("full_name,institution").eq("email", "onboarding.funcional@example.test").single(),
    service.from("onboarding_invites").select("status").eq("token", onboardingInviteToken).single(),
  ]);

  expect(patientError).toBeNull();
  expect(inviteError).toBeNull();
  expect(patient).toEqual({ full_name: "Paciente Onboarding Funcional", institution: institutions.a });
  expect(invite).toEqual({ status: "completed" });
});

test("rota inexistente exibe página 404", async ({ page }) => {
  await page.goto("/rota-que-nao-existe");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("Oops! Page not found")).toBeVisible();
});
