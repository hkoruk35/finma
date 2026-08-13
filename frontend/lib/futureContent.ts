export type FutureStat = { number: string; label: string };
export type FutureSection = { title: string; text: string };

export type FutureSide = {
  eyebrow: string;
  brand: string;
  tagline: string;
  intro: string;
  stats: FutureStat[];
  sections: FutureSection[];
};

export type FutureContent = {
  metaTitle: string;
  metaDescription: string;
  badge: string;
  title: string;
  subtitle: string;
  left: FutureSide;
  right: FutureSide;
  closing: string;
};

type Locale = "en" | "es" | "fr" | "pt" | "id" | "tr";

const content: Record<Locale, FutureContent> = {
  en: {
    metaTitle: "Our Future | BogaStock & AFK Nexro AI",
    metaDescription:
      "A closer look at the two ecosystems behind our company: BogaStock, a financial intelligence platform, and AFK Nexro AI, an autonomous mobility and smart-city operating system.",
    badge: "OUR VISION",
    title: "Two Ecosystems, One Engineering Philosophy",
    subtitle:
      "You already know us from the surface. This page goes deeper — into the scale, the sophistication, and the long-term vision behind both of our platforms.",
    left: {
      eyebrow: "FINANCIAL INTELLIGENCE",
      brand: "BogaStock",
      tagline: "The Financial Intelligence Ecosystem",
      intro:
        "BogaStock is not just a screen that displays stock data — it is a fully integrated system that reads the market, processes information, runs its own social media presence, and tests its own decisions in live investment simulations, all without human intervention.",
      stats: [
        { number: "24/7", label: "Continuous, autonomous market monitoring" },
        { number: "0", label: "Manual intervention required to operate" },
        { number: "6", label: "Fully localized interface languages" },
        { number: "100+", label: "Languages understood by BOGA Copilot" },
      ],
      sections: [
        {
          title: "An Always-On Intelligence Engine",
          text: "BogaStock operates as a single, integrated system — market scanning, risk assessment, and decision-making all run continuously, around the clock, without a human at the controls. What would take a large team to manage manually, our platform handles as one coordinated, self-directing operation.",
        },
        {
          title: "BOGA Copilot",
          text: "The heart of the platform isn't a static translation layer. As balance sheets, prices, and trends change and the system evolves, Copilot keeps learning — understanding context across more than 100 languages to guide users in real time.",
        },
        {
          title: "A Network of Autonomous Scanners",
          text: "Beneath the surface, a coordinated network of specialized scanners — covering swing setups, intraday moves, and our broader stock universe — watches the market around the clock, surfacing chart formations and distilling opportunities for investors.",
        },
        {
          title: "AI Challenge",
          text: "Our most ambitious module: an AI that doesn't just predict, but actively manages a real $1,000 portfolio under strict risk-management rules, with every decision recorded on a fully transparent, tamper-proof ledger.",
        },
        {
          title: "An Autonomous Data & Media Layer",
          text: "The system doesn't just analyze the market — it communicates about it. X Studio tracks market moves, insider activity, and earnings calendars in real time, then produces and publishes content entirely on its own, without human input.",
        },
        {
          title: "Global Reach",
          text: "The interface is fully synchronized across English, Spanish, French, Portuguese, Indonesian, and Turkish. Copilot extends that reach to 100+ languages, effectively removing the language barrier for investors everywhere.",
        },
      ],
    },
    right: {
      eyebrow: "AUTONOMOUS MOBILITY",
      brand: "AFK Nexro AI",
      tagline: "Operating System for Smart Cities & the Autonomous Future",
      intro:
        "AFK Nexro AI is a hardware, simulation, and artificial intelligence ecosystem built to break new ground in autonomous mobility and smart-city technology. Our goal isn't just to operate our own autonomous vehicles — it's to become a universal intelligence layer that connects every future mobile device to the autonomous world.",
      stats: [
        { number: "48", label: "US states covered" },
        { number: "96", label: "Simulated real-world routes" },
        { number: "50+", label: "Real-time AI traffic agents" },
        { number: "2", label: "Proprietary autonomous hardware platforms" },
        { number: "12", label: "Languages spoken by the AI assistant" },
        { number: "60 FPS", label: "Real-time simulation target" },
      ],
      sections: [
        {
          title: "National Simulation Network",
          text: "We built a digital twin to test real-world conditions against our autonomous intelligence — covering 48 US states, 96 routes, and roughly 100 cities, split between Downtown and Suburb categories, using real street geometry.",
        },
        {
          title: "Live Traffic Simulation",
          text: "The streets are never empty. Every simulation runs more than 50 real-time AI agents simultaneously, alongside dynamic conditions — pedestrian crossings, GPS-degraded urban canyons, three traffic-density levels, and three weather states — all targeting a real-time 60 FPS.",
        },
        {
          title: "Proprietary Hardware",
          text: "The intelligence we train in simulation is deployed on two real-world vehicles built on one modular chassis philosophy: the AFK +City Shuttle, a Level 4/5 autonomous transit platform, and the AFK MRC 1.0, an autonomous delivery robot optimized for last-mile logistics.",
        },
        {
          title: "Nexro AI Engineering",
          text: "The software heart of the project is built on modern, type-safe TypeScript and React (Next.js) — no legacy stacks. Zustand state management moves simulation data, route coordinates, and AI analysis across five dynamic panels with zero perceptible lag.",
        },
        {
          title: "Multilingual AI Assistant",
          text: "Our integrated AI assistant doesn't just operate the vehicle — it reports on weather, road conditions, and route optimizations to the operator in 12 languages, in real time.",
        },
        {
          title: "Fault-Tolerant by Design",
          text: "Even a millisecond-level interruption in the AI data stream will never crash the system. It automatically falls back to a safe mode, keeping the vehicle and the simulation running on core algorithms.",
        },
      ],
    },
    closing:
      "AFK Nexro's ultimate goal isn't to stay a closed system. Its architecture is designed to become a universal adapter — installable on other manufacturers' devices, drones, or vehicles — connecting them to the Nexro Swarm Intelligence network and making them \"smart\" within seconds. We're not waiting for the future. We're building it, simulating it, and putting it on the street.",
  },

  tr: {
    metaTitle: "Geleceğimiz | BogaStock & AFK Nexro AI",
    metaDescription:
      "Şirketimizin arkasındaki iki ekosisteme daha yakından bakış: finansal zeka platformu BogaStock ve otonom mobilite işletim sistemi AFK Nexro AI.",
    badge: "VİZYONUMUZ",
    title: "İki Ekosistem, Tek Mühendislik Felsefesi",
    subtitle:
      "Bizi yüzeyden zaten tanıyorsunuz. Bu sayfa daha derine iniyor — her iki platformumuzun arkasındaki ölçeğe, olgunluğa ve uzun vadeli vizyona.",
    left: {
      eyebrow: "FİNANSAL ZEKA",
      brand: "BogaStock",
      tagline: "Finansal Zeka Ekosistemi",
      intro:
        "BogaStock, yalnızca klasik hisse senedi verilerini sunan bir ekran değil; insan müdahalesi olmadan piyasayı okuyan, veriyi işleyen, kendi sosyal medyasını yöneten ve kendi kararlarını yatırım simülasyonlarında test eden, uçtan uca entegre bir sistemdir.",
      stats: [
        { number: "7/24", label: "Kesintisiz, otonom piyasa takibi" },
        { number: "0", label: "Çalışması için gereken manuel müdahale" },
        { number: "6", label: "Tam yerelleştirilmiş arayüz dili" },
        { number: "100+", label: "BOGA Copilot'un anladığı dil" },
      ],
      sections: [
        {
          title: "Hiç Durmayan Bir Zeka Motoru",
          text: "BogaStock tek, entegre bir sistem olarak çalışır — piyasa taraması, risk değerlendirmesi ve karar mekanizmaları, hiçbir insan müdahalesi olmadan gece gündüz kesintisiz sürer. Büyük bir ekibin elle yönetmesi gereken işi, platformumuz tek, koordineli ve kendi kendini yöneten bir operasyon olarak yürütür.",
        },
        {
          title: "BOGA Copilot",
          text: "Platformun kalbi statik bir çeviri katmanı değil. Bilançolar, fiyatlar ve trendler değiştikçe ve sistem geliştikçe Copilot öğrenmeye devam ediyor; 100'den fazla dilde bağlamı anlayarak kullanıcıya anlık rehberlik ediyor.",
        },
        {
          title: "Otonom Bir Tarayıcı Ağı",
          text: "Yüzeyin altında; swing kurgularını, gün içi hareketleri ve daha geniş hisse evrenimizi kapsayan koordineli bir tarayıcı ağı piyasayı 7/24 izliyor, formasyonları yakalıyor ve yatırımcı için fırsatları damıtıyor.",
        },
        {
          title: "AI Challenge",
          text: "En iddialı modülümüz: sadece tahmin yapmayan, gerçek bir $1.000'lık portföyü katı risk yönetimi kuralları altında bizzat yöneten bir yapay zeka — her karar tamamen şeffaf, değiştirilemez bir işlem defterine kaydedilir.",
        },
        {
          title: "Otonom Bir Veri ve Medya Katmanı",
          text: "Sistem sadece piyasayı analiz etmekle kalmıyor, onun hakkında iletişim de kuruyor. X Studio piyasa hareketlerini, içeriden öğrenenlerin faaliyetlerini ve kazanç takvimlerini gerçek zamanlı takip ediyor; ardından tamamen kendi başına, insan müdahalesi olmadan içerik üretip yayınlıyor.",
        },
        {
          title: "Küresel Erişim",
          text: "Arayüz İngilizce, İspanyolca, Fransızca, Portekizce, Endonezce ve Türkçe olmak üzere 6 dilde tam senkronize çalışıyor. Copilot bu erişimi 100'den fazla dile genişleterek dil bariyerini ortadan kaldırıyor.",
        },
      ],
    },
    right: {
      eyebrow: "OTONOM MOBİLİTE",
      brand: "AFK Nexro AI",
      tagline: "Akıllı Şehirler ve Otonom Geleceğin İşletim Sistemi",
      intro:
        "AFK Nexro AI, otonom mobilite ve akıllı şehir teknolojilerinde ezber bozan bir donanım, simülasyon ve yapay zeka ekosistemidir. Amacımız sadece kendi ürettiğimiz otonom araçları yönetmek değil; geleceğin tüm hareketli cihazlarını otonom dünyaya bağlayacak evrensel bir zeka katmanı olmaktır.",
      stats: [
        { number: "48", label: "Kapsanan ABD eyaleti" },
        { number: "96", label: "Simüle edilen gerçek rota" },
        { number: "50+", label: "Gerçek zamanlı AI trafik botu" },
        { number: "2", label: "Tescilli otonom donanım platformu" },
        { number: "12", label: "AI asistanının konuştuğu dil" },
        { number: "60 FPS", label: "Gerçek zamanlı simülasyon hedefi" },
      ],
      sections: [
        {
          title: "Ulusal Simülasyon Ağı",
          text: "Gerçek dünya koşullarını otonom zekamızla test etmek için bir dijital ikiz kurduk: 48 eyalet, 96 rota ve yaklaşık 100 şehir, gerçek sokak geometrileriyle Downtown ve Suburb kategorilerinde.",
        },
        {
          title: "Canlı Trafik Simülasyonu",
          text: "Sokaklar boş değil. Her simülasyonda 50'den fazla otonom AI botu aynı anda trafiği simüle ediyor; yaya geçitleri, GPS kaybı yaşanan kentsel kanyonlar, 3 trafik yoğunluğu seviyesi ve 3 hava durumu ile 60 FPS hedefinde çalışıyor.",
        },
        {
          title: "Tescilli Donanım Ekosistemi",
          text: "Sanal dünyada eğittiğimiz zekayı, tek bir modüler şasi felsefesiyle tasarladığımız iki gerçek dünya aracına entegre ediyoruz: Seviye 4/5 tam otonom AFK +City Shuttle ve son-kilometre lojistiği için AFK MRC 1.0 teslimat robotu.",
        },
        {
          title: "Nexro AI Mühendisliği",
          text: "Projenin yazılım kalbi modern, tip-güvenli TypeScript ve React (Next.js) üzerine kurulu — eski nesil hantal kod yığınları yok. Zustand state management, simülasyon verilerini, rota koordinatlarını ve AI analizlerini 5 dinamik panel arasında 0 gecikmeyle taşıyor.",
        },
        {
          title: "Çok Dilli AI Asistanı",
          text: "Entegre AI asistanımız sadece aracı yönetmiyor; hava koşulları, yol durumu ve rota optimizasyonlarını operatöre 12 farklı dilde anlık olarak raporluyor.",
        },
        {
          title: "Hata Toleranslı Mimari",
          text: "Yapay zeka veri akışında milisaniyelik bir kesinti olsa bile sistem asla çökmez; otomatik olarak güvenli moda geçerek aracın ve simülasyonun akışını temel algoritmalarla sürdürür.",
        },
      ],
    },
    closing:
      "AFK Nexro AI'ın nihai hedefi kapalı bir sistem olarak kalmak değil. Mimarisi; farklı üreticilerin cihazlarına, dronlarına veya araçlarına yüklenerek onları Nexro Sürü Zekası ağına bağlayacak ve saniyeler içinde \"akıllı\" hale getirecek evrensel bir adaptör olmak üzere tasarlanıyor. Geleceği beklemiyoruz; onu inşa ediyor, simüle ediyor ve sokaklara indiriyoruz.",
  },

  es: {
    metaTitle: "Nuestro Futuro | BogaStock & AFK Nexro AI",
    metaDescription:
      "Una mirada más profunda a los dos ecosistemas detrás de nuestra empresa: BogaStock, una plataforma de inteligencia financiera, y AFK Nexro AI, un sistema operativo para movilidad autónoma y ciudades inteligentes.",
    badge: "NUESTRA VISIÓN",
    title: "Dos Ecosistemas, Una Sola Filosofía de Ingeniería",
    subtitle:
      "Ya nos conoces por la superficie. Esta página va más allá: la escala, la madurez y la visión a largo plazo detrás de ambas plataformas.",
    left: {
      eyebrow: "INTELIGENCIA FINANCIERA",
      brand: "BogaStock",
      tagline: "El Ecosistema de Inteligencia Financiera",
      intro:
        "BogaStock no es solo una pantalla que muestra datos bursátiles: es un sistema totalmente integrado que lee el mercado, procesa información, gestiona su propia presencia en redes sociales y pone a prueba sus propias decisiones en simulaciones de inversión en vivo, todo sin intervención humana.",
      stats: [
        { number: "24/7", label: "Monitoreo autónomo y continuo del mercado" },
        { number: "0", label: "Intervención manual necesaria para operar" },
        { number: "6", label: "Idiomas de interfaz totalmente localizados" },
        { number: "100+", label: "Idiomas que entiende BOGA Copilot" },
      ],
      sections: [
        {
          title: "Un Motor de Inteligencia Siempre Activo",
          text: "BogaStock funciona como un único sistema integrado — el rastreo del mercado, la evaluación de riesgos y la toma de decisiones operan de forma continua, las 24 horas, sin una persona al mando. Lo que a un gran equipo le llevaría gestionar manualmente, nuestra plataforma lo maneja como una sola operación coordinada y autónoma.",
        },
        {
          title: "BOGA Copilot",
          text: "El corazón de la plataforma no es una capa de traducción estática. A medida que cambian balances, precios y tendencias, y el sistema evoluciona, Copilot sigue aprendiendo, comprendiendo el contexto en más de 100 idiomas para guiar al usuario en tiempo real.",
        },
        {
          title: "Una Red de Rastreadores Autónomos",
          text: "Bajo la superficie, una red coordinada de rastreadores especializados —que cubre configuraciones swing, movimientos intradía y nuestro universo bursátil más amplio— vigila el mercado las 24 horas, detectando formaciones y destilando oportunidades para el inversor.",
        },
        {
          title: "AI Challenge",
          text: "Nuestro módulo más ambicioso: una IA que no solo predice, sino que gestiona activamente una cartera real de 1.000 USD bajo estrictas reglas de gestión de riesgo, registrando cada decisión en un libro de operaciones totalmente transparente e inalterable.",
        },
        {
          title: "Una Capa Autónoma de Datos y Medios",
          text: "El sistema no solo analiza el mercado, también comunica sobre él. X Studio sigue en tiempo real los movimientos del mercado, la actividad de insiders y el calendario de resultados, y luego produce y publica contenido de forma completamente autónoma, sin intervención humana.",
        },
        {
          title: "Alcance Global",
          text: "La interfaz está totalmente sincronizada en inglés, español, francés, portugués, indonesio y turco. Copilot amplía ese alcance a más de 100 idiomas, eliminando de forma efectiva la barrera del idioma para inversores en cualquier lugar.",
        },
      ],
    },
    right: {
      eyebrow: "MOVILIDAD AUTÓNOMA",
      brand: "AFK Nexro AI",
      tagline: "Sistema Operativo para Ciudades Inteligentes y el Futuro Autónomo",
      intro:
        "AFK Nexro AI es un ecosistema de hardware, simulación e inteligencia artificial construido para marcar un antes y un después en la movilidad autónoma y las tecnologías de ciudad inteligente. Nuestro objetivo no es solo operar nuestros propios vehículos autónomos, sino convertirnos en una capa de inteligencia universal que conecte cada futuro dispositivo móvil al mundo autónomo.",
      stats: [
        { number: "48", label: "Estados de EE. UU. cubiertos" },
        { number: "96", label: "Rutas reales simuladas" },
        { number: "50+", label: "Agentes de IA de tráfico en tiempo real" },
        { number: "2", label: "Plataformas de hardware autónomo propias" },
        { number: "12", label: "Idiomas que habla el asistente de IA" },
        { number: "60 FPS", label: "Objetivo de simulación en tiempo real" },
      ],
      sections: [
        {
          title: "Red Nacional de Simulación",
          text: "Construimos un gemelo digital para probar condiciones del mundo real con nuestra inteligencia autónoma: 48 estados de EE. UU., 96 rutas y cerca de 100 ciudades, divididas en categorías de centro urbano y suburbio, usando geometría de calles real.",
        },
        {
          title: "Simulación de Tráfico en Vivo",
          text: "Las calles nunca están vacías. Cada simulación ejecuta simultáneamente más de 50 agentes de IA en tiempo real, junto con condiciones dinámicas —cruces peatonales, cañones urbanos con pérdida de GPS, tres niveles de tráfico y tres estados climáticos— con un objetivo de 60 FPS en tiempo real.",
        },
        {
          title: "Hardware Propio",
          text: "La inteligencia que entrenamos en simulación se despliega en dos vehículos reales construidos sobre una única filosofía de chasis modular: el AFK +City Shuttle, una plataforma de tránsito autónomo de Nivel 4/5, y el AFK MRC 1.0, un robot de reparto autónomo optimizado para la última milla.",
        },
        {
          title: "Ingeniería de Nexro AI",
          text: "El corazón de software del proyecto está construido sobre TypeScript y React (Next.js) modernos y con tipado seguro, sin pilas tecnológicas obsoletas. La gestión de estado con Zustand mueve datos de simulación, coordenadas de rutas y análisis de IA entre cinco paneles dinámicos sin latencia perceptible.",
        },
        {
          title: "Asistente de IA Multilingüe",
          text: "Nuestro asistente de IA integrado no solo opera el vehículo: informa sobre el clima, el estado de la vía y las optimizaciones de ruta al operador en 12 idiomas, en tiempo real.",
        },
        {
          title: "Diseñado para Tolerar Fallos",
          text: "Incluso una interrupción de milisegundos en el flujo de datos de IA nunca hará colapsar el sistema. Este pasa automáticamente a un modo seguro, manteniendo en marcha el vehículo y la simulación con algoritmos base.",
        },
      ],
    },
    closing:
      "El objetivo final de AFK Nexro no es seguir siendo un sistema cerrado. Su arquitectura está diseñada para convertirse en un adaptador universal —instalable en dispositivos, drones o vehículos de otros fabricantes— conectándolos a la red de Inteligencia de Enjambre de Nexro y haciéndolos \"inteligentes\" en cuestión de segundos. No esperamos el futuro: lo construimos, lo simulamos y lo llevamos a las calles.",
  },

  fr: {
    metaTitle: "Notre Avenir | BogaStock & AFK Nexro AI",
    metaDescription:
      "Un regard approfondi sur les deux écosystèmes derrière notre entreprise : BogaStock, une plateforme d'intelligence financière, et AFK Nexro AI, un système d'exploitation pour la mobilité autonome et les villes intelligentes.",
    badge: "NOTRE VISION",
    title: "Deux Écosystèmes, Une Seule Philosophie d'Ingénierie",
    subtitle:
      "Vous nous connaissez déjà en surface. Cette page va plus loin — dans l'échelle, la maturité et la vision à long terme derrière nos deux plateformes.",
    left: {
      eyebrow: "INTELLIGENCE FINANCIÈRE",
      brand: "BogaStock",
      tagline: "L'Écosystème d'Intelligence Financière",
      intro:
        "BogaStock n'est pas seulement un écran affichant des données boursières : c'est un système entièrement intégré qui lit le marché, traite l'information, gère sa propre présence sur les réseaux sociaux et teste ses propres décisions dans des simulations d'investissement en direct, sans intervention humaine.",
      stats: [
        { number: "24/7", label: "Surveillance autonome et continue du marché" },
        { number: "0", label: "Intervention manuelle nécessaire pour fonctionner" },
        { number: "6", label: "Langues d'interface entièrement localisées" },
        { number: "100+", label: "Langues comprises par BOGA Copilot" },
      ],
      sections: [
        {
          title: "Un Moteur d'Intelligence Toujours Actif",
          text: "BogaStock fonctionne comme un système unique et intégré — l'analyse du marché, l'évaluation des risques et la prise de décision tournent en continu, jour et nuit, sans personne aux commandes. Ce qu'une grande équipe gérerait manuellement, notre plateforme le traite comme une seule opération coordonnée et autonome.",
        },
        {
          title: "BOGA Copilot",
          text: "Le cœur de la plateforme n'est pas une simple couche de traduction statique. À mesure que les bilans, les prix et les tendances évoluent, et que le système se développe, Copilot continue d'apprendre — comprenant le contexte dans plus de 100 langues pour guider l'utilisateur en temps réel.",
        },
        {
          title: "Un Réseau de Scanners Autonomes",
          text: "Sous la surface, un réseau coordonné de scanners spécialisés — couvrant les configurations swing, les mouvements intrajournaliers et notre univers boursier plus large — surveille le marché en continu, repérant les figures chartistes et distillant les opportunités pour l'investisseur.",
        },
        {
          title: "AI Challenge",
          text: "Notre module le plus ambitieux : une IA qui ne se contente pas de prédire, mais gère activement un vrai portefeuille de 1 000 $ selon des règles strictes de gestion des risques, chaque décision étant enregistrée sur un registre entièrement transparent et inaltérable.",
        },
        {
          title: "Une Couche Autonome de Données et de Médias",
          text: "Le système n'analyse pas seulement le marché, il communique aussi à son sujet. X Studio suit en temps réel les mouvements du marché, l'activité des initiés et le calendrier des résultats, puis produit et publie du contenu de manière entièrement autonome, sans intervention humaine.",
        },
        {
          title: "Portée Mondiale",
          text: "L'interface est entièrement synchronisée en anglais, espagnol, français, portugais, indonésien et turc. Copilot étend cette portée à plus de 100 langues, supprimant efficacement la barrière linguistique pour les investisseurs du monde entier.",
        },
      ],
    },
    right: {
      eyebrow: "MOBILITÉ AUTONOME",
      brand: "AFK Nexro AI",
      tagline: "Système d'Exploitation pour les Villes Intelligentes et l'Avenir Autonome",
      intro:
        "AFK Nexro AI est un écosystème matériel, de simulation et d'intelligence artificielle conçu pour bouleverser les codes de la mobilité autonome et des technologies de ville intelligente. Notre objectif n'est pas seulement d'exploiter nos propres véhicules autonomes, mais de devenir une couche d'intelligence universelle connectant chaque futur appareil mobile au monde autonome.",
      stats: [
        { number: "48", label: "États américains couverts" },
        { number: "96", label: "Itinéraires réels simulés" },
        { number: "50+", label: "Agents IA de trafic en temps réel" },
        { number: "2", label: "Plateformes matérielles autonomes propriétaires" },
        { number: "12", label: "Langues parlées par l'assistant IA" },
        { number: "60 IPS", label: "Objectif de simulation en temps réel" },
      ],
      sections: [
        {
          title: "Réseau National de Simulation",
          text: "Nous avons créé un jumeau numérique pour tester des conditions réelles avec notre intelligence autonome : 48 états américains, 96 itinéraires et environ 100 villes, répartis entre centre-ville et banlieue, avec une géométrie de rues réelle.",
        },
        {
          title: "Simulation de Trafic en Direct",
          text: "Les rues ne sont jamais vides. Chaque simulation fait tourner simultanément plus de 50 agents IA en temps réel, avec des conditions dynamiques — passages piétons, canyons urbains à GPS dégradé, trois niveaux de densité de trafic et trois états météo — le tout visant 60 images par seconde en temps réel.",
        },
        {
          title: "Matériel Propriétaire",
          text: "L'intelligence entraînée en simulation est déployée sur deux véhicules réels conçus selon une philosophie de châssis modulaire unique : l'AFK +City Shuttle, une plateforme de transport autonome de Niveau 4/5, et l'AFK MRC 1.0, un robot de livraison autonome optimisé pour le dernier kilomètre.",
        },
        {
          title: "Ingénierie Nexro AI",
          text: "Le cœur logiciel du projet repose sur du TypeScript et du React (Next.js) modernes et type-safe — sans pile technologique héritée. La gestion d'état Zustand déplace les données de simulation, les coordonnées d'itinéraires et les analyses IA entre cinq panneaux dynamiques sans latence perceptible.",
        },
        {
          title: "Assistant IA Multilingue",
          text: "Notre assistant IA intégré ne se contente pas de piloter le véhicule : il rapporte la météo, l'état de la route et les optimisations d'itinéraire à l'opérateur en 12 langues, en temps réel.",
        },
        {
          title: "Conçu pour Tolérer les Pannes",
          text: "Même une interruption de l'ordre de la milliseconde dans le flux de données IA ne fera jamais planter le système. Il bascule automatiquement en mode sécurisé, maintenant le véhicule et la simulation grâce aux algorithmes de base.",
        },
      ],
    },
    closing:
      "L'objectif ultime d'AFK Nexro n'est pas de rester un système fermé. Son architecture est conçue pour devenir un adaptateur universel — installable sur les appareils, drones ou véhicules d'autres fabricants — les connectant au réseau d'Intelligence en Essaim de Nexro et les rendant « intelligents » en quelques secondes. Nous n'attendons pas l'avenir : nous le construisons, nous le simulons et nous le mettons dans la rue.",
  },

  pt: {
    metaTitle: "Nosso Futuro | BogaStock & AFK Nexro AI",
    metaDescription:
      "Um olhar mais profundo sobre os dois ecossistemas por trás da nossa empresa: BogaStock, uma plataforma de inteligência financeira, e AFK Nexro AI, um sistema operacional para mobilidade autônoma e cidades inteligentes.",
    badge: "NOSSA VISÃO",
    title: "Dois Ecossistemas, Uma Só Filosofia de Engenharia",
    subtitle:
      "Você já nos conhece pela superfície. Esta página vai mais fundo — na escala, na maturidade e na visão de longo prazo por trás das nossas duas plataformas.",
    left: {
      eyebrow: "INTELIGÊNCIA FINANCEIRA",
      brand: "BogaStock",
      tagline: "O Ecossistema de Inteligência Financeira",
      intro:
        "A BogaStock não é apenas uma tela que exibe dados de ações — é um sistema totalmente integrado que lê o mercado, processa informações, gerencia sua própria presença em redes sociais e testa suas próprias decisões em simulações de investimento ao vivo, tudo sem intervenção humana.",
      stats: [
        { number: "24/7", label: "Monitoramento autônomo e contínuo do mercado" },
        { number: "0", label: "Intervenção manual necessária para operar" },
        { number: "6", label: "Idiomas de interface totalmente localizados" },
        { number: "100+", label: "Idiomas compreendidos pelo BOGA Copilot" },
      ],
      sections: [
        {
          title: "Um Motor de Inteligência Sempre Ativo",
          text: "A BogaStock opera como um único sistema integrado — o escaneamento do mercado, a avaliação de risco e a tomada de decisão funcionam continuamente, 24 horas por dia, sem uma pessoa no comando. O que exigiria uma grande equipe para gerenciar manualmente, nossa plataforma trata como uma única operação coordenada e autônoma.",
        },
        {
          title: "BOGA Copilot",
          text: "O coração da plataforma não é uma camada de tradução estática. À medida que balanços, preços e tendências mudam, e o sistema evolui, o Copilot continua aprendendo — entendendo o contexto em mais de 100 idiomas para orientar o usuário em tempo real.",
        },
        {
          title: "Uma Rede de Scanners Autônomos",
          text: "Sob a superfície, uma rede coordenada de scanners especializados — cobrindo configurações swing, movimentos intradiários e nosso universo de ações mais amplo — vigia o mercado continuamente, capturando formações gráficas e destilando oportunidades para o investidor.",
        },
        {
          title: "AI Challenge",
          text: "Nosso módulo mais ambicioso: uma IA que não apenas prevê, mas gerencia ativamente uma carteira real de US$ 1.000 sob regras rígidas de gestão de risco, registrando cada decisão em um livro-razão totalmente transparente e inalterável.",
        },
        {
          title: "Uma Camada Autônoma de Dados e Mídia",
          text: "O sistema não apenas analisa o mercado — ele também comunica sobre ele. O X Studio acompanha em tempo real os movimentos do mercado, a atividade de insiders e o calendário de resultados, e então produz e publica conteúdo de forma totalmente autônoma, sem intervenção humana.",
        },
        {
          title: "Alcance Global",
          text: "A interface está totalmente sincronizada em inglês, espanhol, francês, português, indonésio e turco. O Copilot amplia esse alcance para mais de 100 idiomas, eliminando efetivamente a barreira do idioma para investidores em qualquer lugar.",
        },
      ],
    },
    right: {
      eyebrow: "MOBILIDADE AUTÔNOMA",
      brand: "AFK Nexro AI",
      tagline: "Sistema Operacional para Cidades Inteligentes e o Futuro Autônomo",
      intro:
        "A AFK Nexro AI é um ecossistema de hardware, simulação e inteligência artificial criado para romper paradigmas em mobilidade autônoma e tecnologias de cidades inteligentes. Nosso objetivo não é apenas operar nossos próprios veículos autônomos — é nos tornarmos uma camada de inteligência universal que conecta cada futuro dispositivo móvel ao mundo autônomo.",
      stats: [
        { number: "48", label: "Estados dos EUA cobertos" },
        { number: "96", label: "Rotas reais simuladas" },
        { number: "50+", label: "Agentes de IA de tráfego em tempo real" },
        { number: "2", label: "Plataformas de hardware autônomo próprias" },
        { number: "12", label: "Idiomas falados pelo assistente de IA" },
        { number: "60 FPS", label: "Meta de simulação em tempo real" },
      ],
      sections: [
        {
          title: "Rede Nacional de Simulação",
          text: "Criamos um gêmeo digital para testar condições do mundo real com nossa inteligência autônoma: 48 estados dos EUA, 96 rotas e cerca de 100 cidades, divididas entre centro urbano e subúrbio, usando geometria de ruas real.",
        },
        {
          title: "Simulação de Tráfego ao Vivo",
          text: "As ruas nunca estão vazias. Cada simulação executa simultaneamente mais de 50 agentes de IA em tempo real, junto com condições dinâmicas — travessias de pedestres, cânions urbanos com perda de GPS, três níveis de densidade de tráfego e três estados climáticos — tudo com meta de 60 FPS em tempo real.",
        },
        {
          title: "Hardware Proprietário",
          text: "A inteligência que treinamos em simulação é implantada em dois veículos reais construídos sobre uma única filosofia de chassi modular: o AFK +City Shuttle, uma plataforma de transporte autônomo de Nível 4/5, e o AFK MRC 1.0, um robô de entrega autônomo otimizado para a última milha.",
        },
        {
          title: "Engenharia Nexro AI",
          text: "O coração de software do projeto é construído sobre TypeScript e React (Next.js) modernos e type-safe — sem pilhas de tecnologia legadas. O gerenciamento de estado com Zustand move dados de simulação, coordenadas de rotas e análises de IA entre cinco painéis dinâmicos sem latência perceptível.",
        },
        {
          title: "Assistente de IA Multilíngue",
          text: "Nosso assistente de IA integrado não apenas opera o veículo — ele relata condições climáticas, estado da via e otimizações de rota ao operador em 12 idiomas, em tempo real.",
        },
        {
          title: "Projetado para Tolerar Falhas",
          text: "Mesmo uma interrupção de milissegundos no fluxo de dados da IA nunca derruba o sistema. Ele entra automaticamente em modo seguro, mantendo o veículo e a simulação funcionando com algoritmos essenciais.",
        },
      ],
    },
    closing:
      "O objetivo final da AFK Nexro não é permanecer um sistema fechado. Sua arquitetura é projetada para se tornar um adaptador universal — instalável em dispositivos, drones ou veículos de outros fabricantes — conectando-os à rede de Inteligência de Enxame da Nexro e tornando-os \"inteligentes\" em segundos. Não estamos esperando o futuro: estamos construindo, simulando e colocando-o nas ruas.",
  },

  id: {
    metaTitle: "Masa Depan Kami | BogaStock & AFK Nexro AI",
    metaDescription:
      "Tinjauan lebih dalam tentang dua ekosistem di balik perusahaan kami: BogaStock, platform kecerdasan finansial, dan AFK Nexro AI, sistem operasi untuk mobilitas otonom dan kota pintar.",
    badge: "VISI KAMI",
    title: "Dua Ekosistem, Satu Filosofi Rekayasa",
    subtitle:
      "Anda sudah mengenal kami secara permukaan. Halaman ini membahas lebih dalam — skala, kematangan, dan visi jangka panjang di balik kedua platform kami.",
    left: {
      eyebrow: "KECERDASAN FINANSIAL",
      brand: "BogaStock",
      tagline: "Ekosistem Kecerdasan Finansial",
      intro:
        "BogaStock bukan sekadar layar yang menampilkan data saham — ini adalah sistem yang sepenuhnya terintegrasi yang membaca pasar, memproses informasi, mengelola kehadiran media sosialnya sendiri, dan menguji keputusannya sendiri dalam simulasi investasi langsung, semuanya tanpa campur tangan manusia.",
      stats: [
        { number: "24/7", label: "Pemantauan pasar otonom yang berkelanjutan" },
        { number: "0", label: "Intervensi manual yang diperlukan untuk beroperasi" },
        { number: "6", label: "Bahasa antarmuka yang sepenuhnya dilokalkan" },
        { number: "100+", label: "Bahasa yang dipahami BOGA Copilot" },
      ],
      sections: [
        {
          title: "Mesin Kecerdasan yang Selalu Aktif",
          text: "BogaStock beroperasi sebagai satu sistem terintegrasi — pemindaian pasar, penilaian risiko, dan pengambilan keputusan berjalan terus-menerus, sepanjang waktu, tanpa manusia di belakang kendali. Apa yang membutuhkan tim besar untuk dikelola secara manual, platform kami tangani sebagai satu operasi yang terkoordinasi dan mengarahkan dirinya sendiri.",
        },
        {
          title: "BOGA Copilot",
          text: "Jantung dari platform ini bukan lapisan terjemahan statis. Seiring perubahan neraca, harga, dan tren, serta perkembangan sistem, Copilot terus belajar — memahami konteks dalam lebih dari 100 bahasa untuk membimbing pengguna secara real-time.",
        },
        {
          title: "Jaringan Pemindai Otonom",
          text: "Di balik layar, jaringan pemindai khusus yang terkoordinasi — mencakup setup swing, pergerakan intraday, dan cakupan saham kami yang lebih luas — mengawasi pasar sepanjang waktu, menangkap formasi grafik dan menyaring peluang bagi investor.",
        },
        {
          title: "AI Challenge",
          text: "Modul paling ambisius kami: AI yang tidak hanya memprediksi, tetapi secara aktif mengelola portofolio nyata senilai $1.000 di bawah aturan manajemen risiko yang ketat, dengan setiap keputusan dicatat pada buku besar yang sepenuhnya transparan dan tidak dapat diubah.",
        },
        {
          title: "Lapisan Data & Media Otonom",
          text: "Sistem ini tidak hanya menganalisis pasar — tetapi juga berkomunikasi tentangnya. X Studio melacak pergerakan pasar, aktivitas insider, dan kalender pendapatan secara real-time, lalu memproduksi dan mempublikasikan konten sepenuhnya secara mandiri, tanpa campur tangan manusia.",
        },
        {
          title: "Jangkauan Global",
          text: "Antarmuka disinkronkan sepenuhnya dalam bahasa Inggris, Spanyol, Prancis, Portugis, Indonesia, dan Turki. Copilot memperluas jangkauan tersebut hingga 100+ bahasa, secara efektif menghilangkan hambatan bahasa bagi investor di mana pun.",
        },
      ],
    },
    right: {
      eyebrow: "MOBILITAS OTONOM",
      brand: "AFK Nexro AI",
      tagline: "Sistem Operasi untuk Kota Pintar & Masa Depan Otonom",
      intro:
        "AFK Nexro AI adalah ekosistem perangkat keras, simulasi, dan kecerdasan buatan yang dibangun untuk menerobos batasan dalam teknologi mobilitas otonom dan kota pintar. Tujuan kami bukan hanya mengoperasikan kendaraan otonom kami sendiri — melainkan menjadi lapisan kecerdasan universal yang menghubungkan setiap perangkat bergerak masa depan ke dunia otonom.",
      stats: [
        { number: "48", label: "Negara bagian AS yang tercakup" },
        { number: "96", label: "Rute nyata yang disimulasikan" },
        { number: "50+", label: "Agen AI lalu lintas real-time" },
        { number: "2", label: "Platform perangkat keras otonom eksklusif" },
        { number: "12", label: "Bahasa yang digunakan asisten AI" },
        { number: "60 FPS", label: "Target simulasi real-time" },
      ],
      sections: [
        {
          title: "Jaringan Simulasi Nasional",
          text: "Kami membangun kembaran digital untuk menguji kondisi dunia nyata dengan kecerdasan otonom kami: 48 negara bagian AS, 96 rute, dan sekitar 100 kota, terbagi antara kategori pusat kota dan pinggiran, menggunakan geometri jalan yang nyata.",
        },
        {
          title: "Simulasi Lalu Lintas Langsung",
          text: "Jalanan tidak pernah kosong. Setiap simulasi menjalankan lebih dari 50 agen AI real-time secara bersamaan, bersama kondisi dinamis — penyeberangan pejalan kaki, kanyon perkotaan dengan sinyal GPS lemah, tiga tingkat kepadatan lalu lintas, dan tiga kondisi cuaca — semuanya menargetkan 60 FPS secara real-time.",
        },
        {
          title: "Perangkat Keras Eksklusif",
          text: "Kecerdasan yang kami latih dalam simulasi diterapkan pada dua kendaraan dunia nyata yang dibangun dengan satu filosofi sasis modular: AFK +City Shuttle, platform transit otonom Level 4/5, dan AFK MRC 1.0, robot pengiriman otonom yang dioptimalkan untuk logistik jarak akhir.",
        },
        {
          title: "Rekayasa Nexro AI",
          text: "Jantung perangkat lunak proyek ini dibangun di atas TypeScript dan React (Next.js) modern yang type-safe — tanpa tumpukan teknologi lama. Manajemen status Zustand memindahkan data simulasi, koordinat rute, dan analisis AI di lima panel dinamis tanpa jeda yang terasa.",
        },
        {
          title: "Asisten AI Multibahasa",
          text: "Asisten AI terintegrasi kami tidak hanya mengoperasikan kendaraan — ia juga melaporkan cuaca, kondisi jalan, dan optimasi rute kepada operator dalam 12 bahasa, secara real-time.",
        },
        {
          title: "Dirancang Tahan Gangguan",
          text: "Bahkan gangguan tingkat milidetik pada aliran data AI tidak akan pernah membuat sistem crash. Sistem secara otomatis beralih ke mode aman, menjaga kendaraan dan simulasi tetap berjalan dengan algoritme inti.",
        },
      ],
    },
    closing:
      "Tujuan akhir AFK Nexro bukanlah tetap menjadi sistem tertutup. Arsitekturnya dirancang untuk menjadi adaptor universal — yang dapat dipasang pada perangkat, drone, atau kendaraan produsen lain — menghubungkannya ke jaringan Kecerdasan Kawanan Nexro dan membuatnya \"pintar\" dalam hitungan detik. Kami tidak menunggu masa depan; kami membangunnya, mensimulasikannya, dan membawanya ke jalanan.",
  },
};

export function getFutureContent(locale: Locale): FutureContent {
  return content[locale];
}
