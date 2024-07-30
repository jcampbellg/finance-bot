import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import TelegramBot from 'node-telegram-bot-api'

export default async function bookUpdateSend(params: ConversationProps, bookId: string) {
  const { bot, chatId, query } = params

  const text = `¡Perfecto!\nTu libro ha sido actualizado.`
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: `« Regresar`, callback_data: `book_view_${bookId}` }, { text: '🔎 Ver Libros', callback_data: 'books' }],
    menuBtn
  ]

  if (query) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: keyboard
      }
    })
    return
  }

  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
}