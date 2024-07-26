import { BookWithRoleAndOwner, ByncUser } from '@customTypes/prismaTypes'
import TelegramBot from 'node-telegram-bot-api'
import { endButton, onNewConversationEnd } from '@conversations/newConversation'
import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'
import prisma from '@utils/prisma'

export async function onBookBegin(params: ConversationProps) {
  const { query, user, bot, userId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_', '')

  if (!prisma.book.exists(bookId)) {
    await bot.answerCallbackQuery(query.id, { text: 'El libro ya no existe' })
    await onNewConversationEnd(params)
    return
  }

  const conversation = await prisma.conversation.update(params.conversation.id, {
    bookSelected: {
      connect: {
        id: bookId
      }
    }
  })

  const book = await prisma.book.findUnique(bookId)

  if (!book) {
    await bot.answerCallbackQuery(query.id, { text: 'El libro ya no existe' })
    await onNewConversationEnd(params)
    return
  }

  const [botText, botOptions] = await bookFormat(bot, user, book)

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

export async function bookFormat(bot: TelegramBot, user: ByncUser, book: BookWithRoleAndOwner): Promise<[string, TelegramOptions]> {
  const { title, role } = book
  const permision = role.permision === 'OWNER' ? 'Dueño' : role.permision === 'ADMIN' ? 'Administrador' : 'Editor'

  const ownerName = await bot.getChat(book.owner.telegramId).then((res) => res.first_name || res.username || 'Desconocido').catch(() => 'Desconocido')

  const owner = role.permision === 'OWNER' ? 'Tú' : ownerName

  const youAreOwner = role.permision === 'OWNER'

  const text = `<b>${title}</b>\n\nDueño: ${owner}${youAreOwner ? '' : `\nPermisos: ${permision}`}`

  const isSelected = user.bookSelectedId === book.id

  return [text, {
    parse_mode: 'HTML', reply_markup: {
      inline_keyboard: [
        [...(isSelected ? [] : [{ text: '✔ Seleccionar', callback_data: 'select_book' }]), { text: '↪ Compartir', callback_data: 'share_book' }],
        [{ text: '📝 Renombrar', callback_data: 'edit_book' }, { text: '🗑️ Eliminar', callback_data: 'delete_book' }],
        [{ text: '🔙 Volver', callback_data: 'books' }],
        ...endButton()
      ]
    }
  }]
}