import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "Condições resumidas para uso do site da Atria e envio de solicitações de prévia.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Termos de uso"
      description="Estas condições descrevem o uso do site institucional da Atria e do formulário de solicitação de prévia."
    >
      <section aria-labelledby="termos-servico">
        <h2 id="termos-servico">Sobre a Atria</h2>
        <p>
          A Atria oferece modernização digital done-for-you para sites de
          clínicas, com prévia antes da publicação e cuidado da parte técnica.
          A Atria não presta atendimento médico e não opera como clínica.
        </p>
        <ul>
          <li>
            <strong>Entidade responsável:</strong>{" "}
            <span className="legal-placeholder">[A CONFIRMAR]</span>
          </li>
          <li>
            <strong>Registro:</strong>{" "}
            <span className="legal-placeholder">[A CONFIRMAR]</span>
          </li>
          <li>
            <strong>Endereço:</strong>{" "}
            <span className="legal-placeholder">[A CONFIRMAR]</span>
          </li>
          <li>
            <strong>Domínio de produção:</strong>{" "}
            <span className="legal-placeholder">[A CONFIRMAR]</span>
          </li>
          <li>
            <strong>Contato:</strong>{" "}
            <span className="legal-placeholder">[A CONFIRMAR]</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="termos-previa">
        <h2 id="termos-previa">Solicitação de prévia</h2>
        <p>
          Enviar o formulário não cria contrato de prestação de serviço, não
          garante aceitação do projeto e não autoriza alteração do site atual
          da clínica. A publicação de qualquer proposta ocorre somente após
          aprovação explícita em fluxo próprio.
        </p>
      </section>

      <section aria-labelledby="termos-conteudo">
        <h2 id="termos-conteudo">Conteúdo enviado</h2>
        <p>
          Você declara que as informações enviadas são verdadeiras na medida do
          seu conhecimento e que possui autorização para solicitar a análise do
          site informado. Não envie dados de pacientes ou informações sensíveis
          de saúde.
        </p>
      </section>

      <section aria-labelledby="termos-demonstracao">
        <h2 id="termos-demonstracao">Demonstrações</h2>
        <p>
          Páginas como a prévia da Clínica Aurora são demonstrações fictícias
          do formato de entrega da Atria. Não representam clínicas reais nem
          resultados prometidos.
        </p>
      </section>

      <section aria-labelledby="termos-uso">
        <h2 id="termos-uso">Uso aceitável</h2>
        <p>
          É proibido usar o site ou o formulário para abuso, spam, engenharia
          social, coleta automatizada indevida ou qualquer tentativa de
          comprometer a segurança do serviço.
        </p>
      </section>

      <section aria-labelledby="termos-limitacao">
        <h2 id="termos-limitacao">Limitação</h2>
        <p>
          O site é fornecido para informação comercial e solicitação de
          contato. Na extensão permitida pela lei aplicável, a Atria não
          garante disponibilidade ininterrupta nem resultados clínicos,
          financeiros ou de aquisição de pacientes.
        </p>
      </section>

      <section aria-labelledby="termos-atualizacao">
        <h2 id="termos-atualizacao">Atualizações</h2>
        <p>
          Estes termos podem ser atualizados. A versão publicada no site
          prevalece a partir da data de publicação. Revisão jurídica
          qualificada é obrigatória antes do lançamento público.
        </p>
      </section>
    </LegalShell>
  );
}
