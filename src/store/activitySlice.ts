import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { TrackedActivity } from '../types'

interface ActivityState {
  current: TrackedActivity | null
  history: TrackedActivity[]
  closing: boolean
}

const initialState: ActivityState = {
  current: null,
  history: [],
  closing: false,
}

export const loadCurrentActivity = createAsyncThunk('activity/loadCurrent', async () => {
  return window.api.getCurrentActivity()
})

export const loadHistory = createAsyncThunk('activity/loadHistory', async () => {
  return window.api.getHistory()
})

export const openActivity = createAsyncThunk(
  'activity/open',
  async ({
    taskId,
    taskName,
    projectId,
    projectName,
  }: {
    taskId: number
    taskName: string
    projectId: number
    projectName: string
  }) => {
    return window.api.openActivity(taskId, taskName, projectId, projectName)
  }
)

export const closeActivity = createAsyncThunk(
  'activity/close',
  async ({ activityId, description }: { activityId: string; description: string }) => {
    return window.api.closeActivity(activityId, description)
  }
)

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCurrentActivity.fulfilled, (state, action) => {
        state.current = action.payload
      })
      .addCase(loadHistory.fulfilled, (state, action) => {
        state.history = action.payload
      })
      .addCase(openActivity.fulfilled, (state, action) => {
        state.current = action.payload
      })
      .addCase(closeActivity.pending, (state) => {
        state.closing = true
      })
      .addCase(closeActivity.fulfilled, (state, action) => {
        state.current = null
        state.closing = false
        if (action.payload) {
          state.history = [action.payload, ...state.history]
        }
      })
      .addCase(closeActivity.rejected, (state) => {
        state.closing = false
      })
  },
})

export default activitySlice.reducer
