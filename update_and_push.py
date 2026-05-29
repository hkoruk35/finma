"""
Hourly wrapper: update swing_performance.json then push to git.
Run by Windows Scheduled Task instead of update_swing_performance.py directly.
"""
import subprocess, sys, os
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.abspath(__file__))

def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line)
    with open(os.path.join(ROOT, 'logs', 'performance_hourly.log'), 'a', encoding='utf-8') as f:
        f.write(line + '\n')

def run(cmd, cwd=None):
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd or ROOT, encoding='utf-8')
    if result.stdout.strip():
        log(f"  stdout: {result.stdout.strip()[:300]}")
    if result.returncode != 0 and result.stderr.strip():
        log(f"  stderr: {result.stderr.strip()[:300]}")
    return result.returncode == 0

def main():
    log("=== Performance update + push cycle start ===")

    # Step 1: Run the performance updater
    python = sys.executable
    ok = run([python, os.path.join(ROOT, 'update_swing_performance.py')])
    if not ok:
        log("ERROR: update_swing_performance.py failed")
        return

    # Step 2: Git push the updated JSON
    perf_json = os.path.join('frontend', 'public', 'swing_performance.json')

    # Check if there are actual changes
    diff = subprocess.run(['git', 'diff', '--quiet', perf_json], cwd=ROOT)
    if diff.returncode == 0:
        log("No changes in swing_performance.json — skip push")
        return

    ts_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    run(['git', 'add', perf_json])
    run(['git', 'commit', '-m', f'Data: Hourly Performance Update {ts_str} [bot]'])

    pushed = run(['git', 'push', 'origin', 'main'])
    if pushed:
        log("Pushed to git — Vercel deployment triggered")
    else:
        log("WARNING: git push failed")

    log("=== Cycle complete ===")

if __name__ == '__main__':
    main()
