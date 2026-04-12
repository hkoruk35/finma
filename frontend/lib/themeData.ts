export interface Theme {
  name: string;
  sector: string;
  tickers: string[];
}

export const MARKET_THEMES: Theme[] = [
  // TECHNOLOGY
  {
    name: "Mega-cap Platform & Cloud",
    sector: "Technology",
    tickers: ["AAPL", "MSFT", "GOOGL", "META", "AMZN"]
  },
  {
    name: "Semiconductors & Hardware",
    sector: "Technology",
    tickers: ["NVDA", "AMD", "AVGO", "QCOM", "TXN", "MU", "LRCX", "AMAT", "KLAC", "MRVL", "MCHP", "SWKS", "MPWR", "ON", "WOLF", "SMCI", "ARM", "ADI", "STX", "WDC", "SNDK", "COHR", "LITE"]
  },
  {
    name: "Software & Cloud Applications",
    sector: "Technology",
    tickers: ["ORCL", "CRM", "ADBE", "NOW", "INTU", "WDAY", "TEAM", "ZM", "DDOG", "MDB", "SNOW", "HUBS", "VEEV", "BILL", "GTLB", "TTD", "SMAR", "ZS"]
  },
  {
    name: "Cybersecurity",
    sector: "Technology",
    tickers: ["PANW", "CRWD", "FTNT", "OKTA", "S", "CYBR"]
  },
  {
    name: "AI & Data",
    sector: "Technology",
    tickers: ["PLTR", "MSTR", "IBM", "ANSS", "CDNS", "SNPS"]
  },
  {
    name: "Infrastructure & Networking",
    sector: "Technology",
    tickers: ["CSCO", "NET", "AKAM", "ANET", "JNPR", "NTAP"]
  },
  {
    name: "Hardware & Devices",
    sector: "Technology",
    tickers: ["DELL", "INTC", "TSM", "GLW", "GRMN", "KEYS", "VRT"]
  },

  // COMMUNICATION
  {
    name: "Social & Search",
    sector: "Communication",
    tickers: ["GOOGL", "META"]
  },
  {
    name: "Streaming & Entertainment",
    sector: "Communication",
    tickers: ["NFLX", "DIS", "SPOT", "ROKU", "WBD", "PARA"]
  },
  {
    name: "Telecom",
    sector: "Communication",
    tickers: ["T", "VZ", "TMUS", "CHTR", "CMCSA", "NOK", "ERIC", "VOD", "AMX"]
  },
  {
    name: "Gaming",
    sector: "Communication",
    tickers: ["EA", "TTWO", "RBLX"]
  },
  {
    name: "Interactive & Social Content",
    sector: "Communication",
    tickers: ["SNAP", "PINS", "MTCH", "TKO"]
  },
  {
    name: "Advertising Solutions",
    sector: "Communication",
    tickers: ["OMC"]
  },
  {
    name: "EM Digital Platforms",
    sector: "Communication",
    tickers: ["BIDU"]
  },

  // CONSUMER DISCRETIONARY
  {
    name: "E-commerce & Marketplaces",
    sector: "Consumer Discretionary",
    tickers: ["AMZN", "EBAY", "ETSY", "W", "BABA"]
  },
  {
    name: "Automotive & EV",
    sector: "Consumer Discretionary",
    tickers: ["TSLA", "F", "GM", "RIVN", "LCID"]
  },
  {
    name: "Home Improvement",
    sector: "Consumer Discretionary",
    tickers: ["HD", "LOW", "WSM"]
  },
  {
    name: "Restaurant & Fast Food",
    sector: "Consumer Discretionary",
    tickers: ["MCD", "SBUX", "CMG", "YUM", "QSR", "DPZ", "WEN"]
  },
  {
    name: "Apparel & Footwear",
    sector: "Consumer Discretionary",
    tickers: ["NKE", "LULU", "RL", "PVH", "TPR", "VFC", "UAA"]
  },
  {
    name: "Travel & Leisure",
    sector: "Consumer Discretionary",
    tickers: ["BKNG", "ABNB", "EXPE", "MAR", "HLT", "H", "RCL", "CCL", "NCLH", "LYV", "FUN"]
  },
  {
    name: "Retail Leaders",
    sector: "Consumer Discretionary",
    tickers: ["TJX", "ROST", "FIVE", "DLTR", "DG"]
  },
  {
    name: "Delivery & Gig Economy",
    sector: "Consumer Discretionary",
    tickers: ["UBER", "LYFT", "DASH"]
  },
  {
    name: "Luxury & Lifestyle",
    sector: "Consumer Discretionary",
    tickers: ["TSCO", "SIG", "ANF", "CAVA", "CAR"]
  },

  // CONSUMER STAPLES
  {
    name: "Household & Personal Care",
    sector: "Consumer Staples",
    tickers: ["PG", "CL", "KMB", "CHD"]
  },
  {
    name: "Beverages",
    sector: "Consumer Staples",
    tickers: ["KO", "PEP", "MNST", "STZ", "BF.B"]
  },
  {
    name: "Food & Snacks",
    sector: "Consumer Staples",
    tickers: ["MDLZ", "GIS", "CPB", "HRL", "CAG", "SJM", "K", "HSY", "TSN"]
  },
  {
    name: "Tobacco",
    sector: "Consumer Staples",
    tickers: ["PM", "MO", "BTI"]
  },
  {
    name: "Essential Retail & Wholesale",
    sector: "Consumer Staples",
    tickers: ["WMT", "COST", "TGT", "KR", "SFM"]
  },
  {
    name: "Beauty & Cosmetics",
    sector: "Consumer Staples",
    tickers: ["EL", "ULTA", "COTY"]
  },
  {
    name: "Agriculture & Commodities",
    sector: "Consumer Staples",
    tickers: ["ADM", "BG", "MOS", "CTVA"]
  },
  {
    name: "Food Distribution",
    sector: "Consumer Staples",
    tickers: ["SYY"]
  },

  // HEALTHCARE
  {
    name: "Global Pharmaceuticals",
    sector: "Healthcare",
    tickers: ["LLY", "JNJ", "ABBV", "MRK", "PFE", "BMY", "AMGN", "REGN", "GILD", "BIIB", "VRTX", "ALNY", "MRNA", "EXEL", "AZN", "NVS", "TAK", "TEVA", "BNTX"]
  },
  {
    name: "Medical Devices",
    sector: "Healthcare",
    tickers: ["UNH", "ABT", "MDT", "ISRG", "BSX", "SYK", "EW", "ZBH", "HOLX", "BDX", "BAX", "DXCM", "PODD", "INSP", "NVCR"]
  },
  {
    name: "Diagnostics & Lab Services",
    sector: "Healthcare",
    tickers: ["TMO", "DHR", "A", "IQV", "PKI", "ILMN", "LH", "DGX"]
  },
  {
    name: "Healthcare Insurance & Infrastructure",
    sector: "Healthcare",
    tickers: ["CVS", "CI", "ELV", "HCA", "THC"]
  },
  {
    name: "Animal Health",
    sector: "Healthcare",
    tickers: ["ZTS", "IDEXX"]
  },
  {
    name: "Emerging Biotech",
    sector: "Healthcare",
    tickers: ["SRPT", "RARE", "ACAD"]
  },

  // FINANCIALS
  {
    name: "Global Banking Leaders",
    sector: "Financials",
    tickers: ["JPM", "BAC", "WFC", "C", "USB", "TFC", "PNC", "RY", "TD", "BNS", "CM", "BMO", "HSBC", "ING", "BCS", "SAN", "BBVA", "SMFG", "MUFG", "NWG", "LYG"]
  },
  {
    name: "Asset Management & Investment Banking",
    sector: "Financials",
    tickers: ["GS", "MS", "BLK", "BX", "KKR", "APO", "ARES", "CG", "AMP", "NTRS", "BK"]
  },
  {
    name: "Insurance Services",
    sector: "Financials",
    tickers: ["BRK.B", "AIG", "MET", "PRU", "AFL", "ALL", "CB", "TRV", "HIG", "PUK"]
  },
  {
    name: "Payment Networks & processing",
    sector: "Financials",
    tickers: ["V", "MA", "AXP", "PYPL", "SQ", "FIS", "FISV", "GPN"]
  },
  {
    name: "Brokerage & Exchanges",
    sector: "Financials",
    tickers: ["SCHW", "IBKR", "ICE", "CME", "CBOE", "NDAQ"]
  },
  {
    name: "Fintech & Digital Assets",
    sector: "Financials",
    tickers: ["COIN", "HOOD", "SOFI", "NU"]
  },
  {
    name: "Financial Data & Analytics",
    sector: "Financials",
    tickers: ["MCO", "SPGI", "MSCI"]
  },
  {
    name: "Regional Banking",
    sector: "Financials",
    tickers: ["RF", "HBAN", "CFG", "FITB", "MTB", "KEY"]
  },

  // ENERGY
  {
    name: "Integrated Oil & Gas Majors",
    sector: "Energy",
    tickers: ["XOM", "CVX", "SHEL", "TTE", "BP", "EQNR"]
  },
  {
    name: "Exploration & Production",
    sector: "Energy",
    tickers: ["COP", "EOG", "OXY", "DVN", "FANG", "HES", "APA", "MRO", "MTDR", "CHRD", "CRGY", "EQT", "MUR", "CNQ", "CVE", "SU", "OVV", "PBR", "EC"]
  },
  {
    name: "Oilfield Services",
    sector: "Energy",
    tickers: ["SLB", "HAL", "BKR", "OII"]
  },
  {
    name: "Refining & Marketing",
    sector: "Energy",
    tickers: ["MPC", "VLO", "PSX", "PARR"]
  },
  {
    name: "Pipeline & Midstream",
    sector: "Energy",
    tickers: ["KMI", "WMB", "ET", "EPD", "MPLX", "OKE", "TRGP", "DTM", "KNTK", "ENB", "TRP"]
  },
  {
    name: "LNG & Marine Transport",
    sector: "Energy",
    tickers: ["LNG", "GLNG", "FLNG", "WDS"]
  },
  {
    name: "Offshore Support",
    sector: "Energy",
    tickers: ["VAL", "RIG", "TDW", "AROC"]
  },
  {
    name: "Coal & Uranium",
    sector: "Energy",
    tickers: ["BTU", "ARCH", "CCJ"]
  },

  // MATERIALS
  {
    name: "Base Metals & Copper",
    sector: "Materials",
    tickers: ["FCX", "SCCO", "TECK"]
  },
  {
    name: "Diversified Mining",
    sector: "Materials",
    tickers: ["RIO", "BHP", "VALE", "MT"]
  },
  {
    name: "Precious Metals Mining",
    sector: "Materials",
    tickers: ["NEM", "GOLD", "AEM", "WPM", "RGLD", "FNV", "KGC", "GFI", "AU", "SSRM", "PAAS", "FSM"]
  },
  {
    name: "Battery Metals & Lithium",
    sector: "Materials",
    tickers: ["ALB", "SQM", "LTHM", "SGML"]
  },
  {
    name: "Industrial Gases & Specialty Chemicals",
    sector: "Materials",
    tickers: ["LIN", "APD", "CE", "SHW", "ECL", "PPG", "DD", "DOW", "LYB", "EMN"]
  },
  {
    name: "Agriculture Chemicals",
    sector: "Materials",
    tickers: ["CF", "NTR"]
  },
  {
    name: "Steel & Aluminum",
    sector: "Materials",
    tickers: ["NUE", "STLD", "X", "AA", "CENX"]
  },
  {
    name: "Construction Materials",
    sector: "Materials",
    tickers: ["MLM", "VMC", "CRH", "EXP"]
  },
  {
    name: "Paper & Packaging",
    sector: "Materials",
    tickers: ["IP", "PKG", "WRK"]
  },

  // INDUSTRIALS
  {
    name: "Aerospace & Defense",
    sector: "Industrials",
    tickers: ["BA", "LMT", "RTX", "NOC", "GD", "HII", "TDG", "AXON", "LHX", "KTOS"]
  },
  {
    name: "Engines & Power Generation",
    sector: "Industrials",
    tickers: ["GE", "GEV", "CMI"]
  },
  {
    name: "Industrial High-Tech & Test",
    sector: "Industrials",
    tickers: ["TDY", "AME", "KEYS"]
  },
  {
    name: "Heavy Machinery & Equipment",
    sector: "Industrials",
    tickers: ["CAT", "DE", "EMR", "ETN", "ROK", "PH", "IR", "XYL", "DOV", "HUBB", "HWM", "WAB", "ALSN"]
  },
  {
    name: "Industrial Conglomerates",
    sector: "Industrials",
    tickers: ["HON", "MMM"]
  },
  {
    name: "Transport & Logistics",
    sector: "Industrials",
    tickers: ["UNP", "CSX", "NSC", "CNI", "UPS", "FDX", "ODFL", "PCAR", "CHRW", "EXPD"]
  },
  {
    name: "Airlines",
    sector: "Industrials",
    tickers: ["DAL", "UAL", "AAL", "LUV", "ALK"]
  },
  {
    name: "Industrial Support Services",
    sector: "Industrials",
    tickers: ["WM", "RSG", "CTAS", "ROP", "FAST", "GWW", "ROL", "BR", "VRSK", "DNB"]
  },
  {
    name: "Industrial Construction",
    sector: "Industrials",
    tickers: ["PWR", "FLR", "J", "PRIM", "MTZ", "STRL"]
  },
  {
    name: "Leasing & Rental",
    sector: "Industrials",
    tickers: ["URI", "AL", "AER", "WSC"]
  },

  // UTILITIES
  {
    name: "Regulated Electric Utilities",
    sector: "Utilities",
    tickers: ["NEE", "DUK", "SO", "AEP", "EXC", "PEG", "XEL", "ED", "ES", "WEC", "ETR", "CMS", "DTE", "EVRG", "OGE", "AEE", "ATO", "EIX", "FE", "PPL", "NGG"]
  },
  {
    name: "AI & Clean Power Demand",
    sector: "Utilities",
    tickers: ["VST", "CEG", "NRG", "AES", "BE"]
  },
  {
    name: "Gas & Multi-Utility",
    sector: "Utilities",
    tickers: ["SRE", "PCG", "NI", "OGS", "CNP"]
  },
  {
    name: "Water Infrastructure",
    sector: "Utilities",
    tickers: ["AWK", "WTRG", "CWT", "MSEX"]
  },
  {
    name: "Renewable YieldCo",
    sector: "Utilities",
    tickers: ["CWEN", "AY"]
  },

  // REAL ESTATE
  {
    name: "Diversification REITs",
    sector: "Real Estate",
    tickers: ["PLD", "O", "VICI", "EPRT", "GOOD", "GTY"]
  },
  {
    name: "Data Center & Infrastructure REITs",
    sector: "Real Estate",
    tickers: ["EQIX", "AMT", "DLR", "CCI", "SBAC"]
  },
  {
    name: "Retail & Commercial REITs",
    sector: "Real Estate",
    tickers: ["SPG", "MAC", "KIM", "REG", "FRT", "KRG", "BXP", "VNO"]
  },
  {
    name: "Residential REITs",
    sector: "Real Estate",
    tickers: ["AVB", "EQR", "MAA", "UDR", "CPT", "NMI", "AMH"]
  },
  {
    name: "Healthcare & Storage REITs",
    sector: "Real Estate",
    tickers: ["WELL", "VTR", "HR", "OHI", "PSA", "EXR", "CUBE", "LSI"]
  },
  {
    name: "Specialty & Industrial REITs",
    sector: "Real Estate",
    tickers: ["IRM", "ARE", "CBRE", "HST", "LAMR", "SUI", "RHP", "PEB", "EGP", "FR", "WY", "PCH"]
  },
  {
    name: "Homebuilders",
    sector: "Real Estate",
    tickers: ["DHI"]
  }
];
