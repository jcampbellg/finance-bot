import { MsgAndQueryProps, MsgProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import { booksOnStart } from '@conversations/books'
import { onboardingOnStart } from '@conversations/onboarding'
import { budgetOnStart } from '@conversations/budget'
import { newExpenseOnStart } from '@conversations/newExpense'
import { summaryBudgetOnStart } from '@conversations/summary'
import { exchangeRatesOnStart } from './exchangeRates'

export async function waitingForCommandOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

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

export default async function waitingForCommand({ bot, msg }: MsgProps) {
  const userId = msg.chat.id
  const text = msg.text?.trim() || ''

  if (text === '/terminar') {
    await waitingForCommandOnStart({ bot, msg })
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
    await newExpenseOnStart({ bot, msg })
    return
  }

  if (text === '/resumen_presupuesto') {
    await summaryBudgetOnStart({ bot, msg })
    return
  }

  if (text === '/cambio') {
    await exchangeRatesOnStart({ bot, msg })
    return
  }

  await bot.sendMessage(userId, 'No entiendo ese comando.')
  return
}

export async function waitingForCommandNoBook({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'waitingForCommand',
      data: {}
    }
  })

  await bot.sendMessage(userId, 'Primero necesitas seleccionar un libro contable. Usa /libro.')
  return
}