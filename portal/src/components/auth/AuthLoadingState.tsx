import { PageLoadOverlay } from "@/components/common/PageLoadOverlay";

type AuthLoadingStateProps = {
  message?: string;
};

/** État de chargement plein écran pour pages auth et guards. */
export function AuthLoadingState({
  message = "Chargement…",
}: AuthLoadingStateProps) {
  return <PageLoadOverlay message={message} />;
}
