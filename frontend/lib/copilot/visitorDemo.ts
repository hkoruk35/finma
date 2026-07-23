// BOGA Copilot Visitor Demo Content & Helper for 5 Languages (TR, EN, PT, ES, FR)

export type SupportedLocale = "tr" | "en" | "pt" | "es" | "fr";

export interface DemoState {
  language: SupportedLocale;
  primaryInterest?: string;
  timeHorizon?: string;
  followUpTopic?: string;
  demoStage: number;
  offerShown: boolean;
}

export interface DemoMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  buttons?: { label: string; id: string; action?: string; href?: string }[];
  stage?: number;
  stockCard?: any;
}

export const VISITOR_TEXTS: Record<SupportedLocale, {
  headerBadge: string;
  stage1Message: string;
  stage1Buttons: { label: string; id: string }[];
  stage2Message: string;
  stage2Buttons: { label: string; id: string }[];
  stage3Title: string;
  stage3Buttons: { label: string; id: string }[];
  disclaimer: string;
  objections: {
    price9: { keywords: string[]; response: string };
    otherStocks: { keywords: string[]; response: string };
    cancel: { keywords: string[]; response: string };
  };
  offerButtons: {
    summerOffer: string;
    details: string;
    returnChart: string;
  };
  featureMatches: Record<string, string>;
}> = {
  tr: {
    headerBadge: "ZİYARETÇİ DEMO",
    stage1Message: "Merhaba. Ben BOGA Copilot.\n\nSize yalnızca genel bir piyasa özeti vermek yerine, seçtiğiniz zaman aralığına ve amacınıza göre hisse analizi yapabilirim.\n\nÜcretsiz ziyaretçilere NVIDIA ($NVDA) üzerinde kısa ve kişiselleştirilmiş bir analiz sunuyorum. Üç kısa adımda ilerleyeceğiz.\n\nNVIDIA hakkında en çok neyi öğrenmek istiyorsunuz?",
    stage1Buttons: [
      { label: "Mevcut trend", id: "trend" },
      { label: "Olası giriş bölgesi", id: "potential_entry" },
      { label: "Temel riskler", id: "risk" },
      { label: "Kısa vadeli görünüm", id: "short_term_outlook" },
    ],
    stage2Message: "Trend görünümünü size daha uygun yorumlayabilmem için bir şeyi daha bilmem gerekiyor.\n\nNVIDIA’yı hangi zaman aralığında değerlendiriyorsunuz?",
    stage2Buttons: [
      { label: "Birkaç gün", id: "few_days" },
      { label: "Birkaç hafta", id: "few_weeks" },
      { label: "Birkaç ay", id: "few_months" },
      { label: "Uzun vadeli", id: "long_term" },
      { label: "Sadece inceliyorum", id: "exploring" },
    ],
    stage3Title: "Anladım. NVIDIA’yı seçtiğiniz zaman aralığı ve amacınız açısından değerlendiriyorum.",
    stage3Buttons: [
      { label: "Olası işlem senaryosu", id: "trade_scenario" },
      { label: "Görünümü bozacak risk", id: "risk_breakdown" },
      { label: "NVIDIA grafiğini yorumla", id: "chart_analysis" },
    ],
    disclaimer: "Bu bir alım veya satım talimatı değildir. Seviyeler, olası senaryoları ve risk koşullarını değerlendirmek amacıyla gösterilmektedir.",
    objections: {
      price9: {
        keywords: ["9", "usd", "her ay", "dolar"],
        response: "9 USD, yaz kampanyası kapsamında ilk ay için geçerlidir. Sonraki aylarda standart ücret 39 USD/ay olur. Yenileme öncesinde veya daha sonra istediğiniz zaman iptal edebilirsiniz.",
      },
      otherStocks: {
        keywords: ["başka", "hisse", "üye olmadan", "diğer"],
        response: "Ücretsiz ziyaretçi deneyimi NVIDIA ($NVDA) ile sınırlıdır. Üyelik etkinleştirildiğinde desteklenen tüm hisselerin grafiklerini ve analizlerini inceleyebilirsiniz.",
      },
      cancel: {
        keywords: ["iptal", "sonra", "edebilir miyim"],
        response: "Evet. Üyeliğinizi istediğiniz zaman iptal edebilirsiniz. İptal sonrasında yeni dönem için ücretlendirme yapılmaz ve mevcut erişiminiz ödenmiş dönem sonuna kadar devam eder.",
      },
    },
    offerButtons: {
      summerOffer: "9 USD yaz fırsatını yakala",
      details: "Üyelik detaylarını gör",
      returnChart: "NVIDIA grafiğine dön",
    },
    featureMatches: {
      trend: "Siz özellikle **trend devamlılığı ve en güçlü hisselerle** ilgilendiğiniz için BOGA Pro içinde en çok işinize yarayabilecek bölüm, akıllı hesaplamalarla güç kazanan **BOGA AI Trend Sistemleri ve Top 100 Listesi** olacaktır.",
      portfolio: "Takip etmek istediğiniz hisseler olduğu için sizin açınızdan en kullanışlı özellik, **50 hisseye kadar oluşturabileceğiniz kişisel takip listesi** olacaktır.",
      beginner: "Hangi hisseden başlayacağınızdan henüz emin olmadığınız için **BOGA AI Top 100 listesi** sizin için en pratik başlangıç noktası olacaktır.",
      chart: "NVIDIA’da deneyimlediğiniz **interaktif grafik, dinamik destek-direnç ve işlem kurgusu gerekçesi** yaklaşımını tüm hisselerde uygulayabilirsiniz.",
      cautious: "İlk ay **9 USD yaz fırsatıyla** tüm özellikleri risk üstlenmeden deneyebilir, istediğiniz zaman tek tıkla iptal edebilirsiniz.",
    },
  },
  en: {
    headerBadge: "VISITOR DEMO",
    stage1Message: "Hello. I’m BOGA Copilot.\n\nInstead of giving you a generic market summary, I can analyze a stock according to your objective and preferred time horizon.\n\nVisitors can try a short personalized analysis using NVIDIA ($NVDA). We will complete it in three simple steps.\n\nWhat would you most like to understand about NVIDIA?",
    stage1Buttons: [
      { label: "Current trend", id: "trend" },
      { label: "Potential entry area", id: "potential_entry" },
      { label: "Main risks", id: "risk" },
      { label: "Short-term outlook", id: "short_term_outlook" },
    ],
    stage2Message: "To interpret the trend in a way that is more relevant to you:\n\nWhat time horizon are you considering for NVIDIA?",
    stage2Buttons: [
      { label: "A few days", id: "few_days" },
      { label: "A few weeks", id: "few_weeks" },
      { label: "A few months", id: "few_months" },
      { label: "Long term", id: "long_term" },
      { label: "Just exploring", id: "exploring" },
    ],
    stage3Title: "Understood. Evaluating NVIDIA based on your selected time horizon and objective.",
    stage3Buttons: [
      { label: "Possible trade scenario", id: "trade_scenario" },
      { label: "Risk that could weaken the outlook", id: "risk_breakdown" },
      { label: "Interpret the NVIDIA chart", id: "chart_analysis" },
    ],
    disclaimer: "BOGA AI does not provide investment advice. Levels are shown to evaluate technical scenarios and risk conditions.",
    objections: {
      price9: {
        keywords: ["9", "usd", "month", "every"],
        response: "The USD 9 price applies to the first month under the summer campaign. The standard price of USD 39 per month applies afterward. You may cancel at any time.",
      },
      otherStocks: {
        keywords: ["other", "stock", "ask", "without"],
        response: "The free visitor experience is limited to NVIDIA ($NVDA). Membership unlocks charts and analysis for all supported stocks.",
      },
      cancel: {
        keywords: ["cancel", "later", "anytime"],
        response: "Yes. You may cancel at any time. You will not be charged for a new billing period after cancellation, and access continues until the end of the paid period.",
      },
    },
    offerButtons: {
      summerOffer: "Get the USD 9 summer offer",
      details: "View membership details",
      returnChart: "Return to NVIDIA chart",
    },
    featureMatches: {
      trend: "Because you are especially interested in **trend continuation**, one of the most useful BOGA Pro features for you would be the **smart trend-stock discovery system & Top 100 list**.",
      portfolio: "Because you have specific stocks you want to monitor, the most useful feature for you is the **personal watchlist of up to 50 stocks**.",
      beginner: "If you are unsure where to start, the **BOGA AI Top 100 list** gives you a ready-made starting point instead of searching randomly.",
      chart: "You can apply the exact same **interactive chart engine, support-resistance levels, and trade plan reasoning** to all supported stocks.",
      cautious: "You can test all features with the **USD 9 first month summer offer** with complete flexibility to cancel anytime.",
    },
  },
  pt: {
    headerBadge: "DEMO VISITANTE",
    stage1Message: "Olá. Eu sou o BOGA Copilot.\n\nEm vez de apresentar apenas um resumo genérico do mercado, posso analisar uma ação de acordo com o seu objetivo e horizonte de tempo.\n\nVisitantes podem experimentar uma breve análise personalizada usando a NVIDIA ($NVDA). Vamos concluir em três etapas simples.\n\nO que você mais gostaria de entender sobre a NVIDIA?",
    stage1Buttons: [
      { label: "Tendência atual", id: "trend" },
      { label: "Possível região de entrada", id: "potential_entry" },
      { label: "Principais riscos", id: "risk" },
      { label: "Perspectiva de curto prazo", id: "short_term_outlook" },
    ],
    stage2Message: "Para interpretar a tendência de uma forma mais adequada ao seu objetivo:\n\nPor quanto tempo você pretende acompanhar ou manter a NVIDIA?",
    stage2Buttons: [
      { label: "Alguns dias", id: "few_days" },
      { label: "Algumas semanas", id: "few_weeks" },
      { label: "Alguns meses", id: "few_months" },
      { label: "Longo prazo", id: "long_term" },
      { label: "Estou apenas conhecendo", id: "exploring" },
    ],
    stage3Title: "Entendi. Avaliando a NVIDIA com base no horizonte de tempo escolhido.",
    stage3Buttons: [
      { label: "Possível cenário de operação", id: "trade_scenario" },
      { label: "Risco que pode enfraquecer o cenário", id: "risk_breakdown" },
      { label: "Interpretar o gráfico da NVIDIA", id: "chart_analysis" },
    ],
    disclaimer: "A BOGA AI não oferece aconselhamento de investimento. Os níveis são exibidos para avaliar cenários técnicos.",
    objections: {
      price9: {
        keywords: ["9", "us$", "mês", "todo"],
        response: "O valor de US$ 9 é válido para o primeiro mês durante a campanha de verão. Depois, o valor passa a ser US$ 39 por mês. Você pode cancelar quando quiser.",
      },
      otherStocks: {
        keywords: ["outras", "ações", "perguntar", "sem"],
        response: "A experiência gratuita para visitantes é limitada à NVIDIA ($NVDA). A assinatura libera gráficos e análises de todas as ações disponíveis.",
      },
      cancel: {
        keywords: ["cancelar", "depois", "quando"],
        response: "Sim. Você pode cancelar quando quiser. Após o cancelamento, não haverá cobrança de um novo período, e o acesso continuará até o fim do período já pago.",
      },
    },
    offerButtons: {
      summerOffer: "Aproveitar a oferta de US$ 9",
      details: "Ver detalhes da assinatura",
      returnChart: "Voltar ao gráfico da NVIDIA",
    },
    featureMatches: {
      trend: "Como o seu principal interesse é identificar ações em tendência, um dos recursos mais úteis do BOGA Pro para você será o **sistema de descoberta de tendências e Top 100**.",
      portfolio: "Como você já acompanha ações específicas, o recurso mais conveniente será a **lista pessoal com até 50 ações**.",
      beginner: "Se você ainda não sabe por onde começar, a **lista Top 100 da BOGA AI** servirá como excelente ponto de partida.",
      chart: "Você poderá aplicar o mesmo **motor de gráfico interativo e estudo de níveis** a todas as ações.",
      cautious: "Aproveite o **primeiro mês por US$ 9 na campanha de verão** com total liberdade para cancelar quando quiser.",
    },
  },
  es: {
    headerBadge: "DEMO VISITANTE",
    stage1Message: "Hola. Soy BOGA Copilot.\n\nEn lugar de ofrecerte un resumen genérico del mercado, puedo analizar una acción según tu objetivo y horizonte de inversión.\n\nLos visitantes pueden probar un breve análisis personalizado utilizando NVIDIA ($NVDA). Lo completaremos en tres pasos sencillos.\n\n¿Qué te gustaría entender mejor sobre NVIDIA?",
    stage1Buttons: [
      { label: "Tendencia actual", id: "trend" },
      { label: "Posible zona de entrada", id: "potential_entry" },
      { label: "Riesgos principales", id: "risk" },
      { label: "Perspectiva a corto plazo", id: "short_term_outlook" },
    ],
    stage2Message: "Para interpretar la tendencia de una forma más útil para ti:\n\n¿Durante cuánto tiempo estás considerando mantener o seguir NVIDIA?",
    stage2Buttons: [
      { label: "Algunos días", id: "few_days" },
      { label: "Varias semanas", id: "few_weeks" },
      { label: "Algunos meses", id: "few_months" },
      { label: "Largo plazo", id: "long_term" },
      { label: "Solo estoy explorando", id: "exploring" },
    ],
    stage3Title: "Entendido. Evaluando NVIDIA según tu horizonte de tiempo seleccionado.",
    stage3Buttons: [
      { label: "Posible escenario de operación", id: "trade_scenario" },
      { label: "Riesgo que podría debilitar el escenario", id: "risk_breakdown" },
      { label: "Interpretar el gráfico de NVIDIA", id: "chart_analysis" },
    ],
    disclaimer: "BOGA AI no ofrece asesoramiento de inversión. Los niveles se muestran para evaluar escenarios técnicos.",
    objections: {
      price9: {
        keywords: ["9", "usd", "mes", "cada"],
        response: "El precio de 9 USD se aplica al primer mes durante la campaña de verano. Después, el precio será de 39 USD al mes. Puedes cancelar en cualquier momento.",
      },
      otherStocks: {
        keywords: ["otras", "acciones", "preguntar", "sin"],
        response: "La experiencia gratuita para visitantes está limitada a NVIDIA ($NVDA). La membresía permite acceder a gráficos y análisis de todas las acciones disponibles.",
      },
      cancel: {
        keywords: ["cancelar", "después", "cualquier"],
        response: "Sí. Puedes cancelar en cualquier momento. Después de cancelar, no se cobrará un nuevo período y el acceso continuará hasta el final del período ya pagado.",
      },
    },
    offerButtons: {
      summerOffer: "Aprovechar la oferta de 9 USD",
      details: "Ver detalles de la membresía",
      returnChart: "Volver al gráfico de NVIDIA",
    },
    featureMatches: {
      trend: "Como tu principal interés es encontrar acciones con tendencia, una de las funciones más útiles de BOGA Pro será el **sistema de detección de tendencias y la lista Top 100**.",
      portfolio: "Como tienes acciones específicas para seguir, la función más útil será la **lista personal de hasta 50 acciones**.",
      beginner: "Si no estás seguro de por dónde empezar, la **lista Top 100 de BOGA AI** te dará un punto de partida listo.",
      chart: "Podrás aplicar el mismo **gráfico interactivo y estudio de soporte/resistencia** a todas las acciones.",
      cautious: "Prueba todas las funciones con la **oferta de verano de 9 USD el primer mes** cancelando cuando quieras.",
    },
  },
  fr: {
    headerBadge: "DÉMO VISITEUR",
    stage1Message: "Bonjour. Je suis BOGA Copilot.\n\nAu lieu de vous fournir un simple résumé général du marché, je peux analyser une action selon votre objectif et votre horizon d’investissement.\n\nLes visiteurs peuvent essayer une courte analyse personnalisée de NVIDIA ($NVDA). Nous la réaliserons en trois étapes simples.\n\nQue souhaitez-vous principalement comprendre concernant NVIDIA ?",
    stage1Buttons: [
      { label: "Tendance actuelle", id: "trend" },
      { label: "Zone d’entrée potentielle", id: "potential_entry" },
      { label: "Principaux risques", id: "risk" },
      { label: "Perspectives à court terme", id: "short_term_outlook" },
    ],
    stage2Message: "Pour interpréter la tendance de manière plus adaptée à votre situation :\n\nPendant combien de temps envisagez-vous de suivre ou de conserver NVIDIA ?",
    stage2Buttons: [
      { label: "Quelques jours", id: "few_days" },
      { label: "Quelques semaines", id: "few_weeks" },
      { label: "Quelques mois", id: "few_months" },
      { label: "Long terme", id: "long_term" },
      { label: "Je découvre simplement", id: "exploring" },
    ],
    stage3Title: "Compris. Évaluation de NVIDIA selon l'horizon temporel choisi.",
    stage3Buttons: [
      { label: "Scénario potentiel", id: "trade_scenario" },
      { label: "Risque susceptible d’affaiblir le scénario", id: "risk_breakdown" },
      { label: "Interpréter le graphique NVIDIA", id: "chart_analysis" },
    ],
    disclaimer: "BOGA AI ne fournit pas de conseils en investissement. Les niveaux sont présentés pour évaluer les scénarios techniques.",
    objections: {
      price9: {
        keywords: ["9", "usd", "mois", "chaque"],
        response: "Le tarif de 9 USD s’applique au premier mois dans le cadre de la campagne d’été. Ensuite, l’abonnement passe à 39 USD par mois. Vous pouvez annuler à tout moment.",
      },
      otherStocks: {
        keywords: ["autres", "actions", "demander", "sans"],
        response: "L’expérience gratuite destinée aux visiteurs est limitée à NVIDIA ($NVDA). L’abonnement donne accès aux graphiques et aux analyses de toutes les actions disponibles.",
      },
      cancel: {
        keywords: ["annuler", "plus tard", "moment"],
        response: "Oui. Vous pouvez annuler à tout moment. Aucun nouveau cycle ne sera facturé après l’annulation, et l’accès restera actif jusqu’à la fin de la période déjà payée.",
      },
    },
    offerButtons: {
      summerOffer: "Profiter de l’offre à 9 USD",
      details: "Voir les détails de l’abonnement",
      returnChart: "Revenir au graphique NVIDIA",
    },
    featureMatches: {
      trend: "Comme votre priorité est d’identifier des actions en tendance, l’une des fonctionnalités les plus utiles sera le **système de détection des tendances et la liste Top 100**.",
      portfolio: "Pour suivre vos actions clés, la fonctionnalité la plus adaptée sera votre **liste personnelle jusqu’à 50 actions**.",
      beginner: "Si vous hésitez par où commencer, la **liste Top 100 de BOGA AI** vous offre un point de départ idéal.",
      chart: "Vous pourrez utiliser le même **moteur graphique interactif et étude de niveaux** sur l'ensemble des actions.",
      cautious: "Profitez du **premier mois à 9 USD avec l'offre d'été** sans aucun engagement de durée.",
    },
  },
};
