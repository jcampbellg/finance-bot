import { ConversationProps } from '@customTypes/messageTypes'
import menuSend from '@onSend/menuSend'
import xprisma from '@utils/xprisma'

export default async function startPress(params: ConversationProps) {
  const { bot, ctx, conversation, firstName, chatId } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  bot.setMyCommands([], {
    language_code: ctx.from?.language_code,
    scope: {
      type: 'all_group_chats'
    }
  })

  bot.setMyCommands([], {
    language_code: ctx.from?.language_code,
    scope: {
      type: 'all_private_chats'
    }
  })

  bot.setMyCommands([], {
    language_code: ctx.from?.language_code,
    scope: {
      type: 'all_chat_administrators'
    }
  })

  bot.setMyCommands([], {
    language_code: ctx.from?.language_code,
    scope: {
      type: 'chat',
      chat_id: chatId
    }
  })

  if (conversation.subject !== 'start') {
    menuSend(params)
    return
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subject: 'start',
    subSubject: 'countrySearch'
  })

  await bot.sendMessage(chatId, `¡Hola ${firstName}! 👋 Soy Bync Bot.\n\n¿Podrías decirme en qué país vives?\n¡Gracias!`)
}