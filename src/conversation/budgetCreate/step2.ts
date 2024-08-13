import upsError from '@botMessage/errors/upsError'
import budgetBtn from '@buttons/budgetBtn'
import menuBtn from '@buttons/menuBtn'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const element = conversation.subSubject

  await stringReply(params, async (description) => {
    if (element === 'account') {
      const newElement = await xprisma.account.create(user, description)
      if (!newElement) {
        upsError(params)
        return
      }

      await CreateMessage(params, newElement.id)
      return
    }

    if (element === 'income') {
      const newElement = await xprisma.income.create(user, description)
      if (!newElement) {
        upsError(params)
        return
      }

      await CreateMessage(params, newElement.id)
      return
    }

    if (element === 'category') {
      const newElement = await xprisma.category.create(user, description)
      if (!newElement) {
        upsError(params)
        return
      }

      await CreateMessage(params, newElement.id)
      return
    }

    if (element === 'payment') {
      const newElement = await xprisma.payment.create(user, description)
      if (!newElement) {
        upsError(params)
        return
      }

      await CreateMessage(params, newElement.id)
      return
    }
  })
}

async function CreateMessage(params: ConversationPropsWithBookSelected, id: string) {
  const { bot, chatId, conversation } = params

  const element = conversation.subSubject

  const botText: Record<string, string> = {
    'account': 'cuenta',
    'income': 'ingreso',
    'category': 'categoría',
    'payment': 'pago fijo'
  }

  const botTextLook: Record<string, string> = {
    'account': 'Cuentas',
    'income': 'Ingresos',
    'category': 'Categorías',
    'payment': 'Pagos Fijos'
  }

  const botTextLookCallback: Record<string, string> = {
    'account': 'accounts_menu',
    'income': 'incomes_menu',
    'category': 'categories_menu',
    'payment': 'payments_menu fijos'
  }

  const callbackText: Record<string, string> = {
    'account': '🏦 Ver Cuenta',
    'income': '🤑 Ver Ingreso',
    'category': '🗂️ Ver Categoría',
    'payment': '💵 Ver Pago Fijo'
  }

  const callback: Record<string, string> = {
    'account': `account_view_${id}`,
    'income': `category_view_${id}`,
    'category': `category_view_${id}`,
    'payment': `category_view_${id}`
  }

  const text = `¡Perfecto!\nTu ${botText[element]} ha sido creado.`
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: callbackText[element], callback_data: callback[element] }, { text: `🔎 Ver ${botTextLook[element]}`, callback_data: botTextLookCallback[element] }],
    budgetBtn,
    menuBtn
  ]

  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
}