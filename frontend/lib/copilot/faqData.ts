// BOGA Copilot FAQ Knowledge Service — spec böl. 25/33.
// Sitenin 5 dildeki resmi SSS sayfalarıyla (app/global/{locale}/{faq-slug}/page.tsx)
// AYNI, gerçek metinleri kullanır — Copilot bu metinleri asla kendi kelimeleriyle
// yeniden üretmez/uydurmaz; özellikle isSensitive=true olan maddeler (fiyat,
// ödeme, iptal, deneme, veri gecikmesi, risk) neredeyse birebir aktarılmalıdır.
//
// NOT: Sayfa bileşenleri (app/global/*/{faq,sss,Perguntas_Frequentes}/page.tsx)
// şu an bu diziyi import ETMİYOR — kendi inline kopyalarını kullanmaya devam
// ediyor. Bu dosya, canlı/indexlenmiş 5 sayfaya dokunmadan Copilot'a SSS
// yeteneği kazandırmak için o sayfalardaki metinlerin birebir kopyasıdır.

import type { CopilotLocale } from "@/lib/copilot/i18n";

export interface FaqEntry {
  id: string;
  category:
    | "platform" | "membership" | "trend_system" | "chart_analysis"
    | "ai_reliability" | "data_freshness" | "scanning" | "smart_money"
    | "scoring" | "fundamentals" | "market_scope" | "risk";
  question: string;
  answer: string;
  isSensitive: boolean; // fiyat/ödeme/iptal/deneme/veri gecikmesi/risk — LLM serbestçe yeniden yazmaz
}

const CATEGORIES: FaqEntry["category"][] = [
  "platform", "platform", "membership", "membership", "membership",
  "trend_system", "trend_system", "trend_system", "chart_analysis", "ai_reliability",
  "chart_analysis", "data_freshness", "scanning", "smart_money", "scoring",
  "scoring", "fundamentals", "market_scope", "risk", "risk",
];
const SENSITIVE_IDS = new Set([2, 3, 4, 5, 12, 19, 20]);

function buildEntries(locale: CopilotLocale, pairs: { q: string; a: string }[]): FaqEntry[] {
  return pairs.map((p, i) => ({
    id: `faq_${String(i + 1).padStart(2, "0")}`,
    category: CATEGORIES[i],
    question: p.q,
    answer: p.a,
    isSensitive: SENSITIVE_IDS.has(i + 1),
  }));
}

