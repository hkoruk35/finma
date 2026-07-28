const fs = require('fs');
const path = './landing-config.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.es.screenshots = [
  {
    "src": "/screenshots/wes1.png",
    "label": "Inicio — Resumen en Vivo",
    "desc": "Resumen por hora de Swing y Tendencia con banner de rendimiento"
  },
  {
    "src": "/screenshots/wes2.png",
    "label": "Análisis Profundo de Acciones",
    "desc": "Indicadores técnicos, precios de entrada/stop/objetivo, BOGA Score y gráfico en vivo"
  },
  {
    "src": "/screenshots/wes3.png",
    "label": "Candidatos Diarios de Swing",
    "desc": "14 candidatos, señales EMA/RSI, detección de patrones y seguimiento de precios en tiempo real"
  },
  {
    "src": "/screenshots/wes4.png",
    "label": "Rendimiento del Sistema",
    "desc": "Mapa de calor de rentabilidad por sector y registro histórico de operaciones"
  }
];

for (let i = 0; i < data.es.features.length; i++) {
  if (data.es.features[i].title.includes("Top 100")) {
    data.es.features[i].title = "Decisiones Más Claras";
    data.es.features[i].desc = "Tomarás decisiones más fácilmente con menos acciones, enfocándote solo en las mejores oportunidades elegidas por BOGASTOCK.";
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log("Updated Spanish config");
