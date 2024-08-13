import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { TRANSACTION_TYPE_ICON } from '@utils/constant'
import menuBtn from '@buttons/menuBtn'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function searchMessage(params: ConversationPropsWithBookSelected, searchFor?: string) {
  const { query, bot, chatId, user } = params

  const isCategory = query?.data.startsWith('search_category_') || false
  const isAccount = query?.data.startsWith('search_account_') || false

  const itemId = query?.data.replace('search_category_', '').replace('search_account_', '') || ''

  const searchForFloat = parseFloat(searchFor || '')

  const transactions = await xprisma.transaction.findMany(user, {
    ...(isCategory ? { categoryId: itemId } : {}),
    ...(isAccount ? { accountId: itemId } : {}),
    ...(searchFor ? {
      OR: [
        ...(Number.isNaN(searchForFloat) ? [] : [{ amount: { equals: searchForFloat } }]),
        { description: { contains: searchFor, mode: 'insensitive' } },
        { category: { description: { contains: searchFor, mode: 'insensitive' } } },
        { account: { description: { contains: searchFor, mode: 'insensitive' } } },
        { files: { some: { items: { some: { description: { contains: searchFor, mode: 'insensitive' } } } } } },
        { tags: { has: searchFor } }
      ]
    } : {})
  })

  const keyboard = transactions.map((t) => {
    const isNormal = t.type === 'EXPENSE' || t.type === 'DEPOSIT'
    const spanishDate = dayjs(isNormal ? t.paidAt : t.createdAt).tz(user.timezone).format('D MMM YY')
    return [{ text: `${TRANSACTION_TYPE_ICON[t.type]} ${t.description} [${spanishDate}]`, callback_data: `transaction_view_${t.id}` }]
  })

  if (!!query) {
    await bot.editMessageText(`🔎 Transacciones`, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [...keyboard, menuBtn]
      }
    })

    return
  }

  await bot.sendMessage(chatId, `🔎 Transacciones`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [...keyboard, menuBtn]
    }
  })
}