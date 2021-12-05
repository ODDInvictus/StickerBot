import TeleBot from 'telebot'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import NodeGeocoder from 'node-geocoder'

dotenv.config()


const axios = require('axios').default
const prisma = new PrismaClient()
const bot = new TeleBot({
    token: process.env.TELEGRAM_TOKEN!,
    usePlugins: ['askUser']
})
const geocoder = NodeGeocoder({
    provider: 'locationiq',
    apiKey: process.env.GEOCODER_KEY!,
    formatter: null
})

type PhotoQueue = Map<number, PhotoSubmission[]>

type PhotoSubmission = {
    fileName: string
    created: Date
}

type LocationQueue = Map<number, LocationSubmission[]>

type LocationSubmission = {
    latitude: number
    longitude: number
    streetName: string
    streetNumber: string
    city: string
    zipCode: string
    country: string
    created: Date
}

const MAX_STICKERS_PER_STREET = 2

/**
 * Queues,
 * Objecten die inzendingen tijdelijk opslaan terwijl er wordt gewacht op meer informatie
 */

// lijst met ingezonden fotos zonder locatie
const photoQueue: PhotoQueue = new Map<number, PhotoSubmission[]>()

// Lijst met ingezonder locaties zonder fotos
const locationQueue: LocationQueue = new Map<number, LocationSubmission[]>()


// TODO queue leeggooien na 15 minuten

