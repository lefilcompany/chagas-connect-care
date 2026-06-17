import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function formatCep(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

type Props = {
  defaultCep?: string;
  defaultAddress?: string;
  defaultCity?: string;
  defaultState?: string;
};

export function CepAddressFields({ defaultCep = "", defaultAddress = "", defaultCity = "", defaultState = "" }: Props) {
  const [cep, setCep] = useState(defaultCep);
  const [address, setAddress] = useState(defaultAddress);
  const [city, setCity] = useState(defaultCity);
  const [stateUf, setStateUf] = useState(defaultState);
  const [loading, setLoading] = useState(false);

  async function lookup(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      setAddress([data.logradouro, data.bairro].filter(Boolean).join(", "));
      setCity(data.localidade || "");
      setStateUf((data.uf || "").toUpperCase());
    } catch {
      toast.error("Não foi possível buscar o CEP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_120px] gap-3">
        <div className="space-y-2">
          <Label>CEP</Label>
          <div className="relative">
            <Input
              name="cep"
              placeholder="00000-000"
              value={cep}
              maxLength={9}
              onChange={(e) => {
                const v = formatCep(e.target.value);
                setCep(v);
                const digits = v.replace(/\D/g, "");
                if (digits.length === 8) {
                  lookup(v);
                } else if (digits.length === 0) {
                  setAddress("");
                  setCity("");
                  setStateUf("");
                }
              }}
              onBlur={(e) => lookup(e.target.value)}
            />
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input name="city" placeholder="Ex: Recife" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Input
            name="state"
            placeholder="SP"
            maxLength={2}
            className="uppercase"
            value={stateUf}
            onChange={(e) => setStateUf(e.target.value.toUpperCase())}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Endereço</Label>
        <Input
          name="address"
          placeholder="Rua, número, complemento"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
    </>
  );
}