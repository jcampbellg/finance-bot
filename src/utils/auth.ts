import { ConversationProps, MsgOrQueryProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function auth({ bot, ctx, query }: MsgOrQueryProps): Promise<ConversationProps> {
  if (!ctx && !query) {
    throw new Error('Either ctx or query must be provided')
  }

  const userId = ctx?.chat.id || query?.message.chat.id as number
  const text = ctx?.text?.trim() || ''

  if (ctx) {
    // Something was send by the user
    await xprisma.conversation.removeLastMessage(userId)
  }

  const user = await xprisma.user.auth(userId)

  return {
    userId,
    user,
    bookSelected: user.bookSelected,
    conversation: user.conversation,
    text,
    firstName: ctx?.chat.first_name || query?.message.chat.first_name || ctx?.chat.username || query?.message.chat.username || 'usuario',
    bot,
    ctx,
    query
  } as ConversationProps
}