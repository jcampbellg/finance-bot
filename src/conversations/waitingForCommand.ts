import { MsgAndQueryProps, MsgProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import { booksOnStart } from '@conversations/books'
import { onboardingOnStart } from '@conversations/onboarding'
import { budgetOnStart } from '@conversations/budget'
import { newExpenseOnStart } from '@conversations/newExpense'
import { exchangeRatesOnStart } from './exchangeRates'
import { summaryOnStart } from './summary'
import { searchExpenseOnStart } from './searchExpense'
import setMyCommands from '@utils/setMyCommands'
import { shareOnStart } from './share'

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

  if (text === '/resumen') {
    await summaryOnStart({ bot, msg })
    return
  }

  if (text === '/cambio') {
    await exchangeRatesOnStart({ bot, msg })
    return
  }

  if (text === '/buscar') {
    await searchExpenseOnStart({ bot, msg })
    return
  }

  if (text === '/update') {
    await bot.sendMessage(userId, '<i>Actualizando comandos...</i>', { parse_mode: 'HTML' })
    await setMyCommands({ bot, msg })
    return
  }

  if (text === '/compartir') {
    await shareOnStart({ bot, msg })
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