import { NextResponse } from "next/server";
import https from "https";
import tls from "tls";
import dns from "dns";
import fs from "fs";
import path from "path";
import { URL } from "url";

export const dynamic = "force-dynamic";

interface LatencyBreakdown {
  timestamp: string;
  dnsTime: number;
  connectTime: number;
  sslTime: number;
  ttfbTime: number;
  downloadTime: number;
  totalTime: number;
  statusCode: number;
  pageSize: number;
  contentValid: boolean;
  sslDaysLeft?: number;
  sslExpiryDate?: string;
  sslIssuer?: string;
  error?: string;
}

// Check SSL Expiration
function getSSLCertificateExpiry(hostname: string): Promise<{ daysLeft: number; expiryDate: string; issuer: string } | null> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect({
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false
      }, () => {
        const cert = socket.getPeerCertificate();
        if (cert && cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          const msLeft = expiryDate.getTime() - now.getTime();
          const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
          
          const getIssuerString = (val: string | string[] | undefined): string => {
            if (!val) return '';
            return Array.isArray(val) ? val.join(', ') : val;
          };
          const issuer = cert.issuer ? getIssuerString(cert.issuer.O) || getIssuerString(cert.issuer.CN) || '' : '';
          
          socket.destroy();
          resolve({
            daysLeft,
            expiryDate: expiryDate.toISOString().split('T')[0],
            issuer
          });
        } else {
          socket.destroy();
          resolve(null);
        }
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(null);
      });

      socket.setTimeout(4000, () => {
        socket.destroy();
        resolve(null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

// Measure HTTPS timing breakdown using standard Node.js https module
function measureHttpsLatency(urlStr: string): Promise<LatencyBreakdown> {
  const url = new URL(urlStr);
  
  const timings = {
    start: Date.now(),
    dnsResolved: 0,
    connected: 0,
    sslHandshake: 0,
    firstByte: 0,
    end: 0
  };

  return new Promise((resolve) => {
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BOGAMonitor/1.0",
        "Accept": "text/html"
      },
      timeout: 6000
    }, (res) => {
      timings.firstByte = Date.now();
      
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on("end", () => {
        timings.end = Date.now();
        const body = Buffer.concat(chunks).toString("utf-8");
        const contentValid = body.includes("BOGA AI") || body.includes("Terminal") || body.includes("options") || body.includes("Giriş") || body.includes("login");

        // Timings math
        const dnsTime = timings.dnsResolved ? timings.dnsResolved - timings.start : 0;
        const connectTime = timings.connected && timings.dnsResolved ? timings.connected - timings.dnsResolved : 0;
        const sslTime = timings.sslHandshake && timings.connected ? timings.sslHandshake - timings.connected : 0;
        
        // Handle TTFB math correctly based on SSL or plain TCP
        const lastSecureTime = timings.sslHandshake || timings.connected || timings.dnsResolved || timings.start;
        const ttfbTime = timings.firstByte - lastSecureTime;
        const downloadTime = timings.end - timings.firstByte;
        const totalTime = timings.end - timings.start;

        resolve({
          timestamp: new Date().toISOString(),
          dnsTime: Math.max(0, dnsTime),
          connectTime: Math.max(0, connectTime),
          sslTime: Math.max(0, sslTime),
          ttfbTime: Math.max(0, ttfbTime),
          downloadTime: Math.max(0, downloadTime),
          totalTime: Math.max(0, totalTime),
          statusCode: res.statusCode || 0,
          pageSize: body.length,
          contentValid
        });
      });
    });

    req.on("socket", (socket) => {
      socket.on("lookup", () => {
        timings.dnsResolved = Date.now();
      });
      socket.on("connect", () => {
        timings.connected = Date.now();
      });
      socket.on("secureConnect", () => {
        timings.sslHandshake = Date.now();
      });
    });

    req.on("error", (e) => {
      resolve({
        timestamp: new Date().toISOString(),
        dnsTime: 0,
        connectTime: 0,
        sslTime: 0,
        ttfbTime: 0,
        downloadTime: 0,
        totalTime: Date.now() - timings.start,
        statusCode: 0,
        pageSize: 0,
        contentValid: false,
        error: e.message
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        timestamp: new Date().toISOString(),
        dnsTime: 0,
        connectTime: 0,
        sslTime: 0,
        ttfbTime: 0,
        downloadTime: 0,
        totalTime: Date.now() - timings.start,
        statusCode: 0,
        pageSize: 0,
        contentValid: false,
        error: "Connection timeout"
      });
    });

    req.end();
  });
}

export async function GET(request: Request) {
  try {
    const url = "https://bogastock.com/login";
    
    // 1. Measure latency
    const metrics = await measureHttpsLatency(url);
    
    // 2. Fetch SSL certificate details
    const sslInfo = await getSSLCertificateExpiry("bogastock.com");
    if (sslInfo) {
      metrics.sslDaysLeft = sslInfo.daysLeft;
      metrics.sslExpiryDate = sslInfo.expiryDate;
      metrics.sslIssuer = sslInfo.issuer;
    }

    const isVercel = !!process.env.VERCEL;
    let history: LatencyBreakdown[] = [];

    // Only attempt local filesystem logging in non-Vercel dev environment
    if (!isVercel) {
      try {
        // @ts-ignore
        const projectRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..");
        // @ts-ignore
        const logsDir = path.join(/* turbopackIgnore: true */ projectRoot, "logs");
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        // @ts-ignore
        const historyFile = path.join(/* turbopackIgnore: true */ logsDir, "web_performance_history.json");
        
        if (fs.existsSync(historyFile)) {
          try {
            const fileContent = fs.readFileSync(historyFile, "utf-8");
            history = JSON.parse(fileContent);
          } catch (e) {
            history = [];
          }
        }

        history.push(metrics);
        if (history.length > 100) {
          history = history.slice(history.length - 100);
        }
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), "utf-8");
      } catch (e) {
        console.error("Local history save error:", e);
      }
    }

    return NextResponse.json({
      success: true,
      current: metrics,
      history: history.length > 0 ? history.reverse() : [metrics]
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Allow clearing logs via DELETE request (only supported locally)
export async function DELETE() {
  if (process.env.VERCEL) {
    return NextResponse.json({ success: false, error: "Not supported in production" }, { status: 403 });
  }

  try {
    // @ts-ignore
    const projectRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..");
    // @ts-ignore
    const historyFile = path.join(/* turbopackIgnore: true */ projectRoot, "logs", "web_performance_history.json");
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
    }
    return NextResponse.json({ success: true, message: "Logs cleared" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
