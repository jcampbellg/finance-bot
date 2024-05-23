import TelegramBot from 'node-telegram-bot-api'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from "dayjs/plugin/utc"
import notion from '@utils/notion'
import numeral from 'numeral'
import * as dotenv from 'dotenv'
import prisma from '@utils/prisma'
dotenv.config()

if (process.env.botToken === undefined) {
  throw new Error('botToken is not defined')
}

if (process.env.userWhitelist === undefined) {
  throw new Error('userWhitelist is not defined')
}

if (process.env.timezone === undefined) {
  throw new Error('timezone is not defined')
}

dayjs.extend(utc)
dayjs.extend(timezone)

const userWhitelist: number[] = JSON.parse(process.env.userWhitelist)

const token = process.env.botToken

const bot = new TelegramBot(token, { polling: true })

bot.on('message', async (msg) => {
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')
  if (!userWhitelist.includes(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, `You, ${msg.chat.id} are not authorized to use this bot.`)
    return
  }

  if (!msg.text && !msg.voice) {
    bot.sendMessage(msg.chat.id, 'Envia un mensaje de texto o de voz.')
    return
  }

  if (msg.text === '/start') {
    await bot.setMyCommands([{
      command: 'ingreso',
      description: 'Crear o edita tus ingresos mensuales.'
    }, {
      command: 'categoria',
      description: 'Crear o edita tus categorías de gastos.'
    }, {
      command: 'estado',
      description: 'Crear o edita tus estados de cuentas mensuales.'
    }, {
      command: 'presupuesto',
      description: 'Crear o edita tus presupuestos mensuales.'
    }], {
      scope: {
        type: msg.chat.type === 'group' ? 'all_group_chats' : 'chat',
        chat_id: msg.chat.id
      },
      language_code: 'en'
    })

    await bot.getMyCommands({ type: 'chat', chat_id: msg.chat.id }, 'en')

    const userExists = await prisma.user.findUnique({
      where: {
        chatId: msg.chat.id
      }
    })

    if (!!userExists) {
      await bot.sendMessage(msg.chat.id, 'Ya tienes una cuenta creada.')
      return
    }

    await prisma.user.create({
      data: {
        chatId: msg.chat.id,
        chatSubject: 'income',
        chatSubSubject: 'create',
      }
    })

    await bot.sendMessage(msg.chat.id, 'Empezemos. ¿Cuál es tu ingreso mensual, su moneda y de donde proviene?')
    return
  }

  const user = await prisma.user.findUnique({
    where: {
      chatId: msg.chat.id
    }
  })

  if (!user) {
    await bot.sendMessage(msg.chat.id, 'Primero debes iniciar el bot con el comando /start.')
    return
  }

  let userText = msg.text || ''

  if (msg.voice) {
    const link = await bot.getFileLink(msg.voice.file_id)
    const audioFile = await fetch(link)

    const transcription = await openAi.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "text"
    })

    // @ts-ignore
    userText = transcription
  }

  if (user.chatSubject === 'income') {
    if (user.chatSubSubject === 'create') {
      const botAI = await openAi.chat.completions.create({
        messages: [{
          role: 'system',
          content: `Today is: ${today}`
        }, {
          role: 'system',
          content: `Your job is to get amount, currency and source of your income from the user.`
        }, {
          role: 'system',
          content: `The currency can be HNL (L, Lempiras) or USD ($, dollars).`
        }, {
          role: 'system',
          content: 'You will return these data in JSON format: { "amount": <amount in number>, "currenct": "HNL" or "USD", "source": <job description> } or { "error": "error message" }'
        }, {
          role: 'user',
          content: userText
        }],
        model: 'gpt-4-1106-preview',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300
      })
    }
  }
})