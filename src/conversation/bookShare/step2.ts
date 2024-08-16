import bookUpdateMessage from '@botMessage/book/bookUpdateMessage'
import noBookError from '@botMessage/errors/noBookError'
import notFoundError from '@botMessage/errors/notFoundError'
import userIdReply from '@conversation/utils/userIdReply'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationProps) {
  const { ctx, conversation, user, bot, chatId } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const bookId = conversation.edit.bookId

  if (!bookId) {
    await noBookError(params)
    return
  }

  await userIdReply(params, async ({ user: userToShare, groupChat: groupToShare }) => {
    if (conversation.subject === 'book_share') {
      if (!!userToShare) {
        await xprisma.share.create(user, bookId, userToShare.id)
      }

      if (!!groupToShare) {
        await xprisma.groupChat.update({
          where: { id: groupToShare.id },
          data: {
            books: {
              connect: { id: bookId }
            }
          }
        })
        await bot.sendMessage(chatId, `<i>El libro ha sido compartido con el grupo.</i>`, {
          parse_mode: 'HTML'
        })
      }

      if (!userToShare && !groupToShare) {
        await notFoundError(params)
        return
      }

      await bookUpdateMessage(params, bookId)
    }


    if (conversation.subject === 'book_owner') {
      if (!userToShare) {
        await notFoundError(params)
        return
      }
      // Remove share from new owner if he has one
      await xprisma.share.delete(user, bookId, userToShare.id)

      // Update book owner
      await xprisma.book.update(user, bookId, {
        ownerId: userToShare.id
      })

      // Update Old Owner to have access to book
      await xprisma.share.create(userToShare, bookId, user.id)

      await bookUpdateMessage(params, bookId)
    }
  })
}