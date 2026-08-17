#!/usr/bin/env bash
# Sniff host + web-service health: reachability, CPU, memory, disk,
# network, service state. Prints a colored report and exits 0 (safe to
# tee into logs).
#
# Local (on the droplet):
#   bash ~/NoTomorrow/scripts/health-check.sh
#
# Remote (from your Mac), without copying anything first:
#   ssh deploy@<droplet> 'bash -s' < scripts/health-check.sh
#
# Overrides:
#   SERVICE=other.service \
#   HEALTH_URL=http://127.0.0.1:3000/ \
#   PUBLIC_URL=https://plusonesan.com/ \
#   ENV_FILE=~/NoTomorrow/apps/web/.env.local \
#     bash scripts/health-check.sh

set -u

SERVICE=${SERVICE:-notomorrow.service}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/}
PUBLIC_URL=${PUBLIC_URL:-https://plusonesan.com/}
ENV_FILE=${ENV_FILE:-$HOME/NoTomorrow/apps/web/.env.local}

if [ -t 1 ]; then
  H=$'\033[1;36m'; OK=$'\033[1;32m'; WARN=$'\033[1;33m'; BAD=$'\033[1;31m'; DIM=$'\033[2m'; OFF=$'\033[0m'
else
  H=; OK=; WARN=; BAD=; DIM=; OFF=
fi

section() { printf '\n%s══ %s ══%s\n' "$H" "$1" "$OFF"; }
have()    { command -v "$1" >/dev/null 2>&1; }
kv()      { printf '  %-18s %s\n' "$1" "$2"; }

# ─── host ──────────────────────────────────────────────────────────────
section "host"
kv "hostname" "$(hostname)"
kv "kernel"   "$(uname -sr)"
if [ -r /etc/os-release ]; then
  kv "os" "$(. /etc/os-release && echo "$PRETTY_NAME")"
fi
kv "date"     "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
kv "uptime"   "$(uptime -p 2>/dev/null || uptime)"

# ─── cpu ───────────────────────────────────────────────────────────────
section "cpu"
cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "?")
kv "cores" "$cores"
if read -r one five fifteen _ < /proc/loadavg 2>/dev/null; then
  # Flag if 1-min load > cores.
  color=$OK
  awk "BEGIN{exit !($one > $cores)}" 2>/dev/null && color=$BAD
  kv "load (1/5/15m)" "${color}${one} ${five} ${fifteen}${OFF}   (cores: $cores)"
fi
if have top; then
  echo "  ${DIM}top procs by CPU:${OFF}"
  # `top -bn1` is Linux-friendly; head grabs the process block.
  top -bn1 2>/dev/null | awk '/^ *PID/{p=1} p{print "    "$0}' | head -6
fi

# ─── memory ────────────────────────────────────────────────────────────
section "memory"
if have free; then
  free -h | sed 's/^/  /'
  # Warn when available < 15% of total or swap in active use.
  read -r total used _ < <(free -m | awk '/^Mem:/{print $2, $3, $4}')
  avail=$(free -m | awk '/^Mem:/{print $7}')
  swap_used=$(free -m | awk '/^Swap:/{print $3}')
  if [ "${avail:-0}" -gt 0 ] && [ "${total:-0}" -gt 0 ]; then
    pct=$(( 100 * avail / total ))
    if [ "$pct" -lt 15 ]; then
      printf '  %s⚠ available RAM only %s%% of total (%sM/%sM)%s\n' "$WARN" "$pct" "$avail" "$total" "$OFF"
    fi
  fi
  if [ "${swap_used:-0}" -gt 100 ]; then
    printf '  %s⚠ %sM of swap in use — process is likely thrashing%s\n' "$WARN" "$swap_used" "$OFF"
  fi
else
  # Fallback for macOS local runs.
  vm_stat 2>/dev/null | sed 's/^/  /' | head -8
fi
echo "  ${DIM}top procs by RSS:${OFF}"
ps -eo pid,user,pcpu,pmem,rss,cmd --sort=-rss 2>/dev/null | head -6 | sed 's/^/    /' \
  || ps -Ao pid,user,%cpu,%mem,rss,comm -r 2>/dev/null | head -6 | sed 's/^/    /'

# ─── disk ──────────────────────────────────────────────────────────────
section "disk"
df -h / 2>/dev/null | sed 's/^/  /'
use_pct=$(df / | awk 'NR==2{gsub("%","",$5); print $5}')
if [ "${use_pct:-0}" -ge 90 ]; then
  printf '  %s⚠ root filesystem %s%% full%s\n' "$BAD" "$use_pct" "$OFF"
fi
df -i / 2>/dev/null | sed 's/^/  /'
if [ -d "$HOME" ]; then
  echo "  ${DIM}biggest dirs under \$HOME (top 5, depth 2):${OFF}"
  du -h -d 2 "$HOME" 2>/dev/null | sort -hr | head -5 | sed 's/^/    /'
