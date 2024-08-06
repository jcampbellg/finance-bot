import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'
import { chunkIt } from '@array-utils/chunk-it'
import { Category } from '@customTypes/prismaTypes'
import endBtn from '@buttons/endBtn'
import menuBtn from '@buttons/menuBtn'
import { MAX_CATEGORIES } from '@utils/constant'
import budgetBtn from '@buttons/budgetBtn'

type CategoriesListProps = {
  callbackCreate: string
  callbackPrefix: string
  text: string,
  btn: 'end' | 'menu' | 'budget'
}

export default async function categoriesListMessage(params: ConversationPropsWithBookSelected, { callbackCreate, callbackPrefix, text: botText, btn }: CategoriesListProps) {
  const { bot, query, chatId, user } = params

  const categories = await xprisma.category.findMany(user)
  const groupedCategories: Category[][] = chunkIt(categories).size(2)

  const canCreate = MAX_CATEGORIES > categories.length

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    ...(canCreate ? [[{ text: '🗂️ Crear Categoria', callback_data: callbackCreate }]] : []),
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