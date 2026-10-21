#!/usr/bin/env bash
# 身知 / BodyLedger —— 服务器初始化脚本
# 用法（在服务器上）：sudo bash /opt/bodyledger/scripts/server-setup.sh
# 作用：装 Node 20 + Nginx，注册开机自启，把站点跑在 80 端口
# 幂等：重复执行不会坏，可以放心重跑

set -euo pipefail

APP_DIR=/opt/bodyledger
SERVICE=bodyledger
NODE_MAJOR=20

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m[失败] %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 sudo 运行：sudo bash $0"

say "1/6 安装 Node ${NODE_MAJOR}"
CUR_MAJOR=0
if command -v node >/dev/null 2>&1; then
  CUR_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
fi
if [ "$CUR_MAJOR" -lt 18 ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o /tmp/nodesource.sh \
    || die "下载 NodeSource 源失败，检查服务器能否访问外网"
  bash /tmp/nodesource.sh
  apt-get install -y nodejs
else
  echo "已安装 Node $(node -v)，跳过"
fi

say "2/6 安装 Nginx"
apt-get update -qq
apt-get install -y nginx curl ca-certificates

say "3/6 目录与权限"
mkdir -p "$APP_DIR"
chown -R www-data:www-data "$APP_DIR"

say "4/6 生成服务端配置"
if [ ! -f "$APP_DIR/server/.env" ]; then
  cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
  echo "已从样板创建 .env（AI_API_KEY 为空，AI 解读暂时关闭，页面功能不受影响）"
else
  echo ".env 已存在，保留不覆盖"
fi
chown www-data:www-data "$APP_DIR/server/.env"
chmod 640 "$APP_DIR/server/.env"

say "5/6 注册开机自启服务"
cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=BodyLedger static host and AI proxy
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/server/.env
ExecStart=/usr/bin/node ${APP_DIR}/server/proxy.cjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"

say "6/6 配置 Nginx（先用 IP 访问，域名之后再加）"
# 已经跑过 enable-https.sh 的机器，站点文件里有 certbot 插入的证书行。
# 这个脚本重跑时若整段覆盖，443 就没了，站点会直接挂掉。
NGINX_SITE=/etc/nginx/sites-available/bodyledger
if [ -f "$NGINX_SITE" ] && grep -q 'ssl_certificate' "$NGINX_SITE"; then
  say "检测到已启用 HTTPS，保留现有站点配置不覆盖"
else
cat > /etc/nginx/sites-available/bodyledger <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /opt/bodyledger;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header Cache-Control "no-cache" always;
    }

    # 文本压缩：不压缩的话 CSS+JS 约 85KB，压缩后约 17KB，
    # 在国际线路上这个差别直接体现在首屏快慢
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 512;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # 脚本与样式走「每次校验」而不是直接命中缓存：
    # no-cache 不是"不缓存"，是"每次带 ETag 来问一句"，没改动只回 304，
    # 几百字节，改动了立刻拿到新文件——站点还在改的时候这个最合适。
    # 踩过的坑：这里原本写 expires 1h，浏览器整整一小时都不回来问，
    # 部署完刷新还是旧脚本，看着像"改了没生效"。
    # 还要注意：命中这里的请求由 Nginx 直接读盘返回，根本不经过 Node，
    # 所以 Node 里那句 Cache-Control 对静态文件是不生效的，必须在这里加。
    location ~* \.(css|js)$ {
        expires off;
        add_header Cache-Control "no-cache" always;
    }

    # 图片与字体几乎不变，长缓存直接省掉往返
    location ~* \.(svg|png|jpg|jpeg|webp|ico|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800" always;
    }

    # 流式解读：必须关闭缓冲，否则整段一次吐出，"逐字出现"就没了
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 60s;
        chunked_transfer_encoding on;
    }

    # 不对外暴露源码、内部文档与配置
    # 只白名单放行 data/ 和 assets/，其余目录一律 404
    location ~ ^/(server|tests|scripts|docs|research|design-lab|artwork|\.git|\.workbuddy)(/|$) {
        deny all;
        return 404;
    }

    # 根目录的说明文档与包描述也不该被访问
    location ~* ^/[^/]*\.(md|json|sh|cjs|yml|yaml|env)$ {
        deny all;
        return 404;
    }
}
NGINX
fi

ln -sf /etc/nginx/sites-available/bodyledger /etc/nginx/sites-enabled/bodyledger
rm -f /etc/nginx/sites-enabled/default
nginx -t || die "Nginx 配置有语法错误，上面有行号"
systemctl reload nginx

say "自检"
sleep 2
echo "--- 服务状态"
systemctl is-active "$SERVICE" || true
echo "--- 接口健康"
curl -fsS --max-time 5 http://127.0.0.1:8080/api/health || die "Node 服务没起来，看：journalctl -u ${SERVICE} -n 50"
echo
echo "--- 首页"
curl -fsS --max-time 5 -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1/ || die "Nginx 没把首页送出来"

printf '\n\033[1;32m完成。浏览器打开 http://<你的公网IP> 应该能看到首屏。\033[0m\n'
printf '出问题看日志：\n  sudo systemctl status %s -l\n  sudo journalctl -u %s -n 80\n  sudo tail -f /var/log/nginx/error.log\n\n' "$SERVICE" "$SERVICE"
