import { ReviewSessionContent } from "./ReviewSessionContent";

type PageProps = { params: Promise<{ id: string }> };

export default async function ReviewSessionPage({ params }: PageProps) {
  const { id } = await params;

  return <ReviewSessionContent sessionId={id} />;
}
