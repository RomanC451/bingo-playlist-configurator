import { ClipGuessContent } from "./ClipGuessContent";
import { ClipGuessTutorialShell } from "./ClipGuessTutorialShell";

type PageProps = { params: Promise<{ shareToken: string }> };

export default async function ClipGuessPage({ params }: PageProps) {
  const { shareToken } = await params;
  return (
    <ClipGuessTutorialShell>
      <ClipGuessContent shareToken={shareToken} />
    </ClipGuessTutorialShell>
  );
}
