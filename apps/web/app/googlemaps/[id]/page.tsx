// Campaign detail — built in Slice 1.10.
export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-screen flex items-center justify-center px-8">
      <div className="text-center">
        <h1 className="text-[32px] font-bold text-ink dark:text-d-ink">
          Campaign Detail
        </h1>
        <p className="text-sm text-mute mt-2">
          Campaign <code>{id}</code> — detail page comes in Slice 1.10.
        </p>
      </div>
    </main>
  );
}
