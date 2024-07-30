import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export async function bookAddPress(params: ConversationProps) {
  const { query, user, bot, conversation, firstName, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  await xprisma.conversation.waiting(conversation.id)

  await bot.editMessageText(`¡Hola ${firstName}!\n\nAquí está el ID de usuario que necesitas compartir:\n\n<code>${user.id}</code>.\n\nPara compartir el libro dile a tu amigo que sigue estos pasos:\n1. Ve a "Ver y Seleccionar Libro".\n2. Selecciona el libro.\n3. Ve a "Compartir y Permisos".\n4. Pega el ID de usuario.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}