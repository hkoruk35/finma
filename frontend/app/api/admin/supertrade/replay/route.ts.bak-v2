import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || "2026-08-15";

    const rootDir = path.resolve(process.cwd(), "..");
    const venvPython = path.join(rootDir, "venv313", "Scripts", "python.exe");
    const pythonExe = fs.existsSync(venvPython) ? venvPython : "python";
    const scriptPath = path.join(rootDir, "spx_engine", "cli_runner.py");

    return new Promise((resolve) => {
      exec(`"${pythonExe}" "${scriptPath}" replay --date ${dateStr}`, { cwd: rootDir }, (error, stdout, stderr) => {
        if (error) {
          console.error("SuperTrade Replay API Error:", error, stderr);
          return resolve(NextResponse.json({ error: "Failed to execute SPX engine replay" }, { status: 500 }));
        }
        try {
          const result = JSON.parse(stdout);
          return resolve(NextResponse.json(result));
        } catch (parseError) {
          console.error("JSON parse error:", parseError, stdout);
          return resolve(NextResponse.json({ error: "Invalid JSON from engine replay" }, { status: 500 }));
        }
      });
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
