---
id: 0005
titulo: Separar identidade, conversa e pessoa no WhatsApp
status: aceito
data: 2026-07-08
decisores: [equipe-do-projeto]
substitui: null
---

## Contexto

Telefone não é uma chave confiável de paciente: pode mudar, ser compartilhado,
aparecer com variantes e pertencer a contato da rede de cuidado. Mensagens
inbound também podem chegar antes de qualquer vínculo cadastral. A operação do
WhatsApp possui ainda `wa_id`, opt-in, janela de atendimento e estado de
conversa, conceitos que não pertencem diretamente a `patients`.

O schema atual separa `whatsapp_identities`, `whatsapp_conversations`,
`messages`, `patients` e `contacts`.

## Decisão

Mantemos quatro conceitos distintos:

1. **Paciente/contato:** pessoa e vínculo de cuidado.
2. **Identidade WhatsApp:** endereço institucional de mensageria.
3. **Conversa WhatsApp:** contexto operacional e janela de atendimento.
4. **Mensagem:** evento inbound/outbound com status e conteúdo.

A resolução de identidade sempre considera instituição. Mensagem de remetente
desconhecido pode existir antes do vínculo, sem criar automaticamente paciente.

## Alternativas consideradas

### Telefone direto em paciente/contato

- **Prós:** modelo simples e menos tabelas.
- **Contras:** não trata compartilhamento, `wa_id`, opt-in, desconhecidos,
  múltiplas conversas ou histórico de troca.
- **Por que não foi escolhida:** alto risco de atribuição incorreta e vazamento.

### Contato genérico único para CRM e mensageria

- **Prós:** unificação de identidade.
- **Contras:** mistura pessoa, papel no cuidado, endereço e conversa; difícil
  expressar um telefone compartilhado.
- **Por que não foi escolhida:** perde distinções essenciais do domínio.

### Conversa como par paciente-canal

- **Prós:** chave conceitual simples.
- **Contras:** inbound desconhecido, contato cuidador e mudança de telefone não
  cabem no modelo.
- **Por que não foi escolhida:** o provedor conversa com uma identidade, não
  necessariamente com paciente já conhecido.

## Consequências

### Positivas

- resolução e auditoria melhores;
- suporte a remetente desconhecido;
- opt-in/out por identidade;
- janela de atendimento desacoplada do cadastro;
- menor risco de usar telefone como identificador global.

### Negativas / trade-offs

- joins e reconciliação mais complexos;
- duplicidades de identidade precisam de merge;
- autorização aparece tanto no contato quanto na identidade;
- UI precisa explicar vínculo e conflitos;
- mensagens podem ter campos nullable durante resolução.

## Invariantes

- identidade pertence a uma instituição;
- `recipient_type` é compatível com paciente/contato vinculado;
- vínculo ambíguo não é escolhido silenciosamente;
- opt-out não é revertido por recadastro;
- conversa referencia identidade;
- janela não equivale a autorização;
- mensagem preserva external ID para deduplicação/reconciliação.

## Dívidas conhecidas

- regra para telefone compartilhado;
- merge de variantes/duplicidades;
- precedência entre autorização de `contacts` e opt-in da identidade;
- política de vínculo de inbound desconhecido;
- matriz de conteúdo permitido por destinatário.

## Impacto em outros documentos

- `docs/domain/glossary.md`;
- `docs/domain/consent-and-privacy.md`;
- `docs/architecture.md`;
- `docs/risks.md`, R-002 a R-005.