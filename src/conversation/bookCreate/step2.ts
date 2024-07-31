import endBtn from '@buttons/endBtn'
import stringReply from '@conversationUtils/stringReply'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationProps) {
  const { user, bot, ctx, chatId, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await stringReply(params, async (description) => {
    const newBook = await xprisma.book.create(user, description)

    xprisma.conversation.waiting(conversation.id)

    await bot.sendMessage(chatId, `¡Perfecto!\nTu libro contable "${description}" ha sido creado.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `📚 Ver Libro`, callback_data: `book_view_${newBook.id}` }, { text: '🔎 Ver Libros', callback_data: 'books_menu' }],
          endBtn
        ]
      }
    })
  })
}