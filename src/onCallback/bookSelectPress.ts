import { ConversationProps } from '@customTypes/messageTypes'
import bookUpdateSend from '@onSend/bookUpdateSend'
import noBookAccess from '@onSend/noBookAccess'
import xprisma from '@utils/xprisma'

export async function bookSelectPress(params: ConversationProps) {
  const { query, user, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_select_', '')
  const book = await xprisma.book.findUnique(user, bookId)
  if (!book) {
    await noBookAccess(params)
    return
  }

  await xprisma.user.update(chatId, {
    bookSelectedId: book.id
  })

  await bookUpdateSend(params, bookId)
}