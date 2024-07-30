import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import upsSend from '@onSend/upsSend'
import bookUpdateSend from '@onSend/bookUpdateSend'

export default async function bookRenameSend(params: ConversationProps, title: string) {
  const { conversation, user } = params

  const bookId = conversation.edit.bookId

  if (!bookId || !title) {
    await upsSend(params)
    return
  }

  await xprisma.book.update(user, bookId, {
    title: title
  })

  await bookUpdateSend(params, bookId)
}