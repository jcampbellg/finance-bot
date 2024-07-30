import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import { endButtons } from '@conversations/mainMenu'
import { titleEval } from '@utils/isValid'
import { bookFormat } from '@conversations/book'
import { ByncUser } from '@customTypes/prismaTypes'
import TelegramBot from 'node-telegram-bot-api'
import { MAX_OWN_BOOKS } from '@utils/constant'

export async function onNewBookBegin(params: ConversationProps) {
  const { userId, bot, query, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'new_book',
    subSubject: 'title',
    edit: {}
  })

  await bot.editMessageText(`📚 Vamos a crear un nuevo libro contable. ¿Cómo te gustaría llamarlo?`, {
    chat_id: userId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: endButtons()
    }
  })

  return
}

export async function onNewBookText(params: ConversationProps) {
  const { bot, userId, ctx, conversation, text, user } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (conversation.subSubject === 'title') {
    const title = titleEval(text)

    if (title.isError) {
      await bot.sendMessage(userId, title.error, {
        reply_markup: {
          inline_keyboard: endButtons()
        }
      })
      return
    }

    const newBook = await xprisma.book.create(user, {
      title: title.value || ''
    })

    await xprisma.conversation.update(conversation.id, {
      subject: 'book',
      subSubject: '',
      edit: {
        bookId: newBook.id
      }
    })

    const msg = await bookFormat(user, newBook)
    await bot.sendMessage(userId, `¡Perfecto! Tu libro contable "${newBook.title}" ha sido creado.\n\n${msg[0]}`, msg[1])
  }
}

export async function newBookButtons(user: ByncUser): Promise<TelegramBot.InlineKeyboardButton[][]> {
  const ownBooks = await xprisma.book.findManyWithAccess(user).then(books => books.filter(book => book.role.permission === 'OWNER').length)

  const canCreateMore = ownBooks < MAX_OWN_BOOKS

  return [
    [...(canCreateMore ? [{ text: '📕 Crear Libro', callback_data: 'new_book' }] : []), { text: '📚 Añadir Libro Existente', callback_data: 'add_book' }]
  ]
}