const main = async () => {

    const COMMANDS = ['/start', '/help', '/online', '/nieuw',
     '/adduser', '/tid', '/feuten', '/submitters', '/aspiranten', '/deluser', '/admin',
    '/regels', '/geocode', '/willekeurig', '/stickers', '/stats', '/random']

    /**
     * Buttons
     */
     const keyboard = bot.keyboard([
        ['/nieuw', '/help', '/regels'],
        ['/random', '/stickers']
    ], { resize: true })

    const adminKeyboard = bot.keyboard([
        ['/adduser', '/deluser', '/feuten'],
        ['/tid', '/online', '/submitters'],
        ['/start', '/help', '/stats'],
        ['/willekeurig', '/stickers']
    ], { resize: true })

    
    /**
     * Event Handlers
     */

    bot.on('text', msg => {
        if (!COMMANDS.includes(msg.text))
            bot.sendMessage(msg.from.id, 'Wat probeer je te doen?', { replyMarkup: keyboard })
    })

    // Reageert op edits
    bot.on('edit', msg => msg.reply.text('Dat zag ik! Zo krijgen we nooit die VOC-mentaliteit terug :(', { asReply: true }))

    // Foto is gestuurd richting de bot
    bot.on('photo',async msg => {
        console.log('Foto ontvangen van ' + msg.from.id)

        if (!(await isSubmitter(msg.from.id))) 
            return bot.sendMessage(msg.from.id, 'Sorry, je bent nog niet geregistreerd. Doe ff /start', { replyMarkup: keyboard })

        // Pak de benodige attributen
        const photo = msg.photo[msg.photo.length - 1]
        const { file_id, file_unique_id } = photo
        bot.getFile(file_id)
            // Download de foto
            .then(file => downloadPhoto(file.fileLink, file_unique_id + '.jpg'))
            .then(async () => {
                msg.reply.text('Foto ontvangen')
                    .then(() => queuePhoto(msg.from.id, file_unique_id + '.jpg'))
                    .then(() => submit(msg.from.id))
            })
            .catch((err: any) => {
                msg.reply.text('Slinkse onzin ontdekt: ' + err)
                    .then(() => msg.reply.text('Stuur s.v.p. even een screenshot naar @Nierot of fix deze bug zelf'))
            })

    })

    // Locatie is gestuurd richting de bot
    bot.on('location', async msg => {
        console.log('Location received: ' + msg.location.latitude + ' ' + msg.location.longitude)
        msg.reply.text('Locatie ontvangen')
            .then(() => queueLocation(msg.from.id, msg.location.latitude, msg.location.longitude))
            .then(() => submit(msg.from.id))
    })

    /**
     * Commands
     */
    bot.on(['/start'], async msg => {
        if (await isSubmitter(msg.from.id)) {
            bot.sendMessage(msg.from.id, 'Je bent al geregistreerd!', { replyMarkup: keyboard })
            return
        }
        bot.sendMessage(msg.from.id, `
            Heyhoi, ik ben Jan Peter Balkenende en ik ben de O.D.D. Invictus bot! Wat is je feutencode? Als je deze nog niet hebt vraag het dan aan @Nierot
            `// @ts-expect-error
            , { ask: 'start' })
    })

    // Check de feuten code
    bot.on('ask.start', async msg => {
        const code = msg.text
        prisma.aspirantSubmitter.findFirst({
            where: {
                id: code
            }
        }).then(async feut => {
            if (feut) {
                await getAspirantSubmitter(code)
                    .then(aspirant => newSubmitter(msg.from.id, aspirant!.name))
                    .then(() => bot.sendMessage(msg.from.id, `Welkom ${feut.name}! Je kan nu meedoen aan de sticker competitie!`))
                    .then(() => bot.sendMessage(msg.from.id, 'Een sticker opsturen is heel eenvoudig'))
                    .then(() => bot.sendMessage(msg.from.id, 'Het enige wat je moet doen is /nieuw uitvoeren en dan de instucties volgen'))
                    .then(() => bot.sendMessage(msg.from.id, 'Als er iets stuk is met de bot, stuur dan s.v.p. een berichtje met screenshot naar @Nierot', {replyMarkup: keyboard}))
            } else {
                bot.sendMessage(msg.from.id, 'Deze code is niet gevonden, probeer het nog eens of stuur een screenshot naar @Nierot')
            } 
        }).catch(err => {
            bot.sendMessage(msg.from.id, 'Deze code is niet gevonden, probeer het nog eens of stuur een screenshot naar @Nierot')
            console.error(err)
        })
    })

    bot.on(['/nieuw'], msg => {
        bot.sendMessage(msg.from.id, `
            Stuur mij een foto van de sticker en je huidige locatie!
        `, { replyMarkup: keyboard })
    })

    bot.on(['/help', '/regels'], msg => {
        if (msg.from.id.toString() === process.env.ADMIN) {
            bot.sendMessage(msg.from.id, `Mogelijke commands:`, { replyMarkup: adminKeyboard })
        } else {
            bot.sendMessage(msg.from.id, `
De Stickerplak competitie is heel simpel.
  1. Plak een sticker ergens waar jij vind dat het nodig is (en waar voldoet aan de regels)
  2. Klik op de /nieuw knop
  3. Stuur een foto van de sticker
  4. Stuur je huidige locatie als bijlage
Regels:
  * Geen stickers op belangrijke gebouwen
  * Geen stickers op de grond
  * Geen stickers op andere stickers
  * Geen stickers op belangrijke borden
  * Maximaal 2 stickers per straat
            `, { replyMarkup: keyboard })
        }
    })

    bot.on(['/online'], msg => msg.reply.text('Ik ben online!'))

    bot.on(['/willekeurig', '/random'], async msg => {
        if (!(await isSubmitter(msg.from.id))) 
            return bot.sendMessage(msg.from.id, 'Sorry, je bent nog niet geregistreerd. Doe ff /start')

        const submitter = await getSubmitter(msg.from.id)

        const submissions = await prisma.submission.findMany({
            where: {
                submitterId: submitter!.id
            }
        })

        const random = submissions[Math.floor(Math.random() * submissions.length)]

        bot.sendMessage(msg.from.id, `Je hebt deze sticker op ${random.createdAt.toUTCString()} geplakt op locatie: ${random.streetName} ${random.streetNumber} in ${random.city}, ${random.country}!`)
        bot.sendPhoto(msg.from.id, process.env.PHOTO_PATH! + random.photoFileName)
    })

    bot.on(['/stickers'], async msg => {
        if (!(await isSubmitter(msg.from.id))) 
            return bot.sendMessage(msg.from.id, 'Sorry, je bent nog niet geregistreerd. Doe ff /start')

        const submitter = await getSubmitter(msg.from.id)

        const submissions = await prisma.submission.findMany({
            where: {
                submitterId: submitter!.id
            }
        })
        bot.sendMessage(msg.from.id, 'Je hebt ' + submissions.length + ' stickers geplakt!')
    })

    /**
     * Admin commands
     */
    // admin keyboard
    bot.on(['/admin'], msg => {
        if (checkAdmin(msg.from.id))
            return

        bot.sendMessage(msg.from.id, `Leuk keyboard`, { replyMarkup: adminKeyboard })
    })

    // Voeg een aspirant sticker plakker toe
    bot.on(['/adduser'], msg => {
        if (checkAdmin(msg.from.id))
            return

        // @ts-expect-error
        bot.sendMessage(msg.from.id, 'Welke feut wil je registreren?', {ask: 'addUser.name'})
    })

    bot.on('ask.addUser.name', msg => {
        const name = msg.text
        const code = generateFeutenCode()
        newAspirantSubmitter(name, code)
        bot.sendMessage(msg.from.id, 'Gelukt, hun feutencode is: ' + code, { replyMarkup: adminKeyboard })
    })

    // Verwijder een submitter
    bot.on(['/deluser'], msg => {
        if (checkAdmin(msg.from.id))
            return

        // @ts-expect-error
        bot.sendMessage(msg.from.id, 'Welke feut wil je verwijderen?', {ask: 'delUser.name'})
    })

    bot.on('ask.delUser.name', async msg => {
        await prisma.submitter.delete({
            where: {
                name: msg.text
            }
        })
        
        bot.sendMessage(msg.from.id, 'Vast wel gelukt!', { replyMarkup: adminKeyboard })
    })

    // Verkrijg de telegram ID
    bot.on(['/tid'], msg => {
        if (checkAdmin(msg.from.id))
            return

        bot.sendMessage(msg.from.id, msg.from.id, { replyMarkup: adminKeyboard })
    })

    // Verkrijg een lijstje met alle submitters
    bot.on(['/submitters'], async msg => {
        if (checkAdmin(msg.from.id))
            return

        const submitters = await prisma.submitter.findMany({})
        if (submitters.length === 0) {
            bot.sendMessage(msg.from.id, 'Er zijn nog geen submitters')
            return
        }
        const text = submitters.map(s => s.name).join('\n')
        bot.sendMessage(msg.from.id, text, { replyMarkup: adminKeyboard })
    })

    // Verkrijg een lijstje van alle feuten die nog geen submitter zijn
    bot.on(['/feuten', '/aspiranten'], async msg => {
        if (checkAdmin(msg.from.id))
            return

        const aspiranten = await prisma.aspirantSubmitter.findMany({})
        if (aspiranten.length === 0) {
            bot.sendMessage(msg.from.id, 'Er zijn nog geen feuten')
            return
        }
        const aspirantenString = aspiranten.map(aspirant => {
            return aspirant.name + ': ' + aspirant.id
        }).join('\n')
        bot.sendMessage(msg.from.id, aspirantenString, { replyMarkup: adminKeyboard })
    })

    bot.on(['/stats'], async msg => {
        const submitters = await prisma.submitter.findMany({})
        if (submitters.length === 0) {
            bot.sendMessage(msg.from.id, 'Er zijn nog geen submissions')
            return
        }
        let text = ''
        for (const submitter of submitters) {
            const submissions = await prisma.submission.findMany({
                where: {
                    submitterId: submitter.id
                }
            })
            text += submitter.name + ': ' + submissions.length + '\n'
        }

        bot.sendMessage(msg.from.id, text, { replyMarkup: adminKeyboard })
    })

    bot.start()

    return bot
}

