export const PAIR_GROUPS = [
  {
    label: "USD Pairs",
    options: ["USDJPY", "USDCHF", "USDCAD"],
  },
  {
    label: "GBP Pairs",
    options: ["GBPUSD", "GBPJPY", "GBPNZD", "GBPAUD", "GBPCAD", "GBPCHF"],
  },
  {
    label: "EUR Pairs",
    options: ["EURUSD", "EURGBP", "EURJPY", "EURCAD", "EURNZD", "EURCHF", "EURAUD"],
  },
  {
    label: "Others Pairs",
    options: ["AUDUSD", "AUDCHF", "AUDCAD", "AUDJPY", "AUDNZD", "NZDUSD", "NZDCHF", "NZDCAD", "CADCHF", "CADJPY", "NZDJPY"],
  },
] as const;

export const DEFAULT_PAIR = PAIR_GROUPS[0]?.options[0] ?? "EURUSD";
