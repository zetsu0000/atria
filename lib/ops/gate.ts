import { redirect } from "next/navigation";
import {
  canUseReviewFixtures,
  requireOperator,
  reviewFixtureOperator,
  type OperatorSession,
} from "@/lib/ops/operator-auth";

export async function requireOperacaoAccess(): Promise<OperatorSession> {
  if (canUseReviewFixtures()) {
    return reviewFixtureOperator();
  }

  const auth = await requireOperator();
  if (!auth.ok) {
    redirect(
      `/operacao/acesso-bloqueado?reason=${encodeURIComponent(auth.reason)}`,
    );
  }
  return auth.operator;
}
