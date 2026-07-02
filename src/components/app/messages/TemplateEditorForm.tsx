import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { TEMPLATE_CATEGORIES } from "@/lib/templates";
import {
  normalizeMetaName,
  type TemplateDraftInput,
  type TemplateDraftButton,
} from "@/lib/templateDraft";
import { extractSemanticKeys, getSemanticVariable } from "@/lib/metaVariables";
import { WhatsAppPreview } from "./WhatsAppPreview";

export type EditorFormState = TemplateDraftInput;

export type EditorFormProps = {
  value: EditorFormState;
  onChange: (patch: Partial<EditorFormState>) => void;
  errors: Record<string, string>;
  /** When true, all fields are disabled (e.g. non-draft template). */
  disabled?: boolean;
  /** Optional status badge to show at the top (read-only). */
  statusBadge?: React.ReactNode;
};

const EMPTY_BUTTON: Record<TemplateDraftButton["type"], TemplateDraftButton> = {
  quick_reply: { type: "quick_reply", text: "" },
  url: { type: "url", text: "", url: "https://" },
  phone_number: { type: "phone_number", text: "", phone_number: "" },
};

export function TemplateEditorForm({
  value,
  onChange,
  errors,
  disabled = false,
  statusBadge,
}: EditorFormProps) {
  const isMeta = value.template_kind === "meta";
  const vars = useMemo(() => extractSemanticKeys(value.body), [value.body]);

  const set = <K extends keyof EditorFormState>(key: K, v: EditorFormState[K]) =>
    onChange({ [key]: v } as Partial<EditorFormState>);

  const setExample = (k: string, v: string) =>
    onChange({ variable_examples: { ...value.variable_examples, [k]: v } });

  const updateButton = (idx: number, patch: Partial<TemplateDraftButton>) => {
    const next = value.meta_buttons.map((b, i) =>
      i === idx ? ({ ...b, ...patch } as TemplateDraftButton) : b,
    );
    set("meta_buttons", next);
  };
  const removeButton = (idx: number) =>
    set(
      "meta_buttons",
      value.meta_buttons.filter((_, i) => i !== idx),
    );
  const addButton = (type: TemplateDraftButton["type"]) =>
    set("meta_buttons", [...value.meta_buttons, EMPTY_BUTTON[type]]);

  return (
    <fieldset disabled={disabled} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="tpl-name">Nome local</Label>
            {statusBadge}
          </div>
          <Input
            id="tpl-name"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!errors.name}
            placeholder="Ex.: Lembrete de consulta"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tpl-cat">Pasta / categoria interna</Label>
          <select
            id="tpl-cat"
            value={value.category}
            onChange={(e) => set("category", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="tpl-desc">Descrição</Label>
          <Textarea
            id="tpl-desc"
            rows={2}
            value={value.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Para que serve este modelo?"
          />
        </div>

        <div className="space-y-2">
          <Label>Tipo</Label>
          <div className="flex gap-2">
            {(["internal", "meta"] as const).map((k) => (
              <label
                key={k}
                className={`flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm ${
                  value.template_kind === k
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-input"
                }`}
              >
                <input
                  type="radio"
                  name="template_kind"
                  className="sr-only"
                  checked={value.template_kind === k}
                  onChange={() => set("template_kind", k)}
                />
                {k === "internal" ? "Interno" : "Meta (WhatsApp)"}
              </label>
            ))}
          </div>
        </div>

        {isMeta && (
          <div className="space-y-2">
            <Label htmlFor="tpl-meta-name">Nome técnico Meta</Label>
            <Input
              id="tpl-meta-name"
              value={value.meta_template_name}
              onChange={(e) => set("meta_template_name", e.target.value)}
              onBlur={(e) => set("meta_template_name", normalizeMetaName(e.target.value))}
              aria-invalid={!!errors.meta_template_name}
              placeholder="lembrete_consulta"
            />
            <p className="text-[11px] text-muted-foreground">
              Será salvo como:{" "}
              <code className="rounded bg-muted px-1">
                {normalizeMetaName(value.meta_template_name) || "—"}
              </code>
            </p>
            {errors.meta_template_name && (
              <p className="text-xs text-destructive">{errors.meta_template_name}</p>
            )}
          </div>
        )}

        {isMeta && (
          <div className="space-y-2">
            <Label htmlFor="tpl-lang">Idioma</Label>
            <select
              id="tpl-lang"
              value={value.meta_language}
              onChange={(e) => set("meta_language", e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="pt_BR">Português (Brasil)</option>
              <option value="en_US">English (US)</option>
              <option value="es_ES">Español</option>
            </select>
          </div>
        )}

        {isMeta && (
          <div className="space-y-2">
            <Label htmlFor="tpl-cat-meta">Categoria Meta</Label>
            <select
              id="tpl-cat-meta"
              value={value.meta_category}
              onChange={(e) => set("meta_category", e.target.value as EditorFormState["meta_category"])}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="UTILITY">UTILITY</option>
              <option value="MARKETING">MARKETING</option>
              <option value="AUTHENTICATION">AUTHENTICATION</option>
            </select>
          </div>
        )}
      </div>

      {isMeta && (
        <div className="space-y-2 rounded-lg border p-4">
          <Label>Cabeçalho</Label>
          <div className="flex gap-2">
            {(["none", "text"] as const).map((t) => (
              <label
                key={t}
                className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${
                  value.meta_header_type === t
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-input"
                }`}
              >
                <input
                  type="radio"
                  name="meta_header_type"
                  className="sr-only"
                  checked={value.meta_header_type === t}
                  onChange={() => set("meta_header_type", t)}
                />
                {t === "none" ? "Nenhum" : "Texto"}
              </label>
            ))}
          </div>
          {value.meta_header_type === "text" && (
            <Input
              value={value.meta_header_text}
              onChange={(e) => set("meta_header_text", e.target.value)}
              maxLength={60}
              placeholder="Cabeçalho curto (até 60 caracteres)"
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="tpl-body">Corpo</Label>
        <Textarea
          id="tpl-body"
          rows={6}
          value={value.body}
          onChange={(e) => set("body", e.target.value)}
          aria-invalid={!!errors.body}
          placeholder="Escreva o corpo da mensagem. Use {nome_paciente} para variáveis."
        />
        {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
      </div>

      {isMeta && vars.length > 0 && (
        <div className="space-y-2 rounded-lg border p-4">
          <Label>Exemplos das variáveis</Label>
          <p className="text-xs text-muted-foreground">
            A Meta exige um exemplo real (não sensível) para cada variável do modelo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {vars.map((k) => {
              const cat = getSemanticVariable(k);
              const errKey = `variable_examples.${k}`;
              return (
                <div key={k} className="space-y-1">
                  <Label htmlFor={`ex-${k}`} className="text-xs">
                    {cat.label} <code className="text-muted-foreground">{`{${k}}`}</code>
                  </Label>
                  <Input
                    id={`ex-${k}`}
                    value={value.variable_examples[k] ?? ""}
                    onChange={(e) => setExample(k, e.target.value)}
                    aria-invalid={!!errors[errKey]}
                    placeholder={cat.example}
                  />
                  {errors[errKey] && (
                    <p className="text-xs text-destructive">{errors[errKey]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isMeta && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Label>Rodapé</Label>
            <span className="text-[11px] text-muted-foreground">
              {value.meta_footer_text.length}/60
            </span>
          </div>
          <Input
            value={value.meta_footer_text}
            onChange={(e) => set("meta_footer_text", e.target.value.slice(0, 60))}
            placeholder="Ex.: Hospital das Clínicas — não responda a esta mensagem."
          />
        </div>
      )}

      {isMeta && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Label>Botões</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addButton("quick_reply")}
              >
                <Plus className="h-3 w-3" /> Resposta rápida
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addButton("url")}
              >
                <Plus className="h-3 w-3" /> URL
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addButton("phone_number")}
              >
                <Plus className="h-3 w-3" /> Telefone
              </Button>
            </div>
          </div>
          {value.meta_buttons.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum botão adicionado.</p>
          )}
          <div className="space-y-2">
            {value.meta_buttons.map((b, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-[auto_1fr_1fr_auto]"
              >
                <Badge variant="outline" className="w-fit self-center text-[10px]">
                  {b.type}
                </Badge>
                <Input
                  value={b.text}
                  onChange={(e) => updateButton(i, { text: e.target.value } as Partial<TemplateDraftButton>)}
                  placeholder="Texto do botão"
                />
                {b.type === "url" && (
                  <Input
                    value={(b as Extract<TemplateDraftButton, { type: "url" }>).url}
                    onChange={(e) => updateButton(i, { url: e.target.value } as Partial<TemplateDraftButton>)}
                    placeholder="https://..."
                  />
                )}
                {b.type === "phone_number" && (
                  <Input
                    value={(b as Extract<TemplateDraftButton, { type: "phone_number" }>).phone_number}
                    onChange={(e) =>
                      updateButton(i, { phone_number: e.target.value } as Partial<TemplateDraftButton>)
                    }
                    placeholder="+55 11 99999-0000"
                  />
                )}
                {b.type === "quick_reply" && <div />}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeButton(i)}
                  aria-label={`Remover botão ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-lg border p-4">
        <Label>Pré-visualização</Label>
        <WhatsAppPreview
          body={value.body}
          variant="compact"
          resolveExamples
          footer={value.meta_footer_text || undefined}
        />
      </div>
    </fieldset>
  );
}
