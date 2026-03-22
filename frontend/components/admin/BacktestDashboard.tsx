'use client'

import React from 'react';
import { Card } from '@/components/shared/Card';
import { Badge } from '@/components/shared/Badge';
import { TrendingUp, Award, BarChart3, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export const BacktestDashboard: React.FC = () => {
  const mockBacktests = [
    { id: 1, strategy: 'RSI Breakout', timeframe: '1h', winRate: '68%', profit: '+12.4%', status: 'Complete' },
    { id: 2, strategy: 'EMA Cross v2', timeframe: '15m', winRate: '54%', profit: '+8.2%', status: 'Complete' },
    { id: 3, strategy: 'Dip Return Alpha', timeframe: '4h', winRate: '72%', profit: '+18.9%', status: 'Running' },
  ];

  return (
    <Card padding="sm" className="border-finma-yellow/30 bg-finma-yellow/5">
      <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-yellow/20">
        <Award className="w-5 h-5 text-finma-yellow" />
        <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
          Kurumsal Backtest Merkezi (Admin)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
         <div className="p-3 rounded bg-black/40 border border-finma-border/50">
            <div className="text-[10px] text-finma-text-dim uppercase font-bold mb-1">Ort. Başarı Oranı</div>
            <div className="text-xl font-bold text-finma-green finma-number">64.2%</div>
         </div>
         <div className="p-3 rounded bg-black/40 border border-finma-border/50">
            <div className="text-[10px] text-finma-text-dim uppercase font-bold mb-1">Toplam Simülasyon</div>
            <div className="text-xl font-bold text-white finma-number">1,248</div>
         </div>
         <div className="p-3 rounded bg-black/40 border border-finma-border/50">
            <div className="text-[10px] text-finma-text-dim uppercase font-bold mb-1">Alfa Skoru</div>
            <div className="text-xl font-bold text-finma-primary finma-number">4.2</div>
         </div>
      </div>

      <div className="mt-4 space-y-2">
        {mockBacktests.map(bt => (
          <div key={bt.id} className="flex items-center justify-between p-2.5 rounded-md bg-finma-bg/60 border border-finma-border/40 hover:border-finma-yellow/40 transition-colors">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">{bt.strategy}</span>
              <span className="text-[10px] text-finma-text-dim uppercase font-bold">{bt.timeframe} Periyot</span>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <div className="text-[10px] text-finma-text-dim leading-none mb-1">Win Rate</div>
                  <div className="text-xs font-bold text-finma-green finma-number">{bt.winRate}</div>
               </div>
               <div className="text-right">
                  <div className="text-[10px] text-finma-text-dim leading-none mb-1">Profit</div>
                  <div className="text-xs font-bold text-finma-primary finma-number">{bt.profit}</div>
               </div>
               <Badge variant={bt.status === 'Complete' ? 'bull' : 'hold'} className="text-[9px] uppercase">
                  {bt.status}
               </Badge>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 bg-finma-yellow/10 text-finma-yellow border border-finma-yellow/30 rounded text-xs font-bold hover:bg-finma-yellow/20 transition-all uppercase tracking-widest">
         Yeni Backtest Raporu Oluştur
      </button>
    </Card>
  );
};
