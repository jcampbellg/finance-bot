import noBookError from '@botMessage/errors/noBookError'
import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function bookViewMenuMessage(params: ConversationProps) {
  const { bot, conversation, chatId, query, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const bookId = query.data.replace('book_view_', '')
  const book = await xprisma.book.findUnique(user, bookId)

  if (!book) {
    await noBookError(params)
    return
  }

  await xprisma.conversation.waiting(conversation.id)

  const isSelected = user.bookSelectedId === book.id
  const owner = book.isOwner ? 'Tú' : await bot.getChat(book.owner.telegramId).then((res) => res.first_name || res.username || 'Desconocido').catch(() => 'Desconocido')

  await bot.editMessageText(`Editando Libro\n\n<b>Nombre:</b> ${book.title}\n<b>Dueño:</b> ${owner}\n<b>Selecionado:</b> ${isSelected ? 'Si' : 'no'}`, {
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