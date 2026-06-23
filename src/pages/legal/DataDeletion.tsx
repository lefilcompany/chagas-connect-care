import { LegalLayout } from "./LegalLayout";

const DataDeletion = () => (
  <LegalLayout title="Exclusão de Dados" updatedAt="11 de novembro de 2025">
    <p>
      Esta página explica como titulares de dados (pacientes e usuários profissionais) podem solicitar a
      exclusão de seus dados pessoais tratados na plataforma <strong>Chagas Cuidado Digital</strong>.
    </p>

    <h2>1. Como solicitar a exclusão</h2>
    <p>
      A solicitação deve ser enviada por e-mail para:{" "}
      <a href="mailto:privacidade@chagascuidadodigital.com.br">
        privacidade@chagascuidadodigital.com.br
      </a>
      , com o assunto <em>"Solicitação de exclusão de dados"</em>.
    </p>
    <p>
      Pacientes também podem solicitar a exclusão diretamente ao profissional de saúde responsável pelo
      seu acompanhamento, que poderá removê-lo da plataforma.
    </p>

    <h2>2. Informações necessárias para identificação</h2>
    <p>Para que possamos localizar e validar a solicitação, informe:</p>
    <ul>
      <li>Nome completo;</li>
      <li>E-mail e/ou número de telefone (WhatsApp) utilizado no cadastro;</li>
      <li>Se for paciente: nome do profissional ou instituição responsável pelo seu acompanhamento, se souber;</li>
      <li>Descrição da solicitação (exclusão total, exclusão de dados específicos, interrupção do envio de mensagens etc.).</li>
    </ul>
    <p>
      Poderão ser solicitadas informações adicionais para confirmar a identidade do solicitante e evitar
      exclusões indevidas.
    </p>

    <h2>3. Prazo estimado de resposta</h2>
    <p>
      As solicitações são analisadas em até <strong>15 (quinze) dias</strong> a contar do recebimento
      completo das informações necessárias, podendo ser estendido em casos de maior complexidade, mediante
      justificativa.
    </p>

    <h2>4. Dados que podem ser retidos</h2>
    <p>
      Determinados dados podem precisar ser mantidos mesmo após a solicitação de exclusão, quando houver:
    </p>
    <ul>
      <li>Obrigação legal ou regulatória de guarda (por exemplo, normas sanitárias e de registros profissionais);</li>
      <li>Necessidade para o exercício regular de direitos em processos judiciais, administrativos ou arbitrais;</li>
      <li>Registros mínimos de auditoria e segurança da informação.</li>
    </ul>
    <p>
      Nesses casos, os dados retidos serão tratados apenas para a finalidade que justifica a retenção e
      protegidos por medidas de segurança adequadas.
    </p>

    <h2>5. Como será informada a conclusão</h2>
    <p>
      Após o tratamento da solicitação, o titular será comunicado por e-mail (ou por outro canal indicado
      na solicitação) sobre:
    </p>
    <ul>
      <li>A conclusão da exclusão;</li>
      <li>Os dados eventualmente retidos e a base legal correspondente;</li>
      <li>Eventuais impedimentos ou pedidos de informação complementar.</li>
    </ul>

    <h2>6. Outras informações</h2>
    <p>
      Para mais detalhes sobre o tratamento de dados, consulte a{" "}
      <a href="/politica-de-privacidade">Política de Privacidade</a> e os{" "}
      <a href="/termos-de-uso">Termos de Uso</a>.
    </p>
  </LegalLayout>
);

export default DataDeletion;