import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: "https://bogastock.com/global/id/terms", languages: {
      en: "https://bogastock.com/global/en/terms",
      es: "https://bogastock.com/global/es/terms",
      fr: "https://bogastock.com/global/fr/terms",
      id: "https://bogastock.com/global/id/terms",
      pt: "https://bogastock.com/global/pt/terms",
      tr: "https://bogastock.com/global/tr/terms",
      "x-default": "https://bogastock.com/global/en/terms",
    } }
};


export default function TermsPageId() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="id" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">

        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Syarat Penggunaan dan Perjanjian Layanan</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">

          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Penerimaan Syarat dan Pernyataan Perusahaan
            </h2>
            <p className="mb-4 text-slate-300">
              Dengan mengakses platform <strong className="text-white">BogaStock.com</strong>, situs web, atau aplikasi selulernya, atau dengan membuat keanggotaan, Anda dianggap telah membaca, memahami, dan setuju untuk terikat secara hukum pada ketentuan Syarat Penggunaan dan Perjanjian Layanan ini.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> (Blue One Global Analysis) adalah <strong className="text-white">platform analisis teknikal dan dukungan keputusan</strong> otomatis yang bekerja dengan model kecerdasan buatan tingkat lanjut dan algoritma data kuantitatif.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Cakupan Layanan dan Pengecualian Nasihat Investasi
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> memindai peluang teknikal yang menonjol di pasar menggunakan algoritmanya dan menyajikan kepada pengguna data informasi umum, pemodelan statistik, serta dukungan keputusan analitis.
            </p>
            <p className="text-slate-300">
              Tidak ada grafik, sinyal indikator, skor AI, atau output analisis teknikal yang dipublikasikan di dalam platform ini yang merupakan <strong className="text-white">nasihat investasi, manajemen portofolio, atau konsultasi keuangan</strong>. BogaStock.com bukan Penasihat Investasi (RIA) atau Pialang-Dealer terdaftar di bawah SEC AS, dan juga bukan lembaga konsultasi keuangan berlisensi di bawah Undang-Undang Pasar Modal Republik Turki No. 6362 atau otoritas berwenang UE. Tidak ada hubungan konsultasi atau fidusia yang terbentuk dengan pengguna dalam bentuk apa pun.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Pernyataan Kepatuhan Pasar Global dan Hukum UE (ESMA, MiFID II, MAR)
            </h2>
            <p className="mb-4 text-slate-300">
              Platform kami mencakup pasar keuangan global: <strong className="text-white">Pasar AS (NYSE, NASDAQ, S&P 500, Dow, Russell)</strong>, <strong className="text-white">bursa Eropa (DAX, FTSE 100, CAC40, STOXX50)</strong>, <strong className="text-white">bursa Asia (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong>, <strong className="text-white">bursa Amerika Latin (S&P Latam 40, IBOVESPA)</strong>, serta bursa Valuta Asing, Komoditas, dan Kripto.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> dioperasikan dengan mengacu pada arahan regulasi keuangan Uni Eropa (<strong className="text-white">ESMA</strong>, <strong className="text-white">MiFID II</strong>) dan <strong className="text-white">Peraturan Penyalahgunaan Pasar UE (MAR - Regulation EU No 596/2014)</strong>. Sistem kami tidak mengandung manipulasi pasar atau arahan portofolio tanpa izin.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Keamanan Akun Pengguna dan Batasan Kekayaan Intelektual
            </h2>
            <p className="mb-4 text-slate-300">
              Akun pengguna bersifat pribadi dan tidak boleh dibagikan kepada pihak ketiga. Pengguna bertanggung jawab penuh atas keamanan kredensial akses akun mereka sendiri.
            </p>
            <p className="text-slate-300">
              Hak cipta, kode perangkat lunak, arsitektur algoritma, data mesin penilaian skor AI, dan komponen desain di dalam BogaStock.com merupakan milik perusahaan kami. Dilarang mengambil, menyalin, mengumpulkan secara otomatis, atau mendistribusikan ulang data platform untuk tujuan komersial menggunakan bot/alat scraping tanpa izin tertulis.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Privasi Data (GDPR, KVKK, dan CCPA)
            </h2>
            <p className="text-slate-300">
              Data pengguna diproses dengan mengacu pada standar yang berlaku, termasuk Peraturan Perlindungan Data Umum Uni Eropa (<strong className="text-white">GDPR</strong>), Undang-Undang Perlindungan Data Pribadi Republik Turki No. 6698 (<strong className="text-white">KVKK</strong>), dan Undang-Undang Privasi Konsumen California (<strong className="text-white">CCPA</strong>). BogaStock.com tidak menjual atau menyewakan data pribadi kepada pihak ketiga mana pun.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              6. Batasan Tanggung Jawab dan Perubahan Layanan
            </h2>
            <p className="text-slate-300">
              Bertransaksi di pasar keuangan mengandung volatilitas dan risiko yang sangat tinggi. Seluruh keputusan transaksi yang diambil sebagai hasil penggunaan data dukungan keputusan analitis BogaStock.com, beserta kerugian finansial/hukum yang mungkin timbul, sepenuhnya menjadi tanggung jawab pengguna. BogaStock.com berhak memperbarui fitur atau ketentuan layanannya tanpa pemberitahuan sebelumnya.
            </p>
          </section>

          {/* Section 7 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Keberlakuan Hukum</h2>
            <p className="text-xs text-slate-400">
              Dengan terus menggunakan platform BogaStock.com, Anda dianggap telah menyetujui ketentuan dan kerangka hukum di atas.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Terakhir Diperbarui: 4 Agustus 2026 | Platform Analisis Teknikal dan Dukungan Keputusan BogaStock.com
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="id" />
    </div>
  );
}
