import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import noBookAccess from '@onSend/noBookAccess'
import xprisma from '@utils/xprisma'

export async function bookViewPress(params: ConversationProps) {
  const { query, user, bot, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_view_', '')
  const book = await xprisma.book.findUnique(user, bookId)
  if (!book) {
    await noBookAccess(params)
    return
  }

  const isSelected = user.bookSelectedId === book.id ? '\n<i>Libro Seleccionado</i>' : ''
  bot.editMessageText(`Editando\n\n<b>${book.title}</b>${isSelected}`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [...(isSelected ? [] : [{ text: '👉 Seleccionar', callback_data: `book_select_${book.id}` }]), ...(book.isOwner ? [{ text: '🤝 Compartir y Permisos', callback_data: `book_share_${book.id}` }] : [])],
        [{ text: '✏️ Renombrar', callback_data: `book_rename_${book.id}` }, { text: `❌ ${book.isOwner ? 'Eliminar' : 'Quitar'}`, callback_data: `book_delete_${book.id}` }],
        menuBtn
      ]
    }
  })
}