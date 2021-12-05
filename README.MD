# Invictus Telegram Bot

Leuke sticker bot voor de feuten

## Benodigdheden
* NodeJS >= 17
* Docker
* Docker-Compose

## Environment
De bot heeft een aantal environment variables nodig om te kunnen draaien, deze zijn:
| key | value |
|-----|-------|
| TELEGRAM_TOKEN | Een Telegram API bot token |
| DATABASE_URL | De postgresql connection string (in te stellen in docker-compose.yml) |
| ADMIN | Telegram ID voor de gebruiker met admin rechten (vind je id met de /tid command) |
| GEOCODER_KEY | API sleutel van LocationIQ, voor de geocoder |

## Lokale ontwikkeling
Om de bot lokaal te draaien start je eerst de database op met
```bash
docker-compose up
```
Daarna kan je de bot opstarten met
```bash
npm run dev
```

Om in de database te kijken kan je prisma studio gebruiken
```bash
npx prisma studio
```

## Production
Deze bot 24/7 draaien is een fluitje van een cent, aangezien alles al in docker draait.
Het enige waar je voor moet zorgen is een postgresql database, `entry.sh` zorgt ervoor dat de database in orde is. Als eerst bouw je de docker container:
```bash
docker build --tag invictus-bot -f Dockerfile-prod .
```
Daarna kan je deze draaien met
```bash
docker run -it invictus-bot -e TELEGRAM_TOKEN "telegram token" -e DATABASE_URL "database url" -e ADMIN "admin id" -e GEOCODER_KEY "geocoder api sleutel" invictus-bot
```

## Docker bestanden
Bestanden gemaakt in docker containers worden opgeslagen op specifieke plekken, dit kan afgevangen worden in een volume als je dat wilt.
| Container | Path |
|-----------|------|
| Postgresql| /var/lib/postgresql/data |
| Bot | /app/photos |