const TR: FaqEntry[] = buildEntries("tr", [
  { q: "BOGASTOCK tam olarak nedir ve benim için ne yapar?", a: "BOGASTOCK, yapay zeka (BOGA AI) ve gelişmiş matematiksel algoritmalar kullanarak ABD borsalarındaki (NYSE, NASDAQ, AMEX) binlerce hisse senedini tarayan bir finansal teknoloji platformudur. Amacımız, karmaşık indikatör kalabalığı içinde kaybolmanızı önleyerek, trend hisseleri için teknik ve temel olarak en uygun 20-30 hedef hisseyi tespit etmek, bunları puanlamak ve sizin için net bir izleme planı sunmaktır. Yatırım kararlarınızı rasyonel verilere dayandırarak almanızı sağlarız." },
  { q: "Bize hisse alım-satım tavsiyesi mi veriyorsunuz?", a: "Kesinlikle hayır. Biz bir yatırım danışmanlığı firması değiliz. BOGASTOCK, tamamen matematiksel algoritmalara dayalı analizler üreten bir yazılım platformudur. Sistemimiz size \"şu fiyattan alın, bu fiyattan satın\" demez; sadece teknik ve temel kriterlere göre gücü kanıtlanmış potansiyel adayları listeler ve yapay zeka analiz raporunu sunar. Ticaret yapıp yapmama kararı, risk yönetimi ve pozisyon büyüklüğü tamamen sizin sorumluluğunuzdadır." },
  { q: "Üye olmadan önce sistemi ücretsiz deneyebilir miyim?", a: "Hayır, artık ücretsiz deneme süremiz yok — BOGASTOCK doğrudan Premium üyelik modeliyle çalışır. Üye olduğunuz anda abonelik başlar ve ödeme alınır; buna karşılık ilk ayınızı indirimli fiyattan başlatabilirsiniz. Üye olmadan önce herkese açık Gösterge Paneli'ni ücretsiz inceleyip platformun genel görünümünü test edebilirsiniz." },
  { q: "Üye olurken kart bilgisi giriyorum, ödeme hemen mi alınıyor?", a: "Evet. Üyelik oluşturduğunuz anda kartınızdan ilk ay için indirimli tutar tahsil edilir, ikinci aydan itibaren standart aylık ücrete geçilir. Deneme süresi olmadığından ödeme kayıt anında başlar. İstediğiniz zaman, hiçbir ek ücret ödemeden üyeliğinizi hesap panelinizden iptal edebilirsiniz." },
  { q: "Kredi kartı bilgilerimi sisteminizde saklıyor musunuz? Güvende miyim?", a: "Kredi kartı bilgileriniz kesinlikle bizim sitemizde veya sunucularımızda kayıt altına alınmaz ve saklanmaz. Ödeme altyapımız, dünyanın en güvenli ve prestijli ödeme sistemlerinden biri olan Stripe aracılığıyla, tamamen şifreli ve güvenli bir ortamda gerçekleştirilir." },
  { q: "Trend Hisseleri nedir? Ben hiç bilmiyorum.", a: "Trend Hisseleri, bir hisse senedinin birkaç gün ila birkaç hafta sürebilecek güçlü yönlü fiyat hareketlerini (trendleri) yakalayarak kar elde etmeyi amaçlayan bir ticaret yöntemidir. BOGASTOCK, bu kısa ve orta vadeli yönlü hareketleri yakalamak üzere kalibre edilmiştir. Ancak her ticarette olduğu gibi trend hisseleri işlemlerinde de sermaye kaybı riski her zaman mevcuttur." },
  { q: "Önerilen hisseler hemen işleme girmeye hazır mıdır? Nasıl giriş yapmalıyım?", a: "\"Trend Hisseleri\" listesinde yer alan adaylar teknik olarak işleme hazır, güçlü yapılardır. Ancak daha yüksek karlılık ve daha düşük risk için, 15 dakikalık (15m) grafik yapımızda uygun formasyon ve paternlerle hassas giriş yapmanız yönünde ek rehberlik sunuyoruz." },
  { q: "\"İzleme Listesi\" ile \"Trend Listesi\" arasındaki fark nedir?", a: "İzleme Listesi (Watchlist): Algoritmalarımızın radarına giren, potansiyeli yüksek ancak henüz tam olarak kırılım veya güvenli giriş seviyesine ulaşmamış adayları içerir.\n\nTrend Listesi: Bu adaylar izleme listesinden geçerek, gerekli tüm teknik ve hacimsel onayları alıp aktif ticaret planına dahil edilen en yüksek inançlı hisselerdir." },
  { q: "İnteraktif Grafik ve BOGA AI analizi bana nasıl yardımcı olacak?", a: "Grafik detay ekranımızda sadeleştirilmiş interaktif grafik desteği sunuyoruz. BOGA AI, bu grafik üzerinde net ticaret planları (Giriş bölgesi, Hedef seviyeleri ve Stop Loss noktası) üretir. Siz bu verileri inceleyerek kararınızı verir, kendi risk toleransınıza göre pozisyon büyüklüğünüzü ayarlarsınız." },
  { q: "BOGA AI sistemi zamanla hata yapar mı? Kendini nasıl geliştiriyor?", a: "Dünyada hatasız çalışan hiçbir finansal sistem veya yapay zeka yoktur; piyasalar her zaman belirsizliklerle doludur. BOGA AI, kendi geliştirdiğimiz LLM yapısı ve makine öğrenimi altyapısı sayesinde gerçekleşen her işlem sonucunu analiz ederek kendini sürekli günceller." },
  { q: "Grafiklerde çok fazla çizgi ve kafa karıştırıcı indikatör var mı?", a: "Hayır! BOGASTOCK'un temel felsefesi gürültüden ve karmaşadan uzak durmaktır. Doğrudan sonuca götüren net, temiz grafikler ve anlaşılır metrikler sunuyoruz. Finansal okuryazarlığınız başlangıç düzeyinde olsa dahi yapay zekanın sade dilde yazdığı raporlar sayesinde durumu kolayca analiz edebilirsiniz." },
  { q: "Verileriniz canlı (anlık) mı yoksa gecikmeli mi geliyor?", a: "Sistemimizdeki teknik veriler, piyasayı saat başı güncelleyen ve yaklaşık 15 dakika gecikmeli olan veri kaynaklarından beslenir. Trend hisseleri (günlük ve haftalık trend takibi) odağında olduğumuz için saniyelik veya anlık veri akışına ihtiyacımız yoktur." },
  { q: "Borsada işlem gören binlerce hisse var. Hangisini seçeceğimi nasıl bileceğim?", a: "Algoritmamız her gün NYSE, NASDAQ ve AMEX borsalarındaki 6.000'den fazla hisse senedini otomatik tarar. Likidite ve hacim gibi filtrelerden geçirerek gündemimizde ortalama sadece 20-30 adet en kaliteli hisseyi tutar." },
  { q: "\"Akıllı Paranın İzini Sürmek\" ne anlama geliyor?", a: "Piyasalarda fiyatları hareket ettiren asıl güç büyük kurumsal fonlar ve bankalardır (Akıllı Para). Algoritmamız, günlük sermaye akışlarını ve hacim patlamalarını takip ederek büyük oyuncuların hangi hisselere gizlice giriş yaptığını veya hangilerinden çıktığını tespit etmeye çalışır." },
  { q: "\"Beş Kademeli Puan Derecelendirmesi\" nedir?", a: "BOGASTOCK puanlama motoru, her adayı teknik ve temel rasyolara göre analiz ederek net bir sınıfa ayırır: Yüksek İnanç, Pozitif Eğilim, Nötr Bekle, Negatif Eğilim ve Düşük Performans." },
  { q: "Hisselerin teknik puanları nasıl hesaplanıyor?", a: "Teknik puanımız; RSI, MACD, bağıl hacim, EMA hareketli ortalama kesişimleri, ADX trend gücü ve Bollinger Bantlarındaki sıkışma yoğunluğu gibi göstergelerin ağırlıklı bir karmasından hesaplanır. Tek bir indikatöre değil, çok faktörlü bir onay mekanizmasına dayanır." },
  { q: "Sadece teknik analiz mi kullanıyorsunuz? Şirketin karı, bilançosu önemli değil mi?", a: "Kesinlikle önemli! Sistemimiz teknik analizin yanına güçlü bir \"Temel ve Sektör Katmanı\" ekler. F/K oranları, serbest nakit akışı verimleri, brüt kar marjları ve gelir büyüme momentumları sektör ortalamalarıyla kıyaslanarak analiz edilir." },
  { q: "BOGASTOCK sadece ABD borsalarına mı odaklanıyor? Neden?", a: "Evet, sistemimiz %100 ABD Hisse Senedi Piyasalarına (NYSE, NASDAQ, AMEX) odaklıdır. Bunun nedeni, dünyanın en likit ve algoritmik hareketlere en uygun yapısının ABD borsalarında olmasıdır. Tüm ağırlıklarımız ve yapay zeka modellerimiz sadece bu piyasa yapısına göre kalibre edilmiştir." },
  { q: "Sistemdeki işlemlerde kaybetme olasılığım var mı?", a: "Evet, kesinlikle var. Finansal piyasalarda %100 başarı vaat eden hiçbir dürüst sistem olamaz. BOGA AI'ın tarihsel başarı oranı geçmiş verilere dayanır ve gelecekte her işlemin karla sonuçlanacağını garanti etmez. Her işlemde riskinizi sınırlamalı ve asla tek bir işleme tüm sermayenizi bağlamamalısınız." },
  { q: "\"Stop Loss\" (Zarar Durdur) kullanmak zorunda mıyım?", a: "Evet, kesinlikle zorundasınız! BOGASTOCK felsefesinin birinci kuralı: \"Stop Loss konmadan asla işlem açılmaz.\" Sermayenizi büyük çöküşlerden korumanın tek yolu, işleme girmeden önce ne kadar kaybetmeyi göze aldığınızı belirlemek ve bu plana sadık kalmaktır." },
]);

