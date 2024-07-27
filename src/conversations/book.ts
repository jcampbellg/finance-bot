import { BookWithRolesAndOwner, ByncUser } from '@customTypes/prismaTypes'
import { endButtons, onConversationEnd, yesAndNoButtons } from '@conversations/mainMenu'
import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import { titleEval } from '@utils/isValid'
import { onBooksBegin } from './books'

export async function onBookBegin(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_', '')

  const book = await xprisma.book.findUniqueWithAccess(user, bookId)

  if (!book) {
    await bot.answerCallbackQuery(query.id, { text: 'Parece que el libro que buscas no existe o no tienes acceso a él. 😕' })
    await onConversationEnd(params)
    return
  }

  await xprisma.conversation.updateSubject(conversation.id, 'book')
  const [botText, botOptions] = await bookFormat(user, book)

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
  return
}

export async function onBookText(params: ConversationProps) {
  const { ctx, user, bot, userId, conversation, text } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (conversation.subSubject === 'rename') {
    const title = titleEval(text)

    if (title.isError) {
      await bot.sendMessage(userId, title.error)
      return
    }

    const updateBook = await xprisma.book.update(user, conversation.editId as string, { title: title.value })

    if (!updateBook) {
      await bot.sendMessage(userId, 'Parece que el libro que buscas no existe o no tienes acceso a él. 😕')
      await onConversationEnd(params)
      return
    }

    await xprisma.conversation.updateSubject(conversation.id, 'book')

    const msg = await bookFormat(user, updateBook)
    const botMsg = await bot.sendMessage(userId, `${msg[0]}`, msg[1])
    await xprisma.conversation.update(conversation.id, { messageId: botMsg.message_id })
  }
}

export async function onBookCallback(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('bookedit_', '').split('_')[0]
  const book = await xprisma.book.findUniqueWithAccess(user, bookId)

  if (!book) {
    await bot.answerCallbackQuery(query.id, { text: 'Parece que el libro que buscas no existe o no tienes acceso a él. 😕' })
    await onConversationEnd(params)
    return
  }

  const action = query.data.replace(`bookedit_${bookId}_`, '')

  if (['select', 'rename', 'delete', 'delete_confirm'].indexOf(action) !== -1) {
    await xprisma.conversation.updateSubject(conversation.id, 'book')

    let updateUser = user

    if (action === 'select') {
      updateUser = await xprisma.user.update(userId, {
        bookSelected: {
          connect: {
            id: book.id
          }
        }
      })
    }

    if (action === 'rename') {
      await xprisma.conversation.update(conversation.id, {
        subject: 'book',
        subSubject: 'rename',
        messageId: null,
        editId: book.id
      })
      await bot.sendMessage(userId, 'Vamos a renombrar tu libro contable. 📚\n\nPor favor, dime el nuevo nombre que te gustaría darle.')
      return
    }

    if (action === 'delete') {
      const [botText, botOptions] = yesAndNoButtons(book.title, `bookedit_${book.id}_delete_confirm`, `book_${book.id}`)

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

      await bot.sendMessage(userId, botText, botOptions)
      return
    }

    if (action === 'delete_confirm') {
      await bot.answerCallbackQuery(query.id, { text: 'Eliminando libro... 📚' })
      const isOk = await xprisma.book.delete(user, book.id)

      if (!isOk) {
        await bot.sendMessage(userId, 'Parece que el libro que buscas no existe o no tienes acceso a para eliminarlo. 😕')
        await onConversationEnd(params)
        return
      }

      await bot.answerCallbackQuery(query.id, { text: 'Libro eliminado correctamente. 📚' })
      await xprisma.conversation.update(conversation.id, {
        subject: 'books',
        subSubject: '',
        messageId: null
      })
      await onBooksBegin(params)
      return
    }

    const [botText, botOptions] = await bookFormat(updateUser, book)

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

    await bot.sendMessage(userId, botText, botOptions)
    return
  }
}

export async function bookFormat(user: ByncUser, book: BookWithRolesAndOwner): Promise<[string, TelegramOptions]> {
  const { title, role } = book
  const permission = role.permission === 'OWNER' ? 'Dueño' : role.permission === 'FINANCE' ? 'Tesorero' : 'Gastador'

  const isSelected = user.bookSelectedId === book.id

  const text = `${isSelected ? '<i>Libro Seleccionado</i>\n' : ''}<b>${title}</b>\n\nPermisos: ${permission}`

  const canManage = role.permission === 'OWNER'
  const canEdit = role.permission === 'OWNER' || role.permission === 'FINANCE'
  const canGiveUp = role.permission === 'FINANCE' || role.permission === 'SPENDER'

  return [text, {
    parse_mode: 'HTML', reply_markup: {
      inline_keyboard: [
        [...(isSelected ? [] : [{ text: '👉 Seleccionar', callback_data: `bookedit_${book.id}_select` }]), ...(canManage ? [{ text: '🤝 Compartir y Permisos', callback_data: `roles_${book.id}` }] : [])],
        [...(canEdit ? [{ text: '✏️ Renombrar', callback_data: `bookedit_${book.id}_rename` }] : []), ...(canManage ? [{ text: '❌ Eliminar', callback_data: `bookedit_${book.id}_delete` }] : [])],
        ...(canGiveUp ? [[{ text: '❌ Quitar Acceso', callback_data: `giveup_${book.id}` }]] : []),
        ...endButtons(true, 'books', '🔎 Ver Libros')
      ]
    }
  }]
}