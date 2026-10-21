#!/usr/bin/env bash
# 身知 / BodyLedger —— 给域名签 HTTPS 证书
# 用法（在服务器上）：sudo bash /opt/bodyledger/scripts/enable-https.sh body-ledger.com
#
# 前提：域名的 A 记录已经指向本机公网 IP，并且能解析出来。
# 本脚本会：改 Nginx 的 server_name → 用 certbot 申请证书 → 自动配置 443 与跳转

set -euo pipefail

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || { echo "用法：sudo bash $0 你的域名（例如 body-ledger.com）" >&2; exit 1; }

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m[失败] %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 sudo 运行"

say "1/5 检查域名解析"
IP=$(curl -fsS --max-time 10 https://api.ipify.org || true)
echo "本机公网 IP：${IP:-未知}"
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)
if [ -z "$RESOLVED" ]; then
  die "$DOMAIN 还解析不出来。先去 DNSPod 加 A 记录（@ 和 www 都指向 $IP），或用 dig 查一下是否已生效。"
fi
echo "$DOMAIN 解析到：$RESOLVED"
if [ -n "$IP" ] && [ "$RESOLVED" != "$IP" ]; then
  die "解析到的是 $RESOLVED，但本机是 $IP，两者不一致。检查 A 记录是否填错。"
fi

say "2/5 把 Nginx 的 server_name 换成真实域名"
NG=/etc/nginx/sites-available/bodyledger
# 保留 listen 80 default_server：这样直接访问 IP 也仍然能打开
sed -i "s/^[[:space:]]*server_name .*/    server_name ${DOMAIN} www.${DOMAIN};/" "$NG"
grep -n "server_name" "$NG"
nginx -t || die "Nginx 配置语法错误"
systemctl reload nginx

say "3/5 安装 certbot"
apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || {
  apt-get update -qq && apt-get install -y certbot python3-certbot-nginx
}

say "4/5 申请证书"
# 没有填邮箱：避免向用户索取个人信息；续期由系统定时任务负责
certbot --nginx \
  -d "$DOMAIN" -d "www.${DOMAIN}" \
  --non-interactive --agree-tos \
  --register-unsafely-without-email \
  --redirect \
  || die "certbot 失败。常见原因：80 端口没放行、域名还没生效、或该域名今天申请次数用尽（每周 5 次）"

say "5/5 自检"
systemctl reload nginx
echo "--- 证书信息"
certbot certificates | sed -n '/Certificate Name/,+3p'
echo "--- HTTPS 访问"
curl -fsS -o /dev/null -w "https://%{http_code} 首字节 %{time_starttransfer}s\n" -L "https://${DOMAIN}/" \
  || die "HTTPS 访问失败，看 /var/log/nginx/error.log"
echo "--- 自动续期演练"
certbot renew --dry-run | tail -3

printf '\n\033[1;32m完成。用 https://%s 访问你也会看到小锁。\033[0m\n' "$DOMAIN"
printf '证书 90 天有效，certbot 已自动注册 systemd 定时续期，不用手动管。\n'
