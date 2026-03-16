'use client'

import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { UserCheck, TrendingUp, TrendingDown, DollarSign, Clock, Building2 } from 'lucide-react'

const INSIDER_DATA = [
  { name: 'Jensen Huang', title: 'CEO', company: 'NVDA', type: 'Satış', shares: '120,000', value: '$109.5M', date: '12 Mar 2026', priceThen: 912.45 },
  { name: 'Satya Nadella', title: 'CEO', company: 'MSFT', type: 'Satış', shares: '50,000', value: '$21M', date: '11 Mar 2026', priceThen: 420.50 },
  { name: 'Tim Cook', title: 'CEO', company: 'AAPL', type: 'Satış', shares: '75,000', value: '$13.7M', date: '10 Mar 2026', priceThen: 182.30 },
  { name: 'Lisa Su', title: 'CEO', company: 'AMD', type: 'Alış', shares: '25,000', value: '$4.2M', date: '10 Mar 2026', priceThen: 168.30 },
  { name: 'Elon Musk', title: 'CEO', company: 'TSLA', type: 'Alış', shares: '200,000', value: '$35.8M', date: '9 Mar 2026', priceThen: 178.90 },
  { name: 'Mary Barra', title: 'CEO', company: 'GM', type: 'Alış', shares: '30,000', value: '$1.5M', date: '8 Mar 2026', priceThen: 48.20 },
  { name: 'Jamie Dimon', title: 'CEO', company: 'JPM', type: 'Satış', shares: '100,000', value: '$19.8M', date: '7 Mar 2026', priceThen: 198.40 },
  { name: 'Warren Buffett', title: 'CEO', company: 'BRK.B', type: 'Alış', shares: '500,000', value: '$195M', date: '6 Mar 2026', priceThen: 390.00 },
  { name: 'Andy Jassy', title: 'CEO', company: 'AMZN', type: 'Satış', shares: '40,000', value: '$7.6M', date: '5 Mar 2026', priceThen: 189.50 },
  { name: 'Pat Gelsinger', title: 'CEO', company: 'INTC', type: 'Alış', shares: '100,000', value: '$3.15M', date: '5 Mar 2026', priceThen: 31.50 },
]

export default function InsiderPage() {
  const buys = INSIDER_DATA.filter(d => d.type === 'Alış')
  const sells = INSIDER_DATA.filter(d => d.type === 'Satış')

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-finma-primary" />
        <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
          Insider İşlemleri
        </span>
        <span className="text-[10px] text-finma-text-dim ml-2">Son 10 gün</span>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">Toplam İşlem</div>
            <div className="text-lg font-bold text-finma-text finma-number">{INSIDER_DATA.length}</div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">Alış / Satış</div>
            <div className="text-lg font-bold">
              <span className="text-finma-green finma-number">{buys.length}</span>
              <span className="text-finma-text-dim mx-1">/</span>
              <span className="text-finma-red finma-number">{sells.length}</span>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">En Büyük Alış</div>
            <div className="text-sm font-bold text-finma-green finma-number">BRK.B — $195M</div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <div className="text-[9px] text-finma-text-dim uppercase mb-1">En Büyük Satış</div>
            <div className="text-sm font-bold text-finma-red finma-number">NVDA — $109.5M</div>
          </div>
        </Card>
      </div>

      {/* Tablo */}
      <Card padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-finma-text-dim border-b border-finma-border/30">
                <th className="text-left py-2 px-2 font-medium">İsim</th>
                <th className="text-left py-2 px-2 font-medium">Unvan</th>
                <th className="text-left py-2 px-2 font-medium">Hisse</th>
                <th className="text-center py-2 px-2 font-medium">İşlem</th>
                <th className="text-right py-2 px-2 font-medium">Adet</th>
                <th className="text-right py-2 px-2 font-medium">Değer</th>
                <th className="text-right py-2 px-2 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {INSIDER_DATA.map((item, idx) => (
                <tr key={idx} className="border-b border-finma-border/10 hover:bg-finma-card-hover transition-colors">
                  <td className="py-2.5 px-2 text-finma-text font-medium">{item.name}</td>
                  <td className="py-2.5 px-2 text-finma-text-dim">{item.title}</td>
                  <td className="py-2.5 px-2 font-bold text-finma-primary finma-number">{item.company}</td>
                  <td className="py-2.5 px-2 text-center">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[9px] font-bold',
                      item.type === 'Alış' ? 'bg-finma-green/20 text-finma-green' : 'bg-finma-red/20 text-finma-red'
                    )}>
                      {item.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right finma-number text-finma-text">{item.shares}</td>
                  <td className="py-2.5 px-2 text-right finma-number font-medium text-finma-text">{item.value}</td>
                  <td className="py-2.5 px-2 text-right finma-number text-finma-text-dim">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
