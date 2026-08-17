const fs = require('fs');
let data = fs.readFileSync('about-config.json', 'utf8');
data = data.replace(/5 Dil/g, '6 Dil');
data = data.replace(/5 Languages/g, '6 Languages');
data = data.replace(/5 Idiomas/g, '6 Idiomas');
data = data.replace(/5 Langues/g, '6 Langues');
data = data.replace(/5 dilde/g, '6 dilde');
data = data.replace(/5 languages/g, '6 languages');
data = data.replace(/5 idiomas/g, '6 idiomas');
data = data.replace(/5 langues/g, '6 langues');

data = data.replace(/50\+ Dil/g, '100+ Dil');
data = data.replace(/50\+ Languages/g, '100+ Languages');
data = data.replace(/50\+ Idiomas/g, '100+ Idiomas');
data = data.replace(/50\+ Langues/g, '100+ Langues');
data = data.replace(/50\+ Bahasa/g, '100+ Bahasa');

data = data.replace(/50'den fazla/g, "100'den fazla");
data = data.replace(/over 50/g, 'over 100');
data = data.replace(/más de 50/g, 'más de 100');
data = data.replace(/plus de 50/g, 'plus de 100');
data = data.replace(/mais de 50/g, 'mais de 100');
data = data.replace(/lebih dari 50/g, 'lebih dari 100');

fs.writeFileSync('about-config.json', data);
console.log('done');
