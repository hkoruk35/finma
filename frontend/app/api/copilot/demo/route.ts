import { NextRequest, NextResponse } from "next/server";
import { getRealStockCardData } from "@/lib/copilot/stockData";
import { getTechnicalLevels } from "@/lib/copilot/technicalLevels";
import { VISITOR_TEXTS, SupportedLocale } from "@/lib/copilot/visitorDemo";

export const maxDuration = 30;

function resolveLocale(raw: any): SupportedLocale {
  return ["tr", "en", "es", "fr", "pt"].includes(raw) ? raw : "en";
}

function fmtNum(val: any, decimals = 2): string {
  const n = Number(val);
  return isNaN(n) ? "—" : n.toFixed(decimals);
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

    const price = fmtNum(techData?.currentPrice ?? 125.40, 2);
    const rawSupport = Number(cardData?.support ?? techData?.nearestSupport ?? 118.50);
    const support = fmtNum(rawSupport, 2);
    const resistance = fmtNum(cardData?.resistance ?? techData?.nearestResistance ?? 132.00, 2);
    const bogaScore = Math.round(Number(cardData?.bogaScore ?? 84));
    const trendLabel = cardData?.trend ?? "BULLISH";
    const rsi = fmtNum(techData?.rsi14 ?? 58.2, 1);
    const momentum = techData?.rsiTrend5d === "rising" ? "Yükselen Momentum (Güçlü)" : "Dengeli Momentum";
    const riskLevel = cardData?.riskLevel ?? "Orta";
    const invalidationLevel = fmtNum(rawSupport * 0.96, 2);

    // Stage 2: Question about Time Horizon
    if (stage === 2) {
      return NextResponse.json({
        reply: textDef.stage2Message,
        buttons: textDef.stage2Buttons.map((b) => ({ label: b.label, id: b.id, action: "stage2_select" })),
        stage: 2,
      });
    }

    // Stage 3: Personalized NVDA Analysis (UNLOCKED PREMIUM FEATURES FOR NVDA SHOWCASE)
    if (stage === 3) {
      let horizonText = "birkaç haftalık";
      if (timeHorizon === "few_days") horizonText = "birkaç günlük";
      if (timeHorizon === "few_months") horizonText = "birkaç aylık";
      if (timeHorizon === "long_term") horizonText = "uzun vadeli";
      if (timeHorizon === "exploring") horizonText = "genel inceleme";

      let analysisContent = "";
      if (locale === "tr") {
        analysisContent = `Anladım. NVIDIA'yı ($NVDA) **${horizonText}** bir pozisyon açısından değerlendiriyorum:\n\n` +
          `*(✨ Bu derin analizler ve teknik seviyeler normalde BOGA Pro/Premium üyelerine özeldir; NVIDIA ($NVDA) özel tanıtım entegrasyonumuz kapsamında tüm Premium özellikler kullanımınıza açılmıştır.)*\n\n` +
          `• **Mevcut Trend:** ${trendLabel}\n` +
          `• **BOGA Skoru:** ${bogaScore}/100\n` +
          `• **Destek Bölgesi:** $${support}\n` +
          `• **Direnç Bölgesi:** $${resistance}\n` +
          `• **RSI (14):** ${rsi}\n` +
          `• **Momentum:** ${momentum}\n` +
          `• **Risk Seviyesi:** ${riskLevel}\n\n` +
          `Seçtiğiniz **${horizonText}** yaklaşımınız açısından en önemli nokta, fiyatın **$${support}** üzerinde kalması ve momentumun pozitif seyrini korumasıdır.\n\n` +
          `Fiyat **$${resistance}** üzerinde teyit oluşturursa teknik görünüm güçlenebilir. **$${invalidationLevel}** altındaki hareket ise mevcut senaryonun yeniden değerlendirilmesini gerektirebilir.\n\n` +
          `Son adımda hangisini detaylı inceleyelim?`;
      } else if (locale === "pt") {
        analysisContent = `Entendi. Avaliando a NVIDIA ($NVDA) do ponto de vista de **${timeHorizon}**:\n\n` +
          `*(✨ Estas análises profundas e níveis técnicos são normalmente exclusivos do BOGA Pro/Premium; desbloqueados gratuitamente para a demonstração da NVIDIA ($NVDA).)*\n\n` +
          `• **Tendência Atual:** ${trendLabel}\n` +
          `• **Pontuação BOGA:** ${bogaScore}/100\n` +
          `• **Suporte:** $${support}\n` +
          `• **Resistência:** $${resistance}\n` +
          `• **RSI (14):** ${rsi}\n` +
          `• **Nível de Risco:** ${riskLevel}\n\n` +
          `Para o horizonte escolhido, o ponto mais importante é a capacidade do preço de permanecer acima de **$${support}**.\n\n` +
          `Um movimento confirmado acima de **$${resistance}** pode fortalecer o cenário técnico. Uma queda abaixo de **$${invalidationLevel}** pode exigir uma nova avaliação.\n\n` +
          `Qual ponto você gostaria de analisar na etapa final?`;
      } else if (locale === "es") {
        analysisContent = `Entendido. Evaluando NVIDIA ($NVDA) desde la perspectiva de **${timeHorizon}**:\n\n` +
          `*(✨ Estos análisis y niveles técnicos profundos son normalmente exclusivos de BOGA Pro/Premium; desbloqueados gratis para la demostración de NVIDIA ($NVDA).)*\n\n` +
          `• **Tendencia Actual:** ${trendLabel}\n` +
          `• **Puntuación BOGA:** ${bogaScore}/100\n` +
          `• **Zona de Soporte:** $${support}\n` +
          `• **Zona de Resistencia:** $${resistance}\n` +
          `• **RSI (14):** ${rsi}\n` +
          `• **Nivel de Riesgo:** ${riskLevel}\n\n` +
          `Para el horizonte seleccionado, el punto más importante es que el precio se mantenga por encima de **$${support}**.\n\n` +
          `Un movimiento confirmado por encima de **$${resistance}** podría fortalecer el escenario técnico. Una caída por debajo de **$${invalidationLevel}** exigirá una nueva evaluación.\n\n` +
          `¿Qué punto quieres que analice para terminar?`;
      } else if (locale === "fr") {
        analysisContent = `Compris. Évaluation de NVIDIA ($NVDA) dans la perspective de **${timeHorizon}** :\n\n` +
          `*(✨ Ces analyses et niveaux techniques approfondis sont normalement réservés aux membres BOGA Pro/Premium ; débloqués gratuitement pour la présentation NVIDIA ($NVDA).)*\n\n` +
          `• **Tendance Actuelle :** ${trendLabel}\n` +
          `• **Score BOGA :** ${bogaScore}/100\n` +
          `• **Zone de Support :** $${support}\n` +
          `• **Zone de Résistance :** $${resistance}\n` +
          `• **RSI (14) :** ${rsi}\n` +
          `• **Niveau de Risque :** ${riskLevel}\n\n` +
          `Pour l’horizon choisi, le point le plus important est la capacité du cours à rester au-dessus de **$${support}**.\n\n` +
          `Un mouvement confirmé au-dessus de **$${resistance}** pourrait renforcer le scénario technique.\n\n` +
          `Quel dernier point souhaitez-vous que j’examine ?`;
      } else {
        analysisContent = `Understood. Evaluating NVIDIA ($NVDA) based on your **${timeHorizon}** position perspective:\n\n` +
          `*(✨ These deep analytics and technical levels are normally exclusive to BOGA Pro/Premium members; unlocked for free as part of our NVIDIA ($NVDA) showcase integration.)*\n\n` +
          `• **Current Trend:** ${trendLabel}\n` +
          `• **BOGA Score:** ${bogaScore}/100\n` +
          `• **Support Area:** $${support}\n` +
          `• **Resistance Area:** $${resistance}\n` +
          `• **RSI (14):** ${rsi}\n` +
          `• **Risk Level:** ${riskLevel}\n\n` +
          `For your selected time horizon, the most important factor is whether the price can remain above **$${support}** while momentum holds.\n\n` +
          `A confirmed move above **$${resistance}** could strengthen the technical outlook. A move below **$${invalidationLevel}** would require reassessment.\n\n` +
          `Which final point should I examine for you?`;
      }

      return NextResponse.json({
        reply: analysisContent,
        buttons: textDef.stage3Buttons.map((b) => ({ label: b.label, id: b.id, action: "set_followup" })),
        stage: 3,
      });
    }

    if (stage === 4 || stage === 5) {
      // Stage 4 Deepening + Stage 5 Personalized Membership Offer
      let scenarioReply = "";
      const rawPriceNum = Number(price);
      const rawResNum = Number(resistance);
      const potentialPct = rawPriceNum > 0 ? (((rawResNum - rawPriceNum) / rawPriceNum) * 100).toFixed(1) : "12.5";

      if (locale === "tr") {
        scenarioReply = `**Sizin Zaman Aralığınıza Uygun Olası NVIDIA Senaryosu:**\n\n` +
          `*(✨ Bu detaylı işlem kurgusu ve seviyeler normalde Pro/Premium özelliğidir; NVIDIA ($NVDA) tanıtım sayfamız kapsamında ücretsiz erişiminize sunulmuştur.)*\n\n` +
          `• **Hesaplanan Giriş Aralığı:** $${support} – $${(rawSupport * 1.03).toFixed(2)}\n` +
          `• **Birincil Hedef:** $${resistance} (%${potentialPct} potansiyel)\n` +
          `• **Kritik Stop Seviyesi:** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `---\n\n` +
          `NVIDIA ($NVDA) için hazırladığımız özel tanıtım analizimizi tamamladık.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**BOGA Pro Üyeliği İle:**\n\n` +
          `• Tüm hisselerin interaktif grafiklerini ve detaylı analizlerini inceleyebilir,\n` +
          `• BOGA AI tarafından seçilen **Top 100 hisse listesini** görebilir,\n` +
          `• Önceki BOGA AI seçimlerinin **geçmiş performanslarını** inceleyebilir,\n` +
          `• **50 hisseye kadar kişisel izleme listenizi** oluşturup takip edebilirsiniz.\n\n` +
          `Standart üyelik 39 USD/ay. **Sınırlı yaz kampanyasında ilk ay 9 USD**, sonraki aylarda 39 USD/ay. İstediğiniz zaman tek tıkla iptal edebilirsiniz.\n\n` +
          `Şimdilik sohbeti burada tamamlayıp NVIDIA grafiğine dönebilir veya yaz fırsatını kullanarak bütün hisselere erişebilirsiniz.`;
      } else if (locale === "pt") {
        scenarioReply = `**Cenário NVIDIA personalizado:**\n\n` +
          `*(✨ Este cenário de negociação detalhado e níveis são normalmente recursos Pro/Premium; desbloqueados gratuitamente para a demonstração da NVIDIA ($NVDA).)*\n\n` +
          `• **Zona de entrada calculada:** $${support} – $${(rawSupport * 1.03).toFixed(2)}\n` +
          `• **Resistência principal:** $${resistance}\n` +
          `• **Nível de invalidação (Stop):** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `---\n\n` +
          `Sua demonstração gratuita da NVIDIA foi concluída.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**Com a assinatura BOGA Pro:**\n\n` +
          `• Analisar gráficos interativos de todas as ações,\n` +
          `• Consultar as Top 100 ações selecionadas pela BOGA AI,\n` +
          `• Avaliar o desempenho das seleções anteriores,\n` +
          `• Criar uma lista pessoal com até 50 ações.\n\n` +
          `O valor normal é US$ 39/mês. Na campanha de verão, o **primeiro mês custa US$ 9**, depois US$ 39/mês. Cancele quando quiser.`;
      } else if (locale === "es") {
        scenarioReply = `**Escenario personalizado de NVIDIA:**\n\n` +
          `*(✨ Este escenario comercial detallado y niveles son normalmente funciones Pro/Premium; desbloqueados gratis para la demostración de NVIDIA ($NVDA).)*\n\n` +
          `• **Zona de entrada calculada:** $${support} – $${(rawSupport * 1.03).toFixed(2)}\n` +
          `• **Resistencia principal:** $${resistance}\n` +
          `• **Stop de protección:** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `---\n\n` +
          `Has completado la demostración gratuita de NVIDIA.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**Con la membresía BOGA Pro:**\n\n` +
          `• Analizar gráficos interactivos y estudios de todas las acciones,\n` +
          `• Consultar las Top 100 acciones seleccionadas por BOGA AI,\n` +
          `• Revisar el rendimiento de selecciones anteriores,\n` +
          `• Crear una lista personal de hasta 50 acciones.\n\n` +
          `Precio habitual: 39 USD/mes. En la campaña de verano, el **primer mes cuesta 9 USD**, después 39 USD/mes. Cancela en cualquier momento.`;
      } else if (locale === "fr") {
        scenarioReply = `**Scénario NVIDIA personnalisé :**\n\n` +
          `*(✨ Ce scénario de trading détaillé et ces niveaux sont normalement des fonctionnalités Pro/Premium ; débloqués gratuitement pour la présentation NVIDIA ($NVDA).)*\n\n` +
          `• **Zone d'entrée calculée :** $${support} – $${(rawSupport * 1.03).toFixed(2)}\n` +
          `• **Résistance principale :** $${resistance}\n` +
          `• **Niveau d'invalidation :** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `Votre présentation gratuite de NVIDIA est terminée.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**L'abonnement BOGA Pro vous permet de :**\n\n` +
          `• Consulter les graphiques interactifs de toutes les actions,\n` +
          `• Explorer les 100 principales actions sélectionnées par BOGA AI,\n` +
          `• Examiner les performances des sélections précédentes,\n` +
          `• Créer une liste personnelle comprenant jusqu'à 50 actions.\n\n` +
          `Tarif habituel : 39 USD/mois. Pendant la campagne d'été, **le premier mois est à 9 USD**, puis 39 USD/mois. Annulation à tout moment.`;
      } else {
        scenarioReply = `**Your Personalized NVIDIA Trade Scenario:**\n\n` +
          `*(✨ This detailed trade scenario and key levels are normally Pro/Premium features; unlocked for free as part of our NVIDIA ($NVDA) showcase integration.)*\n\n` +
          `• **Calculated Entry Range:** $${support} – $${(rawSupport * 1.03).toFixed(2)}\n` +
          `• **Primary Resistance Target:** $${resistance}\n` +
          `• **Invalidation Level (Stop):** $${invalidationLevel}\n\n` +
          `*${textDef.disclaimer}*\n\n` +
          `---\n\n` +
          `Your free NVIDIA visitor preview is now complete.\n\n` +
          `${textDef.featureMatches[primaryInterest] || textDef.featureMatches.trend}\n\n` +
          `**Membership gives you access to:**\n\n` +
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

    return NextResponse.json({
      reply: textDef.stage1Message,
      buttons: textDef.stage1Buttons.map((b) => ({ label: b.label, id: b.id, action: "stage1_select" })),
      stage: 1,
    });
  } catch (err: any) {
    console.error("[copilot/demo] Error:", err);
    return NextResponse.json({ error: "Service error" }, { status: 500 });
  }
}
