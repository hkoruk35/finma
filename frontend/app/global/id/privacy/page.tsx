import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "https://bogastock.com/global/id/privacy", languages: {
      en: "https://bogastock.com/global/en/privacy",
      es: "https://bogastock.com/global/es/privacy",
      fr: "https://bogastock.com/global/fr/privacy",
      id: "https://bogastock.com/global/id/privacy",
      pt: "https://bogastock.com/global/pt/privacy",
      tr: "https://bogastock.com/global/tr/privacy",
      "x-default": "https://bogastock.com/global/en/privacy",
    } }
};


export default function PrivacyPageId() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="id" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">

        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Kebijakan Privasi dan Standar Keamanan Data Global</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">

          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Pendekatan dan Komitmen Keamanan Data Kami
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> (Blue One Global Analysis) adalah <strong className="text-white">platform analisis teknikal dan dukungan keputusan</strong> yang bekerja dengan algoritma berbasis kecerdasan buatan. Privasi data dan keamanan informasi pengguna kami berada di pusat arsitektur perusahaan kami.
            </p>
            <p className="text-slate-300">
              Sistem kami dioperasikan dengan kepatuhan penuh terhadap prinsip <strong className="text-white">Minimisasi Data (hanya mengumpulkan data yang diperlukan)</strong> dan <strong className="text-white">Privacy by Design</strong>, sejalan dengan Prinsip Keamanan Data Google.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Kerangka Kepatuhan Regulasi Internasional (AS, UE, Amerika Latin, Asia, dan Turki)
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> menyelaraskan praktik datanya dengan mengacu pada undang-undang perlindungan data dan standar keamanan data internasional di wilayah tempat kami melayani pengguna, termasuk:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
              <li><strong className="text-white">Uni Eropa (UE):</strong> Peraturan Perlindungan Data Umum UE (<strong className="text-white">GDPR - General Data Protection Regulation</strong>) dan Direktif ePrivacy.</li>
              <li><strong className="text-white">Amerika Serikat (AS):</strong> Undang-Undang Privasi Konsumen California (<strong className="text-white">CCPA / CPRA</strong>) dan standar perlindungan data tingkat negara bagian.</li>
              <li><strong className="text-white">Amerika Latin:</strong> Undang-Undang Perlindungan Data Umum Brasil (<strong className="text-white">LGPD</strong>), Meksiko (<strong className="text-white">LFPDPPP</strong>), dan Argentina (<strong className="text-white">Ley 25.326</strong>).</li>
              <li><strong className="text-white">Asia Pasifik:</strong> Korea Selatan (<strong className="text-white">PIPA</strong>), Jepang (<strong className="text-white">APPI</strong>), Singapura/Malaysia (<strong className="text-white">PDPA</strong>), India (<strong className="text-white">DPDP</strong>), dan Indonesia (<strong className="text-white">UU PDP</strong>).</li>
              <li><strong className="text-white">Turki:</strong> Undang-Undang Perlindungan Data Pribadi Republik Turki No. 6698 (<strong className="text-white">KVKK</strong>).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Data yang Dikumpulkan dan Tujuan Penggunaannya
            </h2>
            <p className="mb-4 text-slate-300">
              Melalui infrastruktur autentikasi aman Google dan Supabase (OAuth 2.0), hanya data pribadi minimum (alamat email, nama lengkap, foto profil) yang diproses, semata-mata untuk pembuatan akun dan keamanan sesi.
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
              <li><strong className="text-white">Manajemen Akun:</strong> Login yang aman, langganan, dan penyimpanan preferensi watchlist pribadi.</li>
              <li><strong className="text-white">Analitik dan Keamanan:</strong> Log IP anonim untuk melindungi keamanan sistem dari serangan siber.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Larangan Penjualan Data dan Prinsip Berbagi dengan Pihak Ketiga
            </h2>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com tidak pernah menjual, menyewakan, atau memasarkan data pribadi pengguna kepada pihak ketiga atau perantara data (data brokers).</strong> Data Anda hanya diproses secara terenkripsi di dalam penyedia infrastruktur aman kami (Google Cloud, Supabase).
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Standar Enkripsi dan Keamanan Infrastruktur
            </h2>
            <p className="text-slate-300">
              Transmisi data dilindungi menggunakan protokol enkripsi standar industri seperti <strong className="text-white">TLS</strong>, dan pada lapisan basis data diterapkan metode enkripsi berbasis <strong className="text-white">AES</strong>. Keamanan akses didukung dengan kontrol akses multi-faktor.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              6. Hak Pengguna dan Hak untuk Dilupakan (Data Rights & Deletion)
            </h2>
            <p className="text-slate-300">
              Semua pengguna kami berhak untuk melihat, memperbaiki, mengekspor data mereka (Data Portability), dan meminta penghapusan permanen seluruh data pribadi beserta akun mereka (<strong className="text-white">Hak untuk Dilupakan - Right to Erasure</strong>). Anda dapat mengajukan permintaan melalui pengaturan profil atau kanal kontak kami.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              7. Periklanan, Cookie & Google AdSense
            </h2>
            <p className="mb-4 text-slate-300">
              BogaStock.com menggunakan <strong className="text-white">Google AdSense</strong> untuk menampilkan iklan di situs ini. Sebagai vendor pihak ketiga, Google menggunakan cookie untuk menayangkan iklan berdasarkan kunjungan pengguna sebelumnya ke situs ini atau situs lain di Internet. Penggunaan cookie iklan oleh Google memungkinkan Google dan mitranya menayangkan iklan kepada pengguna kami berdasarkan kunjungan mereka ke BogaStock.com dan/atau situs lain.
            </p>
            <p className="text-slate-300">
              Pengguna dapat memilih keluar dari iklan yang dipersonalisasi dengan mengunjungi{" "}
              <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">Setelan Iklan Google</a>
              {" "}atau{" "}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">www.aboutads.info</a>.
            </p>
          </section>

          {/* Section 8 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Pernyataan Privasi Global</h2>
            <p className="text-xs text-slate-400">
              Dengan menggunakan platform BogaStock.com, Anda dianggap telah menyetujui kebijakan privasi ini dan standar perlindungan data internasional.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Terakhir Diperbarui: 4 Agustus 2026 | Manajemen Keamanan Data dan Privasi BogaStock.com
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="id" />
    </div>
  );
}
