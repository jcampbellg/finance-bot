import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { titleEval } from '@utils/isValid'
import xprisma from '@utils/xprisma'

export default async function stringReply(params: ConversationProps, next: NextFunction<string>) {
  const { bot, ctx, chatId, text, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const description = titleEval(text)
  if (description.isError) {
    await bot.sendMessage(chatId, description.error)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    edit: {
      ...conversation.edit,
      description: description.value
    }
  })

  next(description.value)
}