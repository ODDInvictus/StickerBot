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

type PhotoQueue = Map<string, PhotoSubmission[]>

type PhotoSubmission = {
    fileName: string
    created: Date
}

type LocationQueue = Map<string, LocationSubmission[]>

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

/**
 * Queues,
 * Objecten die inzendingen tijdelijk opslaan terwijl er wordt gewacht op meer informatie
 */

// lijst met ingezonden fotos zonder locatie
const photoQueue: PhotoQueue = new Map<string, PhotoSubmission[]>()

// Lijst met ingezonder locaties zonder fotos
const locationQueue: LocationQueue = new Map<string, LocationSubmission[]>()



const main = async () => {

    const test = await prisma.submission.findMany({})

    const COMMANDS = ['/start', '/help', '/online', '/nieuw',
     '/adduser', '/tid', '/feuten', '/submitters', '/aspiranten', '/deluser', '/admin',
    '/regels', '/geocode']

    console.log(test)

    /**
     * Buttons
     */
     const keyboard = bot.keyboard([
        ['/nieuw', '/help', '/regels'],
    ], { resize: true })

    const adminKeyboard = bot.keyboard([
        ['/adduser', '/deluser', '/feuten'],
        ['/tid', '/online', '/submitters'],
        ['/start', '/help',]
    ], { resize: true })

    
    /**
     * Event Handlers
     */

    bot.on('text', msg => {
        if (!COMMANDS.includes(msg.text))
            bot.sendMessage(msg.from.id, 'Wat probeer je te doen?', { replyMarkup: keyboard })
    })

    bot.on(/\?(.*)/, msg => {
        msg.reply.text(`Oof`)
        console.log(msg)
    })

    // Reageert op edits
    bot.on('edit', msg => msg.reply.text('Dat zag ik! Zo krijgen we nooit die VOC-mentaliteit terug :(', { asReply: true }))

    // Foto is gestuurd richting de bot
    bot.on('photo',async msg => {
        console.log('Foto ontvangen van ' + msg.from.id)

        if (await !isSubmitter(msg.from.id)) 
            return bot.sendMessage(msg.from.id, 'Sorry, je bent nog niet geregistreerd. Doe ff /start', { replyMarkup: keyboard })

        // Pak de benodige attributen
        const photo = msg.photo[msg.photo.length - 1]
        const { file_id, file_unique_id } = photo
        bot.getFile(file_id)
            // Download de foto
            .then(file => downloadPhoto(file.fileLink, file_unique_id + '.jpg'))
            .then(async () => {
                msg.reply.text('Foto ontvangen! Stuur nu je huidige locatie om je inzending compleet te maken!')

                // Nu checken we of er al een locatie in de queue staat
                if (locationQueue.has(msg.from.id)) {
                    const queue = locationQueue.get(msg.from.id)!
                    if (queue.length > 0) {
                        // Pak de locatie
                        const { latitude, longitude, streetName, streetNumber, city, zipCode, country } = queue.pop()!
                        // Pak de submitter uit de db
                        const submitter = await getSubmitter(msg.from.id)

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
                                photoFileName: file_unique_id + '.jpg',
                            }
                        })
                        // TODO
                        // locatie en foto in database pleuren en afhandelen
                    }
                }
                queuePhoto(msg.from.id, file_unique_id + '.jpg')
            })
            .catch((err: any) => {
                msg.reply.text('Slinkse onzin ontdekt: ' + err)
                    .then(() => msg.reply.text('Stuur s.v.p. even een screenshot naar @Nierot of fix deze bug zelf'))
            })

    })

    // Locatie is gestuurd richting de bot
    bot.on('location', async msg => {
        console.log('Location received: ' + msg.location.latitude + ' ' + msg.location.longitude)
        queueLocation(msg.from.id, msg.location.latitude, msg.location.longitude)

        msg.reply.text("TODO: Geocoden")
    })

    /**
     * Commands
     */
    bot.on(['/start'], msg => {
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
                    .then(() => bot.sendMessage(msg.from.id, 'Het enige wat je moet doen is /nieuw doen (of de knoppen onderaan gebruiken) en dan de instucties volgen'))
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
                    2. Klik op de /nieuw knop of typ het commando /nieuw
                    3. Stuur een foto van de sticker
                    4. Stuur je huidige locatie als bijlage
            `, { replyMarkup: keyboard })
        }
    })

    bot.on(['/online'], msg => msg.reply.text('Ik ben online!'))

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

    bot.start()

    return bot
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
    console.log(aspirantSubmitter)
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
    console.log(submitter)
}

const storeSubmission = async (submitterId: number, photoFileName: string, latitude: number, longitude: number, 
    streetName: string, streetNumber: string, zipCode: string, country: string, city: string) => {
    const submission = await prisma.submission.create({
        data: {
            photoFileName,
            streetName,
            streetNumber,
            zipCode,
            country,
            city,
            latitude,
            longitude,
            submitterId
        }
    })
    console.log(submission)
}

const queueLocation = async (userId: string, latitude: number, longitude: number) => {
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
        queue.push(obj)
    } else {
        locationQueue.set(userId, [obj])
    }
}

const queuePhoto = async (userId: string, fileName: string) => {
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
        response.data.pipe(fs.createWriteStream('photos/' + fileName))
        resolve()
    }).catch((err: any) => {
        console.error(err)
        reject(err)
    }))
        
}

const geocode = async (latitude: number, longitude: number) => {
    const res = await geocoder.reverse({ lat: latitude, lon: longitude })
    console.log(res)
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