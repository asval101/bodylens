# 上线部署手册

目标：让评委在北京打开一个 https 链接，看到今天的账本，并且 AI 解读能流式出现。
全程大约 40 分钟，其中一半时间在等域名解析。

---

## 一、你要买什么

| 项目 | 规格 | 参考价 | 为什么 |
|---|---|---|---|
| 轻量应用服务器 | 2 核 2G，**地域选中国香港**，镜像 Ubuntu 22.04 | 30–40 元/月 | 香港节点不需要 ICP 备案，当天可用 |
| 域名 | `.com`，在境内注册商买，本人身份证实名 | 30–90 元/首年 | 免费 HTTPS 证书只能签给域名，不能签给 IP |

**不要买 `.cn`**。这个作品的内容涉及健康与器官，`.cn` 一旦被举报可以停止解析，省几十块换来一个随时会消失的链接不划算。

**不要买大陆节点**。大陆服务器必须备案，个人备案禁止医疗健康类内容，且周期 15–25 天，赶不上。

买完两件事：

1. 域名解析加一条 **A 记录**，指向服务器公网 IP
2. 服务器防火墙放行 **80** 和 **443**

---

## 二、装环境

SSH 登录服务器（控制台提供一键登录），然后：

```bash
# Node 18 以上才有内置 fetch，Ubuntu 自带的 12.x 不能用
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

node -v    # 应该是 v20.x
```

本项目**没有任何 npm 依赖**，所以不需要 `npm install`。这不是省事，是为了让「10 分钟复现」这条硬指标站得住。

---

## 三、把代码放上去

在你自己的电脑上（项目目录里）执行：

```bash
# 用 git 推，或者用 scp 直接拷
scp -r ./* root@你的服务器IP:/opt/bodylens/
```

服务器上：

```bash
sudo mkdir -p /opt/bodylens
sudo chown -R www-data:www-data /opt/bodylens
```

`.git` 目录不要拷上去，它属于版本记录，不属于运行时。

---

## 四、配密钥

```bash
cd /opt/bodylens/server
sudo cp .env.example .env
sudo nano .env
```

填两行：

```
AI_API_KEY=你申请到的密钥
AI_MODEL=deepseek-chat
```

`AI_BASE_URL` 只要对方是 OpenAI 兼容接口就不用改。

**先不填密钥也能跑。** 留空时 `/api/interpret` 返回 503，前端自动退回本地解读，页面功能完全正常——这正是「断网可用」的现场演练，建议演示视频里专门演一次。

---

## 五、起服务

```bash
sudo cp /opt/bodylens/server/bodylens.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bodylens
sudo systemctl status bodylens        # 应该是 active (running)
curl http://127.0.0.1:8080/api/health  # {"ok":true,"ai":"on",...}
```

---

## 六、配 Nginx 和证书

```bash
sudo cp /opt/bodylens/server/nginx.conf.sample /etc/nginx/sites-available/bodylens
sudo nano /etc/nginx/sites-available/bodylens   # 改 server_name 为你的域名
sudo ln -sf /etc/nginx/sites-available/bodylens /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 证书
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

`certbot` 会问要不要把 HTTP 跳转到 HTTPS，选**要**。证书 90 天后过期，可以加一条定时续签：

```bash
sudo certbot renew --dry-run
```

---

## 七、验收清单

上线后逐条过一遍，任何一条不过都不要往下走：

- [ ] 手机 4G（不用 Wi-Fi）打开 `https://你的域名`，能看到账本首屏
- [ ] 记一笔，大数字会滚动，类比文字跟着变
- [ ] 解读区出现文字；有密钥时标签显示「AI 解读」，无密钥时显示「本地解读」
- [ ] 浏览器开发者工具里，**没有任何请求携带密钥**（密钥只在服务端）
- [ ] 断网后刷新，页面仍然打开（本地规则解读照常工作）
- [ ] 域名前面显示锁图标，没有「不安全」警告
- [ ] `/server/`、`/tests/`、`/.git/` 都返回 404

---

## 八、最容易踩的三个坑

**1. Nginx 开了代理缓冲，流式变成一次性吐完。**
症状是标签显示「正在读」，然后整段文字瞬间出现。解决：`location /api/` 里必须写 `proxy_buffering off;`，配置里已经写好了，别删。

**2. Node 版本太低，`fetch is not defined`。**
Ubuntu 22.04 的 `apt install nodejs` 装的是 12.x。必须按上面的 NodeSource 方式装 20.x。

**3. 文件名大小写不一致，本地 Windows 好好的，Linux 上 404。**
Windows 文件系统不区分大小写，Linux 区分。`Today.css` 和 `today.css` 是两个文件。上传后跑一遍：

```bash
cd /opt/bodylens && grep -o 'src="[^"]*"\|href="[^"]*"' index.html
```

逐个确认磁盘上真有这个文件。

---

## 九、出问题怎么查

```bash
sudo systemctl status bodylens -l      # 服务有没有起
sudo journalctl -u bodylens -n 80      # 服务日志，接口报错看这里
sudo tail -f /var/log/nginx/error.log  # Nginx 日志
curl -s http://127.0.0.1:8080/api/health
```

如果 `/api/health` 返回 `ai: off`，说明密钥没读到——检查 `.env` 有没有多余空格、`systemctl restart bodylens` 有没有执行。

---

## 十、以后更新代码

```bash
# 本机
git push

# 服务器
cd /opt/bodylens && sudo -u www-data git pull
sudo systemctl reload nginx     # 静态文件不用重启 Node
```

只有改了 `server/proxy.cjs` 才需要 `sudo systemctl restart bodylens`。
