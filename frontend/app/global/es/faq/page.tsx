import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Faq",
  alternates: { canonical: "https://bogastock.com/global/es/faq" }
};


export default function EsFAQPage() {
  const faqs = [
    {
      question: "1. ¿Qué es exactamente BOGASTOCK y qué puede hacer por mí?",
      answer: "BOGASTOCK es una plataforma de tecnología financiera que utiliza inteligencia artificial (BOGA AI) y algoritmos matemáticos avanzados para escanear miles de acciones en las bolsas de Estados Unidos (NYSE, NASDAQ y AMEX). Nuestro objetivo es evitar que te pierdas en gráficos llenos de indicadores confusos. Identificamos, puntuamos y te presentamos una lista de seguimiento clara con las 20 o 30 mejores Acciones en Tendencia, analizadas tanto técnica como fundamentalmente. Te ayudamos a tomar decisiones de inversión basadas en datos puramente racionales."
    },
    {
      question: "2. ¿Nos dan recomendaciones directas de compra o venta de acciones?",
      answer: "Rotundamente no. No somos una firma de asesoría financiera ni gestores de inversión. BOGASTOCK es una plataforma de software que genera análisis basados al 100% en algoritmos matemáticos. Nuestro sistema nunca te dirá \"compra a precio X\" o \"vende a precio Y\"; solo filtra y lista los candidatos con mayor fuerza técnica y fundamental, y te ofrece el informe de análisis de nuestra IA. La decisión final de operar, la gestión de riesgo y el tamaño de tus posiciones son de tu exclusiva responsabilidad."
    },
    {
      question: "3. ¿Puedo probar la plataforma gratis antes de hacerme miembro?",
      answer: "No — ya no ofrecemos una prueba gratuita. BOGASTOCK funciona con un modelo de membresía Premium directa: tu suscripción comienza y se cobra en el momento en que te registras, aunque tu primer mes tiene descuento. Antes de unirte, puedes explorar gratis el Panel público para conocer la plataforma."
    },
    {
      question: "4. Piden los datos de mi tarjeta al registrarme, ¿se cobra de inmediato?",
      answer: "Sí. En el momento en que se crea tu membresía, se cobra a tu tarjeta la tarifa con descuento del primer mes, y desde el segundo mes la tarifa estándar. No hay periodo de prueba, así que el cobro comienza de inmediato al registrarte. Puedes cancelar tu membresía desde tu panel de cuenta en cualquier momento, sin cargos adicionales."
    },
    {
      question: "5. ¿Guardan los datos de mi tarjeta de crédito en su sistema? ¿Estoy seguro?",
      answer: "Tu seguridad es nuestra máxima prioridad. No almacenamos ni registramos ningún dato de tu tarjeta de crédito en nuestros servidores. Todo el proceso de pago se realiza de forma totalmente cifrada y segura a través de Stripe, una de las pasarelas de pago más grandes, fiables y protegidas del mundo."
    },
    {
      question: "6. ¿Qué son las Acciones en Tendencia? No tengo experiencia previa.",
      answer: "Las Acciones en Tendencia son una estrategia que busca capturar movimientos de precio direccionales fuertes en una acción durante un periodo que suele ir de unos días a unas semanas. Es ideal para quienes no tienen tiempo de mirar el mercado minuto a minuto o no quieren dejar su dinero atrapado a muy largo plazo. BOGASTOCK está calibrado para capturar estos movimientos a corto y medio plazo. Sin embargo, como en cualquier inversión de renta variable, siempre existe el riesgo de perder capital."
    },
    {
      question: "7. ¿Las acciones sugeridas están listas para operar de inmediato? ¿Cómo debo entrar?",
      answer: "Las acciones de nuestra lista activa de \"Acciones en Tendencia\" ya presentan una estructura técnica muy fuerte y óptima. Sin embargo, para buscar una mayor rentabilidad con el menor riesgo posible, sugerimos a nuestros miembros utilizar nuestra estructura de gráficos de 15 minutos (15m) para identificar patrones y gatillos de entrada más precisos. Estas estrategias de precisión te ayudan a evitar señales falsas."
    },
    {
      question: "8. ¿Cuál es la diferencia entre la \"Lista de Seguimiento\" (Watchlist) y la \"Lista de Tendencia\"?",
      answer: "Lista de Seguimiento (Watchlist): Incluye acciones con gran potencial detectadas por nuestros algoritmos, pero que aún no han realizado una ruptura (breakout) clara o no han alcanzado un punto de entrada lo suficientemente seguro.\n\nLista de Tendencia: Son las acciones que han superado el filtro de la Lista de Seguimiento tras recibir todas las confirmaciones técnicas, de volumen y de momentum necesarias para sumarse al plan de operaciones activo. Son nuestras ideas de mayor convicción."
    },
    {
      question: "9. ¿Cómo me ayudan los Gráficos Interactivos y el análisis de BOGA AI?",
      answer: "En la pantalla de detalles de cada acción, ofrecemos un gráfico interactivo simplificado diseñado por nosotros para evitar el exceso de información visual. BOGA AI analiza los patrones de este gráfico para generar planes de trading claros: zona de entrada, objetivos de beneficio y nivel de stop loss (límite de pérdida). Tú solo analizas estas proyecciones y gestionas tu operación según tu tolerancia al riesgo y capital."
    },
    {
      question: "10. ¿La inteligencia artificial BOGA AI comete errores? ¿Cómo mejora?",
      answer: "Sí, puede cometerlos. No existe ningún sistema financiero ni inteligencia artificial infalible en el mundo; los mercados siempre están llenos de incertidumbre. Sin embargo, BOGA AI cuenta con una estructura de LLM (Gran Modelo de Lenguaje) propia y aprendizaje automático (machine learning). Analiza constantemente el resultado de cada operación (ganadas y perdidas) para autoajustarse. Nuestro objetivo es adaptarnos lo más rápido posible a los cambios del mercado."
    },
    {
      question: "11. ¿Los gráficos tienen demasiadas líneas e indicadores confusos? ¿Me costará entenderlos?",
      answer: "¡Para nada! La filosofía de BOGASTOCK es eliminar el ruido y la confusión. En lugar de saturarte con jerga técnica compleja, te ofrecemos gráficos limpios e indicadores directos al grano. Aunque tus conocimientos financieros sean básicos, los informes redactados por nuestra IA en un lenguaje sencillo te permitirán entender la situación en un abrir y cerrar de ojos."
    },
    {
      question: "12. ¿Los datos de la plataforma son en tiempo real o retrasados?",
      answer: "Nuestros datos técnicos provienen de fuentes que se actualizan cada hora, con un retraso estándar de 15 minutos. Dado que nos enfocamos exclusivamente en las Acciones en Tendencia (operaciones de varios días o semanas), no necesitamos datos al milisegundo. Las actualizaciones cada hora son más que suficientes para generar análisis estables, seguros y sin estrés."
    },
    {
      question: "13. Hay miles de acciones cotizando en bolsa. ¿Cómo sabré cuál elegir?",
      answer: "Ahí es donde BOGASTOCK hace el trabajo duro por ti. Nuestro algoritmo escanea automáticamente más de 6,000 acciones todos los días en NYSE, NASDAQ y AMEX. Filtramos el mercado por volumen y liquidez para eliminar las distracciones y quedarnos solo con una media de 20 a 30 acciones de máxima calidad bajo radar. Así no tienes que perder el tiempo buscando una aguja en un pajar."
    },
    {
      question: "14. ¿Qué significa \"Seguir el rastro del Smart Money\" (Dinero Inteligente)?",
      answer: "En los mercados financieros, quienes realmente mueven los precios con fuerza son los grandes fondos institucionales y los bancos de inversión (el llamado Smart Money). Nuestro algoritmo rastrea los flujos diarios de capital y los picos de volumen para detectar cuándo estos gigantes están acumulando o distribuyendo posiciones en silencio. Seguir sus huellas nos permite operar a favor de la tendencia principal."
    },
    {
      question: "15. ¿Qué es el \"Sistema de Calificación de Cinco Niveles\"?",
      answer: "El motor de puntuación de BOGASTOCK analiza cada candidato según sus métricas técnicas y fundamentales, clasificándolos en cinco categorías muy claras: Alta Convicción (High Conviction), Sesgo Positivo, Neutral (Esperar), Sesgo Negativo e Infrarendimiento. De este modo, ves al instante el respaldo matemático que tiene cada configuración, sin espacio para las adivinanzas."
    },
    {
      question: "16. ¿Cómo se calcula la puntuación técnica de las acciones?",
      answer: "Nuestra puntuación técnica es una media ponderada de indicadores clave calibrados específicamente para los mercados de EE. UU., como el RSI, MACD, Volumen Relativo, cruces de medias móviles exponenciales (EMA), fuerza de tendencia (ADX) y contracción de Bandas de Bollinger. Es decir, nos basamos en un sistema de confirmación multifactorial y no en un solo indicador aislado."
    },
    {
      question: "17. ¿Utilizan solo análisis técnico? ¿No importan las ganancias ni el balance de la empresa?",
      answer: "¡Importan muchísimo! Nuestro sistema complementa el análisis técnico con una sólida \"Capa Fundamental y Sectorial\". Analizamos ratios clave como el P/E (Precio/Ganancia), el rendimiento del flujo de caja libre (FCF Yield), los márgenes de beneficio bruto y el crecimiento de los ingresos, comparándolos siempre con la media de su sector. Así, priorizamos empresas que no solo tienen gráficos atractivos, sino también fundamentales sólidos."
    },
    {
      question: "18. ¿Por qué BOGASTOCK se enfoca únicamente en los mercados de Estados Unidos?",
      answer: "Sí, nuestra plataforma está enfocada al 100% en las bolsas estadounidenses (NYSE, NASDAQ y AMEX). Elegimos este mercado porque ofrece la mayor liquidez, profundidad y estructura ideal para el seguimiento de tendencias de forma sistemática y algorítmica en todo el mundo. Todos nuestros criterios de puntuación, pesos y modelos de IA han sido calibrados exclusivamente para esta dinámica de mercado."
    },
    {
      question: "19. ¿Existe el riesgo de perder dinero operando con este sistema?",
      answer: "Sí, por supuesto que existe. En los mercados financieros, cualquier promesa de rentabilidad garantizada al 100% es falsa. Las tasas de éxito históricas y las estadísticas de BOGA AI se basan en datos del pasado, lo que no garantiza que todas las operaciones futuras sean ganadoras. Por eso, es vital limitar el riesgo en cada operación y nunca comprometer todo tu capital en una sola posición."
    },
    {
      question: "20. ¿Estoy obligado a utilizar un \"Stop Loss\" (Límite de Pérdida)?",
      answer: "¡Sí, absolutamente! La regla número uno de la filosofía BOGASTOCK es: \"Nunca se abre una operación sin definir un Stop Loss.\" El mercado puede cambiar de dirección de forma inesperada en cualquier momento. La única forma de proteger tu capital de grandes caídas es definir exactamente cuánto estás dispuesto a perder antes de entrar al trade, y ceñirte estrictamente a ese plan. Diseña tu plan, mantén la disciplina y deja las emociones fuera de tus operaciones."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="es" />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Preguntas Frecuentes (FAQ)
          </h1>
          <p className="text-[#64748b] text-lg">
            Todo lo que necesitas saber sobre el funcionamiento de BOGASTOCK y BOGA AI.
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-[#1e2a3a]/40 border border-[#1e2a3a] rounded-xl p-6 hover:border-[#3b82f6]/50 transition-colors">
              <h3 className="text-lg font-medium text-white mb-3 leading-snug">
                {faq.question}
              </h3>
              <div className="text-[#94a3b8] text-sm md:text-base leading-relaxed space-y-4">
                {faq.answer.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer locale="es" />
    </div>
  );
}
