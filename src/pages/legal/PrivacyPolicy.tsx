import { LegalLayout } from "./LegalLayout";

const PrivacyPolicy = () => (
  <LegalLayout title="Política de Privacidade" updatedAt="11 de novembro de 2025">
    <p>
      Esta Política de Privacidade descreve como a plataforma <strong>Chagas Cuidado Digital</strong> coleta,
      utiliza, armazena, compartilha e protege os dados pessoais tratados durante a prestação do serviço,
      em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).
    </p>

    <h2>1. Responsável pelo tratamento dos dados</h2>
    <p>
      O responsável (controlador) pelo tratamento dos dados pessoais coletados nesta plataforma é o
      profissional de saúde ou instituição que contrata e utiliza o Chagas Cuidado Digital para se comunicar
      com seus pacientes. A plataforma atua como operadora, tratando dados em nome do responsável.
    </p>
    <p>
      Para questões relacionadas à privacidade, entre em contato pelo e-mail:{" "}
      <a href="mailto:privacidade@chagascuidadodigital.com.br">privacidade@chagascuidadodigital.com.br</a>.
    </p>

    <h2>2. Dados coletados</h2>
    <p>Durante o uso da plataforma, são tratados os seguintes dados:</p>
    <h3>Dados de usuários profissionais</h3>
    <ul>
      <li>Nome completo e e-mail (cadastro e autenticação);</li>
      <li>Dados de perfil profissional informados voluntariamente;</li>
      <li>Registros de acesso, logs de autenticação e atividade no sistema.</li>
    </ul>
    <h3>Dados de pacientes cadastrados pelos profissionais</h3>
    <ul>
      <li>Nome, telefone (WhatsApp), endereço (incluindo CEP);</li>
      <li>Informações clínicas e de acompanhamento inseridas pelo profissional, como histórico, segmentação e anotações;</li>
      <li>Mensagens enviadas e recebidas via WhatsApp, incluindo conteúdo, data, horário e status de entrega.</li>
    </ul>

    <h2>3. Dados pessoais sensíveis</h2>
    <p>
      Por se tratar de uma plataforma voltada ao cuidado da Doença de Chagas, é possível que sejam tratados
      <strong> dados pessoais sensíveis</strong> relacionados à saúde dos pacientes, como diagnóstico, estágio
      clínico, sintomas, medicações em uso e demais informações inseridas pelo profissional. Esses dados são
      tratados exclusivamente para as finalidades descritas nesta política e com base nas hipóteses legais
      previstas no art. 11 da LGPD, em especial a tutela da saúde e o consentimento, quando aplicável.
    </p>

    <h2>4. Finalidades do tratamento</h2>
    <ul>
      <li>Permitir o cadastro e a gestão de pacientes pelos profissionais de saúde;</li>
      <li>Viabilizar o envio de mensagens educativas, lembretes e conteúdos de acompanhamento via WhatsApp;</li>
      <li>Organizar pacientes em segmentos e campanhas para comunicação dirigida;</li>
      <li>Gerar relatórios de uso, engajamento e desempenho das comunicações;</li>
      <li>Cumprir obrigações legais e regulatórias aplicáveis.</li>
    </ul>

    <h2>5. Comunicação por WhatsApp</h2>
    <p>
      A plataforma envia mensagens aos pacientes por meio do WhatsApp, utilizando o número configurado pelo
      profissional responsável. As mensagens podem incluir conteúdos educativos, lembretes, materiais de
      acompanhamento e respostas a interações iniciadas pelo paciente.
    </p>
    <p>
      O paciente pode, a qualquer momento, solicitar a interrupção do envio de mensagens, respondendo
      diretamente ao profissional responsável ou utilizando os canais de contato indicados nesta política.
    </p>

    <h2>6. Uso da Meta WhatsApp Cloud API</h2>
    <p>
      O envio e o recebimento de mensagens é realizado por meio da <strong>Meta WhatsApp Cloud API</strong>,
      fornecida pela Meta Platforms, Inc. Ao utilizar a plataforma, os dados necessários para a entrega das
      mensagens (como número de telefone e conteúdo enviado) são processados pela infraestrutura da Meta,
      conforme as políticas próprias do WhatsApp e da Meta.
    </p>
    <p>
      Recomendamos a leitura da{" "}
      <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noreferrer">
        Política de Privacidade do WhatsApp
      </a>{" "}
      e dos{" "}
      <a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noreferrer">
        Termos Comerciais do WhatsApp Business
      </a>.
    </p>

    <h2>7. Fornecedores e subprocessadores</h2>
    <p>A plataforma se apoia nos seguintes fornecedores para operar:</p>
    <ul>
      <li>
        <strong>Supabase</strong> – serviço de banco de dados, autenticação, armazenamento e funções de
        backend. Os dados ficam hospedados na infraestrutura do Supabase, protegidos por mecanismos de
        controle de acesso e criptografia em trânsito e em repouso.
      </li>
      <li>
        <strong>Meta Platforms (WhatsApp Cloud API)</strong> – envio e recebimento de mensagens.
      </li>
      <li>
        <strong>Lovable</strong> – hospedagem e entrega da aplicação web.
      </li>
    </ul>
    <p>
      Esses fornecedores tratam dados pessoais apenas para viabilizar o funcionamento da plataforma e nos
      limites das instruções recebidas.
    </p>

    <h2>8. Segurança</h2>
    <p>Adotamos medidas técnicas e organizacionais para proteger os dados, entre elas:</p>
    <ul>
      <li>Autenticação obrigatória para acesso à plataforma;</li>
      <li>Controle de acesso baseado em papéis e em políticas de segurança a nível de banco (Row Level Security);</li>
      <li>Criptografia das comunicações em trânsito (HTTPS/TLS);</li>
      <li>Armazenamento de segredos sensíveis em cofres protegidos, separados do código-fonte;</li>
      <li>Registros de acesso e atividade para auditoria.</li>
    </ul>
    <p>
      Apesar dos esforços, nenhum sistema é totalmente imune a incidentes. Em caso de incidente de segurança
      relevante, os titulares e a ANPD serão comunicados nos termos da LGPD.
    </p>

    <h2>9. Retenção e exclusão</h2>
    <p>
      Os dados pessoais são mantidos enquanto a conta do profissional estiver ativa ou enquanto forem
      necessários para as finalidades descritas. O profissional responsável pode excluir pacientes,
      mensagens e conteúdos diretamente na plataforma.
    </p>
    <p>
      Determinados dados podem ser mantidos por prazos superiores quando houver obrigação legal, regulatória
      ou para o exercício regular de direitos em processos judiciais e administrativos.
    </p>
    <p>
      Para solicitar a exclusão completa de dados, consulte a página{" "}
      <a href="/exclusao-de-dados">Exclusão de Dados</a>.
    </p>

    <h2>10. Direitos do titular</h2>
    <p>Nos termos da LGPD, o titular dos dados pode solicitar:</p>
    <ul>
      <li>Confirmação da existência de tratamento;</li>
      <li>Acesso aos seus dados;</li>
      <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
      <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
      <li>Portabilidade dos dados, observados os segredos comerciais e industriais;</li>
      <li>Eliminação dos dados tratados com base no consentimento;</li>
      <li>Informação sobre compartilhamentos realizados;</li>
      <li>Revogação do consentimento.</li>
    </ul>

    <h2>11. Canal de contato</h2>
    <p>
      Dúvidas, solicitações ou reclamações relacionadas a esta Política de Privacidade podem ser enviadas
      para: <a href="mailto:privacidade@chagascuidadodigital.com.br">privacidade@chagascuidadodigital.com.br</a>.
    </p>

    <h2>12. Atualizações</h2>
    <p>
      Esta política pode ser atualizada periodicamente. A data da última atualização é informada no início
      desta página. Alterações relevantes serão comunicadas pelos canais habituais.
    </p>
  </LegalLayout>
);

export default PrivacyPolicy;