import { NextResponse } from "next/server";
import { headers } from "next/headers";
import dns from "dns";
import net from "net";
import tls from "tls";
import fs from "fs";
import path from "path";

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

// Measure Latency breakdown
function measureLatency(urlStr: string): Promise<LatencyBreakdown> {
  const url = new URL(urlStr);
  const hostname = url.hostname;
  const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
  const pathStr = url.pathname + url.search;

  const timings = {
    start: Date.now(),
    dnsResolved: 0,
    connected: 0,
    sslHandshake: 0,
    firstByte: 0,
    end: 0
  };

  return new Promise((resolve) => {
    dns.lookup(hostname, (err, ip) => {
      if (err) {
        return resolve({
          timestamp: new Date().toISOString(),
          dnsTime: 0, connectTime: 0, sslTime: 0, ttfbTime: 0, downloadTime: 0,
          totalTime: Date.now() - timings.start, statusCode: 0, pageSize: 0,
          contentValid: false, error: `DNS lookup failed: ${err.message}`
        });
      }
      timings.dnsResolved = Date.now();

      const socket = new net.Socket();
      socket.setTimeout(8000);

      socket.connect(port, ip, () => {
        timings.connected = Date.now();

        let client: any = socket;

        if (url.protocol === 'https:') {
          const secureSocket = tls.connect({
            socket: socket,
            servername: hostname,
            rejectUnauthorized: false
          }, () => {
            timings.sslHandshake = Date.now();
            sendRequest(secureSocket);
          });

          secureSocket.on('error', (e) => {
            socket.destroy();
            resolve(buildErrorResult(timings, `SSL Handshake failed: ${e.message}`));
          });

          client = secureSocket;
        } else {
          timings.sslHandshake = timings.connected;
          sendRequest(socket);
        }

        function sendRequest(stream: any) {
          const request = 
            `GET ${pathStr} HTTP/1.1\r\n` +
            `Host: ${hostname}\r\n` +
            `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) BOGAMonitor/1.0\r\n` +
            `Accept: text/html\r\n` +
            `Connection: close\r\n\r\n`;

          stream.write(request);

          let firstByteReceived = false;
          const chunks: Buffer[] = [];
          let statusCode = 0;

          stream.on('data', (chunk: Buffer) => {
            if (!firstByteReceived) {
              timings.firstByte = Date.now();
              firstByteReceived = true;
            }
            chunks.push(chunk);
          });

          stream.on('end', () => {
            timings.end = Date.now();
            const body = Buffer.concat(chunks).toString('utf-8');
            
            const statusLine = body.split('\r\n')[0];
            const statusMatch = statusLine.match(/HTTP\/1\.[01]\s+(\d+)/);
            if (statusMatch) {
              statusCode = parseInt(statusMatch[1]);
            }

            // Check page validity: bogastock.com/options redirects or serves terminal page
            const contentValid = body.includes("BOGA AI") || body.includes("Terminal") || body.includes("Giriş") || body.includes("options");

            const dnsTime = timings.dnsResolved - timings.start;
            const connectTime = timings.connected - timings.dnsResolved;
            const sslTime = timings.sslHandshake - timings.connected;
            const ttfbTime = timings.firstByte - timings.sslHandshake;
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
              statusCode,
              pageSize: body.length,
              contentValid
            });
          });
        }
      });

      socket.on('error', (e) => {
        socket.destroy();
        resolve(buildErrorResult(timings, `Connection failed: ${e.message}`));
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(buildErrorResult(timings, 'Connection timeout'));
      });
    });
  });
}

function buildErrorResult(timings: any, errorMsg: string): LatencyBreakdown {
  const now = Date.now();
  const dnsTime = timings.dnsResolved ? timings.dnsResolved - timings.start : 0;
  const connectTime = timings.connected && timings.dnsResolved ? timings.connected - timings.dnsResolved : 0;
  const sslTime = timings.sslHandshake && timings.connected ? timings.sslHandshake - timings.connected : 0;
  
  return {
    timestamp: new Date().toISOString(),
    dnsTime,
    connectTime,
    sslTime,
    ttfbTime: 0,
    downloadTime: 0,
    totalTime: now - timings.start,
    statusCode: 0,
    pageSize: 0,
    contentValid: false,
    error: errorMsg
  };
}

export async function GET(request: Request) {
  const headerList = await headers();
  const host = headerList.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");

  // Enforce local execution
  if (process.env.VERCEL || !isLocal) {
    return NextResponse.json({ 
      success: false, 
      error: "Manuel tarama işlemi yalnızca lokal terminal sunucusunda (localhost:3000) çalıştırılabilir. Vercel üzerinden erişilemez." 
    }, { status: 403 });
  }

  try {
    const url = "https://bogastock.com/options";
    
    // 1. Measure latency
    const metrics = await measureLatency(url);
    
    // 2. Fetch SSL certificate details
    const sslInfo = await getSSLCertificateExpiry("bogastock.com");
    if (sslInfo) {
      metrics.sslDaysLeft = sslInfo.daysLeft;
      metrics.sslExpiryDate = sslInfo.expiryDate;
      metrics.sslIssuer = sslInfo.issuer;
    }

    // 3. Log/Save to history file
    // @ts-ignore
    const projectRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..");
    // @ts-ignore
    const logsDir = path.join(/* turbopackIgnore: true */ projectRoot, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    // @ts-ignore
    const historyFile = path.join(/* turbopackIgnore: true */ logsDir, "web_performance_history.json");
    
    let history: LatencyBreakdown[] = [];
    if (fs.existsSync(historyFile)) {
      try {
        const fileContent = fs.readFileSync(historyFile, "utf-8");
        history = JSON.parse(fileContent);
      } catch (e) {
        history = [];
      }
    }

    // Add current metrics to history
    history.push(metrics);
    
    // Truncate to keep only last 100 entries to prevent huge logs
    if (history.length > 100) {
      history = history.slice(history.length - 100);
    }
    
    // Save history
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      current: metrics,
      history: history.reverse() // Return latest first
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Allow clearing logs via DELETE request
export async function DELETE() {
  const headerList = await headers();
  const host = headerList.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");

  if (process.env.VERCEL || !isLocal) {
    return NextResponse.json({ success: false, error: "Access Denied" }, { status: 403 });
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
