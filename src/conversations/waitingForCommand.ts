import { MsgProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import { booksOnStart } from '@conversations/books'
import { onboardingOnStart } from '@conversations/onboarding'
import { budgetOnStart } from '@conversations/budget'
import { expenseOnStart } from './expense'

export default async function waitingForCommand({ bot, msg }: MsgProps) {
  const userId = msg.chat.id
  const text = msg.text?.trim() || ''

  if (text === '/terminar') {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'waitingForCommand',
        data: {}
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

  if (text === '/libro') {
    await booksOnStart({ bot, msg })
    return
  }

  if (text === '/nueva') {
    await expenseOnStart({ bot, msg })
    return
  }

  await bot.sendMessage(userId, 'No entiendo ese comando.')
  return
}