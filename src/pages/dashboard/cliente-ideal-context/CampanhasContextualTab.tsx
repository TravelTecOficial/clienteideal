import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleAdsCampaignsSimulator } from "./GoogleAdsCampaignsSimulator";
import { CampanhaPlaceholder } from "./CampanhaPlaceholder";
import { Megaphone, Mail, Linkedin, Video } from "lucide-react";

const CAMPAIGN_TABS = [
  {
    id: "google-ads",
    label: "Google Ads",
    icon: (
      <span className="mr-2 flex h-5 w-5 items-center justify-center rounded bg-[#4285F4] text-white text-xs font-bold">
        G
      </span>
    ),
    content: <GoogleAdsCampaignsSimulator />,
  },
  {
    id: "meta-ads",
    label: "Meta Ads",
    icon: <Megaphone className="mr-2 h-4 w-4" />,
    content: (
      <CampanhaPlaceholder
        title="Meta Ads"
        description="Campanhas do Facebook e Instagram. Conecte o Meta Ads em Configurações quando disponível."
        icon={Megaphone}
        iconBgClass="bg-[#1877F2]/20"
      />
    ),
  },
  {
    id: "linkedin-ads",
    label: "LinkedIn Ads",
    icon: <Linkedin className="mr-2 h-4 w-4" />,
    content: (
      <CampanhaPlaceholder
        title="LinkedIn Ads"
        description="Campanhas B2B no LinkedIn. Conecte o LinkedIn Ads em Configurações quando disponível."
        icon={Linkedin}
        iconBgClass="bg-[#0A66C2]/20"
      />
    ),
  },
  {
    id: "tiktok-ads",
    label: "TikTok Ads",
    icon: <Video className="mr-2 h-4 w-4" />,
    content: (
      <CampanhaPlaceholder
        title="TikTok Ads"
        description="Campanhas no TikTok. Conecte o TikTok Ads em Configurações quando disponível."
        icon={Video}
        iconBgClass="bg-muted"
      />
    ),
  },
  {
    id: "email-marketing",
    label: "Email Marketing",
    icon: <Mail className="mr-2 h-4 w-4" />,
    content: (
      <CampanhaPlaceholder
        title="Email Marketing"
        description="Campanhas de email. Conecte sua plataforma de email em Configurações quando disponível."
        icon={Mail}
        iconBgClass="bg-muted"
      />
    ),
  },
] as const;

export function CampanhasContextualTab() {
  return (
    <Tabs defaultValue="google-ads" className="w-full">
      <TabsList className="mb-4 flex h-auto flex-wrap gap-1 bg-transparent p-0">
        {CAMPAIGN_TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="data-[state=active]:bg-muted data-[state=active]:text-foreground"
          >
            {tab.icon}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {CAMPAIGN_TABS.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-0">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
