import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacidade",
  description:
    "Como a Atria trata dados enviados em solicitações de prévia de sites de clínicas.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Aviso de privacidade"
      description="Este aviso explica, de forma resumida, quais dados a Atria recebe quando alguém solicita uma prévia de modernização de site."
    >
      <section aria-labelledby="privacidade-controlador">
        <h2 id="privacidade-controlador">Quem é responsável</h2>
        <p>
          A Atria é um serviço B2B de modernização digital para clínicas. Não
          somos clínica, hospital nem prestador de cuidados de saúde.
        </p>
        <ul>
          <li>
            <strong>Razão social / entidade:</strong>{" "}
            <span className="legal-placeholder">[A CONFIRMAR]</span>
          </li>
          <li>
            <strong>CNPJ / registro:</strong>{" "}
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
            <strong>Contato de privacidade:</strong>{" "}
            <span className="legal-placeholder">[A CONFIRMAR]</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacidade-dados">
        <h2 id="privacidade-dados">Dados que podemos receber</h2>
        <p>
          No formulário de solicitação de prévia, coletamos apenas dados
          necessários para contato comercial e análise do site informado:
        </p>
        <ul>
          <li>nome de contato;</li>
          <li>nome da clínica;</li>
          <li>função;</li>
          <li>cidade/UF;</li>
          <li>URL do site atual;</li>
          <li>e-mail e WhatsApp;</li>
          <li>descrição opcional do que incomoda no site;</li>
          <li>registro de consentimento e horário.</li>
        </ul>
        <p>
          Não solicite e não envie dados de pacientes, diagnósticos, histórico
          clínico, exames, prontuários ou qualquer informação de saúde
          identificável.
        </p>
      </section>

      <section aria-labelledby="privacidade-finalidade">
        <h2 id="privacidade-finalidade">Para que usamos</h2>
        <p>Usamos os dados para:</p>
        <ul>
          <li>avaliar o site informado;</li>
          <li>preparar ou recusar uma prévia;</li>
          <li>retornar o contato sobre esta solicitação;</li>
          <li>prevenir abuso e envios duplicados;</li>
          <li>manter registros operacionais mínimos do atendimento.</li>
        </ul>
        <p>
          Não usamos o formulário como inscrição em newsletter genérica, nem
          como cadastro de pacientes.
        </p>
      </section>

      <section aria-labelledby="privacidade-base">
        <h2 id="privacidade-base">Base e consentimento</h2>
        <p>
          O envio exige consentimento explícito, não pré-marcado, limitado à
          análise do site e ao retorno de contato sobre a solicitação.
        </p>
      </section>

      <section aria-labelledby="privacidade-retencao">
        <h2 id="privacidade-retencao">Retenção</h2>
        <p>
          Prazo de retenção operacional:{" "}
          <span className="legal-placeholder">[A CONFIRMAR]</span>. Dados
          poderão ser removidos ou anonimizados mediante solicitação legítima,
          observados deveres legais aplicáveis.
        </p>
      </section>

      <section aria-labelledby="privacidade-compartilhamento">
        <h2 id="privacidade-compartilhamento">Operadores técnicos</h2>
        <p>
          Para operar o recebimento de solicitações, a Atria pode utilizar
          provedores de infraestrutura (por exemplo hospedagem, banco de dados
          e envio de e-mail interno). Esses provedores processam dados sob
          instrução da Atria e não devem usar o conteúdo para fins próprios.
        </p>
      </section>

      <section aria-labelledby="privacidade-direitos">
        <h2 id="privacidade-direitos">Seus direitos</h2>
        <p>
          Você pode solicitar informações, correção ou exclusão dos dados
          enviados pelo canal de privacidade indicado acima, quando
          confirmado. Este aviso não substitui aconselhamento jurídico.
        </p>
      </section>
    </LegalShell>
  );
}
