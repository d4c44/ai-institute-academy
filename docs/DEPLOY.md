# Деплой на свой сервер

Схема: GitHub Actions собирает два Docker-образа (сайт и Go API), кладёт их в GitHub Container Registry и по SSH обновляет сервер. На сервере всё работает через Docker Compose: Caddy (HTTPS) → Next.js → Go API → PostgreSQL.

```
push в main ─▶ проверки ─▶ сборка образов ─▶ ghcr.io ─▶ SSH на сервер ─▶ docker compose up -d
```

Пока сервера нет, workflow собирает образы и останавливается; шаг «Deploy to server» пропускается, ничего настраивать не нужно.

Файлы: `.github/workflows/ci.yml` (проверки в pull request), `.github/workflows/deploy.yml`, `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/.env.example`, `deploy/backup.sh`.

## 1. Сервер

Подойдёт любой VPS с Ubuntu 24.04: 2 vCPU, 2–4 ГБ памяти, 20+ ГБ диска. Откройте порты 22, 80 и 443. Данные пользователей и сертификатов хранятся на этом сервере; если важно, чтобы они лежали в Казахстане, выбирайте провайдера с дата-центром там.

Под root подключитесь к серверу и выполните:

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Пользователь для деплоя, без пароля, вход только по ключу
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
install -d -o deploy -g deploy /opt/ai-academy

# Файрвол
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 2. SSH-ключ для GitHub Actions

На своём компьютере (не на сервере):

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions" -f deploy_key
```

Содержимое `deploy_key.pub` добавьте на сервере в `/home/deploy/.ssh/authorized_keys` (владелец `deploy`, права 600). Приватный `deploy_key` понадобится на следующем шаге; после этого удалите оба файла с компьютера.

## 3. Настройки репозитория

GitHub → репозиторий → Settings → Secrets and variables → Actions.

| Тип | Имя | Значение |
|---|---|---|
| Secret | `DEPLOY_SSH_KEY` | содержимое приватного ключа `deploy_key` |
| Secret | `DEPLOY_KNOWN_HOSTS` | вывод `ssh-keyscan -t ed25519 IP_СЕРВЕРА` (защита от подмены сервера) |
| Variable | `DEPLOY_HOST` | IP-адрес или домен сервера |
| Variable | `DEPLOY_USER` | `deploy` (можно не задавать) |

Через консоль то же самое: `gh secret set DEPLOY_SSH_KEY < deploy_key`, `gh variable set DEPLOY_HOST --body IP_СЕРВЕРА`. Пока переменная `DEPLOY_HOST` пустая, деплой на сервер не запускается.

## 4. Конфигурация на сервере

Один раз создайте `/opt/ai-academy/.env` (образец: `deploy/.env.example`):

```bash
ssh deploy@IP_СЕРВЕРА
cd /opt/ai-academy
cat > .env <<EOF
APP_URL=http://IP_СЕРВЕРА
SITE_ADDRESS=:80
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
EOF
chmod 600 .env
```

Пароль базы хранится только в этом файле. Сохраните копию в менеджере паролей: без него базу не открыть.

## 5. Первый деплой

Сделайте любой коммит в `main` или запустите workflow вручную: Actions → Deploy → Run workflow. Через несколько минут сайт откроется на `http://IP_СЕРВЕРА`.

Образы в GHCR приватные, потому что репозиторий приватный. Сервер входит в реестр временным токеном самого workflow, отдельный токен создавать не нужно.

Демо-курсы в базу сами не попадают. Загрузите их один раз (команда безопасна для повторного запуска и обновляет только тексты и переводы):

```bash
cd /opt/ai-academy
docker compose run --rm -e ALLOW_DEMO_SEED=1 --entrypoint /app/seed api
```

## 6. Домен и HTTPS

1. Купите домен и создайте A-запись на IP сервера.
2. В `/opt/ai-academy/.env` замените значения:
   ```
   APP_URL=https://academy.example.kz
   SITE_ADDRESS=academy.example.kz
   ```
3. `cd /opt/ai-academy && docker compose up -d`. Caddy сам получит сертификат Let's Encrypt (порты 80 и 443 должны быть открыты).

`APP_URL` попадает в QR-коды сертификатов, поэтому задайте окончательный адрес до выдачи реальных сертификатов. Если `APP_URL` начинается не с `https://`, API не ставит cookie флаг `Secure`, иначе вход по HTTP не работал бы; в логах API при этом есть предупреждение.

## 7. Резервные копии

```bash
cd /opt/ai-academy && ./backup.sh        # проверить вручную
crontab -e                               # от пользователя deploy, добавить строку:
0 3 * * * /opt/ai-academy/backup.sh >> /opt/ai-academy/backups/backup.log 2>&1
```

Хранятся последние 14 копий в `/opt/ai-academy/backups`. Копии лежат на том же сервере, поэтому периодически скачивайте их к себе: `scp deploy@IP_СЕРВЕРА:/opt/ai-academy/backups/*.sql.gz .`

Восстановление:

```bash
gunzip -c backups/ai-academy-XXXX.sql.gz | docker compose exec -T db psql -U ai_institute ai_institute
```

(для пустой базы; на работающей предварительно остановите `api` и пересоздайте базу).

## Повседневная работа

| Что | Команда на сервере (`cd /opt/ai-academy`) |
|---|---|
| Статус | `docker compose ps` |
| Логи | `docker compose logs -f api web` |
| Откат на прошлую версию | в `.env` задайте `TAG=<sha предыдущего коммита>`, затем `docker compose up -d` |
| Перезапуск | `docker compose restart web api` |

Миграции базы выполняются автоматически при каждом деплое (сервис `migrate`). Они применяются вперёд; перед сложной миграцией сделайте `./backup.sh`.

## Что проверено и что нет

Проверено локально: сборка сайта, тесты Go, миграции и сид на PostgreSQL 18. Docker на машине разработки не установлен, поэтому образы и compose-файл впервые собираются и запускаются в GitHub Actions и на сервере. Если первый запуск упадёт, смотрите лог шага в Actions.
