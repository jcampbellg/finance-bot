import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'
import { chunkIt } from '@array-utils/chunk-it'
import { Category } from '@customTypes/prismaTypes'
import endBtn from '@buttons/endBtn'
import menuBtn from '@buttons/menuBtn'
import { MAX_CATEGORIES, MAX_INCOMES, MAX_PAYMENTS } from '@utils/constant'
import budgetBtn from '@buttons/budgetBtn'
import { $Enums } from '@prisma/client'

type CategoriesListProps = {
  callbackCreate?: string
  callbackPrefix: string
  text: string,
  btn: 'end' | 'menu' | 'budget'
  type?: $Enums.CategoryType
}

export default async function categoriesListMessage(params: ConversationPropsWithBookSelected, { callbackCreate, callbackPrefix, text: botText, btn, type = 'CATEGORY' }: CategoriesListProps) {
  const { bot, query, chatId, user } = params

  const categories = await xprisma.category.findManyByType(user, type)
  const groupedCategories: Category[][] = chunkIt(categories).size(2)

  const canCreate = !!callbackCreate && (
    type === 'INCOME' ? categories.length < MAX_INCOMES : type === 'PAYMENT' ? categories.length < MAX_PAYMENTS : categories.length < MAX_CATEGORIES
  )

  const createText = type === 'INCOME' ? '🤑 Crear Ingreso' : type === 'PAYMENT' ? '💵 Crear Pago Fijo' : '🗂️ Crear Categoria'

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    ...(canCreate ? [[{ text: createText, callback_data: callbackCreate }]] : []),
    ...groupedCategories.map((group) => group.map((c) => ({
      text: `${c.description}`,
      callback_data: `${callbackPrefix}${c.id}`
    }))),
    ...(btn === 'budget' ? [budgetBtn] : (btn === 'end' ? [endBtn] : [menuBtn]))
  ]

  if (query) {
    await bot.editMessageText(botText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    })
    return
  }

  await bot.sendMessage(chatId, botText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
}