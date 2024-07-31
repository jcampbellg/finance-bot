import noBookError from '@botMessage/errors/noBookError'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import bookUpdateMessage from './bookUpdateMessage'

export default async function bookSelectMessage(params: ConversationProps) {
  const { query, user, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const bookId = query.data.replace('book_select_', '')
  const book = await xprisma.book.findUnique(user, bookId)
  if (!book) {
    await noBookError(params)
    return
  }

  await xprisma.user.update(chatId, {
    bookSelectedId: book.id
  })

  await bookUpdateMessage(params, bookId)
}