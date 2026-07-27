export const details = {
  builder: "ForgeLabs",
  status: "testnet" as const,
  featured: true,
  categoryLabel: "Social Payments",
  summary:
    "Chrome extension + escrow contract for tipping X handles with USDC on Arc.",
  links: {
    website: "https://xylonet.xyz/payx",
    docs: "https://xylonet.xyz/payx/docs",
    chrome:
      "https://chromewebstore.google.com/detail/payx-tip-on-x/lfnlmagjbpmgjbekebhgnjklpjhnjigi",
    claim: "https://xylonet.xyz/payx/claim",
    spotlight:
      "https://community.arc.io/en/public/videos/event-replay-arc-community-spotlight-social-payments-with-usdc-powered-by-xylonet-and-payx-2026-03-26",
  },
  contracts: {
    tipping: "0xA312c384770B7b49E371DF4b7AF730EFEF465913",
  },
  sources: ["Arc blog", "Chrome Web Store", "ArcScan"],
};
