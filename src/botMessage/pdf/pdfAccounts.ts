import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function pdfAccounts(params: ConversationPropsWithBookSelected) {
  const { query, chatId, bot } = params

  if (!query) {
    throw new Error('query is required')
  }

  await bot.sendMessage(chatId, 'Pagina en construcción')
}