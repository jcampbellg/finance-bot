import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { TRANSACTION_TYPE_ICON } from '@utils/constant'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function searchButtonMessage(params: ConversationPropsWithBookSelected) {
  const { query, bot, chatId, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const isCategory = query.data.startsWith('search_category_')

  const itemId = query.data.replace('search_category_', '').replace('search_account_', '')

  const transactions = await xprisma.transaction.findMany(user, {
    [isCategory ? 'categoryId' : 'accountId']: itemId,
  })

  await bot.editMessageText(`🔎 Transacciones`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: transactions.map((t) => {
        const isNormal = t.type === 'EXPENSE' || t.type === 'DEPOSIT'
        const spanishDate = dayjs(isNormal ? t.paidAt : t.createdAt).tz(user.timezone).format('D MMM YY')
        return [{ text: `${TRANSACTION_TYPE_ICON[t.type]} ${t.description} [${spanishDate}]`, callback_data: `transaction_view_${t.id}` }]
      })
    }
  })
}