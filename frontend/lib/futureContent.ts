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
      "A closer look at the two engineering ecosystems behind our company: BogaStock, a financial intelligence platform, and AFK Nexro AI, an autonomous mobility and smart-city operating system.",
    badge: "OUR VISION",
    title: "Two Ecosystems, One Engineering Philosophy",
    subtitle:
      "You already know us from the surface. This page goes deeper — into the architecture, the scale, and the long-term vision behind both of our platforms.",
    left: {
      eyebrow: "FINANCIAL INTELLIGENCE",
      brand: "BogaStock",
      tagline: "The Financial Intelligence Ecosystem",
      intro:
        "BogaStock is not just a screen that displays stock data — it is a massive system that reads the market, processes data, runs its own social media presence, and tests its own decisions in live investment simulations, all without human intervention.",
      stats: [
        { number: "250,000+", label: "Lines of proprietary code" },
        { number: "150+", label: "Autonomous background bots" },
        { number: "43", label: "Relational database modules" },
        { number: "296", label: "Unique dynamic screens" },
        { number: "100+", label: "Languages understood by Copilot" },
        { number: "6", label: "Fully localized UI languages" },
      ],
      sections: [
        {
          title: "Scale of the Architecture",
          text: "Around 158,000 lines of Python power the backend and AI layer — scanners, risk engines, and algorithmic decision-making. On top of that, roughly 97,000 lines of TypeScript / Next.js drive a sub-second, modern frontend. Together, the technical tree spans more than 10,000 files and components.",
        },
        {
          title: "BOGA Copilot",
          text: "The heart of the platform isn't a static translation layer. As balance sheets, prices, and trends change and the system evolves, Copilot keeps learning — understanding context across more than 100 languages to guide users in real time.",
        },
        {
          title: "The Autonomous Scanner Army",
          text: "Over 150 background scripts — including Swing, Inday, and the Top 100 Engine — scan the market around the clock, catching chart formations and distilling opportunities for investors.",
        },
        {
          title: "AI Challenge",
          text: "Our most ambitious module: an AI that doesn't just predict, but actively manages a $1,000 portfolio. It operates under real risk-engine constraints (max drawdown, position sizing) and records every decision on an immutable, blockchain-style ledger.",
        },
        {
          title: "Autonomous Data & Media Layer",
          text: "The system doesn't just analyze value — it markets it. X Studio tracks market moves, insider transactions, and earnings calendars in real time, then autonomously produces and schedules content for X (Twitter) without human input.",
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
        { number: "~23,000", label: "Lines of core architecture code" },
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
          text: "The software heart of the project is built on roughly 23,000 lines of modern, type-safe TypeScript and React (Next.js) — no legacy stacks. Zustand state management moves simulation data, route coordinates, and AI analysis across five dynamic panels with zero perceptible lag.",
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
      "AFK Nexro's ultimate goal isn't to stay a closed system. Its architecture is designed to become a universal adapter — installable on other manufacturers' devices, drones, or vehicles — connecting them to the Nexro Swarm Intelligence network and making them \"smart\" within seconds. We're not waiting for the future. We're coding it, simulating it, and putting it on the street.",
  },

  tr: {
    metaTitle: "Geleceğimiz | BogaStock & AFK Nexro AI",
    metaDescription:
      "Şirketimizin arkasındaki iki mühendislik ekosistemine daha yakından bakış: finansal zeka platformu BogaStock ve otonom mobilite işletim sistemi AFK Nexro AI.",
    badge: "VİZYONUMUZ",
    title: "İki Ekosistem, Tek Mühendislik Felsefesi",
    subtitle:
      "Bizi yüzeyden zaten tanıyorsunuz. Bu sayfa daha derine iniyor — her iki platformumuzun arkasındaki mimariye, ölçeğe ve uzun vadeli vizyona.",
    left: {
      eyebrow: "FİNANSAL ZEKA",
      brand: "BogaStock",
      tagline: "Finansal Zeka Ekosistemi",
      intro:
        "BOGAStock, yalnızca klasik hisse senedi verilerini sunan bir ekran değil; insan müdahalesi olmadan piyasayı okuyan, veriyi işleyen, kendi sosyal medyasını yöneten ve kendi kararlarını yatırım simülasyonlarında test eden devasa bir sistemdir.",
      stats: [
        { number: "250.000+", label: "Satır özel kod" },
        { number: "150+", label: "Otonom arka plan botu" },
        { number: "43", label: "İlişkisel veritabanı modülü" },
        { number: "296", label: "Benzersiz dinamik ekran" },
        { number: "100+", label: "Copilot'un anladığı dil" },
        { number: "6", label: "Tam yerelleştirilmiş arayüz dili" },
      ],
      sections: [
        {
          title: "Mimarinin Büyüklüğü",
          text: "~158.000 satır Python, backend ve AI katmanını güçlendiriyor: tarayıcılar, risk motorları, algoritmik karar mekanizmaları. Bunun üzerine ~97.000 satır TypeScript/Next.js, saniyenin altında tepki süresine sahip modern bir arayüz sunuyor. Teknik ağaç toplamda 10.000'den fazla dosya/bileşen barındırıyor.",
        },
        {
          title: "BOGA Copilot",
          text: "Platformun kalbi statik bir çeviri katmanı değil. Bilançolar, fiyatlar ve trendler değiştikçe ve sistem geliştikçe Copilot öğrenmeye devam ediyor; 100'den fazla dilde bağlamı anlayarak kullanıcıya anlık rehberlik ediyor.",
        },
        {
          title: "Otonom Tarayıcı Ordusu",
          text: "Swing, Inday ve Top 100 Engine dahil 150'den fazla arka plan scripti piyasayı 7/24 tarıyor, formasyonları yakalıyor ve yatırımcı için fırsatları damıtıyor.",
        },
        {
          title: "AI Challenge",
          text: "En iddialı modülümüz: sadece tahmin yapmayan, bizzat $1.000'lık bir portföyü yöneten bir yapay zeka. Gerçek risk motoru kısıtlamaları (Max Drawdown, Position Sizing) altında çalışır ve her kararı blockchain mantığıyla değiştirilemez bir işlem defterine kaydeder.",
        },
        {
          title: "Otonom Veri ve Medya Katmanı",
          text: "Sistem sadece analiz yapmakla kalmıyor, ürettiği değeri de pazarlıyor. X Studio, piyasa hareketlerini, içeriden öğrenenlerin alım-satımlarını ve kazanç takvimlerini gerçek zamanlı takip ediyor; insan müdahalesi olmadan X'te (Twitter) otonom içerik üretip yayınlıyor.",
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
        { number: "~23.000", label: "Satır çekirdek mimari kodu" },
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
          text: "Projenin yazılım kalbi ~23.000 satırlık modern, tip-güvenli TypeScript ve React (Next.js) üzerine kurulu — eski nesil hantal kod yığınları yok. Zustand state management, simülasyon verilerini, rota koordinatlarını ve AI analizlerini 5 dinamik panel arasında 0 gecikmeyle taşıyor.",
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
      "AFK Nexro AI'ın nihai hedefi kapalı bir sistem olarak kalmak değil. Mimarisi; farklı üreticilerin cihazlarına, dronlarına veya araçlarına yüklenerek onları Nexro Sürü Zekası ağına bağlayacak ve saniyeler içinde \"akıllı\" hale getirecek evrensel bir adaptör olmak üzere tasarlanıyor. Geleceği beklemiyoruz; onu kodluyor, simüle ediyor ve sokaklara indiriyoruz.",
  },

  es: {
    metaTitle: "Nuestro Futuro | BogaStock & AFK Nexro AI",
    metaDescription:
      "Una mirada más profunda a los dos ecosistemas de ingeniería detrás de nuestra empresa: BogaStock, una plataforma de inteligencia financiera, y AFK Nexro AI, un sistema operativo para movilidad autónoma y ciudades inteligentes.",
    badge: "NUESTRA VISIÓN",
    title: "Dos Ecosistemas, Una Sola Filosofía de Ingeniería",
    subtitle:
      "Ya nos conoces por la superficie. Esta página va más allá: la arquitectura, la escala y la visión a largo plazo detrás de ambas plataformas.",
    left: {
      eyebrow: "INTELIGENCIA FINANCIERA",
      brand: "BogaStock",
      tagline: "El Ecosistema de Inteligencia Financiera",
      intro:
        "BogaStock no es solo una pantalla que muestra datos bursátiles: es un sistema masivo que lee el mercado, procesa datos, gestiona su propia presencia en redes sociales y pone a prueba sus propias decisiones en simulaciones de inversión en vivo, todo sin intervención humana.",
      stats: [
        { number: "250.000+", label: "Líneas de código propio" },
        { number: "150+", label: "Bots autónomos en segundo plano" },
        { number: "43", label: "Módulos de bases de datos relacionales" },
        { number: "296", label: "Pantallas dinámicas únicas" },
        { number: "100+", label: "Idiomas que entiende Copilot" },
        { number: "6", label: "Idiomas de interfaz totalmente localizados" },
      ],
      sections: [
        {
          title: "Escala de la Arquitectura",
          text: "Cerca de 158.000 líneas de Python impulsan el backend y la capa de IA: rastreadores, motores de riesgo y mecanismos de decisión algorítmica. Sobre eso, unas 97.000 líneas de TypeScript/Next.js impulsan un frontend moderno con tiempos de respuesta inferiores al segundo. En conjunto, el árbol técnico supera los 10.000 archivos y componentes.",
        },
        {
          title: "BOGA Copilot",
          text: "El corazón de la plataforma no es una capa de traducción estática. A medida que cambian balances, precios y tendencias, y el sistema evoluciona, Copilot sigue aprendiendo, comprendiendo el contexto en más de 100 idiomas para guiar al usuario en tiempo real.",
        },
        {
          title: "El Ejército de Rastreadores Autónomos",
          text: "Más de 150 scripts en segundo plano —incluyendo Swing, Inday y el Top 100 Engine— rastrean el mercado las 24 horas, detectando formaciones y destilando oportunidades para el inversor.",
        },
        {
          title: "AI Challenge",
          text: "Nuestro módulo más ambicioso: una IA que no solo predice, sino que gestiona activamente una cartera de 1.000 USD, bajo restricciones reales de un motor de riesgo (máximo drawdown, tamaño de posición) y registra cada decisión en un libro de operaciones inmutable, con lógica de blockchain.",
        },
        {
          title: "Capa Autónoma de Datos y Medios",
          text: "El sistema no solo analiza valor, también lo promociona. X Studio sigue en tiempo real los movimientos del mercado, las operaciones de insiders y el calendario de resultados, y produce y publica contenido de forma autónoma en X (Twitter) sin intervención humana.",
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
        { number: "~23.000", label: "Líneas de código de arquitectura central" },
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
          text: "El corazón de software del proyecto está construido sobre unas 23.000 líneas de TypeScript y React (Next.js) modernos y con tipado seguro, sin pilas tecnológicas obsoletas. La gestión de estado con Zustand mueve datos de simulación, coordenadas de rutas y análisis de IA entre cinco paneles dinámicos sin latencia perceptible.",
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
      "El objetivo final de AFK Nexro no es seguir siendo un sistema cerrado. Su arquitectura está diseñada para convertirse en un adaptador universal —instalable en dispositivos, drones o vehículos de otros fabricantes— conectándolos a la red de Inteligencia de Enjambre de Nexro y haciéndolos \"inteligentes\" en cuestión de segundos. No esperamos el futuro: lo programamos, lo simulamos y lo llevamos a las calles.",
  },

  fr: {
    metaTitle: "Notre Avenir | BogaStock & AFK Nexro AI",
    metaDescription:
      "Un regard approfondi sur les deux écosystèmes d'ingénierie derrière notre entreprise : BogaStock, une plateforme d'intelligence financière, et AFK Nexro AI, un système d'exploitation pour la mobilité autonome et les villes intelligentes.",
    badge: "NOTRE VISION",
    title: "Deux Écosystèmes, Une Seule Philosophie d'Ingénierie",
    subtitle:
      "Vous nous connaissez déjà en surface. Cette page va plus loin — dans l'architecture, l'échelle et la vision à long terme derrière nos deux plateformes.",
    left: {
      eyebrow: "INTELLIGENCE FINANCIÈRE",
      brand: "BogaStock",
      tagline: "L'Écosystème d'Intelligence Financière",
      intro:
        "BogaStock n'est pas seulement un écran affichant des données boursières : c'est un système massif qui lit le marché, traite les données, gère sa propre présence sur les réseaux sociaux et teste ses propres décisions dans des simulations d'investissement en direct, sans intervention humaine.",
      stats: [
        { number: "250 000+", label: "Lignes de code propriétaire" },
        { number: "150+", label: "Bots autonomes en arrière-plan" },
        { number: "43", label: "Modules de bases de données relationnelles" },
        { number: "296", label: "Écrans dynamiques uniques" },
        { number: "100+", label: "Langues comprises par Copilot" },
        { number: "6", label: "Langues d'interface entièrement localisées" },
      ],
      sections: [
        {
          title: "L'Ampleur de l'Architecture",
          text: "Environ 158 000 lignes de Python alimentent le backend et la couche IA : scanners, moteurs de risque et mécanismes de décision algorithmique. À cela s'ajoutent près de 97 000 lignes de TypeScript/Next.js pour un frontend moderne à latence inférieure à la seconde. Ensemble, l'arborescence technique compte plus de 10 000 fichiers et composants.",
        },
        {
          title: "BOGA Copilot",
          text: "Le cœur de la plateforme n'est pas une simple couche de traduction statique. À mesure que les bilans, les prix et les tendances évoluent, et que le système se développe, Copilot continue d'apprendre — comprenant le contexte dans plus de 100 langues pour guider l'utilisateur en temps réel.",
        },
        {
          title: "L'Armée de Scanners Autonomes",
          text: "Plus de 150 scripts en arrière-plan — dont Swing, Inday et le Top 100 Engine — scrutent le marché 24 h/24, repèrent les figures chartistes et distillent les opportunités pour l'investisseur.",
        },
        {
          title: "AI Challenge",
          text: "Notre module le plus ambitieux : une IA qui ne se contente pas de prédire, mais gère activement un portefeuille de 1 000 $. Elle opère sous de véritables contraintes de moteur de risque (drawdown maximal, dimensionnement des positions) et enregistre chaque décision sur un registre immuable de type blockchain.",
        },
        {
          title: "Couche Autonome de Données et de Médias",
          text: "Le système n'analyse pas seulement la valeur, il la promeut aussi. X Studio suit en temps réel les mouvements du marché, les transactions d'initiés et le calendrier des résultats, puis produit et programme de manière autonome du contenu sur X (Twitter) sans intervention humaine.",
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
        { number: "~23 000", label: "Lignes de code d'architecture principale" },
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
          text: "Le cœur logiciel du projet repose sur environ 23 000 lignes de TypeScript et React (Next.js) modernes et type-safe — sans pile technologique héritée. La gestion d'état Zustand déplace les données de simulation, les coordonnées d'itinéraires et les analyses IA entre cinq panneaux dynamiques sans latence perceptible.",
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
      "L'objectif ultime d'AFK Nexro n'est pas de rester un système fermé. Son architecture est conçue pour devenir un adaptateur universel — installable sur les appareils, drones ou véhicules d'autres fabricants — les connectant au réseau d'Intelligence en Essaim de Nexro et les rendant « intelligents » en quelques secondes. Nous n'attendons pas l'avenir : nous le codons, le simulons et le mettons dans la rue.",
  },

  pt: {
    metaTitle: "Nosso Futuro | BogaStock & AFK Nexro AI",
    metaDescription:
      "Um olhar mais profundo sobre os dois ecossistemas de engenharia por trás da nossa empresa: BogaStock, uma plataforma de inteligência financeira, e AFK Nexro AI, um sistema operacional para mobilidade autônoma e cidades inteligentes.",
    badge: "NOSSA VISÃO",
    title: "Dois Ecossistemas, Uma Só Filosofia de Engenharia",
    subtitle:
      "Você já nos conhece pela superfície. Esta página vai mais fundo — na arquitetura, na escala e na visão de longo prazo por trás das nossas duas plataformas.",
    left: {
      eyebrow: "INTELIGÊNCIA FINANCEIRA",
      brand: "BogaStock",
      tagline: "O Ecossistema de Inteligência Financeira",
      intro:
        "A BogaStock não é apenas uma tela que exibe dados de ações — é um sistema massivo que lê o mercado, processa dados, gerencia sua própria presença em redes sociais e testa suas próprias decisões em simulações de investimento ao vivo, tudo sem intervenção humana.",
      stats: [
        { number: "250.000+", label: "Linhas de código próprio" },
        { number: "150+", label: "Bots autônomos em segundo plano" },
        { number: "43", label: "Módulos de bancos de dados relacionais" },
        { number: "296", label: "Telas dinâmicas exclusivas" },
        { number: "100+", label: "Idiomas compreendidos pelo Copilot" },
        { number: "6", label: "Idiomas de interface totalmente localizados" },
      ],
      sections: [
        {
          title: "Escala da Arquitetura",
          text: "Cerca de 158.000 linhas de Python alimentam o backend e a camada de IA: scanners, motores de risco e mecanismos de decisão algorítmica. Além disso, cerca de 97.000 linhas de TypeScript/Next.js sustentam um frontend moderno com latência abaixo de um segundo. Juntos, a árvore técnica ultrapassa 10.000 arquivos e componentes.",
        },
        {
          title: "BOGA Copilot",
          text: "O coração da plataforma não é uma camada de tradução estática. À medida que balanços, preços e tendências mudam, e o sistema evolui, o Copilot continua aprendendo — entendendo o contexto em mais de 100 idiomas para orientar o usuário em tempo real.",
        },
        {
          title: "O Exército de Scanners Autônomos",
          text: "Mais de 150 scripts em segundo plano — incluindo Swing, Inday e o Top 100 Engine — escaneiam o mercado 24 horas por dia, capturando formações gráficas e destilando oportunidades para o investidor.",
        },
        {
          title: "AI Challenge",
          text: "Nosso módulo mais ambicioso: uma IA que não apenas prevê, mas gerencia ativamente uma carteira de US$ 1.000. Ela opera sob restrições reais de um motor de risco (drawdown máximo, dimensionamento de posição) e registra cada decisão em um livro-razão imutável, com lógica de blockchain.",
        },
        {
          title: "Camada Autônoma de Dados e Mídia",
          text: "O sistema não apenas analisa valor — ele também o divulga. O X Studio acompanha em tempo real os movimentos do mercado, transações de insiders e o calendário de resultados, e produz e agenda conteúdo de forma autônoma no X (Twitter), sem intervenção humana.",
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
        { number: "~23.000", label: "Linhas de código da arquitetura principal" },
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
          text: "O coração de software do projeto é construído sobre cerca de 23.000 linhas de TypeScript e React (Next.js) modernos e type-safe — sem pilhas de tecnologia legadas. O gerenciamento de estado com Zustand move dados de simulação, coordenadas de rotas e análises de IA entre cinco painéis dinâmicos sem latência perceptível.",
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
      "O objetivo final da AFK Nexro não é permanecer um sistema fechado. Sua arquitetura é projetada para se tornar um adaptador universal — instalável em dispositivos, drones ou veículos de outros fabricantes — conectando-os à rede de Inteligência de Enxame da Nexro e tornando-os \"inteligentes\" em segundos. Não estamos esperando o futuro: estamos codificando, simulando e colocando-o nas ruas.",
  },

  id: {
    metaTitle: "Masa Depan Kami | BogaStock & AFK Nexro AI",
    metaDescription:
      "Tinjauan lebih dalam tentang dua ekosistem rekayasa di balik perusahaan kami: BogaStock, platform kecerdasan finansial, dan AFK Nexro AI, sistem operasi untuk mobilitas otonom dan kota pintar.",
    badge: "VISI KAMI",
    title: "Dua Ekosistem, Satu Filosofi Rekayasa",
    subtitle:
      "Anda sudah mengenal kami secara permukaan. Halaman ini membahas lebih dalam — arsitektur, skala, dan visi jangka panjang di balik kedua platform kami.",
    left: {
      eyebrow: "KECERDASAN FINANSIAL",
      brand: "BogaStock",
      tagline: "Ekosistem Kecerdasan Finansial",
      intro:
        "BogaStock bukan sekadar layar yang menampilkan data saham — ini adalah sistem masif yang membaca pasar, memproses data, mengelola kehadiran media sosialnya sendiri, dan menguji keputusannya sendiri dalam simulasi investasi langsung, semuanya tanpa campur tangan manusia.",
      stats: [
        { number: "250.000+", label: "Baris kode eksklusif" },
        { number: "150+", label: "Bot otonom di latar belakang" },
        { number: "43", label: "Modul basis data relasional" },
        { number: "296", label: "Layar dinamis unik" },
        { number: "100+", label: "Bahasa yang dipahami Copilot" },
        { number: "6", label: "Bahasa antarmuka yang sepenuhnya dilokalkan" },
      ],
      sections: [
        {
          title: "Skala Arsitektur",
          text: "Sekitar 158.000 baris Python menggerakkan backend dan lapisan AI: pemindai, mesin risiko, dan mekanisme keputusan algoritmik. Di atasnya, sekitar 97.000 baris TypeScript/Next.js menggerakkan frontend modern dengan latensi di bawah satu detik. Secara keseluruhan, struktur teknisnya mencakup lebih dari 10.000 file dan komponen.",
        },
        {
          title: "BOGA Copilot",
          text: "Jantung dari platform ini bukan lapisan terjemahan statis. Seiring perubahan neraca, harga, dan tren, serta perkembangan sistem, Copilot terus belajar — memahami konteks dalam lebih dari 100 bahasa untuk membimbing pengguna secara real-time.",
        },
        {
          title: "Pasukan Pemindai Otonom",
          text: "Lebih dari 150 skrip latar belakang — termasuk Swing, Inday, dan Top 100 Engine — memindai pasar 24/7, menangkap formasi grafik, dan menyaring peluang bagi investor.",
        },
        {
          title: "AI Challenge",
          text: "Modul paling ambisius kami: AI yang tidak hanya memprediksi, tetapi secara aktif mengelola portofolio senilai $1.000. AI ini beroperasi di bawah batasan mesin risiko yang sesungguhnya (max drawdown, position sizing) dan mencatat setiap keputusan pada buku besar yang tidak dapat diubah dengan logika blockchain.",
        },
        {
          title: "Lapisan Data & Media Otonom",
          text: "Sistem ini tidak hanya menganalisis nilai — tetapi juga memasarkannya. X Studio melacak pergerakan pasar, transaksi insider, dan kalender pendapatan secara real-time, lalu memproduksi dan menjadwalkan konten secara otonom di X (Twitter) tanpa campur tangan manusia.",
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
        { number: "~23.000", label: "Baris kode arsitektur inti" },
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
          text: "Jantung perangkat lunak proyek ini dibangun di atas sekitar 23.000 baris TypeScript dan React (Next.js) modern yang type-safe — tanpa tumpukan teknologi lama. Manajemen status Zustand memindahkan data simulasi, koordinat rute, dan analisis AI di lima panel dinamis tanpa jeda yang terasa.",
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
      "Tujuan akhir AFK Nexro bukanlah tetap menjadi sistem tertutup. Arsitekturnya dirancang untuk menjadi adaptor universal — yang dapat dipasang pada perangkat, drone, atau kendaraan produsen lain — menghubungkannya ke jaringan Kecerdasan Kawanan Nexro dan membuatnya \"pintar\" dalam hitungan detik. Kami tidak menunggu masa depan; kami mengodekannya, mensimulasikannya, dan membawanya ke jalanan.",
  },
};

export function getFutureContent(locale: Locale): FutureContent {
  return content[locale];
}
