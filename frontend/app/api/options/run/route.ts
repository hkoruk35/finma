import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function POST() {
  return new Promise<NextResponse>((resolve) => {
    // Prevent execution on Vercel cloud environment
    if (process.env.VERCEL) {
      return resolve(NextResponse.json({ 
        success: false, 
        error: "Manuel tarama işlemi yalnızca lokal terminal sunucusunda (localhost:3000) çalıştırılabilir. Vercel üzerinden tetiklenemez." 
      }, { status: 400 }));
    }

    const projectRoot = path.resolve(process.cwd(), "..");
    const scriptPath = path.join(projectRoot, "opsiyon220.py");
    const pythonPath = path.join(projectRoot, "venv313", "Scripts", "python.exe");

    console.log("Running options scanner:", scriptPath);

    exec(`"${pythonPath}" "${scriptPath}" --oneshot`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        resolve(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
        return;
      }

      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);

      // After successful run, we need to find the latest file in the data/ directory
      // and copy it to public/data/latest/options_picks.json
      try {
        const dataDir = path.join(projectRoot, "data");
        const files = fs.readdirSync(dataDir)
          .filter(f => f.startsWith("v220_") && f.endsWith(".json"))
          .sort()
          .reverse();

        if (files.length > 0) {
          // @ts-ignore
          const latestFile = path.join(/* turbopackIgnore: true */ dataDir, files[0]);
          
          // Copy to public for static serving
          const publicDataDir = path.join(process.cwd(), "public", "data", "latest");
          if (!fs.existsSync(publicDataDir)) fs.mkdirSync(publicDataDir, { recursive: true });
          const targetPathPublic = path.join(publicDataDir, "options_picks.json");
          fs.copyFileSync(latestFile, targetPathPublic);

          // Copy to transfer/latest for API serving (local dev)
          const transferRoot = path.join(projectRoot, "transfer");
          const transferLatestDir = path.join(transferRoot, "latest");
          if (fs.existsSync(transferLatestDir)) {
            fs.copyFileSync(latestFile, path.join(transferLatestDir, "options_picks.json"));
            console.log("Copied latest scan to transfer/latest");
          }

          // Archive by date for history
          const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
          const archiveDir = path.join(transferRoot, today);
          if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
          fs.copyFileSync(latestFile, path.join(archiveDir, "options_picks.json"));
          console.log("Archived scan to:", archiveDir);
          
          resolve(NextResponse.json({ success: true, file: files[0] }));
        } else {
          resolve(NextResponse.json({ success: false, error: "No output file found" }, { status: 500 }));
        }
      } catch (e: any) {
        resolve(NextResponse.json({ success: false, error: e.message }, { status: 500 }));
      }
    });
  });
}
