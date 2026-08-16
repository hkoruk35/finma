import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    const rootDir = path.resolve(process.cwd(), "..");
    const venvPython = path.join(rootDir, "venv313", "Scripts", "python.exe");
    const pythonExe = fs.existsSync(venvPython) ? venvPython : "python";
    const scriptPath = path.join(rootDir, "spx_engine", "cli_runner.py");

    return new Promise((resolve) => {
      exec(`"${pythonExe}" "${scriptPath}" snapshot`, { cwd: rootDir }, (error, stdout, stderr) => {
        if (error) {
          console.error("SuperTrade API Error:", error, stderr);
          return resolve(NextResponse.json({ error: "Failed to execute SPX engine snapshot" }, { status: 500 }));
        }
        try {
          const snapshot = JSON.parse(stdout);
          return resolve(NextResponse.json(snapshot));
        } catch (parseError) {
          console.error("JSON parse error:", parseError, stdout);
          return resolve(NextResponse.json({ error: "Invalid JSON from engine" }, { status: 500 }));
        }
      });
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
