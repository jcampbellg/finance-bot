import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'
import { BookWithRoleAndOwner } from '@customTypes/prismaTypes'
import prisma from '@utils/prisma'
import { endButton } from './newConversation'

export async function onBooksBegin(params: ConversationProps) {
  const { query, user, bot, conversation, userId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const books = await prisma.book.findManyWithAccess(user)

  const [botText, botOptions] = await booksFormat(books)

  if (conversation.messageId) {
    try {
      await bot.editMessageText(botText, {
        chat_id: userId,
        message_id: conversation.messageId,
        ...botOptions
      })
      return
    } catch (error) {
      console.error(error)
    }
  }

  await bot.sendMessage(userId, botText, botOptions)
}

export async function booksFormat(books: BookWithRoleAndOwner[]): Promise<[string, TelegramOptions]> {
  return [`Por favor, selecciona el libro que te gustaría ver. 📚`, {
    parse_mode: 'HTML', reply_markup: {
      inline_keyboard: [
        ...books.map((book) => [{ text: book.title, callback_data: `book_${book.id}` }]),
        ...endButton(true, 'menu', '☰ Menú')
      ]
    }
  }]
}