const EN: FaqEntry[] = buildEntries("en", [
  { q: "What exactly is BOGASTOCK, and what does it do for me?", a: "BOGASTOCK is a financial technology platform that uses artificial intelligence (BOGA AI) and advanced mathematical algorithms to scan thousands of stocks across major US exchanges (NYSE, NASDAQ, AMEX). Our goal is to cut through the noise of cluttered charts and indicators to identify, score, and deliver a clean watchlist of the top 20-30 trend stock candidates based on technical and fundamental data." },
  { q: "Do you provide direct buy or sell recommendations?", a: "Absolutely not. We are not a registered investment advisory firm. BOGASTOCK is a software platform driven entirely by mathematical algorithms. Our system will never tell you \"buy at price X\" or \"sell at price Y.\" Executing trades, managing risk, and sizing positions are entirely your responsibility." },
  { q: "Can I try the platform for free before becoming a member?", a: "No — we no longer offer a free trial. BOGASTOCK runs on a direct Premium membership model: your subscription starts and is charged the moment you sign up, though your first month is discounted. Before joining, you can freely browse the public Dashboard." },
  { q: "You ask for card details when signing up — am I charged right away?", a: "Yes. The moment your membership is created, your card is charged the discounted first-month rate, then the standard monthly rate from month two onward. There's no trial period. You can cancel your membership from your account panel at any time, with no further charges." },
  { q: "Do you store my credit card information? Is my data secure?", a: "Your security is our absolute priority. We do not store or process any credit card details on our own servers. All transactions are handled securely through Stripe — one of the world's most trusted, encrypted, and secure payment processors." },
  { q: "What are Trending Stocks? I'm completely new to this.", a: "Trending Stocks is a strategy aimed at capturing strong directional price moves in a stock over a period of a few days to a few weeks. BOGASTOCK is specifically calibrated to spot these short-to-medium-term moves. Like any form of trading, it involves real market risk and the potential loss of capital." },
  { q: "Are the recommended stocks ready to trade immediately? How should I enter?", a: "The candidates featured on our \"Trending Stocks\" list are technically primed and structurally strong. To maximize profitability and lower your risk, we provide additional guidance on using our 15-minute (15m) chart structures to identify precise entry triggers." },
  { q: "What is the difference between the \"Watchlist\" and the \"Trend List\"?", a: "Watchlist: Features high-potential candidates that have hit our algorithms' radar but have not yet achieved a clean breakout or reached a safe, validated entry level.\n\nTrend List: Features the highest-conviction ideas that have graduated from the Watchlist by securing all necessary technical, volume, and momentum confirmations." },
  { q: "How do the Interactive Charts and BOGA AI analysis help me?", a: "BOGA AI analyzes our simplified interactive charts to map out objective trading plans, defining clear entry zones, profit targets, and stop-loss levels. You review these insights and manage your trades based on your personal risk tolerance." },
  { q: "Does BOGA AI ever make mistakes? How does it improve?", a: "Yes, it can. There is no such thing as an infallible financial system or AI; markets are inherently uncertain. BOGA AI uses a proprietary LLM framework combined with machine learning, continuously analyzing the outcome of every trade to refine its parameters." },
  { q: "Are the charts cluttered with too many confusing lines and indicators?", a: "No! The core philosophy of BOGASTOCK is to eliminate clutter, noise, and confusion. We deliver clean, straightforward charts and highly readable metrics, with AI-generated reports written in plain, easy-to-understand language." },
  { q: "Is your data real-time or delayed?", a: "Our technical data feeds update hourly with a standard 15-minute delay. Because BOGASTOCK is purely focused on trend stocks (multi-day or multi-week moves), tick-by-tick real-time data is unnecessary." },
  { q: "There are thousands of stocks out there. How do I know which one to choose?", a: "Our algorithm automatically scans over 6,000 stocks across the NYSE, NASDAQ, and AMEX every single day, filtering out the noise to narrow the list down to an average of just 20-30 high-quality candidates." },
  { q: "What does \"Tracking Smart Money\" mean?", a: "The real force behind major price movements comes from large institutional funds and banks (\"Smart Money\"). Our algorithm tracks daily capital flows and volume spikes to identify when these institutional players are quietly accumulating or distributing positions." },
  { q: "What is the \"Five-Tier Rating System\"?", a: "The BOGASTOCK scoring engine grades every candidate into five distinct categories: High Conviction, Positive Bias, Neutral (Wait), Negative Bias, and Underperformance." },
  { q: "How is the technical score of a stock calculated?", a: "Our technical score is a weighted average of proven indicators: RSI, MACD, Relative Volume, EMA crossovers, ADX trend strength, and Bollinger Band squeezes — a multi-factor confirmation process rather than any single indicator." },
  { q: "Do you only use technical analysis? What about earnings and balance sheets?", a: "Fundamentals are incredibly important. Our system pairs technical setups with a robust Fundamental and Sector Layer — P/E ratios, Free Cash Flow yields, gross profit margins, and revenue growth momentum compared against sector averages." },
  { q: "Does BOGASTOCK only focus on US markets? Why?", a: "Yes, our platform is 100% focused on the US Stock Markets (NYSE, NASDAQ, AMEX) — the deepest liquidity and most reliable structure for algorithmic trend-following. All our scoring criteria and AI models are custom-calibrated for this market." },
  { q: "Is there a risk of losing money when trading with this system?", a: "Yes, absolutely. Any system promising guaranteed profits in financial markets is not being honest. BOGA AI's historical win rates are based on past data, which does not guarantee future results. Always practice proper risk management." },
  { q: "Am I required to use a \"Stop Loss\"?", a: "Yes, absolutely! Rule number one of the BOGASTOCK philosophy is: \"Never open a trade without a Stop Loss.\" Pre-determine exactly where you will exit if the trade goes against you, and stick to that plan." },
]);

