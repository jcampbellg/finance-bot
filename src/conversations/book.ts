import { BookWithRoleAndOwner, ByncUser } from '@customTypes/prismaTypes'
import TelegramBot from 'node-telegram-bot-api'
import { endButton, onNewConversationEnd } from '@conversations/newConversation'
import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'
import prisma from '@utils/prisma'

export async function onBookBegin(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_', '')

  const book = await prisma.book.findUniqueWithAccess(user, bookId)

  if (!book) {
    await bot.answerCallbackQuery(query.id, { text: 'Parece que el libro que buscas no existe o no tienes acceso a él. 😕' })
    await onNewConversationEnd(params)
    return
  }

  await prisma.conversation.updateSubject(conversation.id, 'book')
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
  return
}

export async function onBookCallback(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('bookedit_', '').split('_')[0]
  const book = await prisma.book.findUniqueWithAccess(user, bookId)

  if (!book) {
    await bot.answerCallbackQuery(query.id, { text: 'Parece que el libro que buscas no existe o no tienes acceso a él. 😕' })
    await onNewConversationEnd(params)
    return
  }

  const action = query.data.replace(`bookedit_${bookId}_`, '')

  if (['select_book', 'share_book', 'rename_book', 'delete_book'].indexOf(action) !== -1) {
    await prisma.conversation.updateSubject(conversation.id, 'book')

    let updateUser = user

    if (action === 'select_book') {
      updateUser = await prisma.user.update(userId, {
        bookSelected: {
          connect: {
            id: book.id
          }
        }
      })
    }

    const [botText, botOptions] = await bookFormat(bot, updateUser, book)

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
    return
  }
}

export async function bookFormat(bot: TelegramBot, user: ByncUser, book: BookWithRoleAndOwner): Promise<[string, TelegramOptions]> {
  const { title, role } = book
  const permision = role.permision === 'OWNER' ? 'Dueño' : role.permision === 'ADMIN' ? 'Administrador' : 'Editor'

  const ownerName = await bot.getChat(book.owner.telegramId).then((res) => res.first_name || res.username || 'Desconocido').catch(() => 'Desconocido')

  const owner = role.permision === 'OWNER' ? 'Tú' : ownerName

  const youAreOwner = role.permision === 'OWNER'

  const isSelected = user.bookSelectedId === book.id

  const text = `${isSelected ? '<i>Libro Seleccionado</i>\n' : ''}<b>${title}</b>\n\nDueño: ${owner}${youAreOwner ? '' : `\nPermisos: ${permision}`}`

  return [text, {
    parse_mode: 'HTML', reply_markup: {
      inline_keyboard: [
        [...(isSelected ? [] : [{ text: '✔ Seleccionar', callback_data: `bookedit_${book.id}_select_book` }]), { text: '↪ Compartir', callback_data: `bookedit_${book.id}_share_book` }],
        [{ text: '📝 Renombrar', callback_data: `bookedit_${book.id}_rename_book` }, { text: '🗑️ Eliminar', callback_data: `bookedit_${book.id}_delete_book` }],
        ...endButton(true, 'books', '🔎 Ver Libros')
      ]
    }
  }]
}