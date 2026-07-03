import { ClipGuessContent } from "./ClipGuessContent";

type PageProps = { params: Promise<{ shareToken: string }> };

export default async function ClipGuessPage({ params }: PageProps) {
  const { shareToken } = await params;
  return <ClipGuessContent shareToken={shareToken} />;
}
