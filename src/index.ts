import TelegramBot from 'node-telegram-bot-api'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from "dayjs/plugin/utc"
import notion from '@utils/notion'
import * as dotenv from 'dotenv'
dotenv.config()

type BotJsonResponse = {
  date: string
  paymentMethod: 'Tarjeta' | 'Transferencia' | 'Efectivo'
  description: string
  amount: string
  coin: 'USD' | 'HNL'
  notes: string
} | {
  error: string
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

if (process.env.databaseId === undefined) {
  throw new Error('databaseId is not defined')
}

const budgetId = process.env.databaseId

dayjs.extend(utc)
dayjs.extend(timezone)

const userWhitelist: number[] = JSON.parse(process.env.userWhitelist)

const token = process.env.botToken

const bot = new TelegramBot(token, { polling: true })

bot.on('message', async (msg) => {
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')
  if (!userWhitelist.includes(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, 'You are not authorized to use this bot.')
    return
  }

  if (msg.text === '/start') {
    await bot.sendMessage(msg.chat.id, 'Hello world!')
    return
  }

  if (msg.text || msg.voice) {
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

    const botAI = await openAi.chat.completions.create({
      messages: [{
        role: 'system',
        content: `Today is: ${today}`
      }, {
        role: 'system',
        content: 'Your job is to get the date, description, payment method, amount and coin type of a transaction from the user input. Notes are optionals.'
      }, {
        role: 'system',
        content: 'The date will be in the format YYYY-MM-DD HH:mm:ss. If no date is provided, use the current date.'
      }, {
        role: 'system',
        content: 'The amount can also have negative values.'
      }, {
        role: 'system',
        content: 'The coins accepted are USD and HNL. L also means HNL. Lempiras also mean HNL. Dollars also means USD.'
      }, {
        role: 'system',
        content: 'If the message contains FICO: Transaccion TC xxxx*2928 you will not include this in the description. And the payment method will be Tarjeta.'
      }, {
        role: 'system',
        content: 'You will return these data in JSON format: { "date": "YYYY-MM-DD HH:mm:ss", paymentMethod: "Tarjeta, Transferencia or Efectivo", "description": "description", "amount": "amount", "coin": "USD or HNL", "notes": "return empty string if none" }'
      }, {
        role: 'system',
        content: 'If you cannot find payment method, description, amount and coin, return a json with error message explaining what you need: { "error": "error message" }'
      }, {
        role: 'user',
        content: userText
      }],
      model: 'gpt-4-1106-preview',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 300
    })

    const botMessage = botAI.choices[0].message.content?.trim() || `{"error": "Unknown error"}`
    bot.sendMessage(msg.chat.id, botMessage)

    const botJsonMessage: BotJsonResponse = JSON.parse(botMessage)

    if ('error' in botJsonMessage) {
      return
    }

    const currentMonth = await notion.databases.query({
      database_id: budgetId,
      sorts: [{
        direction: 'descending',
        property: 'Fecha'
      }]
    })

    const lastMonthPageId = currentMonth.results[0].id
    const lastMonthPageData = await notion.blocks.children.list({ block_id: lastMonthPageId })
    const lastMonthTransactionsId = lastMonthPageData.results[0].id

    const entry = await notion.pages.create({
      parent: {
        database_id: lastMonthTransactionsId
      },
      properties: {
        'Fecha': {
          date: {
            start: botJsonMessage.date
          }
        },
        'Descripcion': {
          title: [{
            text: {
              content: botJsonMessage.description
            }
          }]
        },
        [botJsonMessage.coin]: {
          number: parseFloat(botJsonMessage.amount)
        },
        'Notas': {
          rich_text: [{
            text: {
              content: botJsonMessage.notes
            }
          }]
        },
        'Metodo': {
          select: {
            name: botJsonMessage.paymentMethod
          }
        }
      }
    })

    if (entry) {
      bot.sendMessage(msg.chat.id, 'Transaction added successfully.')
    }
  }
})