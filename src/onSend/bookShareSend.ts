import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import upsSend from '@onSend/upsSend'
import bookUpdateSend from '@onSend/bookUpdateSend'
import { User } from '@prisma/client'

export default async function bookShareSend(params: ConversationProps, userShare: User) {
  const { conversation, user } = params

  const bookId = conversation.edit.bookId
  const isOwnerChange = conversation.subject === 'bookShareOwner'

  if (!bookId) {
    await upsSend(params)
    return
  }

  if (isOwnerChange) {
    // Remove the book from share form the new owner
    await xprisma.share.delete(bookId, user.id)

    // Update the book owner
    await xprisma.book.update(user, bookId, {
      ownerId: userShare.id
    })

    // Share the book back to the original owner
    await xprisma.share.create(bookId, user.id)
  } else {
    await xprisma.share.create(bookId, userShare.id)
  }

  await bookUpdateSend(params, bookId)
}