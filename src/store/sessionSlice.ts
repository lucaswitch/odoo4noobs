import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Session } from '../types'

interface SessionState {
  session: Session | null
  loading: boolean
  error: string | null
}

const initialState: SessionState = {
  session: null,
  loading: false,
  error: null,
}

export const checkSession = createAsyncThunk('session/check', async (_, { getState }) => {
  const state = getState() as { session: SessionState }
  const saved = state.session.session
  if (!saved) return null

  // Validate session is still good by re-authenticating
  try {
    const result = await window.api.checkSession()
    return result
  } catch {
    return null
  }
})

export const login = createAsyncThunk(
  'session/login',
  async ({ url, login, password }: { url: string; login: string; password: string }) => {
    const session = await window.api.login(url.replace(/\/+$/, ''), login, password)
    return session
  }
)

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    logout(state) {
      state.session = null
      state.error = null
    },
    setSession(state, action: PayloadAction<Session>) {
      state.session = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkSession.pending, (state) => {
        state.loading = true
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        state.session = action.payload
        state.loading = false
      })
      .addCase(checkSession.rejected, (state) => {
        state.session = null
        state.loading = false
      })
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.session = action.payload
        state.loading = false
        state.error = null
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Falha ao conectar'
      })
  },
})

export const { logout, setSession } = sessionSlice.actions
export default sessionSlice.reducer
