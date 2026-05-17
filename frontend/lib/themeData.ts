export interface Theme {
  name: string;
  sector: string;
  tickers: string[];
}

export const MARKET_THEMES: Theme[] = [
  {
    "name": "Mega-cap Platform & Cloud",
    "sector": "Technology",
    "tickers": [
      "AAPL",
      "MSFT",
      "GOOGL",
      "META",
      "AMZN"
    ]
  },
  {
    "name": "Semiconductors & Hardware",
    "sector": "Technology",
    "tickers": [
      "NVDA",
      "AMD",
      "AVGO",
      "QCOM",
      "TXN",
      "MU",
      "LRCX",
      "AMAT",
      "KLAC",
      "MRVL",
      "MCHP",
      "SWKS",
      "MPWR",
      "ON",
      "WOLF",
      "SMCI",
      "ARM",
      "ADI",
      "STX",
      "WDC",
      "SNDK",
      "COHR",
      "LITE"
    ]
  },
  {
    "name": "Software & Cloud Applications",
    "sector": "Technology",
    "tickers": [
      "ORCL",
      "CRM",
      "ADBE",
      "NOW",
      "INTU",
      "WDAY",
      "TEAM",
      "ZM",
      "DDOG",
      "MDB",
      "SNOW",
      "HUBS",
      "VEEV",
      "BILL",
      "GTLB",
      "TTD",
      "SMAR",
      "ZS"
    ]
  },
  {
    "name": "Cybersecurity",
    "sector": "Technology",
    "tickers": [
      "PANW",
      "CRWD",
      "FTNT",
      "OKTA",
      "S",
      "CYBR"
    ]
  },
  {
    "name": "AI & Data",
    "sector": "Technology",
    "tickers": [
      "PLTR",
      "MSTR",
      "IBM",
      "ANSS",
      "CDNS",
      "SNPS"
    ]
  },
  {
    "name": "Infrastructure & Networking",
    "sector": "Technology",
    "tickers": [
      "CSCO",
      "NET",
      "AKAM",
      "ANET",
      "JNPR",
      "NTAP"
    ]
  },
  {
    "name": "Hardware & Devices",
    "sector": "Technology",
    "tickers": [
      "DELL",
      "INTC",
      "TSM",
      "GLW",
      "GRMN",
      "KEYS",
      "VRT"
    ]
  },
  {
    "name": "Technology",
    "sector": "Sectors",
    "tickers": [
      "AAPL",
      "MSFT",
      "GOOGL",
      "META",
      "AMZN",
      "NVDA",
      "AMD",
      "AVGO",
      "QCOM",
      "TXN",
      "MU",
      "LRCX",
      "AMAT",
      "KLAC",
      "MRVL",
      "MCHP",
      "SWKS",
      "MPWR",
      "ON",
      "WOLF",
      "SMCI",
      "ARM",
      "ADI",
      "STX",
      "WDC",
      "SNDK",
      "COHR",
      "LITE",
      "ORCL",
      "CRM",
      "ADBE",
      "NOW",
      "INTU",
      "WDAY",
      "TEAM",
      "ZM",
      "DDOG",
      "MDB",
      "SNOW",
      "HUBS",
      "VEEV",
      "BILL",
      "GTLB",
      "TTD",
      "SMAR",
      "ZS",
      "PANW",
      "CRWD",
      "FTNT",
      "OKTA",
      "S",
      "CYBR",
      "PLTR",
      "MSTR",
      "IBM",
      "ANSS",
      "CDNS",
      "SNPS",
      "CSCO",
      "NET",
      "AKAM",
      "ANET",
      "JNPR",
      "NTAP",
      "DELL",
      "INTC",
      "TSM",
      "GLW",
      "GRMN",
      "KEYS",
      "VRT"
    ]
  },
  {
    "name": "Social & Search",
    "sector": "Communication Services",
    "tickers": [
      "GOOGL",
      "META"
    ]
  },
  {
    "name": "Streaming & Entertainment",
    "sector": "Communication Services",
    "tickers": [
      "NFLX",
      "DIS",
      "SPOT",
      "ROKU",
      "WBD",
      "PARA"
    ]
  },
  {
    "name": "Telecom - US",
    "sector": "Communication Services",
    "tickers": [
      "T",
      "VZ",
      "TMUS",
      "CHTR",
      "CMCSA"
    ]
  },
  {
    "name": "Telecom - Global",
    "sector": "Communication Services",
    "tickers": [
      "NOK",
      "ERIC",
      "VOD",
      "AMX"
    ]
  },
  {
    "name": "Gaming",
    "sector": "Communication Services",
    "tickers": [
      "EA",
      "TTWO",
      "RBLX"
    ]
  },
  {
    "name": "Interactive & Social",
    "sector": "Communication Services",
    "tickers": [
      "SNAP",
      "PINS",
      "MTCH",
      "TKO"
    ]
  },
  {
    "name": "Advertising",
    "sector": "Communication Services",
    "tickers": [
      "OMC"
    ]
  },
  {
    "name": "EM Digital",
    "sector": "Communication Services",
    "tickers": [
      "BIDU"
    ]
  },
  {
    "name": "Communication Services",
    "sector": "Sectors",
    "tickers": [
      "GOOGL",
      "META",
      "NFLX",
      "DIS",
      "SPOT",
      "ROKU",
      "WBD",
      "PARA",
      "T",
      "VZ",
      "TMUS",
      "CHTR",
      "CMCSA",
      "NOK",
      "ERIC",
      "VOD",
      "AMX",
      "EA",
      "TTWO",
      "RBLX",
      "SNAP",
      "PINS",
      "MTCH",
      "TKO",
      "OMC",
      "BIDU"
    ]
  },
  {
    "name": "E-commerce & Marketplace",
    "sector": "Consumer Discretionary",
    "tickers": [
      "AMZN",
      "EBAY",
      "ETSY",
      "W",
      "BABA"
    ]
  },
  {
    "name": "Automotive & EV",
    "sector": "Consumer Discretionary",
    "tickers": [
      "TSLA",
      "F",
      "GM",
      "RIVN",
      "LCID"
    ]
  },
  {
    "name": "Home Improvement",
    "sector": "Consumer Discretionary",
    "tickers": [
      "HD",
      "LOW",
      "WSM"
    ]
  },
  {
    "name": "Fast Food & Restaurant",
    "sector": "Consumer Discretionary",
    "tickers": [
      "MCD",
      "SBUX",
      "CMG",
      "YUM",
      "QSR",
      "DPZ",
      "WEN"
    ]
  },
  {
    "name": "Apparel & Footwear",
    "sector": "Consumer Discretionary",
    "tickers": [
      "NKE",
      "LULU",
      "RL",
      "PVH",
      "TPR",
      "VFC",
      "UAA"
    ]
  },
  {
    "name": "Travel & Leisure",
    "sector": "Consumer Discretionary",
    "tickers": [
      "BKNG",
      "ABNB",
      "EXPE",
      "MAR",
      "HLT",
      "H",
      "RCL",
      "CCL",
      "NCLH",
      "LYV",
      "FUN"
    ]
  },
  {
    "name": "Retail",
    "sector": "Consumer Discretionary",
    "tickers": [
      "TJX",
      "ROST",
      "FIVE",
      "DLTR",
      "DG"
    ]
  },
  {
    "name": "Delivery & Gig",
    "sector": "Consumer Discretionary",
    "tickers": [
      "UBER",
      "LYFT",
      "DASH"
    ]
  },
  {
    "name": "Luxury & Other",
    "sector": "Consumer Discretionary",
    "tickers": [
      "TSCO",
      "SIG",
      "ANF",
      "CAVA",
      "CAR"
    ]
  },
  {
    "name": "Consumer Discretionary",
    "sector": "Sectors",
    "tickers": [
      "AMZN",
      "EBAY",
      "ETSY",
      "W",
      "BABA",
      "TSLA",
      "F",
      "GM",
      "RIVN",
      "LCID",
      "HD",
      "LOW",
      "WSM",
      "MCD",
      "SBUX",
      "CMG",
      "YUM",
      "QSR",
      "DPZ",
      "WEN",
      "NKE",
      "LULU",
      "RL",
      "PVH",
      "TPR",
      "VFC",
      "UAA",
      "BKNG",
      "ABNB",
      "EXPE",
      "MAR",
      "HLT",
      "H",
      "RCL",
      "CCL",
      "NCLH",
      "LYV",
      "FUN",
      "TJX",
      "ROST",
      "FIVE",
      "DLTR",
      "DG",
      "UBER",
      "LYFT",
      "DASH",
      "TSCO",
      "SIG",
      "ANF",
      "CAVA",
      "CAR"
    ]
  },
  {
    "name": "Household & Personal Care",
    "sector": "Consumer Staples",
    "tickers": [
      "PG",
      "CL",
      "KMB",
      "CHD"
    ]
  },
  {
    "name": "Beverages",
    "sector": "Consumer Staples",
    "tickers": [
      "KO",
      "PEP",
      "MNST",
      "STZ",
      "BF.B"
    ]
  },
  {
    "name": "Food & Snacks",
    "sector": "Consumer Staples",
    "tickers": [
      "MDLZ",
      "GIS",
      "CPB",
      "HRL",
      "CAG",
      "SJM",
      "K",
      "HSY",
      "TSN"
    ]
  },
  {
    "name": "Tobacco",
    "sector": "Consumer Staples",
    "tickers": [
      "PM",
      "MO",
      "BTI"
    ]
  },
  {
    "name": "Retail / Wholesale",
    "sector": "Consumer Staples",
    "tickers": [
      "WMT",
      "COST",
      "TGT",
      "KR",
      "SFM"
    ]
  },
  {
    "name": "Beauty & Cosmetics",
    "sector": "Consumer Staples",
    "tickers": [
      "EL",
      "ULTA",
      "COTY"
    ]
  },
  {
    "name": "Agriculture",
    "sector": "Consumer Staples",
    "tickers": [
      "ADM",
      "BG",
      "MOS",
      "CTVA"
    ]
  },
  {
    "name": "Food Service Distribution",
    "sector": "Consumer Staples",
    "tickers": [
      "SYY"
    ]
  },
  {
    "name": "Consumer Staples",
    "sector": "Sectors",
    "tickers": [
      "PG",
      "CL",
      "KMB",
      "CHD",
      "KO",
      "PEP",
      "MNST",
      "STZ",
      "BF.B",
      "MDLZ",
      "GIS",
      "CPB",
      "HRL",
      "CAG",
      "SJM",
      "K",
      "HSY",
      "TSN",
      "PM",
      "MO",
      "BTI",
      "WMT",
      "COST",
      "TGT",
      "KR",
      "SFM",
      "EL",
      "ULTA",
      "COTY",
      "ADM",
      "BG",
      "MOS",
      "CTVA",
      "SYY"
    ]
  },
  {
    "name": "Large-cap Pharma - US",
    "sector": "Healthcare",
    "tickers": [
      "LLY",
      "JNJ",
      "ABBV",
      "MRK",
      "PFE",
      "BMY",
      "AMGN",
      "REGN",
      "GILD",
      "BIIB",
      "VRTX",
      "ALNY",
      "MRNA",
      "EXEL"
    ]
  },
  {
    "name": "Large-cap Pharma - Global",
    "sector": "Healthcare",
    "tickers": [
      "AZN",
      "NVS",
      "TAK",
      "TEVA",
      "BNTX"
    ]
  },
  {
    "name": "Medical Devices & Equipment",
    "sector": "Healthcare",
    "tickers": [
      "UNH",
      "ABT",
      "MDT",
      "ISRG",
      "BSX",
      "SYK",
      "EW",
      "ZBH",
      "HOLX",
      "BDX",
      "BAX",
      "DXCM",
      "PODD",
      "INSP",
      "NVCR"
    ]
  },
  {
    "name": "Diagnostics & Services",
    "sector": "Healthcare",
    "tickers": [
      "TMO",
      "DHR",
      "A",
      "IQV",
      "PKI",
      "ILMN",
      "LH",
      "DGX"
    ]
  },
  {
    "name": "Health Insurance & Services",
    "sector": "Healthcare",
    "tickers": [
      "CVS",
      "CI",
      "ELV",
      "HCA",
      "THC"
    ]
  },
  {
    "name": "Veterinary",
    "sector": "Healthcare",
    "tickers": [
      "ZTS",
      "IDEXX"
    ]
  },
  {
    "name": "Biotech Emerging",
    "sector": "Healthcare",
    "tickers": [
      "SRPT",
      "RARE",
      "ACAD"
    ]
  },
  {
    "name": "Healthcare",
    "sector": "Sectors",
    "tickers": [
      "LLY",
      "JNJ",
      "ABBV",
      "MRK",
      "PFE",
      "BMY",
      "AMGN",
      "REGN",
      "GILD",
      "BIIB",
      "VRTX",
      "ALNY",
      "MRNA",
      "EXEL",
      "AZN",
      "NVS",
      "TAK",
      "TEVA",
      "BNTX",
      "UNH",
      "ABT",
      "MDT",
      "ISRG",
      "BSX",
      "SYK",
      "EW",
      "ZBH",
      "HOLX",
      "BDX",
      "BAX",
      "DXCM",
      "PODD",
      "INSP",
      "NVCR",
      "TMO",
      "DHR",
      "A",
      "IQV",
      "PKI",
      "ILMN",
      "LH",
      "DGX",
      "CVS",
      "CI",
      "ELV",
      "HCA",
      "THC",
      "ZTS",
      "IDEXX",
      "SRPT",
      "RARE",
      "ACAD"
    ]
  },
  {
    "name": "Money-Center Banks - US",
    "sector": "Financials",
    "tickers": [
      "JPM",
      "BAC",
      "WFC",
      "C",
      "USB",
      "TFC",
      "PNC"
    ]
  },
  {
    "name": "Money-Center Banks - Canada",
    "sector": "Financials",
    "tickers": [
      "RY",
      "TD",
      "BNS",
      "CM",
      "BMO"
    ]
  },
  {
    "name": "Money-Center Banks - Europe/Asia",
    "sector": "Financials",
    "tickers": [
      "HSBC",
      "ING",
      "BCS",
      "SAN",
      "BBVA",
      "SMFG",
      "MUFG",
      "NWG",
      "LYG"
    ]
  },
  {
    "name": "Investment Banking & Asset Management",
    "sector": "Financials",
    "tickers": [
      "GS",
      "MS",
      "BLK",
      "BX",
      "KKR",
      "APO",
      "ARES",
      "CG",
      "AMP",
      "NTRS",
      "BK"
    ]
  },
  {
    "name": "Insurance",
    "sector": "Financials",
    "tickers": [
      "BRK.B",
      "AIG",
      "MET",
      "PRU",
      "AFL",
      "ALL",
      "CB",
      "TRV",
      "HIG",
      "PUK"
    ]
  },
  {
    "name": "Payment Networks",
    "sector": "Financials",
    "tickers": [
      "V",
      "MA",
      "AXP",
      "PYPL",
      "SQ",
      "FIS",
      "FISV",
      "GPN"
    ]
  },
  {
    "name": "Brokerage & Exchange",
    "sector": "Financials",
    "tickers": [
      "SCHW",
      "IBKR",
      "ICE",
      "CME",
      "CBOE",
      "NDAQ"
    ]
  },
  {
    "name": "Fintech & Crypto",
    "sector": "Financials",
    "tickers": [
      "COIN",
      "HOOD",
      "SOFI",
      "NU"
    ]
  },
  {
    "name": "Data & Ratings",
    "sector": "Financials",
    "tickers": [
      "MCO",
      "SPGI",
      "MSCI"
    ]
  },
  {
    "name": "Business Services",
    "sector": "Financials",
    "tickers": [
      "RBA"
    ]
  },
  {
    "name": "Regional Banks - US",
    "sector": "Financials",
    "tickers": [
      "RF",
      "HBAN",
      "CFG",
      "FITB",
      "MTB",
      "KEY"
    ]
  },
  {
    "name": "Financials",
    "sector": "Sectors",
    "tickers": [
      "JPM",
      "BAC",
      "WFC",
      "C",
      "USB",
      "TFC",
      "PNC",
      "RY",
      "TD",
      "BNS",
      "CM",
      "BMO",
      "HSBC",
      "ING",
      "BCS",
      "SAN",
      "BBVA",
      "SMFG",
      "MUFG",
      "NWG",
      "LYG",
      "GS",
      "MS",
      "BLK",
      "BX",
      "KKR",
      "APO",
      "ARES",
      "CG",
      "AMP",
      "NTRS",
      "BK",
      "BRK.B",
      "AIG",
      "MET",
      "PRU",
      "AFL",
      "ALL",
      "CB",
      "TRV",
      "HIG",
      "PUK",
      "V",
      "MA",
      "AXP",
      "PYPL",
      "SQ",
      "FIS",
      "FISV",
      "GPN",
      "SCHW",
      "IBKR",
      "ICE",
      "CME",
      "CBOE",
      "NDAQ",
      "COIN",
      "HOOD",
      "SOFI",
      "NU",
      "MCO",
      "SPGI",
      "MSCI",
      "RBA",
      "RF",
      "HBAN",
      "CFG",
      "FITB",
      "MTB",
      "KEY"
    ]
  },
  {
    "name": "Integrated Majors - US",
    "sector": "Energy",
    "tickers": [
      "XOM",
      "CVX"
    ]
  },
  {
    "name": "Integrated Majors - International",
    "sector": "Energy",
    "tickers": [
      "SHEL",
      "TTE",
      "BP",
      "EQNR"
    ]
  },
  {
    "name": "E&P - US",
    "sector": "Energy",
    "tickers": [
      "COP",
      "EOG",
      "OXY",
      "DVN",
      "FANG",
      "HES",
      "APA",
      "MRO",
      "MTDR",
      "CHRD",
      "CRGY",
      "EQT",
      "MUR"
    ]
  },
  {
    "name": "E&P - Canada",
    "sector": "Energy",
    "tickers": [
      "CNQ",
      "CVE",
      "SU",
      "OVV"
    ]
  },
  {
    "name": "E&P - International/EM",
    "sector": "Energy",
    "tickers": [
      "PBR",
      "EC"
    ]
  },
  {
    "name": "Oilfield Services",
    "sector": "Energy",
    "tickers": [
      "SLB",
      "HAL",
      "BKR",
      "OII"
    ]
  },
  {
    "name": "Refining & Marketing",
    "sector": "Energy",
    "tickers": [
      "MPC",
      "VLO",
      "PSX",
      "PARR"
    ]
  },
  {
    "name": "Midstream & Pipeline - US",
    "sector": "Energy",
    "tickers": [
      "KMI",
      "WMB",
      "ET",
      "EPD",
      "MPLX",
      "OKE",
      "TRGP",
      "DTM",
      "KNTK"
    ]
  },
  {
    "name": "Midstream & Pipeline - Canada",
    "sector": "Energy",
    "tickers": [
      "ENB",
      "TRP"
    ]
  },
  {
    "name": "LNG & Shipping",
    "sector": "Energy",
    "tickers": [
      "LNG",
      "GLNG",
      "FLNG",
      "WDS"
    ]
  },
  {
    "name": "Offshore & Support",
    "sector": "Energy",
    "tickers": [
      "VAL",
      "RIG",
      "TDW",
      "AROC"
    ]
  },
  {
    "name": "Coal",
    "sector": "Energy",
    "tickers": [
      "BTU",
      "ARCH"
    ]
  },
  {
    "name": "Renewables",
    "sector": "Energy",
    "tickers": [
      "BEP"
    ]
  },
  {
    "name": "Uranium (nükleer talep)",
    "sector": "Energy",
    "tickers": [
      "CCJ"
    ]
  },
  {
    "name": "TPL (arazi & enerji)",
    "sector": "Energy",
    "tickers": [
      "TPL"
    ]
  },
  {
    "name": "Energy",
    "sector": "Sectors",
    "tickers": [
      "XOM",
      "CVX",
      "SHEL",
      "TTE",
      "BP",
      "EQNR",
      "COP",
      "EOG",
      "OXY",
      "DVN",
      "FANG",
      "HES",
      "APA",
      "MRO",
      "MTDR",
      "CHRD",
      "CRGY",
      "EQT",
      "MUR",
      "CNQ",
      "CVE",
      "SU",
      "OVV",
      "PBR",
      "EC",
      "SLB",
      "HAL",
      "BKR",
      "OII",
      "MPC",
      "VLO",
      "PSX",
      "PARR",
      "KMI",
      "WMB",
      "ET",
      "EPD",
      "MPLX",
      "OKE",
      "TRGP",
      "DTM",
      "KNTK",
      "ENB",
      "TRP",
      "LNG",
      "GLNG",
      "FLNG",
      "WDS",
      "VAL",
      "RIG",
      "TDW",
      "AROC",
      "BTU",
      "ARCH",
      "BEP",
      "CCJ",
      "TPL"
    ]
  },
  {
    "name": "Copper & Base Metals",
    "sector": "Materials",
    "tickers": [
      "FCX",
      "SCCO",
      "TECK"
    ]
  },
  {
    "name": "Diversified Mining",
    "sector": "Materials",
    "tickers": [
      "RIO",
      "BHP",
      "VALE",
      "MT"
    ]
  },
  {
    "name": "Gold Mining",
    "sector": "Materials",
    "tickers": [
      "NEM",
      "GOLD",
      "AEM",
      "WPM",
      "RGLD",
      "FNV",
      "KGC",
      "GFI",
      "AU",
      "SSRM"
    ]
  },
  {
    "name": "Silver Mining",
    "sector": "Materials",
    "tickers": [
      "PAAS",
      "FSM"
    ]
  },
  {
    "name": "Lithium & Battery Metals",
    "sector": "Materials",
    "tickers": [
      "ALB",
      "SQM",
      "LTHM",
      "SGML"
    ]
  },
  {
    "name": "Industrial Gases",
    "sector": "Materials",
    "tickers": [
      "LIN",
      "APD",
      "CE"
    ]
  },
  {
    "name": "Specialty Chemicals",
    "sector": "Materials",
    "tickers": [
      "SHW",
      "ECL",
      "PPG",
      "DD",
      "DOW",
      "LYB",
      "EMN"
    ]
  },
  {
    "name": "Agriculture Chemicals",
    "sector": "Materials",
    "tickers": [
      "CF",
      "NTR"
    ]
  },
  {
    "name": "Steel & Aluminum",
    "sector": "Materials",
    "tickers": [
      "NUE",
      "STLD",
      "X",
      "AA",
      "CENX"
    ]
  },
  {
    "name": "Construction Materials",
    "sector": "Materials",
    "tickers": [
      "MLM",
      "VMC",
      "CRH",
      "EXP"
    ]
  },
  {
    "name": "Paper & Packaging",
    "sector": "Materials",
    "tickers": [
      "IP",
      "PKG",
      "WRK"
    ]
  },
  {
    "name": "Other",
    "sector": "Materials",
    "tickers": [
      "NEXA",
      "BVN"
    ]
  },
  {
    "name": "Materials",
    "sector": "Sectors",
    "tickers": [
      "FCX",
      "SCCO",
      "TECK",
      "RIO",
      "BHP",
      "VALE",
      "MT",
      "NEM",
      "GOLD",
      "AEM",
      "WPM",
      "RGLD",
      "FNV",
      "KGC",
      "GFI",
      "AU",
      "SSRM",
      "PAAS",
      "FSM",
      "ALB",
      "SQM",
      "LTHM",
      "SGML",
      "LIN",
      "APD",
      "CE",
      "SHW",
      "ECL",
      "PPG",
      "DD",
      "DOW",
      "LYB",
      "EMN",
      "CF",
      "NTR",
      "NUE",
      "STLD",
      "X",
      "AA",
      "CENX",
      "MLM",
      "VMC",
      "CRH",
      "EXP",
      "IP",
      "PKG",
      "WRK",
      "NEXA",
      "BVN"
    ]
  },
  {
    "name": "Aerospace & Defense",
    "sector": "Industrials",
    "tickers": [
      "BA",
      "LMT",
      "RTX",
      "NOC",
      "GD",
      "HII",
      "TDG",
      "AXON",
      "LHX",
      "KTOS"
    ]
  },
  {
    "name": "Engines & Power",
    "sector": "Industrials",
    "tickers": [
      "GE",
      "GEV",
      "CMI"
    ]
  },
  {
    "name": "Precision Instruments & Test",
    "sector": "Industrials",
    "tickers": [
      "TDY",
      "AME",
      "KEYS"
    ]
  },
  {
    "name": "Machinery & Equipment",
    "sector": "Industrials",
    "tickers": [
      "CAT",
      "DE",
      "EMR",
      "ETN",
      "ROK",
      "PH",
      "IR",
      "XYL",
      "DOV",
      "HUBB",
      "HWM",
      "WAB",
      "ALSN"
    ]
  },
  {
    "name": "Conglomerate",
    "sector": "Industrials",
    "tickers": [
      "HON",
      "MMM"
    ]
  },
  {
    "name": "Transportation - Rail",
    "sector": "Industrials",
    "tickers": [
      "UNP",
      "CSX",
      "NSC",
      "CNI"
    ]
  },
  {
    "name": "Transportation - Parcel & Air",
    "sector": "Industrials",
    "tickers": [
      "UPS",
      "FDX"
    ]
  },
  {
    "name": "Transportation - Trucking",
    "sector": "Industrials",
    "tickers": [
      "ODFL",
      "PCAR"
    ]
  },
  {
    "name": "Transportation - Airlines",
    "sector": "Industrials",
    "tickers": [
      "DAL",
      "UAL",
      "AAL",
      "LUV",
      "ALK"
    ]
  },
  {
    "name": "Freight Brokerage & Logistics",
    "sector": "Industrials",
    "tickers": [
      "CHRW",
      "EXPD"
    ]
  },
  {
    "name": "Staffing & Business Services",
    "sector": "Industrials",
    "tickers": [
      "WM",
      "RSG",
      "CTAS",
      "ROP",
      "FAST",
      "GWW",
      "ROL",
      "MSCI"
    ]
  },
  {
    "name": "Construction & Engineering",
    "sector": "Industrials",
    "tickers": [
      "PWR",
      "FLR",
      "J",
      "PRIM",
      "MTZ",
      "STRL"
    ]
  },
  {
    "name": "Leasing & Rental",
    "sector": "Industrials",
    "tickers": [
      "URI",
      "AL",
      "AER",
      "WSC"
    ]
  },
  {
    "name": "Commercial Services",
    "sector": "Industrials",
    "tickers": [
      "BR",
      "VRSK",
      "DNB"
    ]
  },
  {
    "name": "Aviation MRO",
    "sector": "Industrials",
    "tickers": [
      "AIR"
    ]
  },
  {
    "name": "Other",
    "sector": "Industrials",
    "tickers": [
      "SYM",
      "FTAI"
    ]
  },
  {
    "name": "Industrials",
    "sector": "Sectors",
    "tickers": [
      "BA",
      "LMT",
      "RTX",
      "NOC",
      "GD",
      "HII",
      "TDG",
      "AXON",
      "LHX",
      "KTOS",
      "GE",
      "GEV",
      "CMI",
      "TDY",
      "AME",
      "KEYS",
      "CAT",
      "DE",
      "EMR",
      "ETN",
      "ROK",
      "PH",
      "IR",
      "XYL",
      "DOV",
      "HUBB",
      "HWM",
      "WAB",
      "ALSN",
      "HON",
      "MMM",
      "UNP",
      "CSX",
      "NSC",
      "CNI",
      "UPS",
      "FDX",
      "ODFL",
      "PCAR",
      "DAL",
      "UAL",
      "AAL",
      "LUV",
      "ALK",
      "CHRW",
      "EXPD",
      "WM",
      "RSG",
      "CTAS",
      "ROP",
      "FAST",
      "GWW",
      "ROL",
      "MSCI",
      "PWR",
      "FLR",
      "J",
      "PRIM",
      "MTZ",
      "STRL",
      "URI",
      "AL",
      "AER",
      "WSC",
      "BR",
      "VRSK",
      "DNB",
      "AIR",
      "SYM",
      "FTAI"
    ]
  },
  {
    "name": "Electric - Regulated",
    "sector": "Utilities",
    "tickers": [
      "NEE",
      "DUK",
      "SO",
      "AEP",
      "EXC",
      "PEG",
      "XEL",
      "ED",
      "ES",
      "WEC",
      "ETR",
      "CMS",
      "DTE",
      "EVRG",
      "OGE",
      "AEE",
      "ATO",
      "EIX",
      "FE",
      "PPL"
    ]
  },
  {
    "name": "Electric - UK/International",
    "sector": "Utilities",
    "tickers": [
      "NGG"
    ]
  },
  {
    "name": "Electric - Clean/Nuclear (AI Power Demand)",
    "sector": "Utilities",
    "tickers": [
      "VST",
      "CEG",
      "NRG",
      "AES"
    ]
  },
  {
    "name": "Gas & Multi-Utility",
    "sector": "Utilities",
    "tickers": [
      "SRE",
      "PCG",
      "NI",
      "OGS",
      "CNP"
    ]
  },
  {
    "name": "Water",
    "sector": "Utilities",
    "tickers": [
      "AWK",
      "WTRG",
      "CWT",
      "MSEX"
    ]
  },
  {
    "name": "Renewable / YieldCo",
    "sector": "Utilities",
    "tickers": [
      "CWEN",
      "AY"
    ]
  },
  {
    "name": "Bloom Energy (fuel cell)",
    "sector": "Utilities",
    "tickers": [
      "BE"
    ]
  },
  {
    "name": "Utilities",
    "sector": "Sectors",
    "tickers": [
      "NEE",
      "DUK",
      "SO",
      "AEP",
      "EXC",
      "PEG",
      "XEL",
      "ED",
      "ES",
      "WEC",
      "ETR",
      "CMS",
      "DTE",
      "EVRG",
      "OGE",
      "AEE",
      "ATO",
      "EIX",
      "FE",
      "PPL",
      "NGG",
      "VST",
      "CEG",
      "NRG",
      "AES",
      "SRE",
      "PCG",
      "NI",
      "OGS",
      "CNP",
      "AWK",
      "WTRG",
      "CWT",
      "MSEX",
      "CWEN",
      "AY",
      "BE"
    ]
  },
  {
    "name": "Diversified REIT",
    "sector": "Real Estate",
    "tickers": [
      "PLD",
      "O",
      "VICI",
      "EPRT",
      "GOOD",
      "GTY"
    ]
  },
  {
    "name": "Data Center REIT",
    "sector": "Real Estate",
    "tickers": [
      "EQIX",
      "AMT",
      "DLR",
      "CCI",
      "SBAC"
    ]
  },
  {
    "name": "Industrial / Logistics REIT",
    "sector": "Real Estate",
    "tickers": [
      "EGP",
      "FR"
    ]
  },
  {
    "name": "Office REIT",
    "sector": "Real Estate",
    "tickers": [
      "BXP",
      "VNO"
    ]
  },
  {
    "name": "Retail REIT",
    "sector": "Real Estate",
    "tickers": [
      "SPG",
      "MAC",
      "KIM",
      "REG",
      "FRT",
      "KRG"
    ]
  },
  {
    "name": "Residential REIT",
    "sector": "Real Estate",
    "tickers": [
      "AVB",
      "EQR",
      "MAA",
      "UDR",
      "CPT",
      "NMI",
      "AMH"
    ]
  },
  {
    "name": "Healthcare REIT",
    "sector": "Real Estate",
    "tickers": [
      "WELL",
      "VTR",
      "HR",
      "OHI"
    ]
  },
  {
    "name": "Storage REIT",
    "sector": "Real Estate",
    "tickers": [
      "PSA",
      "EXR",
      "CUBE",
      "LSI"
    ]
  },
  {
    "name": "Specialty REIT",
    "sector": "Real Estate",
    "tickers": [
      "IRM",
      "ARE",
      "CBRE",
      "HST",
      "LAMR",
      "SUI",
      "RHP",
      "PEB"
    ]
  },
  {
    "name": "Timber REIT",
    "sector": "Real Estate",
    "tickers": [
      "WY",
      "PCH"
    ]
  },
  {
    "name": "Hotels",
    "sector": "Real Estate",
    "tickers": [
      "DHI"
    ]
  },
  {
    "name": "Real Estate",
    "sector": "Sectors",
    "tickers": [
      "PLD",
      "O",
      "VICI",
      "EPRT",
      "GOOD",
      "GTY",
      "EQIX",
      "AMT",
      "DLR",
      "CCI",
      "SBAC",
      "EGP",
      "FR",
      "BXP",
      "VNO",
      "SPG",
      "MAC",
      "KIM",
      "REG",
      "FRT",
      "KRG",
      "AVB",
      "EQR",
      "MAA",
      "UDR",
      "CPT",
      "NMI",
      "AMH",
      "WELL",
      "VTR",
      "HR",
      "OHI",
      "PSA",
      "EXR",
      "CUBE",
      "LSI",
      "IRM",
      "ARE",
      "CBRE",
      "HST",
      "LAMR",
      "SUI",
      "RHP",
      "PEB",
      "WY",
      "PCH",
      "DHI"
    ]
  }
];
