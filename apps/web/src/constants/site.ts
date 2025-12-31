export const SITE_URL = "https://opencut.app";

export const SITE_INFO = {
  title: "Hue Lightshow",
  description:
    "A synchronized light show creator for Philips Hue. Based on OpenCut.",
  url: SITE_URL,
  openGraphImage: "/open-graph/default.jpg",
  twitterImage: "/open-graph/default.jpg",
  favicon: "/favicon.ico",
};

export const EXTERNAL_TOOLS = [
  {
    name: "Marble",
    description:
      "Modern headless CMS for content management and the blog for Hue Lightshow",
    url: "https://marblecms.com?utm_source=hue-lightshow",
    icon: "MarbleIcon" as const,
  },
  {
    name: "Vercel",
    description: "Platform where we deploy and host Hue Lightshow",
    url: "https://vercel.com?utm_source=hue-lightshow",
    icon: "VercelIcon" as const,
  },
  {
    name: "Databuddy",
    description: "GDPR compliant analytics and user insights for Hue Lightshow",
    url: "https://databuddy.cc?utm_source=hue-lightshow",
    icon: "DataBuddyIcon" as const,
  },
];
