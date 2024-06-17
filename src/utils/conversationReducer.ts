import { createSlice } from '@reduxjs/toolkit'

const conversationSlice = createSlice({
  name: 'conversations',
  initialState: [],
  reducers: {
    newUser(state: any, action: any) {
      state.push({
        chatId: action.payload.chatId,
      })
    }
  }
})

export const { newUser } = conversationSlice.actions
export default conversationSlice.reducer