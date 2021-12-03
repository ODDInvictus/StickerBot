import TeleBot from 'telebot'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import { sign } from 'crypto'

const axios = require('axios').default
const prisma = new PrismaClient()
const bot = new TeleBot({
    token: process.env.TELEGRAM_TOKEN!,
})

const main = async () => {

    dotenv.config()

    const test = await prisma.test.findMany()

    console.log(test)
    
    /**
     * Event Handlers
     */
    // Echo (TODO weghalen)
    bot.on('text', msg => msg.reply.text(msg.text))

    // Reageert op edits
    bot.on('edit', msg => msg.reply.text('Dat zag ik! Zo krijgen we nooit die VOC-mentaliteit terug :(', { asReply: true }))

    // Foto is gestuurd richting de bot
    bot.on('photo', msg => {
        console.log(msg)
        const id = msg.photo[3].file_id
        bot.getFile(id)
            .then(file => downloadPhoto(file.fileLink))
            .then(() => {
                // TODO handle de photos
                msg.reply.text('Foto ontvangen! Stuur nu je huidige locatie om je inzending compleet te maken!')
                    .then(() => msg.reply.text('TODO: in de backend gebeurt er op dit moment nog niks met de fotos'))
            })
            .catch((err: any) => {
                msg.reply.text('Slinkse onzin ontdekt: ' + err)
                    .then(() => msg.reply.text('Stuur s.v.p. even een screenshot naar @Niels'))
            })

    })

    bot.on('location', msg => {
        
    })

    /**
     * Commands
     */
    bot.on(['/start'], msg => msg.reply.text('Hallo en welkom bij de O.D.D. Invictus sticker plak competitie!'))


    bot.start()

    return bot
}

const downloadPhoto = async (link: string) => {
    return new Promise<void>((resolve, reject) => axios({
        method: 'get',
        url: link,
        responseType: 'stream'
    }).then((response: any) => {
        response.data.pipe(fs.createWriteStream('photo'))
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