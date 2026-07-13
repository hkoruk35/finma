"""
Hourly wrapper: update swing_performance.json then push to git.
Run by Windows Scheduled Task instead of update_swing_performance.py directly.
"""
import subprocess, sys, os
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.abspath(__file__))
PUSH_FAIL_FLAG = os.path.join(ROOT, 'logs', 'PUSH_FAILING.flag')

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
    return result.returncode == 0, result.stderr.strip()[:500]

def alert_push_failure(stderr_tail):
    # Silent push failures went unnoticed for ~9 hours on 2026-07-13 (a blocked
    # commit sat unpushed while the hourly job kept "succeeding" locally).
    # Make failure loud: a Windows popup (best-effort, never fatal) + a flag
    # file that stays until a push actually succeeds again.
    try:
        with open(PUSH_FAIL_FLAG, 'a', encoding='utf-8') as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] push failed: {stderr_tail}\n")
    except Exception:
        pass
    try:
        subprocess.run(
            ['msg', os.environ.get('USERNAME', '*'),
             'BOGA AI: git push to origin/main is FAILING (see logs/performance_hourly.log). Site data is going stale.'],
            capture_output=True, timeout=10
        )
    except Exception:
        pass

def clear_push_failure_flag():
    try:
        if os.path.exists(PUSH_FAIL_FLAG):
            os.remove(PUSH_FAIL_FLAG)
    except Exception:
        pass

def main():
    log("=== Performance update + push cycle start ===")

    # Step 1: Run the performance updater
    python = sys.executable
    ok, _ = run([python, os.path.join(ROOT, 'update_swing_performance.py')])
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

    pushed, push_err = run(['git', 'push', 'origin', 'main'])
    if pushed:
        log("Pushed to git — Vercel deployment triggered")
        clear_push_failure_flag()
    else:
        log("WARNING: git push failed")
        alert_push_failure(push_err)

    log("=== Cycle complete ===")

if __name__ == '__main__':
    main()
