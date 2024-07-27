import xprisma from '@utils/xprisma'
import { endButtons, onConversationEnd } from './mainMenu'
import { bookFormat } from './book'
import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'

export async function onRolesBegin(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('roles_', '')
  const book = await xprisma.book.findUniqueWithAccess(user, bookId)

  if (!book) {
    await bot.sendMessage(userId, 'Parece que el libro que buscas no existe o no tienes acceso a él. 😕')
    await onConversationEnd(params)
    return
  }

  if (book.role.permission !== 'OWNER') {
    await bot.sendMessage(userId, 'Solo el dueño del libro puede cambiar los permisos. 😕')
    await onConversationEnd(params)
    return
  }

  await xprisma.conversation.update(conversation.id, { subSubject: 'share', editId: book.id })
  const [botText] = await bookFormat(user, book)

  const rolesText = await Promise.all(book.roles.map(async (role) => {
    const roleUser = await bot.getChat(role.user.telegramId).then((res) => res.first_name || res.username || 'Desconocido').catch(() => 'Desconocido')
    const permission = role.permission === 'OWNER' ? 'Dueño' : role.permission === 'FINANCE' ? 'Tesorero' : 'Gastador'

    return `<i>${roleUser}: ${permission}</i>`
  })).then((res) => res.join('\n'))

  const botOptions: TelegramOptions = {
    parse_mode: 'HTML', reply_markup: {
      inline_keyboard: [
        [{ text: '🔒 Nuevo Tesorero', callback_data: `role_add_${book.id}_admin` }],
        [{ text: '✏️ Nuevo Gastador', callback_data: `role_add_${book.id}_spender` }],
        [{ text: '👤 Cambiar de Dueño', callback_data: `role_add_${book.id}_owner` }],
        ...endButtons(true, `book_${book.id}`)
      ]
    }
  }

  if (conversation.messageId === query.message.message_id) {
    try {
      await bot.editMessageText(`${botText}\n\nPermisos:\n${rolesText}`, {
        chat_id: userId,
        message_id: conversation.messageId,
        ...botOptions
      })
      return
    } catch (error) {
      console.error(error)
    }
  }

  await bot.sendMessage(userId, `${botText}\n\nPermisos:\n${rolesText}`, botOptions)
  return
}