import { PageHeader, PageBody } from "@/components/page-header";
import { getClientSettings } from "@/lib/settings";
import { GEMINI_MODELS } from "@/lib/gemini";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getClientSettings();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure the Gemini AI provider, Ghost publishing, agent behavior, and hero image style."
      />
      <PageBody className="max-w-3xl">
        <SettingsForm initial={settings} models={GEMINI_MODELS} />
      </PageBody>
    </>
  );
}
