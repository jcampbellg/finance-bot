import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import noBookAccessSend from '@onSend/noBookAccessSend'
import xprisma from '@utils/xprisma'

export async function bookSharePress(params: ConversationProps) {
  const { query, user, bot, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_share_', '')
  const book = await xprisma.book.findUnique(user, bookId)
  if (!book) {
    await noBookAccessSend(params)
    return
  }

  const isSelected = user.bookSelectedId === book.id
  const owner = book.isOwner ? 'Tú' : await bot.getChat(book.owner.telegramId).then((res) => res.first_name || res.username || 'Desconocido').catch(() => 'Desconocido')

  const shares = await Promise.all(book.shares.map(async (share) => {
    const shareWith = await bot.getChat(share.user.telegramId).then((res) => res.first_name || res.username || 'Desconocido').catch(() => 'Desconocido')
    return shareWith
  }))

  await bot.editMessageText(`Editando Libro\n\n<b>Nombre:</b> ${book.title}\n<b>Dueño:</b> ${owner}\n<b>Selecionado:</b> ${isSelected ? 'Si' : 'no'}\n<b>Compartido con:</b> ${shares.length === 0 ? 'Nadie' : shares.join(', ')}`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '👥 Compartir', callback_data: `book_share_add_${book.id}` }, { text: `👤 Cambiar de Dueño`, callback_data: `book_share_owner_${book.id}` }],
        menuBtn
      ]
    }
  })
}