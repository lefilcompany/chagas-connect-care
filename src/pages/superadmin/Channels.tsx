import Channels from "@/pages/app/Channels";

export default function SuperAdminChannels() {
  return (
    <Channels
      configureHref="/superadmin/whatsapp/configuracoes"
      diagnosticsHref="/superadmin/whatsapp/diagnostico"
    />
  );
}
