#!/usr/bin/env bash
# 身知 / BodyLedger —— 一键部署（在你自己电脑的 Git Bash 里运行）
#
#   用法： bash scripts/deploy.sh
#   或者： bash scripts/deploy.sh ubuntu@43.128.20.95
#
# 做的事：把当前目录打包 → 传到服务器 → 在服务器上跑初始化脚本
# 密码：执行过程中会问你 1~2 次服务器密码（输入时不显示，正常现象）

set -euo pipefail

TARGET="${1:-ubuntu@43.128.20.95}"
UPLOAD_DIR='~/bl-upload'
APP_DIR='/opt/bodyledger'

cyan() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
red()  { printf '\n\033[1;31m[失败] %s\033[0m\n' "$*" >&2; }

cyan "0/3 检查环境"
command -v ssh >/dev/null 2>&1 || { red "找不到 ssh 命令。请用 Git Bash 运行，不要用 cmd 或 PowerShell"; exit 1; }
command -v tar >/dev/null 2>&1 || { red "找不到 tar 命令。请用 Git Bash 运行"; exit 1; }
echo "目标服务器：$TARGET"

# 装了部署密钥就免密码，否则回落到密码登录
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
KEY="$HOME/.ssh/bodyledger_ed25519"
if [ -f "$KEY" ]; then
  SSH_OPTS+=(-i "$KEY" -o IdentitiesOnly=yes)
  echo "使用密钥：$KEY（不会问密码）"
else
  echo "未找到部署密钥，将使用密码登录"
fi

cyan "1/3 打包并上传（排除 .git 和历史截图，约 5MB）"
echo "接下来会问服务器密码，输入时屏幕不会显示任何字符，输完直接回车。"
tar czf - \
  --exclude='./.git' \
  --exclude='./.tmpshot' \
  --exclude='./.workbuddy' \
  --exclude='./node_modules' \
  --exclude='./docs/evidence' \
  . \
| ssh "${SSH_OPTS[@]}" "$TARGET" \
  'rm -rf ~/bl-upload && mkdir -p ~/bl-upload && tar xzf - -C ~/bl-upload && echo "上传完成：$(find ~/bl-upload -type f | wc -l) 个文件"'

cyan "2/3 安装到 /opt/bodyledger 并初始化"
echo "如果再次问密码，还是同一个服务器密码。"
ssh -t "${SSH_OPTS[@]}" "$TARGET" \
  "sudo mkdir -p $APP_DIR && sudo cp -a ~/bl-upload/. $APP_DIR/ && sudo bash $APP_DIR/scripts/server-setup.sh"

cyan "3/3 从本机验证"
IP="${TARGET#*@}"
echo "尝试访问 http://$IP/"
if curl -fsS --max-time 8 -o /dev/null -w 'HTTP %{http_code}\n' "http://$IP/" 2>/dev/null; then
  printf '\n\033[1;32m部署成功。浏览器打开 http://%s\033[0m\n' "$IP"
else
  cat <<EOF

网页暂时访问不通，最常见三个原因：
  1. 腾讯云防火墙没放行 TCP 80 —— 控制台 → 实例 → 防火墙 → 添加规则
  2. 服务还在启动 —— 等 10 秒再刷新
  3. 服务起不来 —— ssh $TARGET 后执行： sudo journalctl -u bodyledger -n 80

EOF
  exit 1
fi
