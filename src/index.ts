import { MsgProps, QueryProps } from '@customTypes/messageTypes'
import { booksPress } from '@onBegin/booksPress'
import startPress from '@onBegin/startPress'
import transExpenseNewPress from '@onBegin/transExpenseNewPress'
import { bookAddPress } from '@onCallback/bookAddPress'
import { bookCreatePress } from '@onCallback/bookCreatePress'
import countryChangePress from '@onCallback/countryChangePress'
import countryPress from '@onCallback/countryPress'
import timezonePress from '@onCallback/timezonePress'
import accountsSend from '@onSend/accountsSend'
import bookCreateSend from '@onSend/bookCreateSend'
import menuSend from '@onSend/menuSend'
import countrySearchReply from '@onText/countrySearchReply'
import stringReply from '@onText/stringReply'
import auth from '@utils/auth'
import xprisma from '@utils/xprisma'
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('message', async (ctx) => {
  if (ctx.chat.type === 'group') {
    // TODO: Handle group messages
    return
  }

  if (ctx.chat.type !== 'private') return

  const params = await auth({ bot, ctx } as MsgProps)
  const { text, chatId, conversation } = params

  await bot.sendChatAction(chatId, 'typing')

  if (text === '/start') {
    startPress(params)
    return
  }

  if (conversation.subject === 'start') {
    if (conversation.subSubject === 'countrySearch') {
      countrySearchReply(params)
    }
    return
  }

  if (conversation.subject === 'transExpenseNew') {
    if (conversation.subSubject === 'description') {
      stringReply(params, async (params) => {
        await xprisma.conversation.update(conversation.id, {
          subSubject: 'accounts'
        })

        accountsSend(params, { text: `¡Gracias!\nAhora, ¿puedes decirme la cuenta a la que se aplica esta transacción?` })
      })
    }
    return
  }

  if (conversation.subject === 'bookCreate') {
    if (conversation.subSubject === 'title') {
      stringReply(params, bookCreateSend)
    }
    return
  }
})

bot.on('callback_query', async (query) => {
  if (!query.message || !query.data) return

  const msg = await auth({ bot, query } as QueryProps)
  const { chatId, conversation, user } = msg

  const btnPress = query.data

  await bot.sendChatAction(chatId, 'typing')

  if (conversation.subject === 'start') {
    if (btnPress === 'country_change') {
      await countryChangePress(msg)
      return
    }

    if (btnPress.startsWith('country_')) {
      await countryPress(msg)
    }

    if (btnPress.includes('timezone_')) {
      await timezonePress(msg)
    }

    if (!user.timezone) {
      return
    }
  }

  if (btnPress === 'menu') {
    await menuSend(msg)
    return
  }

  if (btnPress === 'books') {
    await booksPress(msg)
  }

  if (btnPress === 'book_add') {
    await bookAddPress(msg)
  }

  if (btnPress === 'book_create') {
    await bookCreatePress(msg)
  }

  if (btnPress === 'trans_expense_new') {
    transExpenseNewPress(msg)
  }
})