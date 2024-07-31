import menuMessage from '@botMessage/menuMessage'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationProps) {
  const { bot, conversation, firstName, chatId } = params

  await setCommands(params)

  if (conversation.subject !== 'start') {
    menuMessage(params)
    return
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subject: 'start',
    subSubject: 'country_search'
  })

  await bot.sendMessage(chatId, `¡Hola ${firstName}! 👋 Soy Bync Bot.\n\n¿Podrías decirme en qué país vives?\n¡Gracias!`)
}

async function setCommands({ bot, ctx, chatId }: ConversationProps) {
  if (!ctx) {
    return
  }

  await bot.setMyCommands([], {
    language_code: ctx.from?.language_code,
    scope: {
      type: 'all_group_chats'
    }
  })

  await bot.setMyCommands([], {
    language_code: ctx.from?.language_code,
    scope: {
      type: 'all_private_chats'
    }
  })

  await bot.setMyCommands([], {
    language_code: ctx.from?.language_code,
    scope: {
      type: 'all_chat_administrators'
    }
  })

  await bot.setMyCommands([], {
    language_code: ctx.from?.language_code,
    scope: {
      type: 'chat',
      chat_id: chatId
    }
  })
}