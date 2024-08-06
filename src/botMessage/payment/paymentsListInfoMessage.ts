import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import menuBtn from '@buttons/menuBtn'


export default async function paymentsListInfoMessage(params: ConversationPropsWithBookSelected) {
  const { bot, query, chatId, user } = params

  const payments = await xprisma.payment.findMany(user)

  const paymentsText = payments.map((p, i) => {
    const paid = p.transactions.filter(t => !!t.paidAt).length
    const all = p.transactions.length

    return `${i + 1}. ${p.description}${!!p.transactions.length ? ` (${paid} Pagos / ${all} facturas)` : ''}`
  }).join('\n')

  const botText = `<b>Pagos</b>\n\n${paymentsText}`

  if (query) {
    await bot.editMessageText(botText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [menuBtn]
      }
    })
    return
  }

  await bot.sendMessage(chatId, botText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}