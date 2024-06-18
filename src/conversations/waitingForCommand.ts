import { MessageFromPrivate } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import { booksOnStart } from '@conversations/books'
import { onboardingOnStart } from '@conversations/onboarding'
import { budgetOnStart } from '@conversations/budget'

type Props = {
  bot: TelegramBot
  msg: MessageFromPrivate
}

export default async function waitingForCommand({ bot, msg }: Props) {
  const userId = msg.chat.id
  const text = msg.text?.trim() || ''

  if (text === '/cancelar') {
    await prisma.conversation.delete({
      where: {
        chatId: userId
      }
    })

    await bot.sendMessage(userId, '¡Hasta luego! 👋')
    return
  }

  if (text === '/start') {
    await onboardingOnStart({ bot, msg })
    return
  }

  if (text === '/presupuesto') {
    await budgetOnStart({ bot, msg })
    return
  }

  if (text === '/libros') {
    await booksOnStart({ bot, msg })
    return
  }

  await bot.sendMessage(userId, 'No entiendo ese comando.')
  return
}