import TelegramBot from 'node-telegram-bot-api'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from "dayjs/plugin/utc"
import notion from '@utils/notion'
import numeral from 'numeral'
import * as dotenv from 'dotenv'
dotenv.config()

type BotJsonResponse = {
  date: string
  paymentMethod: 'Tarjeta' | 'Transferencia' | 'Efectivo'
  description: string
  category: string
  amount: string
  coin: 'USD' | 'HNL'
  notes: string
} | {
  error: string
}

type BotJsonCategoryResponse = {
  category: string
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

  if (!msg.text && !msg.voice) {
    bot.sendMessage(msg.chat.id, 'Please send a text or voice message.')
    return
  }

  if (msg.text === '/start') {
    await bot.sendMessage(msg.chat.id, 'Hello world!')
    return
  }

  const allMonths = await notion.databases.query({
    database_id: budgetId,
    sorts: [{
      direction: 'descending',
      property: 'Fecha'
    }]
  })

  const curMonthPageId = allMonths.results[0].id
  const curMonthPageData = await notion.blocks.children.list({ block_id: curMonthPageId })
  const curMonthTransactionsId = curMonthPageData.results[0].id
  const curMonthCategoriesId = curMonthPageData.results[2].id

  const allCategoriesQuery = await notion.databases.query({
    database_id: curMonthCategoriesId
  })

  // @ts-ignore
  const allCategories = allCategoriesQuery.results.map((category, i) => ({
    id: category.id,
    // @ts-ignore
    name: category.properties.Categoria.title[0].plain_text,
    // @ts-ignore
    icon: category.icon
  }))

  if (msg.text?.startsWith('/cat')) {
    if (msg.text?.startsWith('/cat list') || msg.text.trim() === '/cat') {
      bot.sendMessage(msg.chat.id, `Categories:\n${allCategories.map(c => c.name).join('\n')}`)
      return
    }

    const catName = msg.text.split(' ')[1]

    const botAI = await openAi.chat.completions.create({
      messages: [{
        role: 'system',
        content: `Today is: ${today}`
      }, {
        role: 'system',
        content: `Your job is to get the item on the list the user is trying to refer to, the closest. If the item is not on the list or anything close, return an error message, but you can autocorrect and select the correct item if the user misspelled the word.`
      }, {
        role: 'system',
        content: `Based on this list: [${allCategories.map(c => c.name).join('\n')}]`
      }, {
        role: 'system',
        content: 'You will return these data in JSON format: { "category": "Category Name" } or { "error": "error message" }'
      }, {
        role: 'user',
        content: catName
      }],
      model: 'gpt-4-1106-preview',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 300
    })

    const botMessage = botAI.choices[0].message.content?.trim() || `{"error": "Unknown error"}`
    const botJsonMessage: BotJsonCategoryResponse = JSON.parse(botMessage)


    if ('error' in botJsonMessage) {
      bot.sendMessage(msg.chat.id, botMessage)
      return
    }

    const catToLook = allCategories.find(c => c.name === botJsonMessage.category)

    if (!catToLook) {
      bot.sendMessage(msg.chat.id, `{"error": "Category not found."}`)
      return
    }

    const queryByCat = await notion.databases.query({
      database_id: curMonthTransactionsId,
      filter: {
        and: [
          {
            property: 'Categoria',
            relation: {
              contains: catToLook.id
            }
          },
        ]
      },
    })

    if (queryByCat.results.length === 0) {
      bot.sendMessage(msg.chat.id, 'No transactions found for this category.')
      return
    }

    const allTrans = queryByCat.results.map(t => ({
      // @ts-ignore
      date: t.properties.Fecha.date.start,
      // @ts-ignore
      description: t.properties.Descripcion.title[0].plain_text,
      // @ts-ignore
      hnl: t.properties.HNL.number,
      // @ts-ignore
      usd: t.properties.USD.number,
    }))

    const totalHNL = numeral(allTrans.reduce((acc, t) => acc + t.hnl, 0)).format('0,0.00')
    const totalUSD = numeral(allTrans.reduce((acc, t) => acc + t.usd, 0)).format('0,0.00')

    const transString = allTrans.map(t => `${dayjs(t.date).format('D MMM')} <b>${t.description}</b>:\n${numeral(t.hnl || t.usd || 0).format('0,0.00')} ${t.hnl ? 'HNL' : 'USD'}`).join('\n\n')

    bot.sendMessage(msg.chat.id, `<b>${catToLook.name.toUpperCase()}:</b>${allTrans.length} Transaccione${allTrans.length > 1 && 's'}\n\n${transString}\n\n<b>TOTAL HNL: ${totalHNL}\nTOTAL USD: ${totalUSD}:</b>`, { parse_mode: 'HTML' })
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

  const botAI = await openAi.chat.completions.create({
    messages: [{
      role: 'system',
      content: `Today is: ${today}`
    }, {
      role: 'system',
      content: 'Your job is to get the date, description, category name, payment method, amount and coin type of a transaction from the user input. Notes are optionals.'
    }, {
      role: 'system',
      content: `You will get the category name from this list: [${allCategories.map(c => c.name).join('\n')}]`
    }, {
      role: 'system',
      content: 'The date will be in the format YYYY-MM-DD HH:mm:ss. If no date is provided, use the current date.'
    }, {
      role: 'system',
      content: 'The amount can also have negative values. If the user says "menos", "deposito" "ingreso", it means it is a negative value.'
    }, {
      role: 'system',
      content: 'The coins accepted are USD and HNL. L also means HNL. Lempiras also mean HNL. Dollars also means USD.'
    }, {
      role: 'system',
      content: 'If the message contains FICO: Transaccion TC xxxx*2928 you will not include this in the description. And the payment method will be Tarjeta.'
    }, {
      role: 'system',
      content: 'You will return these data in JSON format: { "date": "YYYY-MM-DD HH:mm:ss", "paymentMethod": "Tarjeta, Transferencia or Efectivo", "category": "Category Name" "description": "description", "amount": "amount", "coin": "USD or HNL", "notes": "return empty string if none" }'
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

  const entry = await notion.pages.create({
    parent: {
      database_id: curMonthTransactionsId
    },
    properties: {
      // @ts-ignore
      'Fecha': {
        date: {
          start: botJsonMessage.date,
          time_zone: (process.env.timezone || 'UTC')
        }
      },
      'Descripcion': {
        title: [{
          text: {
            content: botJsonMessage.description
          }
        }]
      },
      // @ts-ignore
      'Categoria': {
        relation: [
          {
            id: allCategories.find(c => c.name === botJsonMessage.category)?.id || allCategories.find(c => c.name === 'Misc')?.id
          }
        ]
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
})