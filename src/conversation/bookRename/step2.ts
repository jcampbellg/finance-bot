import bookUpdateMessage from '@botMessage/book/bookUpdateMessage'
import noBookError from '@botMessage/errors/noBookError'
import stringReply from '@conversation/utils/stringReply'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationProps) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await stringReply(params, async (title) => {
    const bookId = conversation.edit.bookId

    if (!bookId) {
      await noBookError(params)
      return
    }

    await xprisma.book.update(user, bookId, {
      title: title
    })

    await bookUpdateMessage(params, bookId)
  })
}