import TelegramBot from 'node-telegram-bot-api'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import numeral from 'numeral'
import * as dotenv from 'dotenv'
import prisma from '@utils/prisma'
dotenv.config()

type ErrorJSON = {
  error: string
  reset?: boolean
}

type StatementJSON = {
  month: number
  year: number
}

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
  if (!userWhitelist.includes(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, `You, ${msg.chat.id} are not authorized to use this bot.`)
    return
  }

  if (!msg.text && !msg.voice) {
    bot.sendMessage(msg.chat.id, 'Envia un mensaje de texto o de voz.')
    return
  }

  bot.sendChatAction(msg.chat.id, 'typing')
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')
  const conversion = await prisma.conversion.findFirst()
  const dollarToHNL = conversion?.dollarToHNL || 24.6
  const hnlToDollar = conversion?.hnlToDollar || 0.04

  if (msg.text === '/start') {
    await bot.setMyCommands([{
      command: 'estado',
      description: 'Crear o edita tus estados de cuentas mensuales.'
    }, {
      command: 'ingreso',
      description: 'Crear o edita tus ingresos mensuales.'
    }, {
      command: 'categoria',
      description: 'Crear o edita tus categorías de gastos.'
    }, {
      command: 'resumen',
      description: 'Ver un resumen de tus estado de cuenta actual.'
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
        fullName: msg.chat.first_name || msg.chat.username || '',
        chatId: msg.chat.id,
        chatSubject: '',
        chatSubSubject: [],
        chatHistory: []
      }
    })

    await bot.sendMessage(msg.chat.id, 'Empezemos con /estado para crear un estado de cuenta mensual.')
    return
  }

  const user = await prisma.user.findUnique({
    where: {
      chatId: msg.chat.id
    },
    include: {
      statement: true
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

  if (userText === '/estado') {
    userChat(msg.chat.id, { chatSubject: 'estado', chatSubSubject: [!!user.statement ? 'queres cambiarlo' : 'mes y año'] })

    if (!!user.statement) {
      const monthInSpanish = dayjs().locale('es').month(user.statement.month - 1).format('MMMM')
      const year = user.statement.year
      await bot.sendMessage(msg.chat.id, `Tu estado de cuenta actual es para el mes de ${monthInSpanish} del año ${year}.\n\n¿Quieres cambiarlo?\n/si\n/no`)
      return
    }

    await bot.sendMessage(msg.chat.id, 'No tienes estado de cuenta. Escribe el mes y año para el estado de cuenta:')
    return
  }

  if (user.chatSubject === 'estado') {
    switch (user.chatSubSubject[0]) {
      case 'mes y año':
        const botAI = await openAi.chat.completions.create({
          messages: [{
            role: 'system',
            content: `Today is: ${today}`
          }, {
            role: 'system',
            content: 'Reply in spanish'
          }, {
            role: 'system',
            content: `Your job is to get the month and year from the user. The user can type the month in full or in short form.`
          }, {
            role: 'system',
            content: 'You will return these data in JSON format: { "month": <from 1 to 12>, "year": <4 digits number> } or { "error": "error message" }'
          }, {
            role: 'user',
            content: userText
          }],
          model: 'gpt-4-1106-preview',
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 300
        })

        const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
        const botMessageJSON: StatementJSON | ErrorJSON = JSON.parse(botMessage)

        if ('error' in botMessageJSON) {
          await bot.sendMessage(msg.chat.id, botMessageJSON.error)
          return
        }

        const month = botMessageJSON.month
        const year = botMessageJSON.year
        // Check if the statement already exists
        const statementExists = await prisma.statement.findFirst({
          where: {
            month,
            year
          }
        })

        const monthInSpanish = dayjs().locale('es').month(month - 1).format('MMMM')

        if (!!statementExists) {
          await bot.sendMessage(msg.chat.id, `Cambiando el estado de cuenta para el mes de ${monthInSpanish} del año ${year}.`)
          return
        }

        const newStatement = await prisma.statement.create({
          data: {
            month,
            year
          }
        })

        userChat(msg.chat.id, { statementId: newStatement.id, chatSubject: '', chatSubSubject: [], chatHistory: [] })

        await bot.sendMessage(msg.chat.id, `Estado de cuenta creado para el mes de ${monthInSpanish} del año ${year}.`)
        return
      case 'queres cambiarlo':
        if (userText === '/si') {
          userChat(msg.chat.id, { chatSubSubject: ['mes y año'] })

          await bot.sendMessage(msg.chat.id, 'Escribe el mes y año para el estado de cuenta:')
          return
        }

        if (userText === '/no') {
          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, 'Entendido.')
          return
        }
        break
    }
  }

  if (!user.statement) {
    await bot.sendMessage(msg.chat.id, 'Primero debes crear un estado de cuenta con el comando /estado.')
    return
  }

  await bot.sendMessage(msg.chat.id, 'No entiendo tu mensaje. Empieza otra vez.')
  userChat(msg.chat.id)
  return
})

type ChatData = {
  chatSubject?: string
  chatSubSubject?: string[]
  chatHistory?: string[]
  statementId?: number
}

async function userChat(chatId: number, data: ChatData = { chatHistory: [], chatSubject: '', chatSubSubject: [] }) {
  await prisma.user.update({
    where: {
      chatId: chatId
    },
    data: data
  })
}