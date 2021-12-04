# Invictus Telegram Bot

Leuke sticker bot voor de feuten

## Benodigdheden
* NodeJS 17
* Docker
* Docker-Compose

## Environment
De bot heeft een aantal environment variables nodig om te kunnen draaien, deze zijn:
| key | value |
|-----|-------|
| TELEGRAM_TOKEN | Een Telegram API bot token |
| DATABASE_URL | De postgresql connection string (in te stellen in docker-compose.yml) |

## Lokale ontwikkeling
Om de bot lokaal te draaien start je eerst de database op met
```bash
docker-compose up
```
Daarna kan je de bot opstarten met
```bash
npm run dev
```

## Production
Deze bot 24/7 draaien is een fluitje van een cent, aangezien alles al in docker draait.
Het enige waar je voor moet zorgen is een postgresql database, `entry.sh` zorgt ervoor dat de database in orde is. Als eerst bouw je de docker container:
```bash
docker build --tag invictus-bot -f Dockerfile-prod .
```
Daarna kan je deze draaien met
```bash
docker run -it invictus-bot -e TELEGRAM_TOKEN "telegram token" -e DATABASE_URL "database url" invictus-bot
```

## Docker bestanden
Bestanden gemaakt in docker containers worden opgeslagen op specifieke plekken, dit kan afgevangen worden in een volume als je dat wilt.
| Container | Path |
|-----------|------|
| Postgresql| /var/lib/postgresql/data |
| Bot | /app/photos |