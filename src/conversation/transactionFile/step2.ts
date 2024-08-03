import noBookError from '@botMessage/errors/noBookError'
import upsError from '@botMessage/errors/upsError'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import { $Enums } from '@prisma/client'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const fileType: $Enums.FileType = !!ctx.photo ? 'PHOTO' : 'DOCUMENT'
  const photoLen = ctx.photo?.length || 0

  const fileId = fileType === 'PHOTO' ? ((ctx.photo && ctx.photo[photoLen - 1]) ? ctx.photo[photoLen - 1].file_id : undefined) : ctx.document?.file_id

  if (!fileId) {
    await upsError(params)
    return
  }

  const transactionId = conversation.edit.transactionId

  if (!transactionId) {
    await noBookError(params)
    return
  }



  await transactionViewMenuMessage(params, transactionId)
}