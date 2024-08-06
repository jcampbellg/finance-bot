import bookUpdateMessage from '@botMessage/book/bookUpdateMessage'
import noBookError from '@botMessage/errors/noBookError'
import userIdReply from '@conversation/utils/userIdReply'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationProps) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const bookId = conversation.edit.bookId

  if (!bookId) {
    await noBookError(params)
    return
  }

  await userIdReply(params, async (newUser) => {
    if (conversation.subject === 'book_share') {
      await xprisma.share.create(user, bookId, newUser.id)
      await bookUpdateMessage(params, bookId)
    }


    if (conversation.subject === 'book_owner') {
      // Remove share from new owner if he has one
      await xprisma.share.delete(user, bookId, newUser.id)

      // Update book owner
      await xprisma.book.update(user, bookId, {
        ownerId: newUser.id
      })

      // Update Old Owner to have access to book
      await xprisma.share.create(newUser, bookId, user.id)

      await bookUpdateMessage(params, bookId)
    }
  })
}