// Submit de sticker
const submit = async (telegramId: number) => {
    if (!(await isSubmitter(telegramId))) 
        return bot.sendMessage(telegramId, 'Sorry, je bent nog niet geregistreerd. Doe ff /start')

    const locqueue = locationQueue.get(telegramId)!
    const phqueue = photoQueue.get(telegramId)!

    if (!locqueue || locqueue.length === 0) {
        bot.sendMessage(telegramId, 'Stuur nu je locatie om deze submissie af te maken!')
        return
    } else if (!phqueue || phqueue.length === 0) {
        bot.sendMessage(telegramId, 'Stuur nu je foto om deze submissie af te maken!')
    } else {
        // Pak de locatie
        const { latitude, longitude, streetName, streetNumber, city, zipCode, country } = locqueue.pop()!
        // Pak de foto
        const { fileName } = phqueue.pop()!

        if (!(await checkRules(telegramId, zipCode, country))) {
            return
        }

        // Pak de submitter uit de db
        const submitter = await getSubmitter(telegramId)

        await prisma.submission.create({
            data: {
                latitude, 
                longitude,
                streetName,
                streetNumber,
                submitterId: submitter!.id,
                city,
                zipCode,
                country,
                photoFileName: fileName
            }
        }).then(() => {
            bot.sendMessage(telegramId, 'Submissie succesvol ontvangen!')
        })
    }
}