const ES: FaqEntry[] = buildEntries("es", [
  { q: "¿Qué es exactamente BOGASTOCK y qué puede hacer por mí?", a: "BOGASTOCK es una plataforma de tecnología financiera que utiliza inteligencia artificial (BOGA AI) y algoritmos matemáticos avanzados para escanear miles de acciones en las bolsas de Estados Unidos (NYSE, NASDAQ y AMEX). Identificamos, puntuamos y te presentamos una lista clara con las 20-30 mejores Acciones en Tendencia." },
  { q: "¿Nos dan recomendaciones directas de compra o venta de acciones?", a: "Rotundamente no. No somos una firma de asesoría financiera. BOGASTOCK es una plataforma de software basada al 100% en algoritmos matemáticos. La decisión final de operar, la gestión de riesgo y el tamaño de tus posiciones son de tu exclusiva responsabilidad." },
  { q: "¿Puedo probar la plataforma gratis antes de hacerme miembro?", a: "No — ya no ofrecemos una prueba gratuita. BOGASTOCK funciona con un modelo de membresía Premium directa: tu suscripción comienza y se cobra en el momento en que te registras, aunque tu primer mes tiene descuento. Antes de unirte, puedes explorar gratis el Panel público." },
  { q: "Piden los datos de mi tarjeta al registrarme, ¿se cobra de inmediato?", a: "Sí. En el momento en que se crea tu membresía, se cobra a tu tarjeta la tarifa con descuento del primer mes, y desde el segundo mes la tarifa estándar. No hay periodo de prueba. Puedes cancelar tu membresía desde tu panel de cuenta en cualquier momento." },
  { q: "¿Guardan los datos de mi tarjeta de crédito en su sistema? ¿Estoy seguro?", a: "Tu seguridad es nuestra máxima prioridad. No almacenamos ningún dato de tu tarjeta de crédito en nuestros servidores. Todo el proceso de pago se realiza de forma cifrada y segura a través de Stripe." },
  { q: "¿Qué son las Acciones en Tendencia? No tengo experiencia previa.", a: "Las Acciones en Tendencia son una estrategia que busca capturar movimientos de precio direccionales fuertes durante un periodo de días a semanas. Como en cualquier inversión de renta variable, siempre existe el riesgo de perder capital." },
  { q: "¿Las acciones sugeridas están listas para operar de inmediato? ¿Cómo debo entrar?", a: "Las acciones de nuestra lista de \"Acciones en Tendencia\" ya presentan una estructura técnica muy fuerte. Sugerimos usar nuestra estructura de gráficos de 15 minutos (15m) para identificar patrones de entrada más precisos." },
  { q: "¿Cuál es la diferencia entre la \"Lista de Seguimiento\" y la \"Lista de Tendencia\"?", a: "Lista de Seguimiento (Watchlist): acciones con gran potencial que aún no han alcanzado un punto de entrada seguro.\n\nLista de Tendencia: acciones que han recibido todas las confirmaciones técnicas, de volumen y momentum necesarias. Son nuestras ideas de mayor convicción." },
  { q: "¿Cómo me ayudan los Gráficos Interactivos y el análisis de BOGA AI?", a: "BOGA AI analiza los patrones del gráfico para generar planes de trading claros: zona de entrada, objetivos de beneficio y nivel de stop loss. Tú gestionas tu operación según tu tolerancia al riesgo." },
  { q: "¿La inteligencia artificial BOGA AI comete errores? ¿Cómo mejora?", a: "Sí, puede cometerlos. No existe ningún sistema financiero infalible. BOGA AI cuenta con una estructura de LLM propia y aprendizaje automático, analizando constantemente el resultado de cada operación para autoajustarse." },
  { q: "¿Los gráficos tienen demasiadas líneas e indicadores confusos?", a: "¡Para nada! La filosofía de BOGASTOCK es eliminar el ruido y la confusión, ofreciendo gráficos limpios e informes en lenguaje sencillo." },
  { q: "¿Los datos de la plataforma son en tiempo real o retrasados?", a: "Nuestros datos técnicos se actualizan cada hora, con un retraso estándar de 15 minutos. Nos enfocamos en Acciones en Tendencia, por lo que no necesitamos datos al milisegundo." },
  { q: "Hay miles de acciones cotizando en bolsa. ¿Cómo sabré cuál elegir?", a: "Nuestro algoritmo escanea automáticamente más de 6,000 acciones todos los días en NYSE, NASDAQ y AMEX, filtrando hasta quedarnos con una media de 20-30 acciones de máxima calidad." },
  { q: "¿Qué significa \"Seguir el rastro del Smart Money\"?", a: "Los grandes fondos institucionales y bancos de inversión (Smart Money) son quienes realmente mueven los precios. Nuestro algoritmo rastrea flujos de capital y picos de volumen para detectar sus movimientos." },
  { q: "¿Qué es el \"Sistema de Calificación de Cinco Niveles\"?", a: "El motor de puntuación clasifica cada candidato en cinco categorías: Alta Convicción, Sesgo Positivo, Neutral (Esperar), Sesgo Negativo e Infrarendimiento." },
  { q: "¿Cómo se calcula la puntuación técnica de las acciones?", a: "Es una media ponderada de indicadores como RSI, MACD, Volumen Relativo, cruces de EMA, fuerza de tendencia (ADX) y Bandas de Bollinger — un sistema de confirmación multifactorial." },
  { q: "¿Utilizan solo análisis técnico? ¿No importan las ganancias ni el balance?", a: "¡Importan muchísimo! Complementamos el análisis técnico con una \"Capa Fundamental y Sectorial\": P/E, flujo de caja libre, márgenes de beneficio bruto y crecimiento de ingresos, comparados con la media del sector." },
  { q: "¿Por qué BOGASTOCK se enfoca únicamente en los mercados de Estados Unidos?", a: "Nuestra plataforma está enfocada al 100% en las bolsas estadounidenses (NYSE, NASDAQ y AMEX) por su liquidez y estructura ideal para el seguimiento algorítmico de tendencias." },
  { q: "¿Existe el riesgo de perder dinero operando con este sistema?", a: "Sí, por supuesto. Cualquier promesa de rentabilidad garantizada al 100% es falsa. Las estadísticas de BOGA AI se basan en datos del pasado, que no garantizan resultados futuros. Limita tu riesgo en cada operación." },
  { q: "¿Estoy obligado a utilizar un \"Stop Loss\"?", a: "¡Sí, absolutamente! La regla número uno: \"Nunca se abre una operación sin definir un Stop Loss.\" Define exactamente cuánto estás dispuesto a perder antes de entrar, y cíñete a ese plan." },
]);

