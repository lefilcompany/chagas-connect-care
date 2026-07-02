## Objetivo
Garantir que o texto de **todos os botões** fique na cor `#4A504A` (verde-acinzentado da marca) no estado `:hover`, sem quebrar leitura ou inconsistir com o design system.

## O que será feito

1. **Token de hover para botões**
   - Adicionar `--button-hover-foreground` em `src/index.css`, apontando para o token `--brand` (`#4A504A`).
   - Isso evita cores hardcoded e mantém consistência caso a marca mude no futuro.

2. **Atualizar o componente base `Button`**
   - Inserir `hover:text-[hsl(var(--button-hover-foreground))]` na classe base do `buttonVariants` em `src/components/ui/button.tsx`.
   - Ajustar cada variante (`default`, `hero`, `outline`, `outlineBrand`, `outlineLight`, `secondary`, `ghost`, `link`, `destructive`) para que o texto no hover use esse token.
   - Onde o hover text for herdado naturalmente do token base, mantê-lo; onde a variante definir `hover:text-*` explicitamente, sobrescrever para o token de hover.

3. **Preservar contraste**
   - Para botões de fundo escuro no hover (ex.: `secondary`), ajustar o fundo do hover para uma superfície clara (`primary/30` ou `muted`) de forma que o texto `#4A504A` continue legível.
   - Para botões já claros no hover (ghost/outline), apenas trocar a cor do texto.

4. **Remover overrides manuais dispersos**
   - Buscar usos de `<Button ...>` com classes inline como `hover:text-?` no Header e demais páginas.
   - Substituir por variantes padrão ou pelos tokens semânticos, evitando conflito com a nova regra.

5. **Verificação**
   - Rodar typecheck e build para garantir que não haja erros de classe inválida.
   - Validar visualmente no preview os principais botões: "Entrar", "Cadastre-se agora", primários e outline.

## Resultado esperado
- Todo botão, ao passar o mouse, exibe texto na cor `#4A504A`.
- Nenhum botão fica ilegível por falta de contraste.
- Sem quebra de build ou classes hardcoded fora do design system.