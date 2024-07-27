import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'
import { BookWithRolesAndOwner, ByncUser } from '@customTypes/prismaTypes'
import xprisma from '@utils/xprisma'
import { endButtons } from '@conversations/mainMenu'
import { newBookButtons } from '@conversations/newBook'

export async function onBooksBegin(params: ConversationProps) {
  const { query, user, bot, conversation, userId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const books = await xprisma.book.findManyWithAccess(user)

  const [botText, botOptions] = await booksFormat(user, books)

  if (conversation.messageId === query.message.message_id) {
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

  const botMsg = await bot.sendMessage(userId, botText, botOptions)
  await xprisma.conversation.update(conversation.id, { messageId: botMsg.message_id })
}

export async function booksFormat(user: ByncUser, books: BookWithRolesAndOwner[]): Promise<[string, TelegramOptions]> {
  return [`📚 Por favor, selecciona el libro que te gustaría ver.`, {
    parse_mode: 'HTML', reply_markup: {
      inline_keyboard: [
        ...await newBookButtons(user),
        ...books.map((book) => [{ text: `${book.isSelected ? '⦿ ' : ''}${book.title}`, callback_data: `book_${book.id}` }]),
        ...endButtons('menu')
      ]
    }
  }]
}