import bookAddMessage from '@botMessage/book/bookAddMessage'
import booksMenuMessage from '@botMessage/book/booksMenuMessage'
import menuMessage from '@botMessage/menuMessage'
import bookCreateButton from '@conversation/bookCreate/bookCreateButton'
import bookCreateText from '@conversation/bookCreate/bookCreateText'
import startButton from '@conversation/start/startButton'
import startText from '@conversation/start/startText'
import { MsgProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

bot.on('message', async (ctx) => {
  //#region Auth
  if (ctx.chat.type === 'group') {
    // TODO: Handle group messages
    return
  }

  if (ctx.chat.type !== 'private') return

  const params = await auth({ bot, ctx } as MsgProps)
  const { text, chatId, conversation } = params

  await bot.sendChatAction(chatId, 'typing')
  //#endregion

  //#region Start
  if (text === '/start' || conversation.subject === 'start') {
    await startText(params)
    return
  }
  //#endregion

  //#region Book Create
  if (conversation.subject === 'book_create') {
    await bookCreateText(params)
    return
  }
  //#endregion
})

bot.on('callback_query', async (query) => {
  //#region Auth
  if (!query.message || !query.data) return

  const msg = await auth({ bot, query } as QueryProps)
  const { chatId, conversation } = msg

  const btnPress = query.data

  await bot.sendChatAction(chatId, 'typing')
  //#endregion

  //#region Start
  if (conversation.subject === 'start') {
    if (await startButton(msg)) {
      return
    }
  }

  if (query.data === 'menu' || query.data === 'end') {
    await menuMessage(msg, query.data === 'end')
    return
  }
  //#endregion

  //#region Books
  if (btnPress === 'books_menu') {
    await booksMenuMessage(msg)
    return
  }

  if (btnPress === 'book_add') {
    await bookAddMessage(msg)
    return
  }

  if (btnPress === 'book_create' || conversation.subject === 'book_create') {
    await bookCreateButton(msg)
    return
  }
  //#endregion
})