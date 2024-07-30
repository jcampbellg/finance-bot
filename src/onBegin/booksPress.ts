import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'

export async function booksPress(params: ConversationProps) {
  const { bot, chatId, query, user } = params

  await xprisma.conversation.newSubject(params.conversation.id, {
    subject: 'books'
  })

  const books = await xprisma.book.findMany(user)

  const msg = `📚 Por favor, selecciona el libro que te gustaría ver.`

  const buttons: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: '📚 Crear Libro', callback_data: 'book_create' }, { text: '📚 Añadir Libro', callback_data: 'book_add' }],
    books.map(book => ({ text: book.title, callback_data: `book_view_${book.id}` })),
    menuBtn
  ]

  if (query) {
    await bot.editMessageText(msg, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: buttons
      }
    })
    return
  }

  await bot.sendMessage(chatId, msg, {
    reply_markup: {
      inline_keyboard: buttons
    }
  })
}