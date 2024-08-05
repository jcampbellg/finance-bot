import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'
import { chunkIt } from '@array-utils/chunk-it'
import { Category } from '@customTypes/prismaTypes'
import endBtn from '@buttons/endBtn'
import menuBtn from '@buttons/menuBtn'

type CategoriesListProps = {
  callbackCreate: string
  callbackAccountPrefix: string
  text: string,
  btn: 'end' | 'menu'
}

export default async function categoriesListMessage(params: ConversationPropsWithBookSelected, { callbackCreate, callbackAccountPrefix, text: botText, btn }: CategoriesListProps) {
  const { bot, query, chatId, user } = params

  const categories = await xprisma.category.findMany(user)
  const groupedCategories: Category[][] = chunkIt(categories).size(2)

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: '💵 Crear Categoria', callback_data: callbackCreate }],
    ...groupedCategories.map((group) => group.map((c) => ({
      text: `${c.description}`,
      callback_data: `${callbackAccountPrefix}${c.id}`
    }))),
    ...(btn === 'end' ? [endBtn] : [menuBtn])
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