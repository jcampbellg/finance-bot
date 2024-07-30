import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import upsSend from '@onSend/upsSend'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'

export async function bookDeleteYesPress(params: ConversationProps) {
  const { query, user, bot, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_delete_yes_', '')

  if (!bookId) {
    await upsSend(params)
    return
  }

  const success = await xprisma.book.delete(user, bookId)

  if (!success) {
    await upsSend(params)
    return
  }

  const text = `¡Perfecto!\nTu libro ha sido eliminado.`
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: '🔎 Ver Libros', callback_data: 'books' }],
    menuBtn
  ]

  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
}