const FR: FaqEntry[] = buildEntries("fr", [
  { q: "Qu'est-ce que BOGASTOCK exactement et qu'est-ce que cela m'apporte ?", a: "BOGASTOCK est une plateforme fintech qui utilise l'IA (BOGA AI) et des algorithmes mathématiques avancés pour analyser des milliers d'actions sur les marchés américains (NYSE, NASDAQ, AMEX), et sélectionne pour vous les 20 à 30 meilleures Actions Tendance." },
  { q: "Donnez-vous des conseils directs d'achat ou de vente d'actions ?", a: "Absolument pas. Nous ne sommes pas un cabinet de conseil en investissement. BOGASTOCK repose uniquement sur des algorithmes mathématiques. La décision finale de trader, la gestion du risque et la taille des positions relèvent de votre entière responsabilité." },
  { q: "Puis-je essayer la plateforme gratuitement avant de devenir membre ?", a: "Non — nous ne proposons plus d'essai gratuit. BOGASTOCK fonctionne avec une adhésion Premium directe : votre abonnement démarre et est facturé dès l'inscription, avec un premier mois à prix réduit. Vous pouvez parcourir gratuitement le Tableau de bord public avant de rejoindre." },
  { q: "Vous demandez mes coordonnées bancaires à l'inscription, suis-je débité immédiatement ?", a: "Oui. Dès la création de votre adhésion, votre carte est débitée du tarif réduit du premier mois, puis du tarif standard ensuite. Il n'y a pas de période d'essai. Vous pouvez annuler à tout moment depuis votre espace compte." },
  { q: "Est-ce que vous conservez mes données de carte bancaire ?", a: "Votre sécurité est notre priorité absolue. Nous ne stockons aucune information de carte bancaire sur nos serveurs. Tous les paiements sont traités via Stripe, l'un des prestataires les plus sécurisés au monde." },
  { q: "Les Actions Tendance, c'est quoi ?", a: "Une stratégie qui consiste à capter des mouvements de prix directionnels forts sur quelques jours à quelques semaines. Comme pour tout investissement, le risque de perte en capital existe toujours." },
  { q: "Les actions recommandées sont-elles prêtes à être tradées immédiatement ?", a: "Les actions de notre liste \"Actions Tendance\" présentent des configurations techniques solides. Nous montrons comment utiliser nos structures graphiques en 15 minutes (15m) pour des points d'entrée précis." },
  { q: "Quelle est la différence entre la \"Watchlist\" et la \"Liste Tendance\" ?", a: "Watchlist : actions à fort potentiel qui n'ont pas encore atteint un niveau d'entrée sécurisé.\n\nListe Tendance : opportunités ayant obtenu toutes les validations techniques, de volume et de momentum. Nos configurations à plus forte conviction." },
  { q: "Comment les graphiques interactifs et l'analyse de BOGA AI m'aident-ils ?", a: "BOGA AI analyse les graphiques pour tracer des plans de trading clairs : zone d'entrée, objectifs de gains et stop-loss. Vous gérez vos trades selon votre tolérance au risque." },
  { q: "Le système BOGA AI peut-il faire des erreurs ?", a: "Oui. Il n'existe aucun système financier infaillible. BOGA AI s'appuie sur un LLM propriétaire et le machine learning, analysant en continu les résultats de chaque opération pour s'améliorer." },
  { q: "Les graphiques contiennent-ils trop de lignes et d'indicateurs confus ?", a: "Pas du tout ! Notre philosophie est d'éliminer le bruit de fond, avec des graphiques épurés et des rapports rédigés en langage simple." },
  { q: "Vos données sont-elles en temps réel ou différées ?", a: "Nos données techniques sont mises à jour toutes les heures, avec un différé standard de 15 minutes. Notre approche repose sur les Actions Tendance, donc les données à la milliseconde ne sont pas nécessaires." },
  { q: "Il y a des milliers d'actions cotées. Comment savoir laquelle choisir ?", a: "Notre algorithme analyse plus de 6 000 actions chaque jour sur la NYSE, le NASDAQ et l'AMEX, ne gardant qu'une sélection moyenne de 20 à 30 actions de premier choix." },
  { q: "Que signifie \"Suivre la Smart Money\" ?", a: "La véritable force derrière les mouvements de prix vient des grands fonds institutionnels (Smart Money). Notre algorithme suit les flux de capitaux et les pics de volume pour détecter leurs mouvements." },
  { q: "Qu'est-ce que le \"Système de notation à cinq niveaux\" ?", a: "Chaque candidat est classé en cinq catégories : Forte conviction, Biais positif, Neutre (Attendre), Biais négatif et Performance faible." },
  { q: "Comment la note technique des actions est-elle calculée ?", a: "Une moyenne pondérée d'indicateurs : RSI, MACD, volume relatif, croisements EMA, force de tendance (ADX) et contraction des bandes de Bollinger — un mécanisme multifactoriel." },
  { q: "Utilisez-vous uniquement l'analyse technique ?", a: "Non, les fondamentaux comptent énormément : P/E, flux de trésorerie disponibles, marges brutes et croissance des revenus, comparés aux moyennes sectorielles." },
  { q: "Pourquoi BOGASTOCK se concentre-t-il uniquement sur les marchés américains ?", a: "Notre plateforme est axée à 100 % sur les bourses américaines (NYSE, NASDAQ, AMEX) pour leur liquidité et leur structure idéale pour le suivi algorithmique des tendances." },
  { q: "Y a-t-il un risque de perdre de l'argent avec ce système ?", a: "Oui, absolument. Toute promesse de gain garanti à 100 % est mensongère. Les statistiques de BOGA AI reposent sur des données passées, sans garantie pour l'avenir. Gérez toujours votre risque rigoureusement." },
  { q: "Suis-je obligé d'utiliser un \"Stop Loss\" ?", a: "Oui, impérativement ! Règle d'or : \"On n'ouvre jamais une position sans Stop Loss.\" Définissez votre perte maximale acceptable avant d'entrer en position, et tenez-vous-y." },
]);

