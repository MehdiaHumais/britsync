import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function POST() {
    try {
        // Path to the python script
        const pythonScript = path.join(process.cwd(), "..", "news-automation", "app", "scheduler.py");
        const pythonExe = path.join(process.cwd(), "..", "news-automation", ".venv", "Scripts", "python.exe");

        // We'll create a small wrapper to run the automation function once without the loop
        const triggerScript = `
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.scheduler import run_automation
if __name__ == "__main__":
    run_automation()
`;
        const tempScriptPath = path.join(os.tmpdir(), "news_sync_trigger.py");
        fs.writeFileSync(tempScriptPath, triggerScript);

        console.log(`Triggering news sync with: ${pythonExe} ${tempScriptPath}`);

        try {
            const { stdout, stderr } = await execPromise(`"${pythonExe}" "${tempScriptPath}"`, {
                cwd: path.join(process.cwd(), "..", "news-automation")
            });

            if (stderr) console.warn("Sync warning:", stderr);
            console.log(`Sync stdout: ${stdout}`);

            return NextResponse.json({ success: true, message: "News sync completed successfully" });
        } catch (error: any) {
            console.error(`Sync error: ${error}`);
            return NextResponse.json({
                success: false,
                error: error.stderr || error.message
            }, { status: 500 });
        }

    } catch (err: any) {
        console.error("News sync API failed:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
