import TeleBot from 'telebot'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

dotenv.config()

const axios = require('axios').default
const prisma = new PrismaClient()
const bot = new TeleBot({
    token: process.env.TELEGRAM_TOKEN!,
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

    console.log(test)
    
    /**
     * Event Handlers
     */

    // Reageert op edits
    bot.on('edit', msg => msg.reply.text('Dat zag ik! Zo krijgen we nooit die VOC-mentaliteit terug :(', { asReply: true }))

    // Foto is gestuurd richting de bot
    bot.on('photo', msg => {
        console.log('Foto ontvangen van ' + msg.from.id)

        // Pak de benodige attributen
        const photo = msg.photo[msg.photo.length - 1]
        const { file_id, file_unique_id } = photo
        bot.getFile(file_id)
            // Download de foto
            .then(file => downloadPhoto(file.fileLink, file_unique_id + '.jpg'))
            .then(() => {
                msg.reply.text('Foto ontvangen! Stuur nu je huidige locatie om je inzending compleet te maken!')
                if (locationQueue.has(msg.from.id)) {

                }
                queuePhoto(msg.from.id, file_unique_id + '.jpg')
            })
            .catch((err: any) => {
                msg.reply.text('Slinkse onzin ontdekt: ' + err)
                    .then(() => msg.reply.text('Stuur s.v.p. even een screenshot naar @Niels'))
            })

    })

    bot.on('location', msg => {
        console.log('Location received: ' + msg.location.latitude + ' ' + msg.location.longitude)
        queueLocation(msg.from.id, msg.location.latitude, msg.location.longitude)
    })

    /**
     * Buttons
     */
    const keyboard = bot.keyboard([
        ['/nieuw', '/help'],
    ], { resize: true })

    /**
     * Commands
     */
    bot.on(['/start'], msg => {
        bot.sendMessage(msg.from.id, `
            Heyhoi, ik ben Jan Peter Balkenende en ik ben de O.D.D. Invictus bot!
        `, { replyMarkup: keyboard })
    })

    bot.on(['/nieuw'], msg => {
        msg.reply.text('Stuur mij een foto van de sticker en je huidige locatie!')
    })

    bot.on(['/help'], msg => {
        msg.reply.text('oofyeet TODO')
    })

    bot.on(['/online'], msg => msg.reply.text('Ik ben online!'))

    bot.start()

    return bot
}

const queueLocation = async (userId: string, latitude: number, longitude: number) => {
    const queue = locationQueue.get(userId)
    if (queue) {
        queue.push({
            latitude,
            longitude,
            created: new Date()
        })
    } else {
        locationQueue.set(userId, [{
            latitude,
            longitude,
            created: new Date()
        }])
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