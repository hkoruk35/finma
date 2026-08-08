import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "https://bogastock.com/global/es/about" }
};


export default function AboutPageEs() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">Nuestra Historia</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            De una Idea de Vehículos Autónomos<br />
            <span className="text-[#3b82f6]">al BogaStock de Hoy.</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            BogaStock no apareció de la noche a la mañana. Nació de años de experiencia en procesamiento de datos, acumulada por un pequeño equipo en California que empezó trabajando en coches autónomos.
          </p>
        </div>

        {/* 2018 - Origin */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#3b82f6]">2018</span>
            <h2 className="text-xl font-bold text-white">Un Comienzo en California</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            La historia de BogaStock empieza en realidad con vehículos autónomos, no con finanzas. Fundada en California en 2018, AFK Data Sistemas (AFK DaSYS) dedicó sus primeros años a construir sistemas de procesamiento de datos y apoyo a la decisión para coches autónomos. Ese conocimiento impulsa hoy simulaciones de Smart City en tiempo real en más de 1.000 ciudades repartidas en 48 estados de EE. UU., a partir de 2025.
          </p>
        </div>

        {/* 2021 - BogaStock born */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#8b5cf6]">2021</span>
            <h2 className="text-xl font-bold text-white">El Camino se Cruza con las Finanzas</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            En 2021, el equipo de AFK DaSYS decidió llevar esa misma disciplina de procesamiento de datos — dar sentido a grandes volúmenes de información y convertirla en decisiones en tiempo real — hacia un desafío completamente distinto: los mercados financieros. Así nació BogaStock.com, con un objetivo simple: hacer que seguir miles de acciones estadounidenses deje de ser una tarea técnica y se convierta en algo que cualquiera pueda entender.
          </p>
        </div>

        {/* Continuous learning */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
          <h2 className="text-xl font-bold text-white mb-4">Un Sistema que Nunca Deja de Aprender</h2>
          <p className="text-white/70 leading-relaxed">
            La IA de BogaStock no ha sido la misma desde el primer día, y tampoco lo será en el futuro. Cada vez que el sistema lanza un nuevo modelo de análisis u operación, pasa por su propio ciclo de reentrenamiento — así que cuanto más se usa la plataforma, más experiencia gana y más precisa se vuelve con el tiempo. Este avance continúa junto a{" "}
            <a href="https://www.afknexro.com/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">AFK Nexro AI</a>
            , un sistema de IA hermano enfocado en Smart City y vehículos autónomos, dentro de una cultura compartida de investigación y desarrollo.
          </p>
        </div>

        {/* Today */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white text-center mb-10">BogaStock Hoy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">70+</div>
              <p className="text-white/70 text-sm leading-relaxed">países alcanzados, con un sistema que funciona las 24 horas.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">6.000+</div>
              <p className="text-white/70 text-sm leading-relaxed">acciones y ETFs de EE. UU. escaneados y evaluados cada día.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">5 Idiomas</div>
              <p className="text-white/70 text-sm leading-relaxed">en nuestro sitio web, funcionando con nuestras propias bases de datos y centros de datos.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">30+ Idiomas</div>
              <p className="text-white/70 text-sm leading-relaxed">a través de Boga Copilot — conversación natural, adaptada al uso diario.</p>
            </div>
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-medium text-white mb-4">En Qué Creemos</h2>
          <p className="text-white/80 max-w-2xl mx-auto italic leading-relaxed">
            "En un mundo cada vez más gobernado por algoritmos, procesar los datos correctamente es solo la mitad del trabajo — hacerlos comprensibles importa igual. En BogaStock, nuestro objetivo es convertir datos de mercado complejos en un camino claro que cualquiera pueda seguir, para que tomes tus propias decisiones con confianza."
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