fi

# ─── network ───────────────────────────────────────────────────────────
section "network"
# Default route interface.
if have ip; then
  iface=$(ip route show default 2>/dev/null | awk '/default/{print $5; exit}')
  kv "default iface" "${iface:-unknown}"
  if [ -n "${iface:-}" ]; then
    kv "ipv4" "$(ip -4 addr show "$iface" 2>/dev/null | awk '/inet /{print $2; exit}')"
  fi
fi
# Public IP (best-effort, 2s max).
if have curl; then
  pub=$(curl -sS --max-time 2 https://api.ipify.org 2>/dev/null || true)
  [ -n "$pub" ] && kv "public ip" "$pub"
fi
# Listening TCP sockets.
if have ss; then
  echo "  ${DIM}listening TCP sockets:${OFF}"
  ss -tlnp 2>/dev/null | awk 'NR==1 || $4 ~ /:/ {print "    "$0}' | head -10
  est=$(ss -tan state established 2>/dev/null | tail -n +2 | wc -l)
  kv "established conns" "$est"
elif have netstat; then
  echo "  ${DIM}listening TCP sockets:${OFF}"
  netstat -tlnp 2>/dev/null | head -10 | sed 's/^/    /'
fi
# Cumulative bytes on the default interface — rough proxy for traffic.
if [ -n "${iface:-}" ] && [ -r "/sys/class/net/$iface/statistics/rx_bytes" ]; then
  rx=$(cat "/sys/class/net/$iface/statistics/rx_bytes")
  tx=$(cat "/sys/class/net/$iface/statistics/tx_bytes")
  human() { awk -v b="$1" 'BEGIN{split("B KB MB GB TB",u); for(i=1;b>1024 && i<5;i++) b/=1024; printf "%.1f %s", b, u[i]}'; }
  kv "rx since boot" "$(human "$rx")"
  kv "tx since boot" "$(human "$tx")"
fi

# ─── reachability ──────────────────────────────────────────────────────
section "reachability"
probe() {
  local url=$1
  if have curl; then
    curl -sS -o /dev/null --max-time 10 \
      -w "%{http_code}  dns=%{time_namelookup}s  connect=%{time_connect}s  ttfb=%{time_starttransfer}s  total=%{time_total}s" \
      "$url" 2>&1 || echo "FAILED"
  else
    echo "curl missing"
  fi
}
kv "local  $HEALTH_URL" "$(probe "$HEALTH_URL")"
kv "public $PUBLIC_URL" "$(probe "$PUBLIC_URL")"

# ─── service ───────────────────────────────────────────────────────────
if have systemctl; then
  section "service ($SERVICE)"
  state=$(systemctl is-active "$SERVICE" 2>/dev/null || echo unknown)
  color=$OK; [ "$state" != "active" ] && color=$BAD
  kv "state" "${color}${state}${OFF}"
  # One-line vitals from `systemctl status`.
  systemctl status "$SERVICE" --no-pager 2>/dev/null \
    | awk '/Active:|Main PID:|Tasks:|Memory:|CPU:/ {print "  "$0}'
  # Rogue-child detector: anything in this cgroup whose PPID is 1 that
  # ISN'T the service's own MainPID is orphaned (systemd reparents the
  # leader to init on start — that one is legit). Anything else that
  # ended up under init is a stuck child and should be flagged.
  main_pid=$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null)
  if [ -r "/sys/fs/cgroup/system.slice/$SERVICE/cgroup.procs" ]; then
    rogues=$(
      while read -r pid; do
        [ "$pid" = "$main_pid" ] && continue
        [ -e "/proc/$pid/stat" ] || continue
        ppid=$(awk '{print $4}' "/proc/$pid/stat" 2>/dev/null)
        [ "$ppid" = "1" ] && echo "$pid"
      done < "/sys/fs/cgroup/system.slice/$SERVICE/cgroup.procs"
    )
    if [ -n "$rogues" ]; then
      printf '  %s⚠ orphan PIDs in cgroup (PPID=1):%s %s\n' "$WARN" "$OFF" "$rogues"
      ps -o pid,etime,pcpu,pmem,rss,cmd -p $rogues 2>/dev/null | sed 's/^/    /'
    fi
  fi
fi

# ─── database ──────────────────────────────────────────────────────────
if [ -r "$ENV_FILE" ]; then
  db_path=$(grep -E '^SQLITE_DB_PATH=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
  if [ -n "$db_path" ] && [ -e "$db_path" ]; then
    section "database"
    kv "path" "$db_path"
    kv "size" "$(du -h "$db_path" 2>/dev/null | cut -f1)"
    for f in "$db_path-wal" "$db_path-shm"; do
      [ -e "$f" ] && kv "$(basename "$f")" "$(du -h "$f" | cut -f1)"
    done
  fi
fi

echo
