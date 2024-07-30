import { MsgProps, QueryProps } from '@customTypes/messageTypes'
import { booksPress } from '@onBegin/booksPress'
import startPress from '@onBegin/startPress'
import transExpenseNewPress from '@onBegin/transExpenseNewPress'
import { bookAddPress } from '@onCallback/bookAddPress'
import { bookCreatePress } from '@onCallback/bookCreatePress'
import { bookDeleteYesPress } from '@onCallback/bookDeleteYesPress'
import { bookRenamePress } from '@onCallback/bookRenamePress'
import { bookSelectPress } from '@onCallback/bookSelectPress'
import { bookShareAddPress } from '@onCallback/bookShareAddPress'
import { bookSharePress } from '@onCallback/bookSharePress'
import { bookViewPress } from '@onCallback/bookViewPress'
import countryChangePress from '@onCallback/countryChangePress'
import countryPress from '@onCallback/countryPress'
import timezonePress from '@onCallback/timezonePress'
import accountsSend from '@onSend/accountsSend'
import bookCreateSend from '@onSend/bookCreateSend'
import bookRenameSend from '@onSend/bookRenameSend'
import bookShareSend from '@onSend/bookShareSend'
import booleanSend from '@onSend/booleanSend'
import menuSend from '@onSend/menuSend'
import countrySearchReply from '@onText/countrySearchReply'
import stringReply from '@onText/stringReply'
import userIdReply from '@onText/userIdReply'
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
  if (text === '/start') {
    await startPress(params)
    return
  }

  if (conversation.subject === 'start') {
    if (conversation.subSubject === 'countrySearch') {
      await countrySearchReply(params)
    }
    return
  }
  //#endregion

  //#region Book
  if (conversation.subject === 'bookCreate') {
    if (conversation.subSubject === 'title') {
      await stringReply(params, bookCreateSend)
    }
    return
  }

  if (conversation.subject === 'bookRename') {
    if (conversation.subSubject === 'title') {
      await stringReply(params, bookRenameSend)
    }
    return
  }

  if (conversation.subject === 'bookShareAdd' || conversation.subject === 'bookShareOwner') {
    await userIdReply(params, bookShareSend)
    return
  }
  //#endregion

  //#region TransExpense
  if (conversation.subject === 'transExpenseNew') {
    if (conversation.subSubject === 'description') {
      await stringReply(params, async (params) => {
        await xprisma.conversation.update(conversation.id, {
          subSubject: 'accounts'
        })

        accountsSend(params, { text: `¡Gracias!\nAhora, ¿puedes decirme la cuenta a la que se aplica esta transacción?` })
      })
    }
    return
  }
  //#endregion
})

bot.on('callback_query', async (query) => {
  //#region Auth
  if (!query.message || !query.data) return

  const msg = await auth({ bot, query } as QueryProps)
  const { chatId, conversation, user } = msg

  const btnPress = query.data

  await bot.sendChatAction(chatId, 'typing')
  //#endregion

  //#region Start
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
  //#endregion

  //#region Books
  if (btnPress === 'books') {
    await booksPress(msg)
  }

  if (btnPress === 'book_add') {
    await bookAddPress(msg)
  }

  if (btnPress === 'book_create') {
    await bookCreatePress(msg)
  }

  if (btnPress.startsWith('book_view_')) {
    await bookViewPress(msg)
    return
  }

  if (btnPress.startsWith('book_select_')) {
    await bookSelectPress(msg)
    return
  }

  if (btnPress.startsWith('book_rename_')) {
    await bookRenamePress(msg)
    return
  }

  if (btnPress.startsWith('book_share_')) {
    if (btnPress.startsWith('book_share_add_')) {
      await bookShareAddPress(msg, false)
      return
    }
    if (btnPress.startsWith('book_share_owner_')) {
      await bookShareAddPress(msg, true)
      return
    }
    await bookSharePress(msg)
    return
  }

  if (btnPress.startsWith('book_delete_')) {
    if (btnPress.startsWith('book_delete_yes_')) {
      await bookDeleteYesPress(msg)
      return
    }
    const bookId = btnPress.replace('book_delete_', '')
    await booleanSend(msg, { action: 'eliminar este libro', callbackYes: `book_delete_yes_${bookId}`, callbackNo: `book_view_${bookId}` })
    return
  }
  //#endregion

  //#region TransExpense
  if (btnPress === 'trans_expense_new') {
    transExpenseNewPress(msg)
  }
  //#endregion
})