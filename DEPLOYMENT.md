# Déploiement de ZASS

Cible : un **VPS unique et persistant** sous **Debian 13 (Trixie)** avec accès
**root**. L'application est un processus Node de longue durée qui exécute aussi le
worker WhatsApp en interne et un Chromium « headless » — elle doit donc tourner
sur une seule instance toujours active, avec son propre disque (jamais en
serverless, jamais en plusieurs réplicas).

Topologie :

```
App Flutter ──HTTPS──▶ nginx (443) ──▶ App Node (127.0.0.1:8000)
                                          ├─ API Express (/api/*)
                                          ├─ worker de messages (en interne)
                                          └─ whatsapp-web.js + Chromium
                                                 │
Neon Postgres ◀── pooled (app) / direct (migrations)
```

Valeurs par défaut utilisées ci-dessous (à adapter) :

| Élément | Valeur |
|---|---|
| Dossier de l'app | `/srv/zass` |
| Utilisateur du service | `zass` |
| Port de l'app | `8000` (nginx fait le proxy) |
| Nom d'hôte de l'API | `api.kalande.net` |

---

## 0. DNS (à faire en premier)

Ajoutez un **enregistrement A** pour le sous-domaine de l'API, pointant vers
l'IP du VPS :

```
api.kalande.net  A  <ip-de-votre-serveur>
```

`kalande.net` peut continuer à servir votre site existant ; l'API vit sur son
propre sous-domaine.

---

## 1. Configuration initiale du serveur (en root)

Connectez-vous en SSH en tant que **root**, déposez le code sur la machine, puis
lancez le script d'installation.

### 1a. Installer les dépendances système

```bash
# depuis n'importe où, en root — installe Node 20, Chromium, nginx, certbot,
# git, et crée l'utilisateur `zass` + /srv/zass
bash deploy/setup-server.sh
```

(Si le code n'est pas encore sur le serveur, voyez d'abord l'étape 2, puis
relancez ceci.)

### 1b. Mettre le code dans /srv/zass

**Recommandé — git** (créez d'abord un dépôt privé GitHub/GitLab et poussez-y ce
projet) :

```bash
sudo -u zass git clone <url-de-votre-depot> /srv/zass
```

**Pas encore de git — envoi par SFTP/rsync** (les sources uniquement ; n'envoyez
jamais `node_modules`, `dist`, `.env` ni `.wwebjs_auth`). Depuis votre machine :

```bash
rsync -av --exclude node_modules --exclude dist --exclude .env \
  --exclude .wwebjs_auth ./ <user>@<ip-serveur>:/srv/zass/
# puis sur le serveur : sudo chown -R zass:zass /srv/zass
```

> Envisagez fortement de créer un dépôt git — chaque déploiement futur devient
> alors `git pull` + `deploy.sh` au lieu de re-téléverser des fichiers.

### 1c. Créer le fichier `.env`

```bash
sudo -u zass cp /srv/zass/.env.example /srv/zass/.env
sudo -u zass nano /srv/zass/.env
sudo chmod 600 /srv/zass/.env
```

