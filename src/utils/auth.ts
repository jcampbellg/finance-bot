import { ConversationProps, MsgOrQueryProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function auth({ bot, ctx, query }: MsgOrQueryProps): Promise<ConversationProps> {
  if (!ctx && !query) {
    throw new Error('Either ctx or query must be provided')
  }

  const chatId = ctx?.chat.id || query?.from.id as number
  const text = ctx?.text?.trim() || ''

  const user = await xprisma.user.auth(chatId)

  return {
    chatId,
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