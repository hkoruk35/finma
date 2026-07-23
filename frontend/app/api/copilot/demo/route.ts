import { NextRequest, NextResponse } from "next/server";
import { getRealStockCardData } from "@/lib/copilot/stockData";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";
import { VISITOR_TEXTS, SupportedLocale } from "@/lib/copilot/visitorDemo";

export const maxDuration = 30;

function resolveLocale(raw: any): SupportedLocale {
  return ["tr", "en", "es", "fr", "pt"].includes(raw) ? raw : "en";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawLocale = body.locale;
    const locale = resolveLocale(rawLocale);
    const stage = Number(body.stage || 1);
    const primaryInterest = body.primaryInterest || "trend";
    const timeHorizon = body.timeHorizon || "few_weeks";
    const userMessage = (body.userMessage || "").trim().toLowerCase();

    const textDef = VISITOR_TEXTS[locale] || VISITOR_TEXTS.en;

    // Check for standard objection responses if user typed free text
    if (userMessage) {
      for (const key of ["price9", "otherStocks", "cancel"] as const) {
        const obj = textDef.objections[key];
        if (obj.keywords.some((k) => userMessage.includes(k))) {
          return NextResponse.json({
            reply: obj.response,
            buttons: [
              { label: textDef.offerButtons.summerOffer, action: "offer_signup", href: `/global/${locale}/register?plan=summer9` },
              { label: textDef.offerButtons.details, action: "offer_details", href: `/global/${locale}/register` },
              { label: textDef.offerButtons.returnChart, action: "return_chart", href: `/global/${locale}/graphic/NVDA` },
            ],
            stage: 5,
          });
        }
      }
    }

    // Fetch REAL live NVDA data from the platform
    const cardData = await getRealStockCardData("NVDA", locale);
    const techData = await getTechnicalLevels("NVDA");

    const price = techData?.currentPrice ?? 125.40;
    const support = cardData?.support ?? techData?.nearestSupport ?? 118.50;
    const resistance = cardData?.resistance ?? techData?.nearestResistance ?? 132.00;
    const bogaScore = cardData?.bogaScore ?? 84;
    const trendLabel = cardData?.trend ?? "BULLISH";
    const rsi = techData?.rsi14 ?? 58.2;
    const momentum = techData?.rsiTrend5d === "rising" ? "Yükselen Momentum (Güçlü)" : "Dengeli Momentum";
    const riskLevel = cardData?.riskLevel ?? "Orta";
    const invalidationLevel = (support * 0.96).toFixed(2);

    if (stage === 3) {
      // Stage 3: Personalized NVDA Analysis
      let horizonText = "birkaç haftalık";
      if (timeHorizon === "few_days") horizonText = "birkaç günlük";
      if (timeHorizon === "few_months") horizonText = "birkaç aylık";
      if (timeHorizon === "long_term") horizonText = "uzun vadeli";
      if (timeHorizon === "exploring") horizonText = "genel inceleme";

      let analysisContent = "";
      if (locale === "tr") {
        analysisContent = `Anladım. NVIDIA'yı ($NVDA) **${horizonText}** bir pozisyon ve görünüm açısından değerlendiriyorum.\n\n` +
          `• **Mevcut trend:** ${trendLabel}\n` +
          `• **BOGA skoru:** ${bogaScore}/100\n` +
          `• **Destek bölgesi:** $${support}\n` +
          `• **Direnç bölgesi:** $${resistance}\n` +
          `• **RSI (14):** ${rsi}\n` +
          `• **Momentum:** ${momentum}\n` +
          `• **Risk seviyesi:** ${riskLevel}\n\n` +
          `Seçtiğiniz **${horizonText}** yaklaşımınız açısından en önemli nokta, fiyatın **$${support}** üzerinde kalması ve momentumun pozitif seyrini korumasıdır.\n\n` +
          `Fiyat **$${resistance}** üzerinde teyit oluşturursa teknik görünüm güçlenebilir. **$${invalidationLevel}** altındaki hareket ise mevcut senaryonun yeniden değerlendirilmesini gerektirebilir.\n\n` +
          `Son adımda hangisini detaylı inceleyelim?`;
      } else if (locale === "pt") {
        analysisContent = `Entendi. Avaliando a NVIDIA ($NVDA) do ponto de vista de **${timeHorizon}**.\n\n` +
          `• **Tendência atual:** ${trendLabel}\n` +
          `• **Pontuação BOGA:** ${bogaScore}/100\n` +
          `• **Região de suporte:** $${support}\n` +
          `• **Região de resistência:** $${resistance}\n` +
          `• **RSI (14):** ${rsi}\n` +
          `• **Nível de risco:** ${riskLevel}\n\n` +
          `Para o horizonte escolhido, o ponto mais importante é a capacidade do preço de permanecer acima de **$${support}**.\n\n` +
          `Um movimento confirmado acima de **$${resistance}** pode fortalecer o cenário técnico. Uma queda abaixo de **$${invalidationLevel}** pode exigir uma nova avaliação.\n\n` +
          `Qual ponto você gostaria de analisar na etapa final?`;
      } else if (locale === "es") {
        analysisContent = `Entendido. Evaluando NVIDIA ($NVDA) desde la perspectiva de **${timeHorizon}**.\n\n` +
          `• **Tendencia actual:** ${trendLabel}\n` +
          `• **Puntuación BOGA:** ${bogaScore}/100\n` +
          `• **Zona de soporte:** $${support}\n` +
          `• **Zona de resistencia:** $${resistance}\n` +
          `• **RSI (14):** ${rsi}\n` +
          `• **Nivel de riesgo:** ${riskLevel}\n\n` +
          `Para el horizonte seleccionado, el punto más importante es que el precio se mantenga por encima de **$${support}**.\n\n` +
          `Un movimiento confirmado por encima de **$${resistance}** podría fortalecer el escenario técnico. Una caída por debajo de **$${invalidationLevel}** exigirá una nueva evaluación.\n\n` +
          `¿Qué punto quieres que analice para terminar?`;
      } else if (locale === "fr") {
        analysisContent = `Compris. Évaluation de NVIDIA ($NVDA) dans la perspective de **${timeHorizon}**.\n\n` +
          `• **Tendance actuelle :** ${trendLabel}\n` +
          `• **Score BOGA :** ${bogaScore}/100\n` +
          `• **Zone de support :** $${support}\n` +
          `• **Zone de résistance :** $${resistance}\n` +
          `• **RSI (14) :** ${rsi}\n` +
          `• **Niveau de risque :** ${riskLevel}\n\n` +
          `Pour l’horizon choisi, le point le plus important est la capacité du cours à rester au-dessus de **$${support}**.\n\n` +
          `Un mouvement confirmé au-dessus de **$${resistance}** pourrait renforcer le scénario technique.\n\n` +
          `Quel dernier point souhaitez-vous que j’examine ?`;
      } else {
        analysisContent = `Understood. Evaluating NVIDIA ($NVDA) based on your **${timeHorizon}** position perspective.\n\n` +
          `• **Current trend:** ${trendLabel}\n` +
          `• **BOGA score:** ${bogaScore}/100\n` +
          `• **Support area:** $${support}\n` +
          `• **Resistance area:** $${resistance}\n` +
          `• **RSI (14):** ${rsi}\n` +
          `• **Risk level:** ${riskLevel}\n\n` +
          `For your selected time horizon, the most important factor is whether the price can remain above **$${support}** while momentum holds.\n\n` +
          `A confirmed move above **$${resistance}** could strengthen the technical outlook. A move below **$${invalidationLevel}** would require reassessment.\n\n` +
          `Which final point should I examine for you?`;
      }

      return NextResponse.json({
        reply: analysisContent,
        buttons: textDef.stage3Buttons.map((b) => ({ label: b.label, id: b.id, action: "set_followup" })),
        stage: 4,
      });
    }

    if (stage === 4 || stage === 5) {
      // Stage 4 Deepening + Stage 5 Personalized Membership Offer
      let scenarioReply = "";
      if (locale === "tr") {
        scenarioReply = `**Sizin Zaman Aralığınıza Uygun Olası NVIDIA Senaryosu:**\n\n` +
          `• **Hesaplanan Giriş Aralığı:** $${support} – $${(support * 1.03).toFixed(2)}\n` +
          `• **Birincil Hedef:** $${resistance} (${(((resistance - price) / price) * 100).toFixed(1)}% potansiyel)\n` +
          `• **Kritik Stop Seviyesi:** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `---\n\n` +
          `NVIDIA ($NVDA) için hazırladığımız ücretsiz ziyaretçi analizini tamamladık.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**BOGA Pro Üyeliği İle:**\n` +
          `• Tüm hisselerin interaktif grafiklerini ve detaylı analizlerini inceleyebilir,\n` +
          `• BOGA AI tarafından seçilen **Top 100 hisse listesini** görebilir,\n` +
          `• Önceki BOGA AI seçimlerinin **geçmiş performanslarını** inceleyebilir,\n` +
          `• **50 hisseye kadar kişisel izleme listenizi** oluşturup takip edebilirsiniz.\n\n` +
          `Standart üyelik 39 USD/ay. **Sınırlı yaz kampanyasında ilk ay 9 USD**, sonraki aylarda 39 USD/ay. İstediğiniz zaman iptal edebilirsiniz.\n\n` +
          `Şimdilik sohbeti burada tamamlayıp NVIDIA grafiğine dönebilir veya yaz fırsatını kullanarak bütün hisselere erişebilirsiniz.`;
      } else if (locale === "pt") {
        scenarioReply = `**Cenário NVIDIA personalizado:**\n\n` +
          `• **Zona de entrada calculada:** $${support} – $${(support * 1.03).toFixed(2)}\n` +
          `• **Resistência principal:** $${resistance}\n` +
          `• **Nível de invalidação (Stop):** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `---\n\n` +
          `Sua análise gratuita da NVIDIA foi concluída.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**Com a assinatura BOGA Pro:**\n` +
          `• Analisar gráficos interativos de todas as ações,\n` +
          `• Consultar as Top 100 ações selecionadas pela BOGA AI,\n` +
          `• Avaliar o desempenho das seleções anteriores,\n` +
          `• Criar uma lista pessoal com até 50 ações.\n\n` +
          `O valor normal é US$ 39/mês. Na campanha de verão, o **primeiro mês custa US$ 9**, depois US$ 39/mês. Cancele quando quiser.`;
      } else if (locale === "es") {
        scenarioReply = `**Escenario personalizado de NVIDIA:**\n\n` +
          `• **Zona de entrada calculada:** $${support} – $${(support * 1.03).toFixed(2)}\n` +
          `• **Resistencia principal:** $${resistance}\n` +
          `• **Stop de protección:** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `---\n\n` +
          `Has completado el análisis gratuito de NVIDIA para visitantes.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**Con la membresía BOGA Pro:**\n` +
          `• Analizar gráficos interactivos y estudios de todas las acciones,\n` +
          `• Consultar las Top 100 acciones seleccionadas por BOGA AI,\n` +
          `• Revisar el rendimiento de selecciones anteriores,\n` +
          `• Crear una lista personal de hasta 50 acciones.\n\n` +
          `Precio habitual: 39 USD/mes. En la campaña de verano, el **primer mes cuesta 9 USD**, después 39 USD/mes. Cancela en cualquier momento.`;
      } else if (locale === "fr") {
        scenarioReply = `**Scénario NVIDIA personnalisé :**\n\n` +
          `• **Zone d'entrée calculée :** $${support} – $${(support * 1.03).toFixed(2)}\n` +
          `• **Résistance principale :** $${resistance}\n` +
          `• **Niveau d'invalidation :** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `Votre analyse gratuite de NVIDIA est maintenant terminée.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**L'abonnement BOGA Pro vous permet de :**\n` +
          `• Consulter les graphiques interactifs de toutes les actions,\n` +
          `• Explorer les 100 principales actions sélectionnées par BOGA AI,\n` +
          `• Examiner les performances des sélections précédentes,\n` +
          `• Créer une liste personnelle comprenant jusqu'à 50 actions.\n\n` +
          `Tarif habituel : 39 USD/mois. Pendant la campagne d'été, **le premier mois est à 9 USD**, puis 39 USD/mois. Annulation à tout moment.`;
      } else {
        scenarioReply = `**Your Personalized NVIDIA Trade Scenario:**\n\n` +
          `• **Calculated Entry Range:** $${support} – $${(support * 1.03).toFixed(2)}\n` +
          `• **Primary Resistance Target:** $${resistance}\n` +
          `• **Invalidation Level (Stop):** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `---\n\n` +
          `Your free NVIDIA visitor analysis is now complete.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**Membership gives you access to:**\n` +
          `• Interactive charts and detailed analysis for all supported stocks,\n` +
          `• The **BOGA AI Top 100 stock list**,\n` +
          `• Historical performance of previous BOGA selections,\n` +
          `• A **personal watchlist of up to 50 stocks**.\n\n` +
          `Standard price: USD 39/month. **Summer campaign: First month USD 9**, then USD 39/month. Cancel at any time.`;
      }

      return NextResponse.json({
        reply: scenarioReply,
        buttons: [
          { label: textDef.offerButtons.summerOffer, action: "offer_signup", href: `/global/${locale}/register?plan=summer9` },
          { label: textDef.offerButtons.details, action: "offer_details", href: `/global/${locale}/register` },
          { label: textDef.offerButtons.returnChart, action: "return_chart", href: `/global/${locale}/graphic/NVDA` },
        ],
        stage: 5,
        offerShown: true,
      });
    }

    return NextResponse.json({ reply: textDef.stage1Message, stage: 1 });
  } catch (err: any) {
    console.error("[copilot/demo] Error:", err);
    return NextResponse.json({ error: "Service error" }, { status: 500 });
  }
}