À renseigner (voir le tableau en [§5](#5-variables-denvironnement)) :

- `NODE_ENV=production`, `PORT=8000`
- `DATABASE_URL` / `DIRECT_URL` (Neon : pooled + direct)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` (deux chaînes aléatoires longues et
  différentes : `openssl rand -base64 48`)
- `APP_RESET_URL` (le lien profond Flutter / la page web de réinitialisation)
- bloc SMTP (vrais e-mails) — ou laissez `SMTP_HOST` vide pour le mode journal
- `WHATSAPP_ENABLED=true` et (optionnel) `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

### 1d. Installer le service systemd

```bash
sudo cp /srv/zass/deploy/zass.service /etc/systemd/system/zass.service
sudo systemctl daemon-reload
sudo systemctl enable zass        # démarrage au boot (on le lance à l'étape 3)
```

### 1e. Installer le site nginx + HTTPS

```bash
sudo cp /srv/zass/deploy/nginx-api.conf /etc/nginx/sites-available/zass
sudo ln -s /etc/nginx/sites-available/zass /etc/nginx/sites-enabled/zass
sudo nginx -t && sudo systemctl reload nginx
# Provisionne le certificat TLS (renouvellement automatique) :
sudo certbot --nginx -d api.kalande.net
```

---

## 2. Premier déploiement

```bash
sudo bash /srv/zass/deploy/deploy.sh
```

Cela installe les dépendances, exécute `prisma migrate deploy`, compile, puis
démarre le service. Vérifiez :

```bash
sudo systemctl status zass
sudo journalctl -u zass -f
curl -s https://api.kalande.net/health      # {"status":"ok","env":"production"}
```

### Créer le compte admin (une seule fois)

```bash
# renseignez d'abord ADMIN_EMAIL / ADMIN_PASSWORD dans .env
sudo -u zass bash -lc 'cd /srv/zass && npm run db:seed'
```

---

## 3. Lier WhatsApp (une seule fois)

Avec `WHATSAPP_ENABLED=true`, l'application démarre en état « en attente du QR ».
En tant qu'admin, récupérez le QR et scannez-le depuis le téléphone qui enverra
les messages :

```bash
# obtenez un token d'accès admin via POST /api/auth/login, puis :
curl -s https://api.kalande.net/api/messages/whatsapp/status \
  -H "Authorization: Bearer <token-acces-admin>"
# -> { "state": "QR", "qr": "data:image/png;base64,..." }
```

Affichez ce data-URL `qr` dans un navigateur (ou l'écran admin) et scannez-le
dans WhatsApp ▸ Appareils connectés. L'état passe à `CONNECTED`, la session est
enregistrée dans `/srv/zass/.wwebjs_auth`, et le worker commence à livrer les
messages en file. Vous ne refaites cette étape que si la session est dissociée.

---

## 4. Au quotidien : livrer des mises à jour

```bash
# avec git (recommandé) :
sudo bash /srv/zass/deploy/deploy.sh

# sans git : re-téléversez les sources modifiées via rsync (étape 1b), puis :
sudo bash /srv/zass/deploy/deploy.sh
```

`deploy.sh` = pull → `npm ci` → `prisma migrate deploy` → build → restart.

> **Les migrations sont écrites en local** (`npm run db:migrate` en dev) puis
> commitées. Le serveur n'exécute jamais que `prisma migrate deploy`, qui les
> *applique* — il n'en génère jamais (conformément à CLAUDE.md).

---

## 5. Variables d'environnement

Voir `.env.example` pour la liste complète et annotée. Essentiels en production :

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8000` (doit correspondre au `proxy_pass` nginx) |
| `DATABASE_URL` | connexion Neon **pooled** (app) |
| `DIRECT_URL` | connexion Neon **directe** (migrations) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | deux chaînes aléatoires longues et distinctes |
| `APP_RESET_URL` | base du lien de réinitialisation du frontend |
| `SMTP_*` / `EMAIL_FROM` | vrais e-mails ; `SMTP_HOST` vide ⇒ mode journal |
| `WHATSAPP_ENABLED` | `true` pour envoyer de vrais WhatsApp |
| `WHATSAPP_SESSION_PATH` | défaut `.wwebjs_auth` (persistant sur disque) |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` pour utiliser le Chromium système |

Le `.env` se trouve dans `/srv/zass/.env`, en `chmod 600`, possédé par `zass`,
jamais commité.

---

## 6. Aide-mémoire d'exploitation

```bash
sudo systemctl status zass         # est-ce que ça tourne ?
sudo systemctl restart zass        # redémarrer
sudo journalctl -u zass -f         # logs en direct
sudo journalctl -u zass --since "1 hour ago"
```

- **Santé :** `GET /health` (app en marche) — pour les sondes de disponibilité.
  L'état de WhatsApp est séparé : `GET /api/messages/whatsapp/status`.
- **Arrêt propre** intégré : au restart/stop, l'app arrête le worker, ferme
  Chromium, vide le serveur et déconnecte Prisma.
- **Sauvegardes :** la base est sur Neon (utilisez les backups/branches de Neon).
  Sur le VPS, le seul élément avec état est `/srv/zass/.wwebjs_auth` (la session
  WhatsApp) — sauvegardez-le pour éviter de rescanner le QR après une
  reconstruction.

---

## 7. Dépannage

| Symptôme | Solution |
|---|---|
| `npm run build` ne trouve pas `prisma` | lancez `npm ci` (PAS `--omit=dev`) ; le build a besoin des deps de dev |
| WhatsApp n'atteint jamais `CONNECTED` | vérifiez le log du QR dans `journalctl -u zass` ; rescannez ; assurez-vous que `WHATSAPP_ENABLED=true` |
| Chromium ne démarre pas | définissez `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` ; vérifiez que `chromium` est installé ; `--no-sandbox` est déjà activé |
| `502 Bad Gateway` depuis nginx | app non démarrée ou mauvais `PORT` ; `systemctl status zass`, confirmez le port 8000 |
| Échec des migrations | vérifiez que `DIRECT_URL` (et non l'URL pooled) est bien défini pour les migrations |
| E-mails non envoyés | `SMTP_HOST` vide ⇒ mode journal par conception ; vérifiez la table `EmailLog` pour des lignes `FAILED` |

---

## 8. Monter en charge plus tard (pas nécessaire maintenant)

Si une instance ne suffit plus, séparez **le même code/image** en deux types de
processus : un étage **web** scalable horizontalement (API uniquement) et un
étage **worker** **unique** (worker de messages + WhatsApp). La couche
d'abstraction (« provider seam ») isole déjà WhatsApp, donc c'est un changement
de processus/config, pas une réécriture. D'ici là, gardez une seule instance —
`whatsapp-web.js` exige de toute façon une session unique.