const PT: FaqEntry[] = buildEntries("pt", [
  { q: "O que é exatamente a BOGASTOCK e como ela pode me ajudar?", a: "A BOGASTOCK é uma plataforma de tecnologia financeira que usa IA (BOGA AI) e algoritmos matemáticos avançados para escanear milhares de ações nas bolsas americanas (NYSE, NASDAQ e AMEX), entregando uma lista das 20-30 melhores Ações em Tendência." },
  { q: "Vocês fazem recomendação direta de compra e venda de ações?", a: "De jeito nenhum. Não somos uma empresa de consultoria financeira. A BOGASTOCK gera análises 100% baseadas em algoritmos matemáticos. A decisão final de operar, o gerenciamento de risco e o tamanho da posição são de sua total responsabilidade." },
  { q: "Posso testar a plataforma de graça antes de me tornar membro?", a: "Não — não oferecemos mais um teste gratuito. A BOGASTOCK funciona com um modelo de assinatura Premium direta: sua assinatura começa e é cobrada no cadastro, mas seu primeiro mês sai com desconto. Você pode navegar gratuitamente pelo Painel público antes de assinar." },
  { q: "Vocês pedem os dados do cartão no cadastro, a cobrança é feita na hora?", a: "Sim. No momento em que sua assinatura é criada, seu cartão é cobrado com a tarifa promocional do primeiro mês, passando para a tarifa padrão depois. Não há período de teste. Você pode cancelar a qualquer momento pelo painel da sua conta." },
  { q: "Meus dados de cartão de crédito ficam salvos com vocês?", a: "A segurança dos seus dados é nossa prioridade máxima. Não salvamos nenhuma informação do seu cartão em nossos servidores. Todo pagamento é processado de forma criptografada através do Stripe." },
  { q: "O que são Ações em Tendência? Eu nunca operei antes.", a: "Uma estratégia que busca capturar movimentos de preço direcionais fortes em um prazo de dias a semanas. Como em qualquer renda variável, sempre existem riscos de perda de capital." },
  { q: "As ações sugeridas já estão prontas para operar?", a: "As ações na nossa lista de \"Ações em Tendência\" já apresentam estrutura técnica forte. Sugerimos usar nosso modelo gráfico de 15 minutos (15m) para identificar gatilhos de entrada mais precisos." },
  { q: "Qual é a diferença entre a \"Lista de Monitoramento\" e a \"Lista de Tendência\"?", a: "Lista de Monitoramento (Watchlist): ações de alto potencial que ainda não atingiram uma zona de entrada segura.\n\nLista de Tendência: ações que receberam todas as confirmações técnicas e de volume necessárias — nossas ideias de maior convicção." },
  { q: "Como o Gráfico Interativo e a análise da BOGA AI me ajudam?", a: "A BOGA AI analisa os padrões do gráfico e gera planos de operação: zona de entrada, alvos de lucro e stop loss. Você gerencia a operação de acordo com seu perfil de risco." },
  { q: "A inteligência artificial BOGA AI pode errar?", a: "Sim, pode errar. Não existe sistema financeiro infalível. A BOGA AI conta com um LLM proprietário e aprendizado de máquina, analisando constantemente os resultados de cada operação para se autoajustar." },
  { q: "Os gráficos têm muitas linhas e indicadores confusos?", a: "Não! Nossa filosofia é eliminar o ruído e a confusão, com gráficos limpos e relatórios em linguagem simples." },
  { q: "Os dados da plataforma são em tempo real ou atrasados?", a: "Nossos dados técnicos atualizam de hora em hora, com atraso padrão de 15 minutos. Nosso foco é em Ações em Tendência, então não há necessidade de dados em tempo real." },
  { q: "Existem milhares de ações na bolsa americana. Como vou saber qual escolher?", a: "Nosso algoritmo varre mais de 6.000 ações todos os dias na NYSE, NASDAQ e AMEX, mantendo apenas uma média de 20-30 ações de altíssima qualidade." },
  { q: "O que significa \"Rastrear o Smart Money\"?", a: "Os grandes fundos institucionais (Smart Money) são quem realmente move os preços. Nosso algoritmo acompanha fluxos de capital e picos de volume para identificar seus movimentos." },
  { q: "O que é a \"Classificação de Pontuação em Cinco Níveis\"?", a: "Cada ação é classificada em cinco categorias: Alta Convicção, Tendência Positiva, Neutro (Aguardar), Tendência Negativa e Baixo Desempenho." },
  { q: "Como é calculada a pontuação técnica das ações?", a: "Uma média ponderada de indicadores: RSI, MACD, Volume Relativo, cruzamentos de EMA, força de tendência (ADX) e Bandas de Bollinger — um consenso multifatorial." },
  { q: "Vocês usam apenas análise técnica?", a: "Não, os fundamentos importam muito: P/L, fluxo de caixa livre, margens de lucro bruto e crescimento de receita, comparados com a média do setor." },
  { q: "A BOGASTOCK foca apenas no mercado americano? Por quê?", a: "Sim, nosso foco é 100% nas bolsas dos EUA (NYSE, NASDAQ e AMEX) por sua liquidez e estrutura ideal para o rastreamento algorítmico de tendências." },
  { q: "Existe a chance de eu perder dinheiro operando com o sistema?", a: "Sim, existe. Qualquer promessa de 100% de acerto é mentira. As estatísticas da BOGA AI se baseiam em dados passados, sem garantia de resultados futuros. Limite seus riscos em cada operação." },
  { q: "Sou obrigado a usar o \"Stop Loss\"?", a: "Sim, você é! Regra número um: \"Nunca abra uma operação sem definir um Stop Loss.\" Saiba exatamente quanto aceita perder antes de entrar no trade, e respeite esse limite." },
]);

export const FAQ_DATA: Record<CopilotLocale, FaqEntry[]> = { tr: TR, en: EN, es: ES, fr: FR, pt: PT };

/** Basit anahtar kelime eşleştirmesi — semantic embedding yok, ama soru/cevap
 *  metninde geçen kelime örtüşmesine göre en iyi 1-3 SSS maddesini bulur. */
export function findFaqMatches(query: string, locale: string, limit = 3): FaqEntry[] {
  const entries = FAQ_DATA[(locale as CopilotLocale)] || FAQ_DATA.en;
  const q = query.toLowerCase();
  const qWords = q.split(/\s+/).filter((w) => w.length > 2);
  if (qWords.length === 0) return [];

  const scored = entries.map((e) => {
    const hay = (e.question + " " + e.answer).toLowerCase();
    const score = qWords.reduce((s, w) => (hay.includes(w) ? s + 1 : s), 0);
    return { e, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.e);
}
