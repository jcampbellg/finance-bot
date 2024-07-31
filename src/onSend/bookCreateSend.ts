import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import upsSend from './upsSend'

export default async function bookCreateSend(params: ConversationProps, title: string) {
  const { bot, chatId, user } = params

  if (!title) {
    await upsSend(params)
    return
  }

  const newBook = await xprisma.book.create(user, title)

  await bot.sendMessage(chatId, `¡Perfecto!\nTu libro contable "${title}" ha sido creado.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `📚 Ver Libro`, callback_data: `book_view_${newBook.id}` }, { text: '🔎 Ver Libros', callback_data: 'books' }],
        menuBtn
      ]
    }
  })
}