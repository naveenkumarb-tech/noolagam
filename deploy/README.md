# Running Noolagam on a server

This puts the website, API, database, worker and uploaded photos on one always-on server, so the Android app works anywhere, without your computer. [Caddy](https://caddyserver.com) receives all traffic and handles HTTPS by itself, and nothing else is reachable from outside.

The steps use a free [Oracle Cloud](https://www.oracle.com/cloud/free/) server and a free [DuckDNS](https://www.duckdns.org) address, but any Linux server with Docker and any domain will work.

| File | Purpose |
|---|---|
| `docker-compose.yml` | Every service, in production mode |
| `Caddyfile` | HTTPS, and which requests go to the API |
| `web.Dockerfile` | Builds the website |
| `.env.example` | The settings to fill in |
| `backup.sh`, `restore.sh` | Save and restore the database and photos |

## 1. Create the server

1. Sign up for Oracle Cloud and choose your **home region** carefully, as it can't be changed later and free servers can only be created there.
2. Go to **Compute → Instances → Create instance**.
3. Choose the **Ubuntu** image, and the **Ampere** shape `VM.Standard.A1.Flex` with **1 OCPU and 3 GB** of memory. The app uses about 450 MB. A smaller server is also less likely to count as idle, because Oracle may reclaim free servers that stay below 20% use.
4. Download the **SSH private key**. You can't get it again later.
5. If you see **Out of host capacity**, try another availability domain, or try again later.
6. Note the server's **public IP address**.

## 2. Open the web ports

Open the instance's **Subnet → Security → Default Security List → Add Ingress Rules**, and add two rules with source `0.0.0.0/0` and protocol TCP: destination port `80` and destination port `443`.

## 3. Get a web address

Sign in to DuckDNS, add a subdomain such as `mybooks`, and set its **current ip** to the server's IP address. Your address is then `mybooks.duckdns.org`.

## 4. Install the app on the server

Connect from your computer:

```bash
chmod 600 ~/Downloads/your-key.key
ssh -i ~/Downloads/your-key.key ubuntu@SERVER_IP
```

On the server, install Docker and download the project:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```

Connect again, so that the Docker permission applies, then:

```bash
git clone YOUR_REPOSITORY_URL noolagam
cd noolagam/deploy
cp .env.example .env
chmod 600 .env
openssl rand -hex 32   # use this for POSTGRES_PASSWORD
openssl rand -hex 48   # use this for JWT_SECRET
nano .env
```

Fill in every value. Use your address for `DOMAIN`, without `https://`. Keep these values private, and never commit them.

Start everything:

```bash
docker compose up -d --build
```

The first build takes several minutes. Then check that `https://YOUR_ADDRESS/health` opens in a browser and shows that it's healthy.

## 5. Move your existing data (optional)

Skip this to start with an empty library. On your computer, from the project's root folder, with the local app running:

```bash
docker compose exec -T db pg_dump -U noolagam --clean --if-exists noolagam | gzip > database.sql.gz
docker compose exec -T api tar -C /data/uploads -cf - . | gzip > photos.tar.gz
scp -i ~/Downloads/your-key.key database.sql.gz photos.tar.gz ubuntu@SERVER_IP:noolagam/deploy/
```

On the server, this **replaces everything already there**:

```bash
cd ~/noolagam/deploy
./restore.sh database.sql.gz photos.tar.gz
rm database.sql.gz photos.tar.gz
```

Delete both files from your computer too, as they contain your data. Accounts and passwords stay the same, but everyone has to log in again, because the server has its own `JWT_SECRET`.

## 6. Build the Android app for the server

On your computer, from the project's root folder:

```bash
frontend/build-apk.sh https://YOUR_ADDRESS
```

Install `apk/noolagam-debug.apk` on your phone, then try it on mobile data with your computer off.

## Backups

Oracle can reclaim a free server, so keep copies somewhere else. To back up every night at 3 AM, run `crontab -e` on the server and add:

```
0 3 * * * /home/ubuntu/noolagam/deploy/backup.sh > /dev/null 2>&1
```

This keeps the last 7 backups in `deploy/backups`, on the server. To copy them to your computer now and then, run this there:

```bash
scp -i ~/Downloads/your-key.key -r ubuntu@SERVER_IP:noolagam/deploy/backups .
```

To recover, set up a new server with these steps and use `./restore.sh` with the backup files. The same `.env` isn't needed, but without the same `JWT_SECRET` everyone has to log in again.

## Updating

After pushing changes to GitHub:

```bash
cd ~/noolagam
git pull
cd deploy
docker compose up -d --build
```

Database changes are applied automatically when the API starts. Rebuild the APK only if the frontend has changed.

## Useful commands

Run these from the `deploy` folder on the server:

```bash
docker compose ps               # Is everything running?
docker compose logs -f web      # HTTPS and traffic
docker compose logs -f api      # API errors
docker compose logs -f worker   # Emails and book details
```

## Troubleshooting

**The site doesn't open at all**
- Check that the address points to the server: `getent hosts YOUR_ADDRESS` should show its IP.
- Check the ingress rules from step 2, and `docker compose ps` on the server.

**A certificate or security warning**
- Caddy needs ports 80 and 443 open to get its certificate. See `docker compose logs web`. It retries by itself after the problem is fixed.

**Password reset emails don't arrive**
- Check `docker compose logs worker`, and the `SMTP_` settings. Gmail needs an App Password. After editing `.env`, run `docker compose up -d`.

**The app says it can't reach the server**
- Check that the APK was built with the server's `https://` address, and that `https://YOUR_ADDRESS/health` opens on the phone.
