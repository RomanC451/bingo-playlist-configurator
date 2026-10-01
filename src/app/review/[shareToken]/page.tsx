import { GuestReviewContent } from "./GuestReviewContent";

type PageProps = {
  params: Promise<{ shareToken: string }>;
};

export default async function GuestReviewPage({ params }: PageProps) {
  const { shareToken } = await params;
  return <GuestReviewContent shareToken={shareToken} />;
}
