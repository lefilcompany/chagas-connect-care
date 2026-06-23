import { LegalLayout } from "./LegalLayout";

const TermsOfUse = () => (
  <LegalLayout title="Termos de Uso" updatedAt="11 de novembro de 2025">
    <p>
      Estes Termos de Uso regulam o acesso e o uso da plataforma <strong>Chagas Cuidado Digital</strong>.
      Ao utilizar a plataforma, o usuário declara ter lido, compreendido e aceitado integralmente estes
      termos e a Política de Privacidade.
    </p>

    <h2>1. Finalidade da plataforma</h2>
    <p>
      O Chagas Cuidado Digital é uma ferramenta voltada a profissionais e instituições de saúde para apoiar
      a comunicação contínua com pacientes acompanhados em razão da Doença de Chagas. A plataforma permite
      cadastro de pacientes, segmentação, envio de mensagens educativas e lembretes por WhatsApp, gestão de
      conteúdos e geração de relatórios.
    </p>

    <h2>2. Quem pode utilizar</h2>
    <p>
      A plataforma destina-se exclusivamente a profissionais de saúde habilitados, equipes assistenciais e
      instituições de saúde que atuem no acompanhamento de pacientes. O usuário declara ter capacidade
      legal e habilitação profissional para tratar dos pacientes que cadastra.
    </p>

    <h2>3. Responsabilidade dos profissionais e instituições</h2>
    <ul>
      <li>O profissional é o responsável pelo conteúdo das mensagens enviadas e pelas informações registradas;</li>
      <li>É de responsabilidade do profissional obter o consentimento dos pacientes para o envio de mensagens por WhatsApp, quando aplicável;</li>
      <li>É vedado utilizar a plataforma para o envio de spam, conteúdos enganosos, ofensivos, discriminatórios ou em desacordo com as políticas do WhatsApp;</li>
      <li>O profissional deve manter suas credenciais de acesso em sigilo, respondendo pelas ações praticadas em sua conta.</li>
    </ul>

    <h2>4. Limites do sistema</h2>
    <p>
      A plataforma é uma ferramenta de apoio à comunicação e gestão de pacientes. <strong>Não substitui
      consulta médica, avaliação clínica presencial, prontuário eletrônico oficial ou prescrição
      médica.</strong> As decisões clínicas continuam sendo de responsabilidade exclusiva do profissional
      de saúde.
    </p>

    <h2>5. Proibição de uso emergencial</h2>
    <p>
      <strong>
        O WhatsApp e a plataforma Chagas Cuidado Digital não devem ser utilizados para atendimento de
        urgência ou emergência médica.
      </strong>{" "}
      As mensagens podem não ser lidas ou respondidas imediatamente. Em situações de emergência, o paciente
      deve procurar atendimento presencial ou ligar para serviços oficiais como SAMU (192) e Bombeiros (193).
    </p>

    <h2>6. Regras de acesso</h2>
    <ul>
      <li>O acesso é realizado mediante cadastro e autenticação;</li>
      <li>O usuário deve fornecer informações verdadeiras e mantê-las atualizadas;</li>
      <li>É proibido tentar burlar mecanismos de segurança, acessar áreas restritas ou utilizar a plataforma para fins ilícitos;</li>
      <li>A plataforma pode suspender ou encerrar contas que violem estes termos.</li>
    </ul>

    <h2>7. Disponibilidade e manutenção</h2>
    <p>
      Envidamos esforços para manter a plataforma disponível de forma contínua, mas podem ocorrer
      interrupções programadas para manutenção, atualizações ou em razão de falhas em serviços de
      terceiros (como a Meta WhatsApp Cloud API e o Supabase). Não garantimos disponibilidade ininterrupta
      nem entrega instantânea de mensagens.
    </p>

    <h2>8. Privacidade</h2>
    <p>
      O tratamento de dados pessoais realizado pela plataforma é descrito na{" "}
      <a href="/politica-de-privacidade">Política de Privacidade</a>, que é parte integrante destes Termos.
    </p>

    <h2>9. Propriedade intelectual</h2>
    <p>
      A marca, o logotipo, o código-fonte, a interface e os demais elementos da plataforma são protegidos
      por direitos de propriedade intelectual. É vedada a reprodução, modificação ou distribuição sem
      autorização prévia e por escrito.
    </p>

    <h2>10. Contato</h2>
    <p>
      Dúvidas sobre estes Termos podem ser enviadas para:{" "}
      <a href="mailto:contato@chagascuidadodigital.com.br">contato@chagascuidadodigital.com.br</a>.
    </p>

    <h2>11. Atualizações dos termos</h2>
    <p>
      Estes Termos podem ser atualizados a qualquer momento. A versão vigente é sempre a publicada nesta
      página, com a respectiva data de atualização. O uso continuado da plataforma após alterações implica
      concordância com a nova versão.
    </p>
  </LegalLayout>
);

export default TermsOfUse;