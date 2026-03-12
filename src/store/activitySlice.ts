import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { TrackedActivity } from '../types'

interface ActivityState {
  current: TrackedActivity | null
  paused: TrackedActivity[]
  history: TrackedActivity[]
  closing: boolean
}

const initialState: ActivityState = {
  current: null,
  paused: [],
  history: [],
  closing: false,
}

export const loadCurrentActivity = createAsyncThunk('activity/loadCurrent', async () => {
  return window.api.getCurrentActivity()
})

export const loadPausedActivities = createAsyncThunk('activity/loadPaused', async () => {
  return window.api.getPausedActivities()
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
    const current = await window.api.openActivity(taskId, taskName, projectId, projectName)
    const paused = await window.api.getPausedActivities()
    return { current, paused }
  }
)

export const pauseActivity = createAsyncThunk(
  'activity/pause',
  async (activityId: string) => {
    await window.api.pauseActivity(activityId)
    return window.api.getPausedActivities()
  }
)

export const resumeActivity = createAsyncThunk(
  'activity/resume',
  async (activityId: string) => {
    const current = await window.api.resumeActivity(activityId)
    const paused = await window.api.getPausedActivities()
    return { current, paused }
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
      .addCase(loadPausedActivities.fulfilled, (state, action) => {
        state.paused = action.payload
      })
      .addCase(loadHistory.fulfilled, (state, action) => {
        state.history = action.payload
      })
      .addCase(openActivity.fulfilled, (state, action) => {
        state.current = action.payload.current
        state.paused = action.payload.paused
      })
      .addCase(pauseActivity.fulfilled, (state, action) => {
        state.current = null
        state.paused = action.payload
      })
      .addCase(resumeActivity.fulfilled, (state, action) => {
        state.current = action.payload.current
        state.paused = action.payload.paused
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
