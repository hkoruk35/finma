/**
 * SPY Engine — 5m Monte Carlo fiyat yolu simülasyonu (Faz 1, bkz.
 * tasks/active/013).
 *
 * GBM (geometrik Brownian hareket) ile fiyat yollarını simüle eder ve İKİ
 * AYRI olasılık türü üretir — bunlar MATEMATİKSEL OLARAK FARKLI
 * büyüklüklerdir, birbirine dönüştürülemez ve aynı etiketle gösterilmemeli
 * (bkz. tasks/active/013 §2.1):
 *
 *   - touchProbability(level): yolun ufuk boyunca EN AZ BİR noktada o
 *     seviyeye ulaşma/geçme ihtimali ("erişim olasılığı").
 *   - densityInBand(low, high): tüm yolların TÜM adımları içinde o bantta
 *     geçirilen zaman/nokta oranı ("yoğunluk").
 *
 * DETERMİNİSTİK: `seed` çağıran tarafından SON KAPALI 5m BARIN zaman
 * damgasından türetilir (bkz. seedFromBar) — aynı kapalı bar için sonuç
 * HER ZAMAN aynıdır. Bu, motorun geri kalanının "non-repainting" ilkesiyle
 * tutarlıdır: ekranda olasılıklar yalnızca yeni bir 5m bar kapandığında
 * değişir, art arda yoklamalar arasında rastgele titremez.
 *
 * Sürüklenme (drift) SIFIR varsayılır — yön tahmini yapılmaz, yalnızca
 * ölçülen oynaklık kadar dağılım simüle edilir. Girdi (spot, sigma)
 * gerçek ölçümden gelmiyorsa çağıran taraf simülasyonu hiç çalıştırmamalı.
 */

export interface MonteCarloParams {
  spot: number;
  /** Bir 5m adımlık log-getiri standart sapması (mevsimsellikle ayarlanmış) */
  sigmaPerStep: number;
  /** Kaç 5m adımı ileri simüle edilecek */
  steps: number;
  /** Yol sayısı */
  nSims: number;
  /** Tekrarlanabilirlik için tohum — bkz. seedFromBar */
  seed: number;
}

export interface MonteCarloResult {
  spot: number;
  sigmaPerStep: number;
  steps: number;
  nSims: number;
  /** steps × 5 — simülasyonun kapsadığı gerçek dakika */
  horizonMin: number;
  /** Erişim olasılığı — bkz. dosya başlığı */
  touchProbability(level: number): number;
  /** Yoğunluk olasılığı — bkz. dosya başlığı */
  densityInBand(low: number, high: number): number;
}

/** Hızlı, tohum'lanabilir PRNG (mulberry32) — kriptografik amaç YOK, yalnızca tekrarlanabilirlik için */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller dönüşümü: standart normal (N(0,1)) rastgele değişken üretir */
function boxMuller(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Son kapalı 5m barın zamanından + o anki spot'tan deterministik tohum
 * türetir. Aynı kapalı bar + aynı spot → aynı tohum → aynı simülasyon
 * sonucu (yeni bar kapanana kadar ekranda sabit kalır).
 */
export function seedFromBar(barTimeSec: number, spot: number): number {
  const x = Math.floor(barTimeSec) * 2654435761 + Math.round(spot * 100);
  return x >>> 0;
}

export function runMonteCarlo(params: MonteCarloParams): MonteCarloResult {
  const { spot, sigmaPerStep, steps, nSims, seed } = params;
  const rng = mulberry32(seed);
  // Sıfır sürüklenme + log-normal varyans düzeltmesi (risk-nötr DEĞİL, yön
  // tahmini yapmayan saf dağılım varsayımı — bkz. dosya başlığı).
  const drift = -0.5 * sigmaPerStep * sigmaPerStep;

  const allPaths: Float64Array[] = new Array(nSims);
  for (let s = 0; s < nSims; s++) {
    const path = new Float64Array(steps);
    let price = spot;
    for (let i = 0; i < steps; i++) {
      const z = boxMuller(rng);
      price = price * Math.exp(drift + sigmaPerStep * z);
      path[i] = price;
    }
    allPaths[s] = path;
  }

  const totalPoints = nSims * steps;

  function touchProbability(level: number): number {
    if (!Number.isFinite(level) || nSims === 0) return 0;
    const above = level >= spot;
    let touched = 0;
    for (let s = 0; s < nSims; s++) {
      const path = allPaths[s];
      for (let i = 0; i < steps; i++) {
        if (above ? path[i] >= level : path[i] <= level) { touched++; break; }
      }
    }
    return touched / nSims;
  }

  function densityInBand(low: number, high: number): number {
    if (!(high > low) || totalPoints === 0) return 0;
    let count = 0;
    for (let s = 0; s < nSims; s++) {
      const path = allPaths[s];
      for (let i = 0; i < steps; i++) {
        if (path[i] >= low && path[i] < high) count++;
      }
    }
    return count / totalPoints;
  }

  return { spot, sigmaPerStep, steps, nSims, horizonMin: steps * 5, touchProbability, densityInBand };
}
