import WhatsAppSettings from "@/pages/app/WhatsAppSettings";
import { Card } from "@/components/ui/card";
import { useInstitutionScope, ALL_INSTITUTIONS } from "@/components/superadmin/InstitutionScope";

export default function SuperAdminWhatsAppSettings() {
  const { selected } = useInstitutionScope();

  if (selected === ALL_INSTITUTIONS) {
    return (
      <Card className="space-y-2 p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
          WhatsApp — Super Admin
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecione uma instituição no topo da tela para configurar canais, templates,
          diagnóstico e identidade do WhatsApp dessa instituição.
        </p>
      </Card>
    );
  }

  return <WhatsAppSettings advanced institutionOverride={selected} />;
}
