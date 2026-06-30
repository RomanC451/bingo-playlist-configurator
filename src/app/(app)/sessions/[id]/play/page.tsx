import { PlaySessionContent } from "./PlaySessionContent";

type PageProps = { params: Promise<{ id: string }> };

export default async function PlaySessionPage({ params }: PageProps) {
  const { id } = await params;

  return <PlaySessionContent sessionId={id} />;
}
