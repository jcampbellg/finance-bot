import endBtn from '@buttons/endBtn'
import { ConversationProps } from '@customTypes/messageTypes'

export default async function noAttachmentError(params: ConversationProps) {
  const { bot, chatId } = params

  await bot.sendMessage(chatId, `Para continuar, asegúrate de enviar un documento o foto.`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}