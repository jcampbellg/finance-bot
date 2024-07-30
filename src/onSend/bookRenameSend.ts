import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import upsSend from './upsSend'

export default async function bookRenameSend(params: ConversationProps, title: string) {
  const { bot, chatId, conversation, user } = params

  const bookId = conversation.edit.bookId

  if (!bookId || !title) {
    await upsSend(params)
    return
  }

  await xprisma.book.update(user, bookId, {
    title: title
  })

  await bot.sendMessage(chatId, `¡Perfecto!\nTu libro ha sido actualizado.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `« Regresar`, callback_data: `book_view_${bookId}` }, { text: '🔎 Ver Libros', callback_data: 'books' }],
        menuBtn
      ]
    }
  })
}