const checkRules = async (telegramId: number, zipCode: string, country: string) => {
    const other = await prisma.submission.findMany({
        where: {
            zipCode,
            country
        }
    })

    // Als er niks is gevonden, of als er minder dan MAX_STICKERS_PER_STREET stickers zijn geplakt in die straat, dan is priem
    if (!other || other.length < MAX_STICKERS_PER_STREET) {
        return true
    } else {
        console.log(other)
        const submitter1 = await getSubmitterById(other[0].submitterId)
        const submitter2 = await getSubmitterById(other[1].submitterId)

        const name1 = submitter1!.name
        const name2 = submitter2!.name

        if (name1 === name2) {
            bot.sendMessage(telegramId, `Helaas! ${name1} was eerder en heeft hier al ${MAX_STICKERS_PER_STREET} stickers geplakt.`)
        } else {
            bot.sendMessage(telegramId, `Helaas! ${name1} en ${name2} waren eerder en zij hebben hier al ${MAX_STICKERS_PER_STREET} stickers geplakt.`)
        }
        return false
    }
}

// Checkt of de gebruiker admin is, false in het geval van admin, true in het geval van een feut
const checkAdmin = (id: number): boolean => {
    if (id.toString() !== process.env.ADMIN) {
        bot.sendMessage(id, 'Sorry, jij bent een feut!')
        bot.sendMessage(id, 'https://www.youtube.com/watch?v=mBN8xJby2b8')
        return true
    }
    return false
}

const generateFeutenCode = (): string => {
    const possible = 'ABCDEFGH'
    let text = ''
    for (let i = 0; i < 4; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    return text
}

const getAspirantSubmitter = async (id: string) => {
    const submitter = await prisma.aspirantSubmitter.findFirst({
        where: {
            id
        }
    })
    return submitter
}

const newAspirantSubmitter = async (name: string, code: string) => {
    const aspirantSubmitter = await prisma.aspirantSubmitter.create({
        data: {
            name,
            id: code
        }
    })
}

// Check if the given user is a submitter
const isSubmitter = async (telegramId: number): Promise<boolean> => {
    // javascript moment
    return !! await prisma.submitter.findFirst({
        where: {
            telegramId
        }
    })!
}

const getSubmitter = async (telegramId: number) => {
    return await prisma.submitter.findFirst({
        where: {
            telegramId
        }
    })
}

const getSubmitterById = async (id: number) => {
    return await prisma.submitter.findFirst({
        where: {
            id
        }
    })
}

const newSubmitter = async (telegramId: number, name: string) => {
    const submitter = await prisma.submitter.create({
        data: {
            telegramId,
            name
        }
    })
    await prisma.aspirantSubmitter.delete({
        where: {
            name
        }
    })
}

const queueLocation = async (userId: number, latitude: number, longitude: number) => {
    const geocoded = await geocode(latitude, longitude)

    const obj = {
        latitude,
        longitude,
        streetName: geocoded.streetName!,
        streetNumber: geocoded.streetNumber!,
        city: geocoded.city!,
        country: geocoded.country!,
        zipCode: geocoded.zipcode!,
        created: new Date()
    }

    const queue = locationQueue.get(userId)
    if (queue) {
        locationQueue.get(userId)!.push(obj)
    } else {
        locationQueue.set(userId, [obj])
    }
}

const queuePhoto = async (userId: number, fileName: string) => {
    const queue = photoQueue.get(userId)
    if (queue) {
        queue.push({
            fileName,
            created: new Date()
        })
    } else {
        photoQueue.set(userId, [{
            fileName,
            created: new Date()
        }])
    }
}

const downloadPhoto = async (link: string, fileName: string) => {
    return new Promise<void>((resolve, reject) => axios({
        method: 'get',
        url: link,
        responseType: 'stream'
    }).then((response: any) => {
        response.data.pipe(fs.createWriteStream(process.env.PHOTO_PATH! + fileName))
        resolve()
    }).catch((err: any) => {
        console.error(err)
        reject(err)
    }))
        
}

const geocode = async (latitude: number, longitude: number) => {
    const res = await geocoder.reverse({ lat: latitude, lon: longitude })
    return res[0]
}

process.on('SIGTERM', async () => {
    prisma.$disconnect()
    bot.stop('Ga ff slapen, brb')
})

main()
    .catch(e => {
        throw e
    }).finally(async () => {
        await prisma.$disconnect()
    })